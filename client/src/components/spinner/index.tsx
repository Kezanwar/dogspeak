import { Atom } from "loading-dev";

import { cn } from "@app/lib/utils";

type SpinnerProps = {
  /** px; ~16 inline/in buttons, ~28 on the splash. */
  size?: number;
  /** Announced to screen readers (Atom itself is aria-hidden). */
  label?: string;
  /** ms per revolution; the library default when omitted. */
  duration?: number;
  className?: string;
};

// The app's one loading indicator — swap the implementation here and every
// spinner follows. Colour is currentColor (Atom draws its rings with it), so
// it matches whatever text it sits in; set a text-* class to change it.
// Reduced motion is handled by the library (the rings stop spinning).
const Spinner = ({
  size = 16,
  label = "loading",
  duration,
  className,
}: SpinnerProps) => (
  <span
    role="status"
    aria-label={label}
    className={cn("inline-flex shrink-0", className)}
  >
    <Atom size={size} duration={duration} />
  </span>
);

export default Spinner;
