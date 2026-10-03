/**
 * Web Audio API Emergency Alarm Service for AeroGuard Critical Crash Risk
 * Generates an aviation warning pulse tone (900Hz / 600Hz alternating pattern).
 */

let audioCtx: AudioContext | null = null;
let isPlaying = false;
let isMuted = false;
let osc1: OscillatorNode | null = null;
let osc2: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let pulseInterval: any = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setAudioMuted(muted: boolean) {
  isMuted = muted;
  if (muted) {
    stopCrashAlarm();
  }
}

export function getAudioMuted(): boolean {
  return isMuted;
}

export function startCrashAlarm() {
  if (isMuted || isPlaying) return;

  try {
    const ctx = getAudioContext();
    gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
    gainNode.connect(ctx.destination);

    osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5 note

    osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(440, ctx.currentTime); // A4 octave

    osc1.connect(gainNode);
    osc2.connect(gainNode);

    osc1.start();
    osc2.start();
    isPlaying = true;

    // Pulsing siren pitch modulation (Alternating 880Hz / 660Hz every 250ms)
    let flip = false;
    pulseInterval = setInterval(() => {
      if (!gainNode || !osc1 || !osc2 || isMuted) return;
      flip = !flip;
      const freq1 = flip ? 880 : 660;
      const freq2 = flip ? 440 : 330;
      const gainVal = flip ? 0.3 : 0.15;
      
      osc1.frequency.setValueAtTime(freq1, ctx.currentTime);
      osc2.frequency.setValueAtTime(freq2, ctx.currentTime);
      gainNode.gain.setValueAtTime(gainVal, ctx.currentTime);
    }, 250);

    console.log('[AeroGuard Audio] 🚨 CRITICAL CRASH SIREN STARTED');
  } catch (err) {
    console.warn('[AeroGuard Audio] Failed to start Web Audio context:', err);
  }
}

export function stopCrashAlarm() {
  if (!isPlaying) return;

  if (pulseInterval) {
    clearInterval(pulseInterval);
    pulseInterval = null;
  }

  try {
    if (osc1) { osc1.stop(); osc1.disconnect(); osc1 = null; }
    if (osc2) { osc2.stop(); osc2.disconnect(); osc2 = null; }
    if (gainNode) { gainNode.disconnect(); gainNode = null; }
  } catch (e) {}

  isPlaying = false;
  console.log('[AeroGuard Audio] 🔇 Crash Alarm Stopped');
}

export function toggleAudioMute(): boolean {
  const next = !isMuted;
  setAudioMuted(next);
  return next;
}
