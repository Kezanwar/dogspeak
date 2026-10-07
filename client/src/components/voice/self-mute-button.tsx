import { Mic, MicOff } from "lucide-react";

import { Button } from "@app/components/ui/button";
import { cn } from "@app/lib/utils";
import store, { observer } from "@app/stores";

// The one self-mute control, used by the sidebar voice strip and the voice
// grid's bottom bar so they read (and behave) as the same thing. Goes through
// the store action (persisted + broadcast).
const SelfMuteButton = observer(({ className }: { className?: string }) => {
  const { audio } = store;
  const muted = audio.selfMuted;
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-pressed={muted}
      aria-label={muted ? "unmute" : "mute"}
      title={muted ? "unmute" : "mute"}
      onClick={() => audio.toggleSelfMute()}
      className={cn(
        "size-8",
        muted && "bg-destructive/15 text-destructive hover:bg-destructive/25",
        className,
      )}
    >
      {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
    </Button>
  );
});

export default SelfMuteButton;
