import { makeObservable, observable, action, computed } from "mobx";
import type { RootStore } from "@app/stores";

const MIC_KEY = "$MobX-mic";
const VOLUME_KEY = "$MobX-volume";
const SELF_MUTED_KEY = "$MobX-self-muted";

export const MIC_GAIN_MAX = 2; // 200%

const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : hi;

export type MicDevice = { deviceId: string; label: string };

// The observable face of the audio manager (src/audio/audio.ts). The manager
// keeps everything imperative (pcs, AudioContext, analysers) to itself and
// only writes derived flags here — speaking on transitions, micBlocked when
// getUserMedia fails.
class AudioStore {
  rootStore: RootStore;

  // ids currently speaking. A map (not a set) because ObservableMap.has() is
  // tracked per key, so a MemberTile only re-renders when ITS id flips.
  speaking = observable.map<string, true>();

  // In an audio channel but the mic couldn't be captured (denied/unavailable).
  micBlocked = false;

  // Chosen input, persisted. "" = system default. The label is a hint for
  // when deviceIds rotate (they can change between sessions).
  micDeviceId = "";
  micDeviceLabel = "";

  // Audio inputs from enumerateDevices(); labels are "" until mic permission
  // has been granted once. Refreshed by the manager (incl. on devicechange).
  devices: MicDevice[] = [];

  // The device the live mic track is actually capturing (null = no mic live).
  activeMic: MicDevice | null = null;

  // ── local-only listening controls (never broadcast) ──
  // People I've muted for myself, and my per-person volume (0..1, default 1).
  localMuted = observable.map<string, true>();
  peerVolume = observable.map<string, number>();
  // Persisted: master output volume (0..1) and my mic gain (0..2).
  outputVolume = 1;
  micGain = 1;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    try {
      const saved = JSON.parse(localStorage.getItem(MIC_KEY) ?? "{}") as {
        deviceId?: unknown;
        label?: unknown;
      };
      if (typeof saved.deviceId === "string") this.micDeviceId = saved.deviceId;
      if (typeof saved.label === "string") this.micDeviceLabel = saved.label;
    } catch {
      // corrupt / unavailable storage — use the system default
    }
    try {
      const vol = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? "{}") as {
        output?: unknown;
        micGain?: unknown;
      };
      // Number.isFinite too: typeof lets NaN/Infinity (e.g. "1e999") through,
      // and clamp would turn those into the max. Garbage keeps the defaults.
      if (typeof vol.output === "number" && Number.isFinite(vol.output))
        this.outputVolume = clamp(vol.output, 0, 1);
      if (typeof vol.micGain === "number" && Number.isFinite(vol.micGain))
        this.micGain = clamp(vol.micGain, 0, MIC_GAIN_MAX);
    } catch {
      // defaults
    }
    makeObservable(this, {
      micBlocked: observable,
      micDeviceId: observable,
      micDeviceLabel: observable,
      devices: observable.ref,
      activeMic: observable.ref,
      setDevices: action,
      setActiveMic: action,
      setMicChoice: action,
      labelsHidden: computed,
      outputVolume: observable,
      micGain: observable,
      selfMuted: computed,
      toggleSelfMute: action,
      restoreSelfMute: action,
      toggleLocalMute: action,
      setPeerVolume: action,
      setOutputVolume: action,
      setMicGain: action,
      setSpeaking: action,
      clearSpeaking: action,
      setMicBlocked: action,
    });
  }

  isSpeaking(id: string): boolean {
    return this.speaking.has(id);
  }

  setSpeaking(id: string, on: boolean) {
    if (on) this.speaking.set(id, true);
    else this.speaking.delete(id);
  }

  /** Clear one id, or everyone when called with no id. */
  clearSpeaking(id?: string) {
    if (id === undefined) this.speaking.clear();
    else this.speaking.delete(id);
  }

  setMicBlocked(blocked: boolean) {
    this.micBlocked = blocked;
  }

  /** True when the browser is hiding device labels (no mic permission yet). */
  get labelsHidden(): boolean {
    return this.devices.length > 0 && this.devices.every((d) => !d.label);
  }

  setDevices(devices: MicDevice[]) {
    this.devices = devices;
  }

  setActiveMic(mic: MicDevice | null) {
    this.activeMic = mic;
  }

  /** Persist the chosen input ("" = system default). */
  setMicChoice(deviceId: string, label: string) {
    this.micDeviceId = deviceId;
    this.micDeviceLabel = deviceId ? label : "";
    try {
      localStorage.setItem(
        MIC_KEY,
        JSON.stringify({
          deviceId: this.micDeviceId,
          label: this.micDeviceLabel,
        }),
      );
    } catch {
      // storage full / disabled — the choice just won't survive a reload
    }
  }

  // ── self-mute (broadcast via presence) ──
  /** Am I self-muted? Presence is the source of truth (it's broadcast). */
  get selfMuted(): boolean {
    return this.rootStore.presence.me?.muted ?? false;
  }

  /**
   * Toggle my mic mute: persist it (so it survives a refresh) and broadcast
   * it via presence. The audio manager reacts by disabling the track.
   */
  toggleSelfMute() {
    const muted = !this.selfMuted;
    try {
      localStorage.setItem(SELF_MUTED_KEY, JSON.stringify(muted));
    } catch {
      // storage full / disabled — mute just won't survive a refresh
    }
    this.rootStore.presence.setMuted(muted);
  }

  /**
   * Re-assert a persisted self-mute on (re)connect. The server treats every
   * connection as fresh and unmuted, so the client re-sends user:mute — called
   * from the session:welcome handler, i.e. as soon as we've joined, before
   * any later frame is processed.
   */
  restoreSelfMute() {
    let saved = false;
    try {
      saved =
        JSON.parse(localStorage.getItem(SELF_MUTED_KEY) ?? "false") === true;
    } catch {
      // corrupt storage — stay unmuted
    }
    if (saved) this.rootStore.presence.setMuted(true);
  }

  // ── local-only per-person controls ──
  isLocallyMuted(id: string): boolean {
    return this.localMuted.has(id);
  }

  toggleLocalMute(id: string) {
    if (this.localMuted.has(id)) this.localMuted.delete(id);
    else this.localMuted.set(id, true);
  }

  volumeOf(id: string): number {
    return this.peerVolume.get(id) ?? 1;
  }

  setPeerVolume(id: string, volume: number) {
    this.peerVolume.set(id, clamp(volume, 0, 1));
  }

  setOutputVolume(volume: number) {
    this.outputVolume = clamp(volume, 0, 1);
    this.#persistVolume();
  }

  setMicGain(gain: number) {
    this.micGain = clamp(gain, 0, MIC_GAIN_MAX);
    this.#persistVolume();
  }

  #persistVolume() {
    try {
      localStorage.setItem(
        VOLUME_KEY,
        JSON.stringify({ output: this.outputVolume, micGain: this.micGain }),
      );
    } catch {
      // storage full / disabled
    }
  }
}

export default AudioStore;
