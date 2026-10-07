import { Mic, MicOff } from "lucide-react";

import { Button } from "@app/components/ui/button";
import { CHANNELS, isAudioChannel } from "@app/config/channels";
import { cn } from "@app/lib/utils";
import store, { observer } from "@app/stores";

// In-channel controls above the profile, only while you're in a voice
// channel. Self-mute goes through the store action (store.audio.toggleSelfMute)
// so other surfaces (e.g. a future voice-grid bar) can reuse it.
const VoiceStrip = observer(() => {
  const { presence, audio } = store;
  const channel = presence.myChannel;
  if (!isAudioChannel(channel)) return null;

  const label = CHANNELS.find((c) => c.id === channel)?.label ?? channel;
  const muted = audio.selfMuted;

  return (
    <div className="bg-sidebar-accent/50 flex items-center gap-2 rounded-lg px-2 py-1.5">
      <div className="grid flex-1 text-xs leading-tight">
        <span className="font-medium text-green-600 dark:text-green-500">
          voice connected
        </span>
        <span className="text-muted-foreground truncate">{label}</span>
      </div>
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
        )}
      >
        {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </Button>
    </div>
  );
});

export default VoiceStrip;
