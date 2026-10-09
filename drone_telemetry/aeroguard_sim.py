#!/usr/bin/env python3
"""
AeroGuard - fast crash-prediction + distance-estimation prototype simulator.

Pipeline (mirrors the hardware):
  synthetic MPU6050 (100 Hz, +-8 g / +-1000 dps) -> complementary filter ->
  0.5 s window features -> small Random Forest (exported to C for STM32) ->
  debounce -> CRASH ALERT -> fall-height + horizontal-range estimate.

Run:  python3 aeroguard_sim.py            (about a minute, writes files next to script)
"""
import numpy as np, json, sys, time
from sklearn.ensemble import RandomForestClassifier
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import f1_score, precision_score, recall_score
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

G = 9.81
FS = 100.0               # Hz, ESP32 streaming rate
DT = 1.0 / FS
WIN = 50                 # 0.5 s window
STRIDE = 10              # new decision every 0.1 s
VT = 30.0                # assumed terminal velocity (m/s) for drag-corrected fall model
rng = np.random.default_rng(7)


# ----------------------------------------------------------------- physics sim
def rot(roll, pitch, yaw):
    cr, sr, cp, sp, cy, sy = np.cos(roll), np.sin(roll), np.cos(pitch), np.sin(pitch), np.cos(yaw), np.sin(yaw)
    return np.array([[cy*cp, cy*sp*sr - sy*cr, cy*sp*cr + sy*sr],
                     [sy*cp, sy*sp*sr + cy*cr, sy*sp*cr - cy*sr],
                     [-sp,   cp*sr,            cp*cr]])


def simulate(kind, dur=14.0):
    """Returns dict with noisy imu (N,6) [ax ay az in g, gx gy gz in dps], labels, truth."""
    n = int(dur * FS)
    t = np.arange(n) * DT
    # ---- normal-flight attitude commands (smooth sinusoids) ----
    agg = 1.0 if kind in ("normal_aggr", "crash_motor", "crash_tumble", "crash_collision") else 0.5
    if kind == "normal_aggr":
        agg = 1.0
    amp = rng.uniform(8, 22) * agg if kind != "normal_aggr" else rng.uniform(25, 45)
    f1, f2, f3 = rng.uniform(0.15, 0.6, 3)
    ph = rng.uniform(0, 6.28, 4)
    roll_c = np.radians(amp) * np.sin(2*np.pi*f1*t + ph[0])
    pitch_c = np.radians(amp) * np.sin(2*np.pi*f2*t + ph[1])
    yaw_rate_c = np.radians(rng.uniform(10, 90 if kind == "normal_aggr" else 40)) * np.sin(2*np.pi*f3*t + ph[2])
    thr_punch = (0.25 if kind == "normal_aggr" else 0.08) * np.sin(2*np.pi*rng.uniform(0.3, 1.2)*t + ph[3])

    onset = None
    mode = "flight"
    if kind.startswith("crash"):
        onset = int(rng.uniform(4.0, 7.0) * FS)
    h0 = rng.uniform(6, 45)                     # altitude when flight begins (m)
    pos = np.array([0.0, 0.0, h0])
    vel = np.array([rng.uniform(-3, 3), rng.uniform(-3, 3), 0.0])
    roll = pitch = yaw = 0.0
    rates_b = np.zeros(3)
    spin_axis = rng.normal(size=3); spin_axis /= np.linalg.norm(spin_axis)
    spin_rate = np.radians(rng.uniform(250, 900)) if kind == "crash_motor" else np.radians(rng.uniform(150, 500))
    spin_tau = rng.uniform(0.15, 0.5)
    imu = np.zeros((n, 6)); label = np.zeros(n, int)
    traj = np.zeros((n, 3)); vtraj = np.zeros((n, 3)); fall_state = np.zeros(n, int)
    impact_idx = None; thrust_on = True
    prev_roll_c = prev_pitch_c = 0.0
    last = n
    for i in range(n):
        crashing = onset is not None and i >= onset and impact_idx is None
        R = rot(roll, pitch, yaw)
        if impact_idx is not None:
            # lying on ground after impact: small rattle
            f_b = np.array([0, 0, 1.0]) @ np.eye(3) + rng.normal(0, 0.02, 3)
            f_b = R.T @ np.array([0, 0, 1.0])
            rates_b = rates_b * 0.8 + rng.normal(0, 2, 3) * DT * 0
            vel[:] = 0
        else:
            if not crashing:
                # simple attitude-tracking: body rates follow command derivative
                rc = (roll_c[i] - prev_roll_c) / DT; pc = (pitch_c[i] - prev_pitch_c) / DT
                prev_roll_c, prev_pitch_c = roll_c[i], pitch_c[i]
                rates_b = np.array([ (roll_c[i]-roll)*6 + rc*0.3, (pitch_c[i]-pitch)*6 + pc*0.3, yaw_rate_c[i]])
                tilt_cos = max(np.cos(roll) * np.cos(pitch), 0.5)
                T = G * (1.0 + thr_punch[i]) / tilt_cos
                T = np.clip(T, 0, 2.2 * G)
                thrust_vec = R @ np.array([0, 0, T])
                # hold altitude: damp vertical drift
                thrust_vec[2] += -2.0 * vel[2] - 0.3 * (h0 - pos[2])
                if kind == "crash_collision" and onset is not None and i == onset:
                    pass
                a_drag = -0.01 * np.linalg.norm(vel) * vel
                a_w = thrust_vec - np.array([0, 0, G]) + a_drag
                f_b = R.T @ (a_w + np.array([0, 0, G]) - a_drag)   # specific force (no drag in sensor model) -> thrust only
                f_b = R.T @ thrust_vec / G
                f_b = f_b
            else:
                # loss of thrust: motor-fail / tumble / collision scenario
                k = (i - onset) * DT
                if kind == "crash_motor":
                    rates_b = spin_axis * spin_rate * (1 - np.exp(-k / spin_tau))
                    T = G * max(0.0, 1.0 - k / 0.4) * 0.5       # partial thrust fades
                elif kind == "crash_tumble":      # flip-over, power loss soon after
                    rates_b = spin_axis * spin_rate * (1 - np.exp(-k / spin_tau))
                    T = G * max(0.0, 1.0 - k / 0.25) * 0.8
                else:                              # collision with obstacle: lateral kick then loss of control
                    if k < 0.05:
                        vel[:2] += rng.uniform(-4, 4, 2) * DT / 0.05
                    rates_b = spin_axis * np.radians(rng.uniform(100, 400)) * (1 - np.exp(-k / 0.3))
                    T = G * max(0.0, 0.8 - k / 0.5) * 0.6
                if kind == "crash_battery":
                    rates_b = np.zeros(3); T = 0.0
                thrust_vec = R @ np.array([0, 0, T])
                a_drag = -0.01 * np.linalg.norm(vel) * vel
                a_w = thrust_vec - np.array([0, 0, G]) + a_drag
                # accelerometer senses thrust + a little aerodynamic drag on a tumbling body
                f_b = (R.T @ (thrust_vec + a_drag)) / G
                fall_state[i] = 1
            # kinematics
            a_w = thrust_vec - np.array([0, 0, G]) + (-0.01 * np.linalg.norm(vel) * vel)
            vel = vel + a_w * DT
            pos = pos + vel * DT
            # ground impact
            if pos[2] <= 0 and (crashing or i > 0) and onset is not None and crashing:
                pos[2] = 0
                impact_idx = i
        # attitude integrate (body rates -> euler approx via rotation update)
        w = rates_b
        if impact_idx is None or impact_idx == i:
            # rotation matrix integrate
            wx = np.array([[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]])
            Rn = R @ (np.eye(3) + wx * DT)
            u, _, vt = np.linalg.svd(Rn); Rn = u @ vt
            pitch = -np.arcsin(np.clip(Rn[2, 0], -1, 1)); roll = np.arctan2(Rn[2, 1], Rn[2, 2]); yaw = np.arctan2(Rn[1, 0], Rn[0, 0])
        f = f_b.copy()
        if impact_idx == i:
            f = f + rng.uniform(-1, 1, 3) * 0 + (R.T @ np.array([0, 0, 1.0])) * rng.uniform(8, 22)
        # sensor model: noise + prop vibration + bias, quantised by clipping range
        vib = 0.06 * np.sin(2*np.pi*rng.uniform(30, 45)*t[i]) * (1 if thrust_on else 0.0) if i % 1 == 0 else 0
        f = f + rng.normal(0, 0.035, 3) + vib * np.array([1, 1, 1.4]) * (1 if impact_idx is None else 0.2)
        gyro = np.degrees(rates_b) + rng.normal(0, 0.4, 3) + np.array([0.6, -0.4, 0.3])
        imu[i, :3] = np.clip(f, -8, 8); imu[i, 3:] = np.clip(gyro, -1000, 1000)
        traj[i] = pos; vtraj[i] = vel
        if impact_idx is not None and i > impact_idx + 60:
            last = i; break
        if crashing:
            label[i] = 1
    n_eff = last if last < n else n
    # if flight ended on crash, label all post-onset until impact as 1; keep post-impact as 1 too (already crashed)
    if onset is not None and impact_idx is not None:
        label[onset:impact_idx + 1] = 1
        label[impact_idx + 1:] = 1
    return dict(kind=kind, imu=imu[:n_eff], label=label[:n_eff], onset=onset, impact=impact_idx,
                pos=traj[:n_eff], vel=vtraj[:n_eff])


# ---------------------------------------------------------------- estimators
class ComplementaryAHRS:
    """Gyro-dominant tilt filter. Accel correction is *gated*: only used when |a|~1 g,
    because in powered flight the accelerometer reads thrust, not gravity."""
    def __init__(self, alpha=0.98):
        self.R = np.eye(3); self.alpha = alpha

    def update(self, a_g, gyro_dps):
        w = np.radians(gyro_dps)
        wx = np.array([[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]])
        Rn = self.R @ (np.eye(3) + wx * DT)
        u, _, vt = np.linalg.svd(Rn); Rn = u @ vt
        mag = np.linalg.norm(a_g)
        if 0.9 < mag < 1.1:
            up_meas = a_g / mag
            up_est = Rn.T @ np.array([0, 0, 1.0])
            corr = np.cross(up_est, up_meas) * (1 - self.alpha)
            wc = np.array([[0, -corr[2], corr[1]], [corr[2], 0, -corr[0]], [-corr[1], corr[0], 0]])
            Rn = Rn @ (np.eye(3) + wc)
            u, _, vt = np.linalg.svd(Rn); Rn = u @ vt
        self.R = Rn
        return np.degrees(np.arccos(np.clip(Rn[2, 2], -1, 1)))   # tilt from vertical


def window_features(a, g, tilt):
    """a:(W,3) g, g:(W,3) dps, tilt:(W,) deg  ->  1-D feature vector (13 features, cheap on a Cortex-M3)."""
    am = np.linalg.norm(a, axis=1)
    gm = np.linalg.norm(g, axis=1)
    jerk = np.linalg.norm(np.diff(a, axis=0), axis=1) / DT
    hp = a - a.mean(axis=0)
    return np.array([
        am.mean(), am.min(), am.max(), am.std(),             # specific-force magnitude stats
        (am < 0.35).mean(),                                  # free-fall fraction
        np.sqrt((hp ** 2).sum(axis=1).mean()),               # vibration RMS
        jerk.mean(), jerk.max(),
        gm.mean(), gm.max(), gm.std(),                       # rotation energy
        tilt[-1], tilt[-1] - tilt[0],                        # attitude + its trend
    ])


FEATS = ["a_mean", "a_min", "a_max", "a_std", "freefall_frac", "vib_rms", "jerk_mean", "jerk_max",
         "g_mean", "g_max", "g_std", "tilt", "tilt_delta"]


def build_windows(sc):
    imu, lab = sc["imu"], sc["label"]
    ahrs = ComplementaryAHRS(); tilt = np.zeros(len(imu))
    for i in range(len(imu)):
        tilt[i] = ahrs.update(imu[i, :3], imu[i, 3:])
    X, y, idx = [], [], []
    for e in range(WIN, len(imu) + 1, STRIDE):
        s = e - WIN
        X.append(window_features(imu[s:e, :3], imu[s:e, 3:], tilt[s:e]))
        # target: "loss-of-control" = any of the newest 20 samples is post-onset (so we fire EARLY, not at impact)
        y.append(int(lab[e - 20:e].max()))
        idx.append(e)
    return np.array(X), np.array(y), np.array(idx), tilt


# ----------------------------------------------------------- distance methods
def fall_height(t_free, vt=VT):
    """Drag-corrected free-fall height. Exact solution of dv/dt = g - (g/vt^2) v^2 ."""
    return (vt ** 2 / G) * np.log(np.cosh(G * t_free / vt))


def horizontal_velocity_estimate(imu, upto, tilt_R_hist):
    """Short-window leaky integration of gravity-compensated acceleration.
    a_world = R * f_b * g - g_vec ; leak removes drift (time-constant 3 s). Returns v_h (2,)"""
    v = np.zeros(2); tau = 3.0
    lo = max(0, upto - int(6 * FS))
    for i in range(lo, upto):
        a_w = (tilt_R_hist[i] @ (imu[i, :3] * G)) - np.array([0, 0, G])
        v = v * (1 - DT / tau) + a_w[:2] * DT
    return v


def run_estimators(sc, detect_idx):
    """Returns (est_fall_height, est_horizontal_range, true_fall_height, true_range) for a crash scenario."""
    imu = sc["imu"]
    ahrs = ComplementaryAHRS(); Rh = []
    for i in range(len(imu)):
        ahrs.update(imu[i, :3], imu[i, 3:]); Rh.append(ahrs.R.copy())
    # free-fall time = from detection onset to impact (impact found as the g-spike)
    am = np.linalg.norm(imu[:, :3], axis=1)
    imp = detect_idx + int(np.argmax(am[detect_idx:] > 5.0)) if (am[detect_idx:] > 5.0).any() else None
    if imp is None:
        return None
    # onset refinement: walk back from detection while |a| is still small/changing
    on = detect_idx
    while on > 0 and am[on - 1] < 0.6:
        on -= 1
    t_free = (imp - on) * DT
    h_est = fall_height(t_free)
    v_h = horizontal_velocity_estimate(imu, on, Rh)
    # horizontal travel during fall (drag slows it a bit: scale by mean/initial velocity ratio)
    range_est = np.linalg.norm(v_h) * t_free * 0.9
    true_h = sc["pos"][sc["onset"], 2] - 0.0
    true_range = np.linalg.norm(sc["pos"][sc["impact"], :2] - sc["pos"][sc["onset"], :2])
    return h_est, range_est, true_h, true_range, t_free


# ------------------------------------------------------------------- export
def export_rf_to_c(rf, path, n_feat):
    lines = ["/* Auto-generated by aeroguard_sim.py - Random Forest crash classifier for STM32 (no dependencies).",
             "   Feature order:  " + ", ".join(FEATS), "   Returns crash probability in [0,1]. */",
             "#ifndef CRASH_MODEL_H", "#define CRASH_MODEL_H", ""]
    for k, est in enumerate(rf.estimators_):
        tr = est.tree_
        lines.append(f"static inline float tree_{k}(const float *x) {{")
        def rec(node, ind):
            pad = "  " * ind
            if tr.children_left[node] == -1:
                v = tr.value[node][0]; p = v[1] / v.sum()
                lines.append(f"{pad}return {p:.4f}f;")
            else:
                lines.append(f"{pad}if (x[{tr.feature[node]}] <= {tr.threshold[node]:.5f}f) {{")
                rec(tr.children_left[node], ind + 1)
                lines.append(f"{pad}}} else {{")
                rec(tr.children_right[node], ind + 1)
                lines.append(f"{pad}}}")
        rec(0, 1)
        lines.append("}")
    lines += ["", "static inline float crash_probability(const float *x) {", "  float s = 0.0f;"]
    lines += [f"  s += tree_{k}(x);" for k in range(len(rf.estimators_))]
    lines += [f"  return s / {len(rf.estimators_)}.0f;", "}", "", "#endif"]
    open(path, "w").write("\n".join(lines))


# ---------------------------------------------------------------------- main
def main():
    t0 = time.time()
    kinds_normal = ["normal_gentle", "normal_aggr"]
    kinds_crash = ["crash_motor", "crash_tumble", "crash_battery", "crash_collision"]
    def make(n_norm, n_crash):
        return ([simulate(rng.choice(kinds_normal)) for _ in range(n_norm)] +
                [simulate(k) for k in kinds_crash for _ in range(n_crash)])
    train_sc = make(60, 30); test_sc = make(40, 20)
    def stack(scs):
        Xs, ys = [], []
        for s in scs:
            X, y, _, _ = build_windows(s); Xs.append(X); ys.append(y)
        return np.vstack(Xs), np.concatenate(ys)
    Xtr, ytr = stack(train_sc)
    print(f"train windows {Xtr.shape}, crash share {ytr.mean():.2f}  ({time.time()-t0:.0f}s)")

    models = {
        "LDA (baseline)": LinearDiscriminantAnalysis(),
        "Decision tree (d5)": DecisionTreeClassifier(max_depth=5, class_weight="balanced", random_state=0),
        "Random Forest (12 trees, d6)": RandomForestClassifier(n_estimators=12, max_depth=6, class_weight="balanced",
                                                               min_samples_leaf=5, random_state=0),
    }
    for m in models.values():
        m.fit(Xtr, ytr)
    rf = models["Random Forest (12 trees, d6)"]
    export_rf_to_c(rf, "crash_model.h", Xtr.shape[1])

    # ---- evaluation at the EVENT level (what matters in the field) ----
    THRESH, K, N = 0.5, 3, 4          # prob threshold, need K positives within last N decisions
    results = {}
    for name, m in models.items():
        det, lead, false_alarms, normal_hours = 0, [], 0, 0.0
        n_crash = 0; wf1_t, wf1_p = [], []
        for sc in test_sc:
            X, y, idx, tilt = build_windows(sc)
            p = m.predict_proba(X)[:, 1]; wf1_t.append(y); wf1_p.append(p >= THRESH)
            hits = (p >= THRESH).astype(int)
            alert = None
            for j in range(len(hits)):
                if hits[max(0, j - N + 1):j + 1].sum() >= K:
                    alert = idx[j]; break
            if sc["onset"] is None:
                normal_hours += len(sc["imu"]) / FS / 3600
                if alert is not None: false_alarms += 1
            else:
                n_crash += 1
                if alert is not None and alert <= sc["impact"]:
                    det += 1; lead.append((sc["impact"] - alert) * DT)
        yt = np.concatenate(wf1_t); yp = np.concatenate(wf1_p)
        results[name] = dict(window_f1=f1_score(yt, yp), window_recall=recall_score(yt, yp),
                             window_precision=precision_score(yt, yp),
                             detection_rate=det / n_crash, mean_lead_s=float(np.mean(lead)) if lead else 0.0,
                             p10_lead_s=float(np.percentile(lead, 10)) if lead else 0.0,
                             false_alarm_flights=f"{false_alarms}/{sum(1 for s in test_sc if s['onset'] is None)}")
        print(f"\n{name}\n  " + json.dumps(results[name], indent=2).replace("\n", "\n  "))

    # ---- distance estimation on detected crashes ----
    eh, th, er, tr_, tf = [], [], [], [], []
    ex = None
    for sc in test_sc:
        if sc["onset"] is None or sc["impact"] is None: continue
        X, y, idx, tilt = build_windows(sc)
        p = rf.predict_proba(X)[:, 1]
        hits = (p >= THRESH).astype(int); alert = None
        for j in range(len(hits)):
            if hits[max(0, j - N + 1):j + 1].sum() >= K: alert = idx[j]; break
        if alert is None or alert > sc["impact"]: continue
        r = run_estimators(sc, alert)
        if r is None: continue
        eh.append(r[0]); er.append(r[1]); th.append(r[2]); tr_.append(r[3]); tf.append(r[4])
        if ex is None and sc["kind"] == "crash_motor": ex = (sc, alert, p, idx, tilt)
    eh, er, th, tr_ = map(np.array, (eh, er, th, tr_))
    h_err = np.abs(eh - th); r_err = np.abs(er - tr_)
    print(f"\nDISTANCE  ({len(eh)} detected crashes)")
    print(f"  fall height : median abs err {np.median(h_err):.2f} m, 90th pct {np.percentile(h_err, 90):.2f} m "
          f"(true heights {th.min():.0f}-{th.max():.0f} m, median rel err {np.median(h_err/th)*100:.0f}%)")
    print(f"  horiz range : median abs err {np.median(r_err):.2f} m, 90th pct {np.percentile(r_err, 90):.2f} m "
          f"(true range median {np.median(tr_):.1f} m)")
    results["distance"] = dict(fall_height_median_err_m=float(np.median(h_err)), fall_height_p90_err_m=float(np.percentile(h_err, 90)),
                               fall_height_median_rel_err=float(np.median(h_err / th)),
                               range_median_err_m=float(np.median(r_err)), range_p90_err_m=float(np.percentile(r_err, 90)),
                               range_true_median_m=float(np.median(tr_)))
    json.dump(results, open("results.json", "w"), indent=2)

    # ---- plot: one example crash + scatter of fall-height estimates ----
    sc, alert, p, idx, tilt = ex
    imu = sc["imu"]; t = np.arange(len(imu)) * DT
    fig, ax = plt.subplots(2, 2, figsize=(12, 7.5))
    INK, MUT, C1, C2, C3 = "#1f2933", "#6b7785", "#2563eb", "#d97706", "#dc2626"
    a_ = ax[0, 0]; a_.plot(t, np.linalg.norm(imu[:, :3], axis=1), color=C1, lw=1)
    a_.axvline(sc["onset"]*DT, color=MUT, ls=":"); a_.axvline(sc["impact"]*DT, color=C3, ls="--")
    a_.axvline(alert*DT, color=C2, lw=2)
    a_.set_title("Accelerometer magnitude (g)", loc="left", fontsize=11, color=INK)
    a_.text(sc["onset"]*DT, a_.get_ylim()[1]*0.92, " fault starts", color=MUT, fontsize=9)
    a_.text(alert*DT, a_.get_ylim()[1]*0.75, " ALERT", color=C2, fontsize=9, fontweight="bold")
    a_.text(sc["impact"]*DT, a_.get_ylim()[1]*0.55, " impact", color=C3, fontsize=9)
    b_ = ax[0, 1]; b_.plot(t, np.linalg.norm(imu[:, 3:], axis=1), color=C1, lw=1)
    b_.axvline(alert*DT, color=C2, lw=2); b_.axvline(sc["impact"]*DT, color=C3, ls="--")
    b_.set_title("Gyro magnitude (deg/s)", loc="left", fontsize=11, color=INK)
    c_ = ax[1, 0]; c_.plot(idx*DT, p, color=C1, lw=1.5); c_.axhline(THRESH, color=MUT, ls=":")
    c_.axvline(alert*DT, color=C2, lw=2); c_.axvline(sc["impact"]*DT, color=C3, ls="--")
    c_.set_title("Random-forest crash probability", loc="left", fontsize=11, color=INK); c_.set_xlabel("time (s)")
    d_ = ax[1, 1]; d_.scatter(th, eh, s=14, color=C1, alpha=0.7)
    lim = [0, max(th.max(), eh.max()) * 1.05]; d_.plot(lim, lim, color=MUT, ls=":")
    d_.set_title("Fall height: estimated vs true (m)", loc="left", fontsize=11, color=INK)
    d_.set_xlabel("true (m)"); d_.set_ylabel("estimated from free-fall time (m)")
    for a in ax.ravel():
        for s in ("top", "right"): a.spines[s].set_visible(False)
        a.tick_params(colors=MUT, labelsize=9); a.grid(alpha=0.15)
    plt.tight_layout(); plt.savefig("aeroguard_results.png", dpi=140)
    print(f"\nDone in {time.time()-t0:.0f}s -> crash_model.h, results.json, aeroguard_results.png")


if __name__ == "__main__":
    main()
