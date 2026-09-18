import store, { observer } from '@app/stores';
import { type FC, type ReactNode } from 'react';
import { Navigate } from 'react-router';

type Props = {
  children: ReactNode;
};

const GuestGuard: FC<Props> = observer(({ children }) => {
  if (store.auth.isInitialized && store.auth.isAuthenticated) {
    return <Navigate to={'/'} />;
  }

  return children;
});

export default GuestGuard;
