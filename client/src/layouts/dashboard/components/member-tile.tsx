import { LogOut, MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@app/components/ui/dropdown-menu";
import ColourAvatar from "@app/components/colour-avatar";
import { LocallyMutedIcon, MutedIcon } from "@app/components/voice/mute-icons";
import PeerMenu from "@app/components/voice/peer-menu";
import { RING_SM, speakingRing } from "@app/components/voice/speaking";
import store, { observer } from "@app/stores";
import { cn } from "@app/lib/utils";
import { isSpeaking } from "@app/lib/speaking";

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
        <DropdownMenuItem onSelect={() => store.ui.leaveVoice()}>
          <LogOut />
          leave channel
        </DropdownMenuItem>
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
        // a muted mic never glows
        style={{ boxShadow: speakingRing(speaking && !user.muted, RING_SM) }}
      />
      {/* Self-mute (broadcast, everyone sees it) vs muted-by-me (local). */}
      {user.muted && <MutedIcon />}
      {!isMe && store.audio.isLocallyMuted(user.uuid) && <LocallyMutedIcon />}
      <span
        className={cn(
          "truncate text-xs",
          isMe ? "font-medium" : "text-sidebar-foreground/80",
        )}
      >
        {user.name}
      </span>
      {isMe ? (
        <MyTileMenu />
      ) : (
        <PeerMenu
          uuid={user.uuid}
          name={user.name}
          triggerClassName={MENU_TRIGGER}
        />
      )}
    </li>
  );
});

export default MemberTile;
