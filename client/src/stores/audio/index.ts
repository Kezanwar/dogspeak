import { makeObservable, observable, action } from "mobx";
import type { RootStore } from "@app/stores";

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

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeObservable(this, {
      micBlocked: observable,
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
}

export default AudioStore;
