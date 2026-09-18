import { observable, action, makeObservable } from "mobx";
import type { RootStore } from "..";

type Theme = "light" | "dark";

const THEME_KEY = "$MobX-theme";

class UIStore {
  rootStore: RootStore;
  theme: Theme = "dark";

  constructor(rootStore: RootStore) {
    makeObservable(this, {
      theme: observable,
      setTheme: action,
      toggleTheme: action,
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
}

export default UIStore;
