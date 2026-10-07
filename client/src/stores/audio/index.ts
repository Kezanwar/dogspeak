import { makeObservable, observable, action, computed } from "mobx";
import type { RootStore } from "@app/stores";

const MIC_KEY = "$MobX-mic";

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
}

export default AudioStore;
