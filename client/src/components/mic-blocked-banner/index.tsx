import { useState } from "react";
import { MicOff } from "lucide-react";

import { Button } from "@app/components/ui/button";
import { audio } from "@app/audio/audio";
import store, { observer } from "@app/stores";

// Persistent while you're in an audio channel without a mic. Clears itself
// when the manager gets mic access or you leave the channel.
const MicBlockedBanner = observer(() => {
  const [retrying, setRetrying] = useState(false);
  if (!store.audio.micBlocked) return null;

  const retry = async () => {
    setRetrying(true);
    try {
      await audio.retryMic();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 text-foreground mb-3 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <MicOff className="text-destructive mt-0.5 size-4 shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="font-medium">
          your mic is blocked — others can't hear you
        </p>
        <p className="text-muted-foreground">
          you can still listen and chat. if you blocked it, allow microphone
          access from the mic or padlock icon in your browser's address bar,
          then retry.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={retry}
        disabled={retrying}
        className="shrink-0"
      >
        {retrying ? "retrying…" : "retry"}
      </Button>
    </div>
  );
});

export default MicBlockedBanner;
