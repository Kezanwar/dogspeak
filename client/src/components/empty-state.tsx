import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// A centred icon + small muted line, filling the space it's given. Shared by
// the empty chat, the no-audio (afk) channel view and the superseded screen so
// they read the same. Optional children sit underneath (a hint, an action).
const EmptyState = ({
  icon: Icon,
  text,
  children,
}: {
  icon: LucideIcon;
  text: string;
  children?: ReactNode;
}) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm">
    <Icon className="size-6 opacity-60" />
    {text}
    {children}
  </div>
);

export default EmptyState;
