import AuthInitializer from "./hocs/auth-initializer";
import Toast from "./components/toast";
import Routes from "./routes";

function App() {
  return (
    <AuthInitializer>
      <Toast />
      <Routes />
    </AuthInitializer>
  );
}

export default App;
