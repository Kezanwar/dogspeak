import { observer } from "mobx-react-lite";
import AuthStore from "./auth";
import UIStore from "./ui";
import PresenceStore from "./presence";

export class RootStore {
  auth = new AuthStore(this);
  ui = new UIStore(this);
  presence = new PresenceStore(this);
}

const store = new RootStore();

export default store;

export { observer };
