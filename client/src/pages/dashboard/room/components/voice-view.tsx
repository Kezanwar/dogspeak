import { MicOff, Volume2 } from "lucide-react";

import ColourAvatar from "@app/components/colour-avatar";
import { CHANNELS } from "@app/config/channels";
import store, { observer } from "@app/stores";

// PLACEHOLDER for a voice channel's main-panel view: just its current members
// in a centred list. The Discord-style grid tiles (with per-tile controls)
// replace this next. Viewing never joins or leaves audio — the "voice
// connected" strip still follows presence.myChannel, not this view.
const VoiceView = observer(({ channelId }: { channelId: string }) => {
  const { presence } = store;
  const label = CHANNELS.find((c) => c.id === channelId)?.label ?? channelId;
  const ids = presence.membersInChannel(channelId);
  const inIt = presence.myChannel === channelId;

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Volume2 className="size-4" />
        <span>{label}</span>
        {!inIt && <span>· double-click it in the sidebar to join</span>}
      </div>
      {ids.length === 0 ? (
        <p className="text-muted-foreground text-sm">no one here yet</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={`${label} members`}>
          {ids.map((id) => (
            <VoiceViewMember key={id} id={id} />
          ))}
        </ul>
      )}
    </section>
  );
});

const VoiceViewMember = observer(({ id }: { id: string }) => {
  const user = store.presence.users.get(id);
  if (!user) return null;
  return (
    <li className="flex items-center gap-2 text-sm">
      <ColourAvatar
        name={user.name}
        colour={user.colour}
        className="size-7 rounded-full text-xs"
      />
      <span>{user.name}</span>
      {user.muted && (
        <MicOff aria-label="muted" className="text-destructive size-3.5" />
      )}
    </li>
  );
});

export default VoiceView;
