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

const isHexColour = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

// My own identity (name + colour). localStorage is the source of truth across
// reloads; PresenceStore carries it to everyone else over the socket.
class ProfileStore {
  rootStore: RootStore;
  name: string;
  colour: string;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;

    const saved = this.load();
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

  private load(): { name?: string; colour?: string } {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return {};
      const { name, colour } = parsed as Record<string, unknown>;
      return {
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
        JSON.stringify({ name: this.name, colour: this.colour }),
      );
    } catch {
      // storage full / disabled — identity just won't survive a reload
    }
  }
}

export default ProfileStore;
