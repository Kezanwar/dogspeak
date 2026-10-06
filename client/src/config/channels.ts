import { Coffee, Hash, Moon, type LucideIcon } from "lucide-react";

// The fixed set of voice channels. The server has no list of channels — it
// treats `channel` as an opaque string ("" = lobby) — so this is the catalog.
export interface Channel {
  id: string;
  label: string;
  icon: LucideIcon;
  hasAudio: boolean; // afk = present but silent: no mic, no peer connections
}

export const CHANNELS: Channel[] = [
  { id: "general", label: "general", icon: Hash, hasAudio: true },
  { id: "lounge", label: "lounge", icon: Coffee, hasAudio: true },
  { id: "afk", label: "afk", icon: Moon, hasAudio: false },
];
