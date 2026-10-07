import { LogOut, MicOff, MoreHorizontal, Volume2, VolumeX } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@app/components/ui/dropdown-menu";
import ColourAvatar from "@app/components/colour-avatar";
import store, { observer } from "@app/stores";
import { cn } from "@app/lib/utils";
import { isSpeaking } from "@app/lib/speaking";

// Speaking highlight: one fixed green for everyone (Tailwind green-500). It's
// mid-luminance, so the ring reads on both the light and dark sidebar.
const SPEAKING_GREEN = "#22c55e";
const SPEAKING_GLOW = "rgb(34 197 94 / 0.55)";

const MENU_TRIGGER =
  "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent focus-visible:ring-sidebar-ring ml-auto flex size-5 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2";

// Actions on your OWN tile: "leave channel", so it's only rendered while
// you're actually in a channel. (Self-mute lives in the sidebar voice strip.)
const MyTileMenu = observer(() => {
  const { presence } = store;
  if (presence.myChannel === "") return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="member actions" className={MENU_TRIGGER}>
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="min-w-36">
        <DropdownMenuItem onSelect={() => presence.joinChannel("")}>
          <LogOut />
          leave channel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// Actions on someone ELSE's tile. Both are LOCAL ONLY — nobody else knows:
// mute them for yourself, and set how loud they are for you.
const PeerMenu = observer(({ id, name }: { id: string; name: string }) => {
  const { audio } = store;
  const muted = audio.isLocallyMuted(id);
  const volume = Math.round(audio.volumeOf(id) * 100);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`actions for ${name}`}
        className={MENU_TRIGGER}
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-52">
        <DropdownMenuItem onSelect={() => audio.toggleLocalMute(id)}>
          {muted ? <Volume2 /> : <VolumeX />}
          <span className="truncate">
            {muted ? `unmute ${name}` : `mute ${name}`}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Keep arrow keys for the slider, not the menu's item navigation. */}
        <div className="px-2 py-1.5" onKeyDown={(e) => e.stopPropagation()}>
          <div className="text-muted-foreground mb-1 flex justify-between text-xs">
            <span>volume</span>
            <span className="tabular-nums">{volume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            aria-label={`volume for ${name}`}
            onChange={(e) =>
              audio.setPeerVolume(id, Number(e.target.value) / 100)
            }
            className="accent-primary w-full"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

type Props = {
  id: string;
  speaking?: boolean;
};

// Its own observer reading only its own roster entry, so a name/colour change
// (or a speaking flip from VAD) re-renders this tile and not the whole list.
const MemberTile = observer(({ id, speaking = isSpeaking(id) }: Props) => {
  const user = store.presence.users.get(id);
  if (!user) return null;

  const isMe = id === store.presence.myId;

  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1">
      <ColourAvatar
        name={user.name}
        colour={user.colour}
        className="size-6 rounded-full text-[11px] motion-safe:transition-shadow motion-safe:duration-150"
        style={{
          // green ring (with a sidebar-coloured gap) + soft green glow
          boxShadow:
            speaking && !user.muted // a muted mic never glows
              ? `0 0 0 2px var(--sidebar), 0 0 0 4px ${SPEAKING_GREEN}, 0 0 10px 4px ${SPEAKING_GLOW}`
              : undefined,
        }}
      />
      {/* Self-mute (broadcast, everyone sees it) vs muted-by-me (local). */}
      {user.muted && (
        <MicOff
          aria-label="muted"
          className="text-destructive size-3.5 shrink-0"
        >
          <title>muted</title>
        </MicOff>
      )}
      {!isMe && store.audio.isLocallyMuted(id) && (
        <VolumeX
          aria-label="you muted them"
          className="text-muted-foreground size-3.5 shrink-0"
        >
          <title>you muted them</title>
        </VolumeX>
      )}
      <span
        className={cn(
          "truncate text-xs",
          isMe ? "font-medium" : "text-sidebar-foreground/80",
        )}
      >
        {user.name}
      </span>
      {isMe ? <MyTileMenu /> : <PeerMenu id={id} name={user.name} />}
    </li>
  );
});

export default MemberTile;
