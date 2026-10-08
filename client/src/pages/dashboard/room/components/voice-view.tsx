import { LogIn, PhoneOff, Users } from "lucide-react";

import ColourAvatar from "@app/components/colour-avatar";
import EmptyState from "@app/components/empty-state";
import { Button } from "@app/components/ui/button";
import { LocallyMutedIcon, MutedIcon } from "@app/components/voice/mute-icons";
import PeerMenu from "@app/components/voice/peer-menu";
import SelfMuteButton from "@app/components/voice/self-mute-button";
import { RING_LG, speakingRing } from "@app/components/voice/speaking";
import { CHANNELS } from "@app/config/channels";
import { isSpeaking } from "@app/lib/speaking";
import store, { observer } from "@app/stores";

const TILE_MENU_TRIGGER =
  "text-muted-foreground hover:text-foreground hover:bg-accent data-[state=open]:bg-accent focus-visible:ring-ring absolute top-2 right-2 flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2";

// A voice channel's main-panel view: one tile per member, centred, with the
// avatars as the focal point and the speaking glow as the only motion. Pure
// presentation over presence + audio state. Viewing never joins or leaves
// audio; the sidebar's "voice connected" strip still follows
// presence.myChannel, not this view.
const VoiceView = observer(({ channelId }: { channelId: string }) => {
  const { presence } = store;
  const label = CHANNELS.find((c) => c.id === channelId)?.label ?? channelId;
  const ids = presence.membersInChannel(channelId);
  const inIt = presence.myChannel === channelId;

  return (
    <section
      aria-label={`${label} voice channel`}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-2 py-10">
        {ids.length === 0 ? (
          <EmptyState icon={Users} text="no one here yet" />
        ) : (
          // Fixed-width tiles in a centred wrap: a few sit centred, more wrap
          // onto further rows — and a short last row stays centred too
          // (a CSS grid would left-align it).
          <ul
            aria-label={`${label} members`}
            className="flex w-full max-w-4xl flex-wrap justify-center gap-4 sm:gap-6"
          >
            {ids.map((id) => (
              <VoiceTile key={id} id={id} live={inIt} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-center pt-4 pb-2">
        {inIt ? (
          // Same controls as the sidebar strip: shared mute button + leave.
          <div className="bg-card flex items-center gap-1 rounded-full border px-2 py-1.5 shadow-sm">
            <SelfMuteButton />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="leave channel"
              title="leave channel"
              onClick={() => store.ui.leaveVoice()}
              className="text-destructive hover:bg-destructive/15 hover:text-destructive size-8"
            >
              <PhoneOff className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button
              type="button"
              onClick={() => store.ui.enterVoice(channelId)}
              className="rounded-full px-5"
            >
              <LogIn className="size-4" />
              join {label}
            </Button>
            <span className="text-muted-foreground text-xs">
              or double-click it in the sidebar
            </span>
          </div>
        )}
      </div>
    </section>
  );
});

// One member. Its own observer reading only its own roster entry (and its own
// speaking flag), so a speaking flip re-renders just this tile.
//
// `live` = you're IN this channel. Speaking data only exists for peers you
// have connections to (your channel + yourself), so a previewed channel is
// never asked for it — its tiles are static by construction.
const VoiceTile = observer(({ id, live }: { id: string; live: boolean }) => {
  const { presence, audio } = store;
  const user = presence.users.get(id);
  if (!user) return null;

  const isMe = id === presence.myId;
  const speaking = live && isSpeaking(id) && !user.muted; // muted never glows

  return (
    <li className="bg-card relative flex w-40 flex-col items-center gap-4 rounded-2xl border px-4 pt-8 pb-6 sm:w-48">
      {!isMe && (
        <PeerMenu
          uuid={user.uuid}
          name={user.name}
          side="bottom"
          triggerClassName={TILE_MENU_TRIGGER}
        />
      )}
      <ColourAvatar
        name={user.name}
        colour={user.colour}
        className="size-20 rounded-full text-3xl motion-safe:transition-shadow motion-safe:duration-150"
        style={{ boxShadow: speakingRing(speaking, RING_LG) }}
      />
      <div className="flex max-w-full items-center gap-1.5 text-sm">
        {user.muted && <MutedIcon />}
        {!isMe && audio.isLocallyMuted(user.uuid) && <LocallyMutedIcon />}
        <span className="truncate font-medium">{user.name}</span>
        {isMe && <span className="text-muted-foreground shrink-0">(you)</span>}
      </div>
    </li>
  );
});

export default VoiceView;
