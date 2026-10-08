import { AppWindow } from "lucide-react";

import EmptyState from "@app/components/empty-state";
import { Button } from "@app/components/ui/button";
import store from "@app/stores";

// Full-screen state when a newer session for this browser's identity took
// over (another tab, or a refresh elsewhere). No sidebar, no shell: the
// dashboard is unmounted, so this tab has released its mic and socket.
// "continue here" reconnects, which supersedes the other tab in turn.
const SupersededScreen = () => (
  <main className="bg-background text-foreground flex h-svh flex-col p-4">
    <EmptyState icon={AppWindow} text="you're connected in another tab">
      <p className="text-muted-foreground/80 max-w-xs text-center text-xs">
        dogspeak is open somewhere else — close this tab or continue here.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => store.presence.continueHere()}
      >
        continue here
      </Button>
    </EmptyState>
  </main>
);

export default SupersededScreen;
