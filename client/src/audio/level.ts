// ONE scale for the voice-activation control: the live meter's fill, the
// threshold marker/slider and the gate decision all go through these, so
// what you see is what gates.
//
// Level = time-domain RMS (-1..1) measured BEFORE the gate (after mic gain).
// Percent = position on the meter, linear: 0.35 RMS fills it, so normal
// speech sits around 50–90%.

/** RMS that reads as a full meter (100%). */
export const METER_CEILING_RMS = 0.35;

/**
 * The glow's noise floor, ≈6% on the meter (0.02 RMS): the glow never lights
 * below it. Dropped to sit level with the default activation level, so at
 * the default the glow lines up with the gate (it lights when you transmit);
 * still above typical idle hiss (with noiseSuppression on), so the glow
 * doesn't flicker on noise when the slider is near the open/bottom end.
 */
export const VOICE_FLOOR_RMS = 0.02;

/**
 * Activation level used when nothing is saved, and by "reset". 6% ≈ 0.021
 * RMS: a gentle default gate.
 */
export const DEFAULT_THRESHOLD = 6;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** RMS → 0..100 meter position. */
export const levelToPercent = (rms: number) =>
  clamp((rms / METER_CEILING_RMS) * 100, 0, 100);

/** 0..100 meter position → RMS. */
export const percentToLevel = (percent: number) =>
  (clamp(percent, 0, 100) / 100) * METER_CEILING_RMS;
