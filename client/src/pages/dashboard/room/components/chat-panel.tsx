import { useEffect, useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { MessagesSquare } from "lucide-react";

import { Input } from "@app/components/ui/input";
import { TEXT_CHANNELS } from "@app/config/channels";
import type { ChatMessage } from "@app/socket/events";
import { contrastingShade } from "@app/lib/colour";
import { cn } from "@app/lib/utils";
import store, { observer } from "@app/stores";

const MAX_CHAT_LENGTH = 2000; // mirrors the server's cap

// Each message is one bubble: a header row (name chip + timestamp) with the
// text beneath. Own messages sit on the right, everyone else's on the left.
// The surface is the theme's muted token so it sits just off the page in light
// and dark. Short messages hug their content (shrink-to-fit via self-start/end);
// long ones wrap at ~50% of the panel, ~a third from lg up.
//
// Identity is by uuid (message.authorId): "mine" survives a reload, and the
// name + colour come LIVE from whoever has that uuid now — so renames/recolours
// update past messages — falling back to the message's frozen snapshot when the
// author isn't connected. An observer, so only affected rows re-render.
const MessageRow = observer(({ message }: { message: ChatMessage }) => {
  const isMine = message.authorId === store.profile.uuid;
  const author = store.presence.byUuid.get(message.authorId);
  const name = author?.name ?? message.name;
  const colour = author?.colour ?? message.colour;

  return (
    <li
      className={cn(
        "bg-muted my-1 flex max-w-[50%] min-w-0 flex-col gap-2 rounded-2xl px-3 py-3 lg:max-w-[33%]",
        isMine
          ? "self-end rounded-br-md" // tail corner toward the sender's side
          : "self-start rounded-bl-md",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Chip matches the sender's avatar: their colour, readable same-hue shade. */}
        <span
          className="truncate rounded-full px-2 py-0.5 text-xs leading-tight font-semibold"
          style={{
            backgroundColor: colour,
            color: contrastingShade(colour),
          }}
        >
          {name}
        </span>
        <time
          className="text-muted-foreground shrink-0 text-[11px]"
          dateTime={new Date(message.ts).toISOString()}
        >
          {format(new Date(message.ts), "HH:mm dd/MM/yyyy")}
        </time>
      </div>
      <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>
    </li>
  );
});

// The global text chat. Always usable — in the lobby, in a voice channel, or
// while viewing text from inside one; it doesn't depend on presence.myChannel.
const ChatPanel = observer(({ channelId }: { channelId: string }) => {
  const { chat } = store;
  const messages = chat.messages;
  const label =
    TEXT_CHANNELS.find((c) => c.id === channelId)?.label ?? channelId;

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as messages arrive (and on opening).
  const newestId = messages[messages.length - 1]?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [newestId]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    chat.send(draft);
    setDraft("");
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {/* Flex column + mt-auto on the content: messages hug the bottom and
          grow upward, and the container still scrolls up to older ones. */}
      {/* Top ~2rem fades to transparent via a mask (no colour, so it's
          theme-proof); the bottom stays crisp. Masks don't affect events. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pt-8 [mask-image:linear-gradient(to_bottom,transparent,black_2rem,black_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_2rem,black_100%)]">
        {messages.length === 0 ? (
          <EmptyState text={`no messages in ${label} yet`} />
        ) : (
          <ul className="mt-auto flex flex-col pb-2 gap-1">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="pt-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={`message ${label}`}
          aria-label="chat message"
          autoComplete="off"
        />
      </form>
    </section>
  );
});

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-sm">
    <MessagesSquare className="size-6 opacity-60" />
    {text}
  </div>
);

export default ChatPanel;
