import { type FC } from 'react';
import { AppSidebar } from './components/app-sidebar';
import DashboardHeader from '@app/layouts/dashboard/components/header';
import { SidebarInset, SidebarProvider } from '@app/components/ui/sidebar';
import { Outlet } from 'react-router';
import AuthGuard from '@app/hocs/auth-guard';

const DashboardLayout: FC = () => {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="bg-background text-foreground flex min-h-screen flex-col">
            <DashboardHeader />
            <main className="flex-1 overflow-y-auto p-4">
              <Outlet />
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
};

export default DashboardLayout;
