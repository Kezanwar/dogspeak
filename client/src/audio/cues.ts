import { comparer, reaction } from "mobx";

import { audio } from "@app/audio/audio";
import type { RootStore } from "@app/stores";

type Snapshot = { myId: string; channel: string; members: string[] };

/**
 * Join/leave blips for MY current channel, driven by presence:
 * - I switch/leave channel: ONE self cue (join for a real channel, leave for
 *   the lobby) — never a cue per person already in the new channel.
 * - Same channel, member set changed: someone arrived => join, someone went
 *   (switched out or disconnected) => leave.
 * - Nothing in the lobby, nothing for other channels, and nothing for the
 *   initial roster snapshot or a reconnect (myId changes => new baseline).
 * Returns a disposer.
 */
export function startChannelCues(root: RootStore): () => void {
  return reaction<Snapshot>(
    () => {
      const { presence } = root;
      const channel = presence.myChannel;
      return {
        myId: presence.myId,
        channel,
        members: channel
          ? presence
              .membersInChannel(channel)
              .filter((id) => id !== presence.myId)
              .sort()
          : [],
      };
    },
    (cur, prev) => {
      // First snapshot after connect / reconnect: just take the baseline.
      if (!cur.myId || cur.myId !== prev.myId) return;

      if (cur.channel !== prev.channel) {
        audio.playCue(cur.channel ? "join" : "leave");
        return;
      }
      if (!cur.channel) return; // lobby: silent

      const before = new Set(prev.members);
      const after = new Set(cur.members);
      if (cur.members.some((id) => !before.has(id))) audio.playCue("join");
      if (prev.members.some((id) => !after.has(id))) audio.playCue("leave");
    },
    { equals: comparer.structural },
  );
}
