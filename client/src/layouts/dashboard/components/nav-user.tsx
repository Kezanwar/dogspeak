import { useState } from "react";
import { LogOut } from "lucide-react";

import ColourAvatar from "@app/components/colour-avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@app/components/ui/sidebar";
import store, { observer } from "@app/stores";
import SettingsModal from "@app/layouts/dashboard/components/settings-modal";
import SignOutConfirm from "@app/layouts/dashboard/components/sign-out-confirm";

const NavUser = observer(() => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const me = store.profile;

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-1">
        <SidebarMenuButton
          size="lg"
          onClick={() => setSettingsOpen(true)}
          className="flex-1"
          tooltip="settings"
        >
          <ColourAvatar
            name={me.name}
            colour={me.colour}
            className="size-8 rounded-lg text-sm"
          />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{me.name}</span>
            <span className="text-muted-foreground truncate text-xs">
              settings
            </span>
          </div>
        </SidebarMenuButton>

        <SidebarMenuButton
          onClick={() => setConfirmOpen(true)}
          tooltip="sign out"
          aria-label="sign out"
          className="w-8 justify-center"
        >
          <LogOut className="size-4" />
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

      <SignOutConfirm open={confirmOpen} onOpenChange={setConfirmOpen} />
    </SidebarMenu>
  );
});

export default NavUser;
