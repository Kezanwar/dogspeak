import AuthInitializer from "./hocs/auth-initializer";
import Toast from "./components/toast";
import SupersededScreen from "./components/superseded-screen";
import Routes from "./routes";
import store, { observer } from "./stores";

// Superseded (this identity is live in another tab) gates everything, above
// the dashboard: swapping it out unmounts the presence connection, which
// tears down audio and the socket the usual way.
const App = observer(() => {
  return (
    <AuthInitializer>
      <Toast />
      {store.presence.superseded ? <SupersededScreen /> : <Routes />}
    </AuthInitializer>
  );
});

export default App;
