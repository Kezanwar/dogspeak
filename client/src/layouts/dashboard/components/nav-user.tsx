import { useState } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";

import ColourAvatar from "@app/components/colour-avatar";
import { Button } from "@app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@app/components/ui/dialog";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@app/components/ui/sidebar";
import store, { observer } from "@app/stores";
import SettingsModal from "@app/layouts/dashboard/components/settings-modal";

const NavUser = observer(() => {
  const nav = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const me = store.profile;

  // Only after confirming.
  const onLogout = async () => {
    setSigningOut(true);
    try {
      await store.auth.logout();
    } finally {
      setSigningOut(false);
      setConfirmOpen(false);
    }
    nav("/sign-in");
  };

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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent role="alertdialog" className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>sign out?</DialogTitle>
            <DialogDescription>
              you'll leave your channel and need the room password to get
              back in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              autoFocus // safe default for a destructive confirm
            >
              cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onLogout}
              disabled={signingOut}
            >
              sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
});

export default NavUser;
