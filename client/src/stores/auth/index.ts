import { makeObservable, observable, action, runInAction } from "mobx";
import { RootStore } from "@app/stores/index";
import { getSession, deleteSession } from "@app/api/auth";

class AuthStore {
  rootStore: RootStore;

  constructor(rootStore: RootStore) {
    makeObservable(this, {
      isAuthenticated: observable,
      isInitialized: observable,
      initialize: action,
      authenticate: action,
      logout: action,
    });

    this.rootStore = rootStore;
  }

  // Auth is just a boolean now. The httpOnly cookie is the real source of truth,
  // and JS can't read it — so we ask the server (GET /session) and record the
  // yes/no here.
  isAuthenticated = false;
  isInitialized = false;

  // Runs once on load: is there already a valid session cookie?
  initialize = async () => {
    let ok = false;
    try {
      const res = await getSession();
      ok = res.data?.ok === true; // an HTML 200 has no `ok` -> stays false
    } catch {
      ok = false;
    }
    runInAction(() => {
      this.isAuthenticated = ok;
      this.isInitialized = true;
    });
  };

  // Called after a successful POST /session — the server has already set the
  // cookie, so we just record that we're in.
  authenticate = () => {
    this.isAuthenticated = true;
  };

  // Clear the cookie server-side, then flip local state.
  logout = async () => {
    try {
      await deleteSession();
    } catch {
      // even if the request fails, drop local auth state
    }
    runInAction(() => {
      this.isAuthenticated = false;
    });
  };
}

export default AuthStore;
