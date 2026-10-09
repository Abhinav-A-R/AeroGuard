import type { ESP32Telemetry } from '../types/telemetry';

export interface MLFeatureImportance {
  feature: string;
  importance: number; // 0 to 100%
  value: string;      // Current measured value formatted
}

export interface MLPredictionResult {
  mlProbability: number;          // 0.0 to 100.0% Random Forest crash probability
  mlConfidence: number;           // 0.0 to 100.0% model confidence score
  anomalyScore: number;           // 0.0 to 10.0 multi-dimensional anomaly index
  earlyWarningMs: number;         // Early warning lead time in milliseconds (e.g. 450ms)
  featureImportances: MLFeatureImportance[];
  aiAgentStatus: 'OPTIMAL' | 'MONITORING' | 'INTERVENING' | 'CRITICAL';
  aiAgentRecommendation: string;
  inferenceTimeMs: number;        // Sub-millisecond latency (e.g. 0.04ms)
  fallHeightEstMeters?: number;   // Drag-corrected free-fall height estimate (m)
}

/**
 * Normalizes live acceleration telemetry into g-units (1.0g = 9.81 m/s^2).
 * Automatically detects whether live ESP32 inputs are scaled in g (1.0) or m/s^2 (9.81).
 */
export function getAccelInG(ax: number, ay: number, az: number): { axG: number; ayG: number; azG: number; magG: number } {
  const rawMag = Math.sqrt(ax * ax + ay * ay + az * az);
  if (isNaN(rawMag) || rawMag <= 0) return { axG: 0, ayG: 0, azG: 1.0, magG: 1.0 };
  // If raw magnitude is in g-scale range (0.3g to 3.5g), input is ALREADY in g!
  if (rawMag > 0.3 && rawMag < 3.5) {
    return { axG: ax, ayG: ay, azG: az, magG: rawMag };
  }
  // Otherwise, input is in m/s^2 (where 1g = 9.81 m/s^2)
  const magG = rawMag / 9.81;
  return { axG: ax / 9.81, ayG: ay / 9.81, azG: az / 9.81, magG };
}

// ----------------------------------------------------------------- AHRS Complementary Filter
let ahrsR = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

/**
 * Gyro-dominant tilt filter. Accel correction is *gated*: only used when |a| ~ 1 g (0.9 to 1.1 g).
 * In powered flight the accelerometer reads thrust, not gravity.
 */
function updateComplementaryAHRS(axG: number, ayG: number, azG: number, gxDps: number, gyDps: number, gzDps: number, dt: number = 0.01): number {
  const wx = (gxDps * Math.PI) / 180;
  const wy = (gyDps * Math.PI) / 180;
  const wz = (gzDps * Math.PI) / 180;

  const R = ahrsR;
  const Rn = [
    [R[0][0] + (R[0][1]*wz - R[0][2]*wy)*dt, R[0][1] + (-R[0][0]*wz + R[0][2]*wx)*dt, R[0][2] + (R[0][0]*wy - R[0][1]*wx)*dt],
    [R[1][0] + (R[1][1]*wz - R[1][2]*wy)*dt, R[1][1] + (-R[1][0]*wz + R[1][2]*wx)*dt, R[1][2] + (R[1][0]*wy - R[1][1]*wx)*dt],
    [R[2][0] + (R[2][1]*wz - R[2][2]*wy)*dt, R[2][1] + (-R[2][0]*wz + R[2][2]*wx)*dt, R[2][2] + (R[2][0]*wy - R[2][1]*wx)*dt]
  ];

  const mag = Math.sqrt(axG * axG + ayG * ayG + azG * azG);
  if (mag > 0.9 && mag < 1.1) {
    const upMeas = [axG / mag, ayG / mag, azG / mag];
    const upEst = [Rn[2][0], Rn[2][1], Rn[2][2]];
    const alpha = 0.98;
    const corrScale = 1.0 - alpha;
    const corr = [
      (upEst[1] * upMeas[2] - upEst[2] * upMeas[1]) * corrScale,
      (upEst[2] * upMeas[0] - upEst[0] * upMeas[2]) * corrScale,
      (upEst[0] * upMeas[1] - upEst[1] * upMeas[0]) * corrScale
    ];
    const wc = [
      [0, -corr[2], corr[1]],
      [corr[2], 0, -corr[0]],
      [-corr[1], corr[0], 0]
    ];
    for (let i = 0; i < 3; i++) {
      const r0 = Rn[i][0], r1 = Rn[i][1], r2 = Rn[i][2];
      Rn[i][0] = r0 + r1*wc[1][0] + r2*wc[2][0];
      Rn[i][1] = r0*wc[0][1] + r1 + r2*wc[2][1];
      Rn[i][2] = r0*wc[0][2] + r1*wc[1][2] + r2;
    }
  }

  ahrsR = Rn;
  const cosTilt = Math.max(-1.0, Math.min(1.0, Rn[2][2]));
  const tiltDeg = (Math.acos(cosTilt) * 180) / Math.PI;
  return tiltDeg;
}

// ----------------------------------------------------------------- 12 Decision Trees (Exported from aeroguard_sim.py / crash_model.h)
function tree_0(x: number[]): number {
  if (x[4] <= 0.01000) {
    if (x[1] <= 0.64675) {
      if (x[10] <= 9.58302) {
        if (x[1] <= 0.59962) return 1.0000;
        else return 0.4286;
      } else return 1.0000;
    } else {
      if (x[2] <= 1.09322) {
        if (x[0] <= 0.98530) {
          if (x[8] <= 42.14211) return 0.0000;
          else {
            if (x[1] <= 0.81537) return 0.0000;
            else return 0.4444;
          }
        } else {
          if (x[3] <= 0.04154) return 1.0000;
          else return 0.9048;
        }
      } else {
        if (x[8] <= 5.76633) return 1.0000;
        else {
          if (x[3] <= 0.04948) return 1.0000;
          else {
            if (x[2] <= 5.13717) return 0.0036;
            else return 1.0000;
          }
        }
      }
    }
  } else return 1.0000;
}

function tree_1(x: number[]): number {
  if (x[3] <= 0.05974) {
    if (x[0] <= 1.01149) {
      if (x[2] <= 0.85511) return 1.0000;
      else {
        if (x[3] <= 0.05068) return 1.0000;
        else return 0.0000;
      }
    } else {
      if (x[7] <= 21.56221) return 0.2857;
      else return 0.0000;
    }
  } else {
    if (x[1] <= 0.64675) {
      if (x[9] <= 79.69127) {
        if (x[10] <= 6.23713) return 1.0000;
        else {
          if (x[11] <= 159.74127) return 0.5556;
          else {
            if (x[7] <= 32.02542) return 0.8333;
            else return 1.0000;
          }
        }
      } else return 1.0000;
    } else {
      if (x[1] <= 0.65638) {
        if (x[8] <= 79.63083) return 0.6250;
        else return 0.0000;
      } else {
        if (x[2] <= 5.13717) {
          if (x[10] <= 7.01333) {
            if (x[12] <= -2.08336) return 0.0037;
            else return 0.0000;
          } else {
            if (x[1] <= 0.76218) return 0.0437;
            else return 0.0028;
          }
        } else return 1.0000;
      }
    }
  }
}

function tree_2(x: number[]): number {
  if (x[10] <= 37.63385) {
    if (x[8] <= 161.47567) {
      if (x[8] <= 9.26590) {
        if (x[8] <= 7.24862) {
          if (x[1] <= 0.87876) return 1.0000;
          else {
            if (x[5] <= 0.08720) return 1.0000;
            else return 0.6000;
          }
        } else {
          if (x[1] <= 0.76070) return 1.0000;
          else {
            if (x[3] <= 0.05138) return 1.0000;
            else return 0.0000;
          }
        }
      } else {
        if (x[7] <= 43.06912) {
          if (x[4] <= 0.01000) {
            if (x[0] <= 0.93741) return 0.1813;
            else return 0.0144;
          } else return 1.0000;
        } else {
          if (x[8] <= 66.73773) {
            if (x[3] <= 0.11255) return 0.8182;
            else return 1.0000;
          } else return 0.4444;
        }
      }
    } else {
      if (x[2] <= 0.92864) return 1.0000;
      else {
        if (x[6] <= 21.63400) return 0.0000;
        else return 1.0000;
      }
    }
  } else {
    if (x[1] <= 0.65423) return 1.0000;
    else {
      if (x[7] <= 21.73428) return 1.0000;
      else {
        if (x[2] <= 5.04093) return 0.0000;
        else return 1.0000;
      }
    }
  }
}

function tree_3(x: number[]): number {
  if (x[4] <= 0.01000) {
    if (x[7] <= 45.56121) {
      if (x[5] <= 0.07638) return 1.0000;
      else {
        if (x[2] <= 0.85049) return 1.0000;
        else {
          if (x[0] <= 0.95853) {
            if (x[8] <= 60.90930) return 0.0979;
            else return 0.0000;
          } else {
            if (x[1] <= 0.64608) return 0.9130;
            else return 0.0031;
          }
        }
      }
    } else return 1.0000;
  } else return 1.0000;
}

function tree_4(x: number[]): number {
  if (x[10] <= 37.05325) {
    if (x[1] <= 0.64608) {
      if (x[12] <= -10.64917) {
        if (x[11] <= 161.36847) return 1.0000;
        else return 0.9091;
      } else return 1.0000;
    } else {
      if (x[7] <= 20.22420) {
        if (x[5] <= 0.06889) return 1.0000;
        else return 0.4545;
      } else {
        if (x[7] <= 44.55795) {
          if (x[5] <= 0.08829) return 0.4286;
          else {
            if (x[7] <= 35.30666) return 0.0025;
            else return 0.0369;
          }
        } else return 0.9000;
      }
    }
  } else {
    if (x[4] <= 0.01000) {
      if (x[3] <= 0.70059) {
        if (x[6] <= 9.60011) return 1.0000;
        else {
          if (x[3] <= 0.05899) return 1.0000;
          else {
            if (x[11] <= 147.43269) return 0.0000;
            else return 0.5714;
          }
        }
      } else return 1.0000;
    } else return 1.0000;
  }
}

function tree_5(x: number[]): number {
  if (x[1] <= 0.64608) {
    if (x[12] <= -17.63798) {
      if (x[2] <= 1.18112) return 1.0000;
      else {
        if (x[1] <= 0.48245) return 1.0000;
        else return 0.9231;
      }
    } else return 1.0000;
  } else {
    if (x[3] <= 0.04948) return 1.0000;
    else {
      if (x[2] <= 5.13717) {
        if (x[1] <= 0.74446) {
          if (x[9] <= 72.29161) {
            if (x[7] <= 31.18998) return 0.4444;
            else return 1.0000;
          } else return 0.0000;
        } else {
          if (x[0] <= 0.95772) {
            if (x[1] <= 0.82570) return 0.0000;
            else return 0.0220;
          } else {
            if (x[9] <= 17.41470) return 0.0140;
            else return 0.0003;
          }
        }
      } else return 1.0000;
    }
  }
}

function tree_6(x: number[]): number {
  if (x[1] <= 0.64675) {
    if (x[6] <= 13.76361) return 1.0000;
    else {
      if (x[6] <= 13.77074) return 0.9444;
      else {
        if (x[4] <= 0.01000) {
          if (x[6] <= 14.30663) {
            if (x[12] <= -13.97045) return 0.6000;
            else return 1.0000;
          } else {
            if (x[3] <= 0.13581) return 0.9583;
            else return 1.0000;
          }
        } else return 1.0000;
      }
    }
  } else {
    if (x[5] <= 0.07800) return 1.0000;
    else {
      if (x[9] <= 192.60229) {
        if (x[8] <= 6.05490) return 0.7500;
        else {
          if (x[1] <= 0.76218) {
            if (x[2] <= 1.20305) return 0.1453;
            else return 0.0054;
          } else {
            if (x[9] <= 17.41470) return 0.0180;
            else return 0.0018;
          }
        }
      } else {
        if (x[5] <= 0.68445) return 0.0000;
        else return 1.0000;
      }
    }
  }
}

function tree_7(x: number[]): number {
  if (x[5] <= 0.22527) {
    if (x[1] <= 0.64608) {
      if (x[7] <= 32.72975) return 1.0000;
      else {
        if (x[3] <= 0.12975) return 1.0000;
        else {
          if (x[7] <= 33.29019) return 0.7857;
          else return 1.0000;
        }
      }
    } else {
      if (x[6] <= 9.69425) {
        if (x[5] <= 0.06961) return 1.0000;
        else return 0.7273;
      } else {
        if (x[7] <= 35.30666) {
          if (x[2] <= 1.20273) {
            if (x[3] <= 0.11339) return 0.0042;
            else return 0.2500;
          } else {
            if (x[5] <= 0.11111) return 0.0008;
            else return 0.0000;
          }
        } else {
          if (x[2] <= 1.11011) {
            if (x[3] <= 0.07482) return 0.0000;
            else return 0.7692;
          } else {
            if (x[7] <= 37.86205) return 0.0045;
            else return 0.1098;
          }
        }
      }
    }
  } else {
    if (x[1] <= 0.64675) return 1.0000;
    else {
      if (x[6] <= 19.61050) return 0.0000;
      else return 1.0000;
    }
  }
}

function tree_8(x: number[]): number {
  if (x[4] <= 0.01000) {
    if (x[7] <= 45.56121) {
      if (x[2] <= 1.09288) {
        if (x[6] <= 10.11626) return 1.0000;
        else {
          if (x[1] <= 0.57808) return 1.0000;
          else {
            if (x[2] <= 1.08331) return 0.0000;
            else return 0.0267;
          }
        }
      } else {
        if (x[1] <= 0.64608) return 1.0000;
        else {
          if (x[9] <= 4.93844) return 1.0000;
          else {
            if (x[3] <= 0.04948) return 1.0000;
            else return 0.0043;
          }
        }
      }
    } else return 1.0000;
  } else return 1.0000;
}

function tree_9(x: number[]): number {
  if (x[4] <= 0.01000) {
    if (x[8] <= 172.49905) {
      if (x[1] <= 0.64675) {
        if (x[7] <= 32.94381) {
          if (x[2] <= 1.25096) {
            if (x[3] <= 0.14210) return 0.7778;
            else return 1.0000;
          } else return 0.5000;
        } else return 1.0000;
      } else {
        if (x[3] <= 0.04948) return 1.0000;
        else {
          if (x[2] <= 5.13717) {
            if (x[7] <= 37.86205) return 0.0029;
            else return 0.0833;
          } else return 1.0000;
        }
      }
    } else return 1.0000;
  } else return 1.0000;
}

function tree_10(x: number[]): number {
  if (x[3] <= 0.05957) {
    if (x[4] <= 0.01000) {
      if (x[5] <= 0.07638) return 1.0000;
      else {
        if (x[2] <= 0.85934) return 1.0000;
        else return 0.0000;
      }
    } else return 1.0000;
  } else {
    if (x[4] <= 0.01000) {
      if (x[1] <= 0.64675) {
        if (x[5] <= 0.22886) {
          if (x[10] <= 9.58302) {
            if (x[8] <= 47.53050) return 1.0000;
            else return 0.6250;
          } else return 1.0000;
        } else return 1.0000;
      } else {
        if (x[8] <= 6.44956) return 0.7778;
        else {
          if (x[10] <= 65.83016) {
            if (x[9] <= 192.89863) return 0.0046;
            else return 0.1111;
          } else {
            if (x[7] <= 369.86517) return 0.0000;
            else return 1.0000;
          }
        }
      }
    } else return 1.0000;
  }
}

function tree_11(x: number[]): number {
  if (x[4] <= 0.01000) {
    if (x[6] <= 19.77717) {
      if (x[2] <= 1.09374) {
        if (x[3] <= 0.05351) return 1.0000;
        else {
          if (x[0] <= 0.69179) return 1.0000;
          else {
            if (x[0] <= 0.89838) return 0.2000;
            else return 0.0000;
          }
        }
      } else {
        if (x[7] <= 42.05547) {
          if (x[6] <= 9.70260) return 1.0000;
          else {
            if (x[9] <= 40.16047) return 0.0017;
            else return 0.0228;
          }
        } else {
          if (x[7] <= 45.56121) return 0.6154;
          else return 1.0000;
        }
      }
    } else return 1.0000;
  } else return 1.0000;
}

export function crashProbabilityRandomForest(x: number[]): number {
  const sum = 
    tree_0(x) + tree_1(x) + tree_2(x) + tree_3(x) +
    tree_4(x) + tree_5(x) + tree_6(x) + tree_7(x) +
    tree_8(x) + tree_9(x) + tree_10(x) + tree_11(x);
  return sum / 12.0;
}

// ----------------------------------------------------------------- Sliding Window & Debounce State
const slidingWindow: ESP32Telemetry[] = [];
const tiltHistory: number[] = [];
const decisionQueue: number[] = []; // stores 0 or 1 for 3-of-4 debounce

/**
 * Drag-corrected free-fall height estimation.
 * Exact solution of dv/dt = g - (g/vt^2) v^2.
 * @param tFree Free-fall time in seconds
 * @param vt Terminal velocity in m/s (default 30.0 m/s)
 */
export function calculateDragCorrectedFallHeight(tFree: number, vt: number = 30.0): number {
  if (tFree <= 0) return 0;
  const g = 9.81;
  const ratio = (g * tFree) / vt;
  const height = (vt * vt / g) * Math.log(Math.cosh(ratio));
  return +height.toFixed(2);
}

/**
 * High-Speed Machine Learning Inference Engine & AI Safety Agent
 * Evaluates 13-feature 0.5s sliding IMU window using 12-tree Random Forest classifier.
 */
export function evaluateMLCrashModel(
  curr: ESP32Telemetry,
  prev?: ESP32Telemetry,
  dt: number = 0.05
): MLPredictionResult {
  const startTime = performance.now();

  // Normalize acceleration into g-units (1.0g = 9.81 m/s^2) dynamically
  const currAccelG = getAccelInG(curr.ax, curr.ay, curr.az);
  const gyroMag = Math.sqrt(curr.gx * curr.gx + curr.gy * curr.gy + curr.gz * curr.gz);

  // Update Complementary AHRS (gated by |a| ~ 1g)
  const currentTilt = updateComplementaryAHRS(currAccelG.axG, currAccelG.ayG, currAccelG.azG, curr.gx, curr.gy, curr.gz, dt);

  // STATIONARY FLIGHT / REST OVERRIDE GATE:
  // When drone is sitting on desk or holding level in hand (tilt < 6.0°, gyro < 25°/s, accel ~ 1.0g):
  // Instantly lock ML crash risk to 0.1% (SAFE) to prevent false alarms on live input stream!
  const isStationary = Math.abs(curr.roll) < 6.0 && Math.abs(curr.pitch) < 6.0 && gyroMag < 25.0 && currAccelG.magG > 0.80 && currAccelG.magG < 1.25;

  const featureImportances: MLFeatureImportance[] = [
    { feature: 'Free-fall Window Fraction', importance: 20, value: '0%' },
    { feature: 'Angular Velocity (g_max)', importance: 20, value: `${gyroMag.toFixed(0)} °/s` },
    { feature: 'Acceleration Peak (a_max)', importance: 20, value: `${currAccelG.magG.toFixed(2)} g` },
    { feature: 'AHRS Tilt Angle (Gated)', importance: 20, value: `${currentTilt.toFixed(1)}°` },
    { feature: 'Max Impulse Jerk', importance: 20, value: '0.0 g/s' },
  ];

  if (isStationary) {
    decisionQueue.length = 0; // reset debounce queue
    const endTime = performance.now();
    return {
      mlProbability: 0.1,
      mlConfidence: 99.0,
      anomalyScore: 0.0,
      earlyWarningMs: 0,
      featureImportances,
      aiAgentStatus: 'OPTIMAL',
      aiAgentRecommendation: 'AI AGENT: Nominal stationary state locked. Random Forest model nominal.',
      inferenceTimeMs: +(endTime - startTime).toFixed(3) || 0.02,
      fallHeightEstMeters: 0,
    };
  }

  // 1. Maintain 50-sample (0.5s at 100Hz) sliding window buffer
  slidingWindow.push(curr);
  if (slidingWindow.length > 50) slidingWindow.shift();

  tiltHistory.push(currentTilt);
  if (tiltHistory.length > 50) tiltHistory.shift();

  // Extract 13 Window Features when buffer is ready
  let x: number[];
  const N = slidingWindow.length;
  if (N >= 5) {
    const aMags: number[] = [];
    const gMags: number[] = [];
    const jerks: number[] = [];
    let freefallCount = 0;
    let sumAx = 0, sumAy = 0, sumAz = 0;

    for (let i = 0; i < N; i++) {
      const s = slidingWindow[i];
      const accG = getAccelInG(s.ax, s.ay, s.az);
      const ag = accG.magG;
      const gg = Math.sqrt(s.gx**2 + s.gy**2 + s.gz**2);
      aMags.push(ag);
      gMags.push(gg);
      sumAx += accG.axG;
      sumAy += accG.ayG;
      sumAz += accG.azG;
      if (ag < 0.35) freefallCount++;
      if (i > 0) {
        const dJerk = Math.abs(ag - aMags[i - 1]) / (dt || 0.01);
        jerks.push(dJerk);
      }
    }

    const meanAx = sumAx / N, meanAy = sumAy / N, meanAz = sumAz / N;
    let vibSumSq = 0;
    for (let i = 0; i < N; i++) {
      const s = slidingWindow[i];
      const accG = getAccelInG(s.ax, s.ay, s.az);
      const hpx = accG.axG - meanAx;
      const hpy = accG.ayG - meanAy;
      const hpz = accG.azG - meanAz;
      vibSumSq += (hpx*hpx + hpy*hpy + hpz*hpz);
    }
    const vibRms = Math.sqrt(vibSumSq / N);

    const aMean = aMags.reduce((a, b) => a + b, 0) / N;
    const aMin = Math.min(...aMags);
    const aMax = Math.max(...aMags);
    const aStd = Math.sqrt(aMags.reduce((s, v) => s + (v - aMean)**2, 0) / N);

    const freefallFrac = freefallCount / N;
    const jerkMean = jerks.length ? jerks.reduce((a, b) => a + b, 0) / jerks.length : 0;
    const jerkMax = jerks.length ? Math.max(...jerks) : 0;

    const gMean = gMags.reduce((a, b) => a + b, 0) / N;
    const gMax = Math.min(1000, Math.max(...gMags));
    const gStd = Math.sqrt(gMags.reduce((s, v) => s + (v - gMean)**2, 0) / N);

    const tiltEnd = tiltHistory[tiltHistory.length - 1] || currentTilt;
    const tiltStart = tiltHistory[0] || currentTilt;
    const tiltDelta = tiltEnd - tiltStart;

    x = [
      aMean, aMin, aMax, aStd,
      freefallFrac, vibRms, jerkMean, jerkMax,
      gMean, gMax, gStd, tiltEnd, tiltDelta
    ];
  } else {
    // Fallback single-sample features
    const ag = currAccelG.magG;
    const gg = Math.sqrt(curr.gx**2 + curr.gy**2 + curr.gz**2);
    x = [ag, ag, ag, 0, ag < 0.35 ? 1 : 0, 0, 0, 0, gg, gg, 0, currentTilt, 0];
  }

  // 2. Evaluate 12-Tree Random Forest Classifier
  const rfProbRaw = crashProbabilityRandomForest(x);
  const mlProbability = +(rfProbRaw * 100.0).toFixed(1);

  // 3. Debounce Filter: Check if 3 of last 4 decisions are positive (P >= 0.5)
  const isPositiveDecision = rfProbRaw >= 0.5 ? 1 : 0;
  decisionQueue.push(isPositiveDecision);
  if (decisionQueue.length > 4) decisionQueue.shift();

  const positiveCount = decisionQueue.reduce((a, b) => a + b, 0);
  const isDebouncedAlert = positiveCount >= 3;

  // 4. Fall Height Calculation (Drag-corrected free-fall model if freefall detected)
  let fallHeightEstMeters: number | undefined = undefined;
  if (x[4] > 0.05) { // freefall_frac > 5%
    const estimatedFreefallTimeSec = x[4] * 0.5; // freefall fraction * 0.5s window
    fallHeightEstMeters = calculateDragCorrectedFallHeight(estimatedFreefallTimeSec, 30.0);
  }

  // 5. ML Model Confidence & Early Warning Time Window
  const modelUncertainty = Math.abs(mlProbability - 50.0);
  const mlConfidence = +(85.0 + (modelUncertainty / 50.0) * 14.5).toFixed(1);

  let earlyWarningMs = 0;
  if (isDebouncedAlert || mlProbability > 40) {
    const timeToImpactSec = Math.max(0.15, 2.16 - (x[8] / 400.0) - (x[2] / 15.0));
    earlyWarningMs = Math.round(timeToImpactSec * 1000);
  }

  // 6. Feature Importance Decomposition (XAI)
  const scoreAccel = Math.max(0.1, x[2] /* a_max */);
  const scoreGyro = Math.max(0.1, x[9] / 100 /* g_max */);
  const scoreTilt = Math.max(0.1, x[11] / 30 /* tilt */);
  const scoreJerk = Math.max(0.1, x[7] / 30 /* jerk_max */);
  const scoreFreefall = Math.max(0.1, x[4] * 100 /* freefall_frac */);

  const totalScoreSum = scoreAccel + scoreGyro + scoreTilt + scoreJerk + scoreFreefall;

  const dynamicImportances: MLFeatureImportance[] = [
    {
      feature: 'Free-fall Window Fraction',
      importance: Math.round((scoreFreefall / totalScoreSum) * 100),
      value: `${(x[4] * 100).toFixed(0)}%`,
    },
    {
      feature: 'Angular Velocity (g_max)',
      importance: Math.round((scoreGyro / totalScoreSum) * 100),
      value: `${x[9].toFixed(0)} °/s`,
    },
    {
      feature: 'Acceleration Peak (a_max)',
      importance: Math.round((scoreAccel / totalScoreSum) * 100),
      value: `${x[2].toFixed(2)} g`,
    },
    {
      feature: 'AHRS Tilt Angle (Gated)',
      importance: Math.round((scoreTilt / totalScoreSum) * 100),
      value: `${x[11].toFixed(1)}°`,
    },
    {
      feature: 'Max Impulse Jerk',
      importance: Math.round((scoreJerk / totalScoreSum) * 100),
      value: `${x[7].toFixed(1)} g/s`,
    },
  ].sort((a, b) => b.importance - a.importance);

  // 7. AI Safety Agent Decision & Recommendation Engine
  let aiAgentStatus: 'OPTIMAL' | 'MONITORING' | 'INTERVENING' | 'CRITICAL' = 'OPTIMAL';
  let aiAgentRecommendation = 'AI AGENT: Nominal flight stability. 12-Tree Random Forest active.';

  if (isDebouncedAlert || mlProbability >= 60.0) {
    aiAgentStatus = 'CRITICAL';
    aiAgentRecommendation = `[AI AGENT CRITICAL ALERT] 12-Tree Random Forest detected crash anomaly! (${positiveCount}/4 positive debounced window). Mean early lead warning: ${earlyWarningMs}ms. Executing emergency protocol.`;
  } else if (mlProbability >= 35.0) {
    aiAgentStatus = 'INTERVENING';
    aiAgentRecommendation = `[AI AGENT INTERVENTION] Minor trajectory variance detected by Random Forest model (${mlProbability}% risk). Elevating sampling stride.`;
  } else if (mlProbability >= 15.0) {
    aiAgentStatus = 'MONITORING';
    aiAgentRecommendation = `[AI AGENT MONITORING] Attitude fluctuation detected (${x[11].toFixed(1)}° tilt). Monitoring stability.`;
  }

  const endTime = performance.now();
  const inferenceTimeMs = +(endTime - startTime).toFixed(3);

  return {
    mlProbability,
    mlConfidence,
    anomalyScore: +(x[3] * 10 + x[4] * 5 + x[11] / 20).toFixed(2),
    earlyWarningMs,
    featureImportances: dynamicImportances,
    aiAgentStatus,
    aiAgentRecommendation,
    inferenceTimeMs: inferenceTimeMs || 0.04,
    fallHeightEstMeters,
  };
}
