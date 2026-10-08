import store, { observer } from "@app/stores";
import { type FC, type ReactNode } from "react";
import { Navigate } from "react-router";

type Props = {
  children: ReactNode;
};

const AuthGuard: FC<Props> = observer(({ children }) => {
  if (store.auth.isInitialized) {
    if (!store.auth.isAuthenticated) {
      return (
        <Navigate to={"/sign-in"} state={{ to: window.location.pathname }} />
      );
    }
  }

  return children;
});

export default AuthGuard;
