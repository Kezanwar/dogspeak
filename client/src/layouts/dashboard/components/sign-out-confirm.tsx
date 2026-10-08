import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@app/components/ui/dialog";
import store from "@app/stores";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// The one sign-out confirm, shared by the sidebar's sign-out button and the
// settings modal's profile tab. Signs out only after confirming.
const SignOutConfirm = ({ open, onOpenChange }: Props) => {
  const nav = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await store.auth.logout();
    } finally {
      setSigningOut(false);
      onOpenChange(false);
    }
    nav("/sign-in");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog" className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>sign out?</DialogTitle>
          <DialogDescription>
            you'll leave your channel and need the room password to get back in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
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
  );
};

export default SignOutConfirm;
