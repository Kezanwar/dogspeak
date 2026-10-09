// ONE scale for the voice-activation control: the live meter's fill, the
// threshold marker/slider and the gate decision all go through these, so
// what you see is what gates.
//
// Level = time-domain RMS (-1..1) measured BEFORE the gate (after mic gain).
// Percent = position on the meter, linear: 0.35 RMS fills it, so normal
// speech sits around 50–90%.

/** RMS that reads as a full meter (100%). */
export const METER_CEILING_RMS = 0.35;

/** The original VAD voice floor (~9% on the meter). The glow never lights below it. */
export const VOICE_FLOOR_RMS = 0.03;

/**
 * Activation level used when nothing is saved, and by "reset". 15% ≈ 0.0525
 * RMS: just above the voice floor, so out of the box the gate trims idle hiss
 * while normal speech clears it easily.
 */
export const DEFAULT_THRESHOLD = 15;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** RMS → 0..100 meter position. */
export const levelToPercent = (rms: number) =>
  clamp((rms / METER_CEILING_RMS) * 100, 0, 100);

/** 0..100 meter position → RMS. */
export const percentToLevel = (percent: number) =>
  (clamp(percent, 0, 100) / 100) * METER_CEILING_RMS;
