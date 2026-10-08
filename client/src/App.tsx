import AuthInitializer from "./hocs/auth-initializer";
import Toast from "./components/toast";
import MaintenanceScreen from "./components/maintenance-screen";
import SupersededScreen from "./components/superseded-screen";
import Routes from "./routes";
import store, { observer } from "./stores";

// Two full-screen gates sit above everything:
// - maintenance (server says so via /api/status): outermost, it even stands in
//   for the boot session check, which would 503. Lifts itself when it's over.
// - superseded (this identity is live in another tab).
// Swapping the tree out also unmounts the presence connection — on top of
// the explicit audio/socket teardown each gate's store action already did.
const App = observer(() => {
  if (store.maintenance.active) {
    return (
      <>
        <Toast />
        <MaintenanceScreen />
      </>
    );
  }
  return (
    <AuthInitializer>
      <Toast />
      {store.presence.superseded ? <SupersededScreen /> : <Routes />}
    </AuthInitializer>
  );
});

export default App;
