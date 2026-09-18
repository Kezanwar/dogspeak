import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";

import { Avatar, AvatarFallback } from "@app/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@app/components/ui/sidebar";
import store, { observer } from "@app/stores";

// TODO: name + colour will come from a small "me" store (localStorage-backed),
// editable via the profile modal, and emitted over the socket on change.
const me = { name: "Kez Anwar", colour: "#8a8a8a" };

const NavUser = observer(() => {
  const nav = useNavigate();

  const initial = me.name.charAt(0).toUpperCase();

  const openProfile = () => {
    // TODO: open the name / colour modal
  };

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
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback
              className="rounded-lg text-white"
              style={{ backgroundColor: me.colour }}
            >
              {initial}
            </AvatarFallback>
          </Avatar>
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
    </SidebarMenu>
  );
});

export default NavUser;
