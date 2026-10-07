import { useEffect, type FC } from 'react';
import { AppSidebar } from './components/app-sidebar';
import DashboardHeader from '@app/layouts/dashboard/components/header';
import { SidebarInset, SidebarProvider } from '@app/components/ui/sidebar';
import { Outlet } from 'react-router';
import AuthGuard from '@app/hocs/auth-guard';
import store, { observer } from '@app/stores';
import { startAudio } from '@app/audio/audio';

// Opens the presence socket once we're authenticated and closes it on unmount
// (logout / leaving the dashboard). Keyed only on the auth flag, so re-renders
// never reconnect; profile edits travel as change events, not reconnects.
const PresenceConnection: FC = observer(() => {
  const authed = store.auth.isAuthenticated;

  useEffect(() => {
    if (!authed) return;
    const { presence, profile } = store;
    presence.connect(profile.name, profile.colour);
    // The audio mesh follows presence (my channel + its members).
    const stopAudio = startAudio(store);
    return () => {
      stopAudio(); // close peers, release the mic
      presence.disconnect();
    };
  }, [authed]);

  return null;
});

const DashboardLayout: FC = () => {
  return (
    <AuthGuard>
      <PresenceConnection />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="bg-background text-foreground flex h-svh flex-col">
            <DashboardHeader />
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <Outlet />
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
};

export default DashboardLayout;
