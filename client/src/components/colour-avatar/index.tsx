import type { CSSProperties } from "react";

import { cn } from "@app/lib/utils";
import { contrastingShade } from "@app/lib/colour";

type Props = {
  name: string;
  colour: string;
  className?: string;
  style?: CSSProperties;
};

// A user's initial on their own colour, in a contrasting shade of that colour
// so it's legible whatever colour they picked. Size/shape come from className.
const ColourAvatar = ({ name, colour, className, style }: Props) => (
  <span
    aria-hidden
    className={cn(
      "flex shrink-0 items-center justify-center font-semibold select-none",
      className,
    )}
    style={{ backgroundColor: colour, color: contrastingShade(colour), ...style }}
  >
    {(name.trim().charAt(0) || "?").toUpperCase()}
  </span>
);

export default ColourAvatar;
