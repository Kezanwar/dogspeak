import { Mic, MicOff } from "lucide-react";

import Spinner from "@app/components/spinner";
import { Button } from "@app/components/ui/button";
import { cn } from "@app/lib/utils";
import store, { observer } from "@app/stores";

// The one self-mute control, used by the sidebar voice strip and the voice
// grid's bottom bar so they read (and behave) as the same thing. Goes through
// the store action (persisted + broadcast). While the mic is being acquired
// (just joined, or a retry) the icon is a spinner; the button still works.
const SelfMuteButton = observer(({ className }: { className?: string }) => {
  const { audio } = store;
  const muted = audio.selfMuted;
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-pressed={muted}
      aria-busy={audio.micAcquiring}
      aria-label={muted ? "unmute" : "mute"}
      title={muted ? "unmute" : "mute"}
      onClick={() => audio.toggleSelfMute()}
      className={cn(
        "size-8",
        muted && "bg-destructive/15 text-destructive hover:bg-destructive/25",
        className,
      )}
    >
      {audio.micAcquiring ? (
        <Spinner label="connecting mic" />
      ) : muted ? (
        <MicOff className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
    </Button>
  );
});

export default SelfMuteButton;
