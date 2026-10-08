import { MoreHorizontal, Volume2, VolumeX } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@app/components/ui/dropdown-menu";
import store, { observer } from "@app/stores";

type Props = {
  uuid: string; // the person's client uuid — local mute/volume are keyed by it
  name: string;
  triggerClassName: string;
  side?: "top" | "right" | "bottom" | "left";
};

// Actions on someone ELSE's tile. Both are LOCAL ONLY — nobody else knows:
// mute them for yourself, and set how loud they are for you. Keyed by their
// uuid so it sticks across their reconnects (and is persisted for yours).
const PeerMenu = observer(
  ({ uuid, name, triggerClassName, side = "right" }: Props) => {
    const { audio } = store;
    const muted = audio.isLocallyMuted(uuid);
    const volume = Math.round(audio.volumeOf(uuid) * 100);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`actions for ${name}`}
          className={triggerClassName}
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side} align="start" className="w-52">
          <DropdownMenuItem onSelect={() => audio.toggleLocalMute(uuid)}>
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
                audio.setPeerVolume(uuid, Number(e.target.value) / 100)
              }
              className="accent-primary w-full"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

export default PeerMenu;
