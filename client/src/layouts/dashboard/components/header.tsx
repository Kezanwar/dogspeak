import ToggleTheme from "@app/components/buttons/toggle-theme";
import { SidebarTrigger } from "@app/components/ui/sidebar";

import ConnectionStatus from "./connection-status";

const DashboardHeader = () => {
  return (
    <div className="p-3">
      <div className="bg-paper text-foreground flex items-center justify-between">
        <SidebarTrigger />
        <ConnectionStatus />
        <div className="flex items-center gap-3">
          <ToggleTheme />
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
