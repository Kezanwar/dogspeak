import { makeObservable, observable, action } from "mobx";
import type { RootStore } from "..";

const PROFILE_KEY = "$MobX-profile";

export const NAME_MAX_LENGTH = 32;

/** Preset swatches offered in the profile modal. */
export const PROFILE_COLOURS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

const randomName = () => `dog-${Math.floor(1000 + Math.random() * 9000)}`;

const randomColour = (): string =>
  PROFILE_COLOURS[Math.floor(Math.random() * PROFILE_COLOURS.length)] ??
  "#3b82f6";

// Identity-LITE: a random per-browser id, NOT auth (it's client-supplied and
// spoofable, like the name — the room password is the trust boundary).
const newUUID = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); // non-secure contexts
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

const isUUID = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 64;

const isHexColour = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

// My own identity (uuid + name + colour). localStorage is the source of truth
// across reloads; PresenceStore carries it to everyone else over the socket.
class ProfileStore {
  rootStore: RootStore;
  /** Stable per-browser identity, sent at connect. Generated once, never
   *  cleared on logout; only lost if site storage is cleared. */
  readonly uuid: string;
  name: string;
  colour: string;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;

    const saved = this.load();
    this.uuid = saved.uuid ?? newUUID();
    this.name = saved.name ?? randomName();
    this.colour = saved.colour ?? randomColour();
    this.persist(); // first visit: keep the generated defaults stable

    makeObservable(this, {
      name: observable,
      colour: observable,
      setName: action,
      setColour: action,
    });
  }

  setName = (name: string) => {
    const next = name.trim().slice(0, NAME_MAX_LENGTH);
    if (!next || next === this.name) return;
    this.name = next;
    this.persist();
    this.rootStore.presence.setName(next);
  };

  setColour = (colour: string) => {
    if (!isHexColour(colour) || colour === this.colour) return;
    this.colour = colour;
    this.persist();
    this.rootStore.presence.setColour(colour);
  };

  private load(): { uuid?: string; name?: string; colour?: string } {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return {};
      const { uuid, name, colour } = parsed as Record<string, unknown>;
      return {
        uuid: isUUID(uuid) ? uuid : undefined,
        name:
          typeof name === "string" && name.trim()
            ? name.trim().slice(0, NAME_MAX_LENGTH)
            : undefined,
        colour: isHexColour(colour) ? colour : undefined,
      };
    } catch {
      return {};
    }
  }

  private persist() {
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          uuid: this.uuid,
          name: this.name,
          colour: this.colour,
        }),
      );
    } catch {
      // storage full / disabled — identity just won't survive a reload
    }
  }
}

export default ProfileStore;
