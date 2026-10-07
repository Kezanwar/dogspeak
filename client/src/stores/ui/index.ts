import { observable, action, makeObservable } from "mobx";
import type { RootStore } from "..";

type Theme = "light" | "dark";

/**
 * What the main panel is SHOWING — deliberately separate from
 * presence.myChannel (which voice channel you're IN). You can be talking in a
 * voice channel while reading the text chat, or preview a voice channel you
 * haven't joined. Changing the view never touches audio.
 */
export type View = { kind: "text"; id: string } | { kind: "voice"; id: string };

export const DEFAULT_VIEW: View = { kind: "text", id: "general" };

const THEME_KEY = "$MobX-theme";

class UIStore {
  rootStore: RootStore;
  theme: Theme = "dark";
  // Always starts on the general text channel (no "last viewed" persistence).
  view: View = DEFAULT_VIEW;

  constructor(rootStore: RootStore) {
    makeObservable(this, {
      theme: observable,
      view: observable.ref,
      setTheme: action,
      toggleTheme: action,
      viewText: action,
      viewVoice: action,
      enterVoice: action,
      leaveVoice: action,
    });

    this.rootStore = rootStore;

    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved === "light" || saved === "dark") {
      this.setTheme(saved);
    }

    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(this.theme);
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  toggleTheme() {
    this.setTheme(this.theme === "dark" ? "light" : "dark");
  }

  // ── view (what the main panel shows) ──────────────────────────
  /** Show a text channel. View-only: voice membership and peers untouched. */
  viewText(id = DEFAULT_VIEW.id) {
    this.view = { kind: "text", id };
  }

  /** Show / preview a voice channel without joining its audio. */
  viewVoice(id: string) {
    this.view = { kind: "voice", id };
  }

  /**
   * Join a voice channel and show it (double-click). If you're already in it,
   * skip the join entirely — no joinChannel, no user:change_channel, no mesh
   * teardown — and just bring its view back.
   */
  enterVoice(id: string) {
    const { presence } = this.rootStore;
    if (id !== presence.myChannel) presence.joinChannel(id);
    this.viewVoice(id);
  }

  /** Leave your voice channel; if you were viewing it, fall back to text. */
  leaveVoice() {
    const { presence } = this.rootStore;
    const left = presence.myChannel;
    if (!left) return;
    presence.joinChannel("");
    if (this.view.kind === "voice" && this.view.id === left) this.viewText();
  }
}

export default UIStore;
