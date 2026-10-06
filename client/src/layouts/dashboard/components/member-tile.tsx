import store, { observer } from "@app/stores";
import { cn } from "@app/lib/utils";
import { isSpeaking } from "@app/lib/speaking";

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
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white transition-shadow duration-150"
        style={{
          backgroundColor: user.colour,
          // ring (with a sidebar-coloured gap) + soft glow in the member's colour
          boxShadow: speaking
            ? `0 0 0 2px var(--sidebar), 0 0 0 4px ${user.colour}, 0 0 12px 4px ${user.colour}`
            : undefined,
        }}
      >
        {user.name.charAt(0).toUpperCase()}
      </span>
      <span
        className={cn(
          "truncate text-xs",
          isMe ? "font-medium" : "text-sidebar-foreground/80",
        )}
      >
        {user.name}
      </span>
    </li>
  );
});

export default MemberTile;
