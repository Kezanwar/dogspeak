import { makeObservable, observable, action, computed } from "mobx";
import type { RootStore } from "@app/stores";

const MIC_KEY = "$MobX-mic";
const VOLUME_KEY = "$MobX-volume";
const SELF_MUTED_KEY = "$MobX-self-muted";
const LOCAL_AUDIO_KEY = "$MobX-local-audio";

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

  // getUserMedia in flight (joining an audio channel, or a banner retry).
  micAcquiring = false;

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
  // Keyed by the other person's client UUID (not their connection id), so it
  // survives THEIR reconnects; persisted so it survives YOUR reload.
  localMuted = observable.map<string, true>(); // uuid -> muted by me
  peerVolume = observable.map<string, number>(); // uuid -> 0..1
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
    this.#loadLocalAudio();
    makeObservable(this, {
      micBlocked: observable,
      micAcquiring: observable,
      setMicAcquiring: action,
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
      setSelfMute: action,
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

  setMicAcquiring(acquiring: boolean) {
    this.micAcquiring = acquiring;
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
    this.setSelfMute(!this.selfMuted);
  }

  /**
   * Set my mic mute (persisted + broadcast); shared by the button and the
   * mic-volume slider. Idempotent: no persist / re-broadcast when nothing
   * changes, so the gain coupling can't send duplicate user:mute/unmute.
   */
  setSelfMute(muted: boolean) {
    if (muted === this.selfMuted) return;
    try {
      localStorage.setItem(SELF_MUTED_KEY, JSON.stringify(muted));
    } catch {
      // storage full / disabled — mute just won't survive a refresh
    }
    this.rootStore.presence.setMuted(muted);
    // Unmuting must make you audible again: if the slider was at 0% (e.g.
    // muted by dragging it there, then unmuted via the button), restore 100%.
    // Set the field directly — going through setMicGain would re-fire the
    // zero-crossing. The manager's micGain reaction applies it to the node.
    if (!muted && this.micGain === 0) {
      this.micGain = 1;
      this.#persistVolume();
    }
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

  // ── local-only per-person controls (keyed by uuid, persisted) ──
  isLocallyMuted(uuid: string): boolean {
    return this.localMuted.has(uuid);
  }

  toggleLocalMute(uuid: string) {
    if (this.localMuted.has(uuid)) this.localMuted.delete(uuid);
    else this.localMuted.set(uuid, true);
    this.#persistLocalAudio();
  }

  volumeOf(uuid: string): number {
    return this.peerVolume.get(uuid) ?? 1;
  }

  setPeerVolume(uuid: string, volume: number) {
    const v = clamp(volume, 0, 1);
    if (v === 1)
      this.peerVolume.delete(uuid); // default: don't store it
    else this.peerVolume.set(uuid, v);
    this.#persistLocalAudio();
  }

  /** A peer connection's uuid, from presence (undefined until known). */
  uuidOfConnection(connId: string): string | undefined {
    return this.rootStore.presence.users.get(connId)?.uuid;
  }

  #loadLocalAudio() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_AUDIO_KEY) ?? "{}") as {
        muted?: unknown;
        volumes?: unknown;
      };
      if (Array.isArray(raw.muted)) {
        for (const u of raw.muted)
          if (typeof u === "string") this.localMuted.set(u, true);
      }
      if (raw.volumes && typeof raw.volumes === "object") {
        for (const [u, v] of Object.entries(raw.volumes)) {
          if (typeof v === "number" && Number.isFinite(v))
            this.peerVolume.set(u, clamp(v, 0, 1));
        }
      }
    } catch {
      // corrupt storage — nobody muted, everyone at full volume
    }
  }

  #persistLocalAudio() {
    try {
      localStorage.setItem(
        LOCAL_AUDIO_KEY,
        JSON.stringify({
          muted: [...this.localMuted.keys()],
          volumes: Object.fromEntries(this.peerVolume),
        }),
      );
    } catch {
      // storage full / disabled — settings just won't survive a reload
    }
  }

  setOutputVolume(volume: number) {
    this.outputVolume = clamp(volume, 0, 1);
    this.#persistVolume();
  }

  /**
   * Mic volume. Crossing zero drives self-mute: dragging to 0% mutes you
   * (broadcast, icon, persisted — the normal self-mute path), and raising it
   * back up from 0% unmutes you.
   */
  setMicGain(gain: number) {
    const prev = this.micGain;
    this.micGain = clamp(gain, 0, MIC_GAIN_MAX);
    this.#persistVolume();
    if (this.micGain === 0 && prev !== 0) this.setSelfMute(true);
    else if (this.micGain > 0 && prev === 0) this.setSelfMute(false);
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
