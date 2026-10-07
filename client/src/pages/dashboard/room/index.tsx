import store, { observer } from "@app/stores";

import ChatPanel from "./components/chat-panel";
import VoiceView from "./components/voice-view";

// Main panel routes on what you're VIEWING (ui.view), never on which voice
// channel you're IN (presence.myChannel).
const Room = observer(() => {
  const { view } = store.ui;
  return view.kind === "text" ? (
    <ChatPanel channelId={view.id} />
  ) : (
    <VoiceView channelId={view.id} />
  );
});

export default Room;
