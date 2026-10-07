import store from "@app/stores";

// Who's talking, from local voice-activity detection in the audio manager.
// Reads an observable per-id flag, so call it inside an observer.
export const isSpeaking = (id: string): boolean => store.audio.isSpeaking(id);
