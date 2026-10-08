import { isAudioChannel } from "@app/config/channels";
import store, { observer } from "@app/stores";

import ChatPanel from "./components/chat-panel";
import SilentChannelView from "./components/silent-channel-view";
import VoiceView from "./components/voice-view";

// Main panel routes on what you're VIEWING (ui.view), never on which voice
// channel you're IN (presence.myChannel):
//   text                    → the (global) chat
//   voice, audio channel    → the member grid
//   voice, no-audio channel → an empty state (afk: no voice, no chat)
// Gated on isAudioChannel, not on "afk", so the channel catalog stays the
// single source of truth.
const Room = observer(() => {
  const { view } = store.ui;
  if (view.kind === "text") return <ChatPanel channelId="general" />;
  if (isAudioChannel(view.id)) return <VoiceView channelId={view.id} />;
  return <SilentChannelView channelId={view.id} />;
});

export default Room;
