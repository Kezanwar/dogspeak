import { useEffect, useRef } from "react";

import { audio } from "@app/audio/audio";
import { Label } from "@app/components/ui/label";
import { SPEAKING_GREEN } from "@app/components/voice/speaking";
import store, { observer } from "@app/stores";

// Voice activation (noise gate): ONE slider on a live input meter. The
// slider value IS the marker's position on the meter (same 0..100 scale, see
// audio/level.ts), and your mic transmits while the fill reaches the marker —
// what you see is what gates. Lower = more open.
//
// The fill/marker geometry shares one inset box (2px each side) whose edges
// match the invisible native range's thumb travel, so the marker sits exactly
// where the slider value is. The meter animates via rAF + direct style writes
// (no observable churn); it reads the live chain's pre-gate analyser, or a
// transient mic opened only while this is mounted (audio tab open).
// Per-frame decay of the displayed level (~28% after 10 frames ≈ 160ms).
const METER_DECAY = 0.88;

const VoiceActivation = observer(() => {
  const a = store.audio;
  const threshold = a.voiceThreshold;
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    audio.beginMeter();
    let raf = 0;
    let shown = 0;
    const tick = () => {
      const fill = fillRef.current;
      if (fill) {
        const level = audio.readInputLevel();
        // Meter ballistics: rise instantly, fall back gently (each frame reads
        // one ~10ms window, so the raw value flickers between syllables). The
        // gate itself decides on the raw level + its own hangover.
        shown = Math.max(level ?? 0, shown * METER_DECAY);
        const pct = shown;
        const open = level !== null && pct >= store.audio.voiceThreshold;
        fill.style.width = `${pct}%`;
        fill.style.backgroundColor = open
          ? SPEAKING_GREEN
          : "var(--muted-foreground)";
        fill.dataset.open = String(open);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio.endMeter(); // closes the transient mic if one was opened
    };
  }, []);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="voice-threshold">activation level</Label>
        <div className="text-muted-foreground flex items-center gap-2 text-xs tabular-nums">
          {threshold}%
          <button
            type="button"
            onClick={() => a.resetVoiceThreshold()}
            aria-label="reset activation level"
            className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-[3px]"
          >
            reset
          </button>
        </div>
      </div>

      <div className="relative h-5">
        {/* live input level */}
        <div
          aria-hidden
          className="bg-muted absolute inset-x-0.5 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full"
        >
          <div
            ref={fillRef}
            data-testid="input-meter-fill"
            className="h-full w-0 rounded-full opacity-80"
          />
        </div>
        <input
          id="voice-threshold"
          type="range"
          min={0}
          max={100}
          step={1}
          value={threshold}
          onChange={(e) => a.setVoiceThreshold(Number(e.target.value))}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-1 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-1 [&::-webkit-slider-thumb]:appearance-none"
        />
        {/* threshold marker = the slider's handle */}
        <div
          aria-hidden
          data-testid="threshold-marker"
          className="bg-foreground peer-focus-visible:ring-ring/50 pointer-events-none absolute top-0 bottom-0 w-1 rounded-full peer-focus-visible:ring-[3px]"
          style={{ left: `calc(${threshold / 100} * (100% - 4px))` }}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        your mic sends when the level reaches the marker. lower = more open.
      </p>
    </div>
  );
});

export default VoiceActivation;
