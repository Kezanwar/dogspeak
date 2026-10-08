import DogHeadset from "@app/components/dog-headset";
import Spinner from "@app/components/spinner";

// Full-screen park while the server is in maintenance mode. No sidebar, no
// shell, no socket, no audio (MaintenanceStore.enter tore them down). The
// store polls /api/status and lifts this on its own when it's over.
const MaintenanceScreen = () => (
  <main className="bg-background text-foreground flex h-svh flex-col items-center justify-center gap-2 p-4 text-center text-sm">
    <DogHeadset className="text-foreground/80 w-40 sm:w-48" />
    <p>dogspeak is getting an upgrade</p>
    <p className="text-muted-foreground max-w-xs text-xs">
      hang tight, back in a moment.
    </p>
    <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
      <Spinner size={14} label="checking again" />
      <span aria-hidden>checking again shortly…</span>
    </div>
  </main>
);

export default MaintenanceScreen;
