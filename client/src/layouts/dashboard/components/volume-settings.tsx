import { Label } from "@app/components/ui/label";
import store, { observer } from "@app/stores";
import { MIC_GAIN_MAX } from "@app/stores/audio";

// Your own volume controls. Persisted, applied live (not part of the
// name/colour draft): output scales everyone you hear; mic volume is a gain
// on what you send (>100% boosts, and can boost background noise too).
const VolumeSettings = observer(() => {
  const { audio } = store;
  const output = Math.round(audio.outputVolume * 100);
  const mic = Math.round(audio.micGain * 100);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="output-volume">output volume</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {output}%
          </span>
        </div>
        <input
          id="output-volume"
          type="range"
          min={0}
          max={100}
          step={1}
          value={output}
          onChange={(e) => audio.setOutputVolume(Number(e.target.value) / 100)}
          className="accent-primary w-full"
        />
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="mic-volume">mic volume</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {mic}%
          </span>
        </div>
        <input
          id="mic-volume"
          type="range"
          min={0}
          max={MIC_GAIN_MAX * 100}
          step={5}
          value={mic}
          onChange={(e) => audio.setMicGain(Number(e.target.value) / 100)}
          className="accent-primary w-full"
        />
      </div>
    </div>
  );
});

export default VolumeSettings;
