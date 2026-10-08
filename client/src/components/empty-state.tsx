import type { LucideIcon } from "lucide-react";

// A centred icon + small muted line, filling the space it's given. Shared by
// the empty chat and the no-audio (afk) channel view so they read the same.
const EmptyState = ({
  icon: Icon,
  text,
}: {
  icon: LucideIcon;
  text: string;
}) => (
  <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-sm">
    <Icon className="size-6 opacity-60" />
    {text}
  </div>
);

export default EmptyState;
