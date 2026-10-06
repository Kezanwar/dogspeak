import { LogOut, MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@app/components/ui/dropdown-menu";
import ColourAvatar from "@app/components/colour-avatar";
import store, { observer } from "@app/stores";
import { cn } from "@app/lib/utils";
import { isSpeaking } from "@app/lib/speaking";

// Actions on your OWN tile. Only "leave channel" for now (mute/volume come with
// audio), so it's only rendered while you're actually in a channel.
const MyTileMenu = observer(() => {
  const { presence } = store;
  if (presence.myChannel === "") return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="member actions"
        className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent focus-visible:ring-sidebar-ring ml-auto flex size-5 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2"
      >
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

type Props = {
  id: string;
  speaking?: boolean;
};

// Its own observer reading only its own roster entry, so a name/colour change
// (or, later, a speaking flip) re-renders this tile and not the whole list.
const MemberTile = observer(({ id, speaking = isSpeaking(id) }: Props) => {
  const user = store.presence.users.get(id);
  if (!user) return null;

  const isMe = id === store.presence.myId;

  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1">
      <ColourAvatar
        name={user.name}
        colour={user.colour}
        className="size-6 rounded-full text-[11px] transition-shadow duration-150"
        style={{
          // ring (with a sidebar-coloured gap) + soft glow in the member's colour
          boxShadow: speaking
            ? `0 0 0 2px var(--sidebar), 0 0 0 4px ${user.colour}, 0 0 12px 4px ${user.colour}`
            : undefined,
        }}
      />
      <span
        className={cn(
          "truncate text-xs",
          isMe ? "font-medium" : "text-sidebar-foreground/80",
        )}
      >
        {user.name}
      </span>
      {isMe && <MyTileMenu />}
    </li>
  );
});

export default MemberTile;
