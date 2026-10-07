import { MicOff, VolumeX } from "lucide-react";

import { cn } from "@app/lib/utils";

// Self-muted (broadcast — everyone sees it).
export const MutedIcon = ({ className }: { className?: string }) => (
  <MicOff
    aria-label="muted"
    className={cn("text-destructive size-3.5 shrink-0", className)}
  >
    <title>muted</title>
  </MicOff>
);

// Muted by me (local only — nobody else knows).
export const LocallyMutedIcon = ({ className }: { className?: string }) => (
  <VolumeX
    aria-label="you muted them"
    className={cn("text-muted-foreground size-3.5 shrink-0", className)}
  >
    <title>you muted them</title>
  </VolumeX>
);
