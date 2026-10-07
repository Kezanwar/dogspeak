// Speaking highlight: one fixed green for everyone (Tailwind green-500). It's
// mid-luminance, so the ring reads on both light and dark surfaces.
export const SPEAKING_GREEN = "#22c55e";
export const SPEAKING_GLOW = "rgb(34 197 94 / 0.55)";

type RingSize = {
  gap: number; // px of surface-coloured gap between avatar and ring
  ring: number; // px ring thickness
  blur: number; // px glow blur
  spread: number; // px glow spread
  surface: string; // CSS colour of whatever the avatar sits on
};

/** Sidebar member tile (24px avatar). */
export const RING_SM: RingSize = {
  gap: 2,
  ring: 2,
  blur: 10,
  spread: 4,
  surface: "var(--sidebar)",
};

/** Voice grid tile (80px avatar). */
export const RING_LG: RingSize = {
  gap: 4,
  ring: 3,
  blur: 28,
  spread: 8,
  surface: "var(--card)",
};

/** Green ring (with a surface-coloured gap) + soft glow, or none. */
export const speakingRing = (
  on: boolean,
  { gap, ring, blur, spread, surface }: RingSize,
): string | undefined =>
  on
    ? `0 0 0 ${gap}px ${surface}, 0 0 0 ${gap + ring}px ${SPEAKING_GREEN}, 0 0 ${blur}px ${spread}px ${SPEAKING_GLOW}`
    : undefined;
