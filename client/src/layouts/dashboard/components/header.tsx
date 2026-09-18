import ToggleTheme from "@app/components/buttons/toggle-theme";
import { SidebarTrigger } from "@app/components/ui/sidebar";

const DashboardHeader = () => {
  return (
    <div className="p-3">
      <div className="bg-paper text-foreground flex items-center justify-between">
        <SidebarTrigger />
        <ToggleTheme />
      </div>
    </div>
  );
};

export default DashboardHeader;
