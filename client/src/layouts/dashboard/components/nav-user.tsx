import { useState } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";

import ColourAvatar from "@app/components/colour-avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@app/components/ui/sidebar";
import store, { observer } from "@app/stores";
import ProfileModal from "@app/layouts/dashboard/components/profile-modal";

const NavUser = observer(() => {
  const nav = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const me = store.profile;

  const openProfile = () => setProfileOpen(true);

  const onLogout = async () => {
    await store.auth.logout();
    nav("/sign-in");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-1">
        <SidebarMenuButton
          size="lg"
          onClick={openProfile}
          className="flex-1"
          tooltip="edit profile"
        >
          <ColourAvatar
            name={me.name}
            colour={me.colour}
            className="size-8 rounded-lg text-sm"
          />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{me.name}</span>
          </div>
        </SidebarMenuButton>

        <SidebarMenuButton
          onClick={onLogout}
          tooltip="log out"
          className="w-8 justify-center"
        >
          <LogOut className="size-4" />
        </SidebarMenuButton>
      </SidebarMenuItem>
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </SidebarMenu>
  );
});

export default NavUser;
