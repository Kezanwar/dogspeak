import { useEffect, useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { MessagesSquare } from "lucide-react";

import { Input } from "@app/components/ui/input";
import { CHANNELS } from "@app/config/channels";
import type { ChatMessage } from "@app/socket/events";
import store, { observer } from "@app/stores";

const MAX_CHAT_LENGTH = 2000; // mirrors the server's cap

const MessageRow = ({ message }: { message: ChatMessage }) => (
  <li className="flex flex-col gap-0.5 px-1 py-1.5">
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-medium" style={{ color: message.colour }}>
        {message.name}
      </span>
      <time
        className="text-muted-foreground text-[11px]"
        dateTime={new Date(message.ts).toISOString()}
      >
        {format(new Date(message.ts), "HH:mm dd/MM/yyyy")}
      </time>
    </div>
    <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>
  </li>
);

const ChatPanel = observer(() => {
  const { presence, chat } = store;
  const channel = presence.myChannel;
  const inLobby = channel === "";
  const messages = inLobby ? [] : chat.messagesIn(channel);
  const label = CHANNELS.find((c) => c.id === channel)?.label ?? channel;

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as messages arrive or the channel changes.
  const newestId = messages[messages.length - 1]?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [newestId, channel]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inLobby || !draft.trim()) return;
    chat.send(draft);
    setDraft("");
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border">
      <header className="border-b px-4 py-2.5 text-sm font-medium">
        {inLobby ? "chat" : `# ${label}`}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {inLobby ? (
          <EmptyState text="join a channel to chat" />
        ) : messages.length === 0 ? (
          <EmptyState text={`no messages in ${label} yet`} />
        ) : (
          <ul className="flex flex-col">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={inLobby}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={inLobby ? "" : `message ${label}`}
          aria-label="chat message"
          autoComplete="off"
        />
      </form>
    </section>
  );
});

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
    <MessagesSquare className="size-6 opacity-60" />
    {text}
  </div>
);

export default ChatPanel;
