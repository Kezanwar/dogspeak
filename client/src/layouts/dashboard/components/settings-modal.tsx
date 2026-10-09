import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Mic, User } from "lucide-react";

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
import VoiceActivation from "@app/layouts/dashboard/components/voice-activation";
import store from "@app/stores";
import { NAME_MAX_LENGTH, PROFILE_COLOURS } from "@app/stores/profile";
import type { AudioSettingsSnapshot } from "@app/stores/audio";

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

// Explicit save-or-cancel. Backdrop clicks and Escape don't close it; the
// only ways out are save, cancel and the X (which is cancel).
//
// The audio tab is transactional: its controls apply LIVE (peers hear the
// change at once — tune the gate while mates tell you what they hear) but
// nothing persists until save → audio.commit(). Cancel / X → audio.restore()
// puts the values from when the modal opened back, live chain and mic
// device included. The profile tab keeps its own draft as before.
const SettingsModal = ({ open, onOpenChange }: Props) => {
  // The audio tab's values as the modal opened; null once saved/cancelled.
  const snap = useRef<AudioSettingsSnapshot | null>(null);

  useEffect(() => {
    if (!open) return;
    snap.current = store.audio.snapshot();
    // Closed or unmounted without save/cancel (e.g. maintenance swapped the
    // app out): revert rather than leave unsaved preview values behind.
    return () => {
      if (snap.current) store.audio.restore(snap.current);
      snap.current = null;
    };
  }, [open]);

  const cancel = () => {
    if (snap.current) store.audio.restore(snap.current);
    snap.current = null;
    onOpenChange(false);
  };

  const save = () => {
    store.audio.commit();
    snap.current = null;
    onOpenChange(false);
  };

  return (
    // The only close Radix can still trigger here is the X → treat as cancel.
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : cancel())}
    >
      <DialogContent
        className="sm:max-w-sm"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* mounted only while open, so the draft resets from the store each time */}
        {open && <SettingsForm onSave={save} onCancel={cancel} />}
      </DialogContent>
    </Dialog>
  );
};

// Two tabs over one form. The name/colour draft lives here (not in a tab), so
// switching tabs keeps it. Save submits the profile draft as before and
// commits the audio tab; cancel discards the draft and reverts the audio tab
// (see SettingsModal). Panels share a min height so switching tabs doesn't
// resize the modal.
const SettingsForm = ({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) => {
  const { profile } = store;
  const [name, setName] = useState(profile.name);
  const [colour, setColour] = useState(profile.colour);
  const [tab, setTab] = useState<Tab>(readTab);

  const trimmed = name.trim();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    profile.setName(trimmed);
    profile.setColour(colour);
    onSave(); // persists the audio tab, then closes
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
        </TabsContent>

        <TabsContent value="audio" className={PANEL}>
          <MicPicker />
          <VolumeSettings />
          <VoiceActivation />
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          cancel
        </Button>
        <Button type="submit" disabled={!trimmed}>
          save
        </Button>
      </DialogFooter>
    </form>
  );
};

// Shared by both panels: same rhythm, and a min height that fits the taller
// one (audio, ~294px with the voice-activation meter) so the modal doesn't
// jump when you switch tabs. Bump it when a panel outgrows it.
const PANEL = "flex min-h-[294px] flex-col gap-5";

export default SettingsModal;
