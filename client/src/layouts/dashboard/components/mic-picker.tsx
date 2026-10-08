import { useEffect, useState } from "react";
import { Mic } from "lucide-react";

import { audio } from "@app/audio/audio";
import { Button } from "@app/components/ui/button";
import { Label } from "@app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@app/components/ui/select";
import store, { observer } from "@app/stores";

// Radix Select can't use "" as an item value; this stands for "system default".
const DEFAULT = "__default__";

// Microphone choice. Reads observable device state from the audio store and
// writes through the audio manager, which persists it and — if you're in an
// audio channel — swaps the live track in place. Applies immediately (it's
// not part of the name/colour draft that "save" commits).
const MicPicker = observer(() => {
  const { audio: a } = store;
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    void audio.refreshDevices();
  }, []);

  const value = a.micDeviceId || DEFAULT;
  // Keep the saved choice selectable even if it isn't plugged in right now.
  const savedMissing =
    !!a.micDeviceId && !a.devices.some((d) => d.deviceId === a.micDeviceId);

  const onChange = (v: string) => {
    const id = v === DEFAULT ? "" : v;
    const label = a.devices.find((d) => d.deviceId === id)?.label ?? "";
    void audio.setMic(id, label);
  };

  const askPermission = async () => {
    setAsking(true);
    try {
      await audio.requestPermission();
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor="mic-picker">microphone</Label>

      {a.labelsHidden || a.devices.length === 0 ? (
        <div className="text-muted-foreground flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-xs">
          <span>
            {a.devices.length === 0
              ? "no microphones found."
              : "allow mic access to see your microphones by name."}
          </span>
          {a.devices.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={askPermission}
              disabled={asking}
            >
              allow
            </Button>
          )}
        </div>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id="mic-picker" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>system default</SelectItem>
            {a.devices.map((d, i) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `microphone ${i + 1}`}
              </SelectItem>
            ))}
            {savedMissing && (
              <SelectItem value={a.micDeviceId} disabled>
                {a.micDeviceLabel || "saved microphone"} (not connected)
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      )}

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Mic className="size-3.5 shrink-0" />
        {a.activeMic ? (
          <span className="truncate">
            in use: {a.activeMic.label || "microphone"}
          </span>
        ) : (
          <span>used when you join a voice channel</span>
        )}
      </p>
    </div>
  );
});

export default MicPicker;
