import { Coffee, Hash, Moon, type LucideIcon } from "lucide-react";

// The fixed set of voice channels. The server has no list of channels — it
// treats `channel` as an opaque string ("" = lobby) — so this is the catalog.
export interface Channel {
  id: string;
  label: string;
  icon: LucideIcon;
  hasAudio: boolean; // afk = present but silent: no mic, no peer connections
}

/** Text channels. One global chat for now; listed in its own sidebar section. */
export interface TextChannel {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const TEXT_CHANNELS: TextChannel[] = [
  { id: "general", label: "general", icon: Hash },
];

/** Does this channel carry voice? ("" lobby and afk don't.) */
export const isAudioChannel = (channel: string) =>
  CHANNELS.some((c) => c.id === channel && c.hasAudio);

export const CHANNELS: Channel[] = [
  { id: "general", label: "general", icon: Hash, hasAudio: true },
  { id: "lounge", label: "lounge", icon: Coffee, hasAudio: true },
  { id: "afk", label: "afk", icon: Moon, hasAudio: false },
];
