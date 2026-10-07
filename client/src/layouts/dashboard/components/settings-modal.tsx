import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";

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
import { cn } from "@app/lib/utils";
import { contrastingShade } from "@app/lib/colour";
import ColourAvatar from "@app/components/colour-avatar";
import MicPicker from "@app/layouts/dashboard/components/mic-picker";
import store from "@app/stores";
import { NAME_MAX_LENGTH, PROFILE_COLOURS } from "@app/stores/profile";

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

const SettingsForm = ({ onDone }: { onDone: () => void }) => {
  const { profile } = store;
  const [name, setName] = useState(profile.name);
  const [colour, setColour] = useState(profile.colour);

  const trimmed = name.trim();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    profile.setName(trimmed);
    profile.setColour(colour);
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>settings</DialogTitle>
        <DialogDescription>how your mates see and hear you.</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3">
        <ColourAvatar
          name={trimmed}
          colour={colour}
          className="size-10 rounded-lg text-base"
        />
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="profile-name">name</Label>
          <Input
            id="profile-name"
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

      <MicPicker />

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          cancel
        </Button>
        <Button type="submit" disabled={!trimmed}>
          save
        </Button>
      </DialogFooter>
    </form>
  );
};

export default SettingsModal;
