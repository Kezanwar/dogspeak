import SelfMuteButton from "@app/components/voice/self-mute-button";
import { CHANNELS, isAudioChannel } from "@app/config/channels";
import store, { observer } from "@app/stores";

// In-channel controls above the profile, only while you're in a voice
// channel. Follows presence.myChannel (where you ARE), not what you're
// viewing. The mute button is shared with the voice grid's bottom bar.
const VoiceStrip = observer(() => {
  const { presence } = store;
  const channel = presence.myChannel;
  if (!isAudioChannel(channel)) return null;

  const label = CHANNELS.find((c) => c.id === channel)?.label ?? channel;

  return (
    <div className="bg-sidebar-accent/50 flex items-center gap-2 rounded-lg px-2 py-1.5">
      <div className="grid flex-1 text-xs leading-tight">
        <span className="font-medium text-green-600 dark:text-green-500">
          voice connected
        </span>
        <span className="text-muted-foreground truncate">{label}</span>
      </div>
      <SelfMuteButton />
    </div>
  );
});

export default VoiceStrip;
