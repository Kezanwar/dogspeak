import { isAudioChannel } from "@app/config/channels";
import store, { observer } from "@app/stores";

import ChatPanel from "./components/chat-panel";
import VoiceView from "./components/voice-view";

// Main panel routes on what you're VIEWING (ui.view), never on which voice
// channel you're IN (presence.myChannel).
const Room = observer(() => {
  const { view } = store.ui;
  // Deliberate: afk (and any non-audio voice channel) shows the general chat,
  // not a grid — you're present but silent there, with no mic or peers.
  const showGrid = view.kind === "voice" && isAudioChannel(view.id);
  return showGrid ? (
    <VoiceView channelId={view.id} />
  ) : (
    <ChatPanel channelId="general" />
  );
});

export default Room;
