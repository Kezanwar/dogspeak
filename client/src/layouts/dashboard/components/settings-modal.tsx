import { useState, type FormEvent } from "react";
import { Check, LogOut, Mic, User } from "lucide-react";

import { Button } from "@app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@app/components/ui/dialog";
import { Input } from "@app/components/ui/input";
import { Label } from "@app/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@app/components/ui/tabs";
import { cn } from "@app/lib/utils";
import { contrastingShade } from "@app/lib/colour";
import ColourAvatar from "@app/components/colour-avatar";
import MicPicker from "@app/layouts/dashboard/components/mic-picker";
import VolumeSettings from "@app/layouts/dashboard/components/volume-settings";
import SignOutConfirm from "@app/layouts/dashboard/components/sign-out-confirm";
import store from "@app/stores";
import { NAME_MAX_LENGTH, PROFILE_COLOURS } from "@app/stores/profile";

type Tab = "profile" | "audio";
const TAB_KEY = "$MobX-settings-tab";

// Opens on the last tab you used (default "profile"). Storage can be
// unavailable or hold junk — fall back quietly.
const readTab = (): Tab => {
  try {
    return localStorage.getItem(TAB_KEY) === "audio" ? "audio" : "profile";
  } catch {
    return "profile";
  }
};
const saveTab = (t: Tab) => {
  try {
    localStorage.setItem(TAB_KEY, t);
  } catch {
    // just won't be remembered
  }
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SettingsModal = ({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {/* mounted only while open, so the draft resets from the store each time */}
        {open && <SettingsForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
};

// Two tabs over one form. The name/colour draft lives here (not in a tab), so
// switching tabs keeps it; save/cancel in the footer apply to it exactly as
// before. The audio controls apply live, as they always have. Panels share a
// min height so switching tabs doesn't resize the modal.
const SettingsForm = ({ onDone }: { onDone: () => void }) => {
  const { profile } = store;
  const [name, setName] = useState(profile.name);
  const [colour, setColour] = useState(profile.colour);
  const [tab, setTab] = useState<Tab>(readTab);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const trimmed = name.trim();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    profile.setName(trimmed);
    profile.setColour(colour);
    onDone();
  };

  const onTab = (v: string) => {
    const t: Tab = v === "audio" ? "audio" : "profile";
    setTab(t);
    saveTab(t);
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>settings</DialogTitle>
        <DialogDescription>how your mates see and hear you.</DialogDescription>
      </DialogHeader>

      <Tabs value={tab} onValueChange={onTab} className="gap-4">
        <TabsList variant="underline">
          <TabsTrigger variant="underline" value="profile">
            <User />
            profile
          </TabsTrigger>
          <TabsTrigger variant="underline" value="audio">
            <Mic />
            audio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className={PANEL}>
          <div className="flex items-center gap-3">
            <ColourAvatar
              name={trimmed}
              colour={colour}
              className="size-10 rounded-lg text-base"
            />
            <div className="grid flex-1 gap-1.5">
              <Input
                id="profile-name"
                aria-label="name"
                value={name}
                maxLength={NAME_MAX_LENGTH}
                autoFocus
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>colour</Label>
            <div className="flex flex-wrap gap-2">
              {PROFILE_COLOURS.map((c) => {
                const selected = c === colour;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`colour ${c}`}
                    aria-pressed={selected}
                    onClick={() => setColour(c)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                      selected && "ring-foreground ring-2 ring-offset-2",
                    )}
                    style={{ backgroundColor: c, color: contrastingShade(c) }}
                  >
                    {selected && <Check className="size-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Same confirm as the sidebar's sign-out button. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive mt-auto w-fit"
          >
            <LogOut className="size-4" />
            sign out
          </Button>
        </TabsContent>

        <TabsContent value="audio" className={PANEL}>
          <MicPicker />
          <VolumeSettings />
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          cancel
        </Button>
        <Button type="submit" disabled={!trimmed}>
          save
        </Button>
      </DialogFooter>

      <SignOutConfirm open={confirmOpen} onOpenChange={setConfirmOpen} />
    </form>
  );
};

// Shared by both panels: same rhythm, and a min height that fits the taller
// one (audio, ~194px today) so the modal doesn't jump when you switch tabs.
// Bump it when a panel outgrows it (e.g. the upcoming voice-activation controls).
const PANEL = "flex min-h-52 flex-col gap-5";

export default SettingsModal;
