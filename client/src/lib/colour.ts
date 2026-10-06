// Colour helpers for user-chosen colours (always "#rgb" / "#rrggbb" hex).

type Rgb = { r: number; g: number; b: number }; // 0-255
type Hsl = { h: number; s: number; l: number }; // h 0-360, s/l 0-1

export const hexToRgb = (hex: string): Rgb | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  const v =
    m[1].length === 3
      ? m[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : m[1];
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

export const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
};

export const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

const toHex = ({ r, g, b }: Rgb) =>
  "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");

// WCAG relative luminance and contrast ratio.
const luminance = ({ r, g, b }: Rgb) => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
};

const TARGET_CONTRAST = 4.5; // WCAG AA for normal text

/**
 * A same-hue shade of `colour` that's legible on top of it: darker for light
 * and mid colours, lighter when the colour is itself dark. Steps lightness away
 * from the background until it reaches AA contrast (or the end of the range).
 */
export const contrastingShade = (colour: string): string => {
  const bg = hexToRgb(colour);
  if (!bg) return "#1f1f1f"; // not a hex colour — fall back to near-black

  const hsl = rgbToHsl(bg);
  // Above ~0.18 luminance a dark foreground out-contrasts a light one.
  const darker = luminance(bg) > 0.18;
  const step = darker ? -0.02 : 0.02;

  let fg = bg;
  for (let l = hsl.l; darker ? l >= 0.05 : l <= 0.97; l += step) {
    fg = hslToRgb({ ...hsl, l });
    if (contrast(bg, fg) >= TARGET_CONTRAST) break;
  }
  return toHex(fg);
};
