import Spinner from "@app/components/spinner";
import store, { observer } from "@app/stores";

// Shown only while the presence socket isn't open: first connect after login,
// or the backoff reconnects after a drop. Nothing at all once connected.
const ConnectionStatus = observer(() => {
  const { connected, everConnected } = store.presence;
  if (connected) return null;
  const text = everConnected ? "reconnecting…" : "connecting…";
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      <Spinner size={14} label={text} />
      <span aria-hidden>{text}</span>
    </div>
  );
});

export default ConnectionStatus;
