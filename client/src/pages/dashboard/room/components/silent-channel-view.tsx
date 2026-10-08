import { Moon } from "lucide-react";

import EmptyState from "@app/components/empty-state";
import { CHANNELS } from "@app/config/channels";

// The main panel for a voice channel with no audio (afk): just an empty
// state — no grid, no chat box, no controls. Leaving is the sidebar's job
// (own tile → "leave channel").
const SilentChannelView = ({ channelId }: { channelId: string }) => {
  const channel = CHANNELS.find((c) => c.id === channelId);
  const label = channel?.label ?? channelId;
  return (
    <section
      aria-label={`${label} channel`}
      className="flex min-h-0 flex-1 flex-col"
    >
      <EmptyState
        icon={channel?.icon ?? Moon}
        text={`${label} — away, no voice or chat here`}
      />
    </section>
  );
};

export default SilentChannelView;
