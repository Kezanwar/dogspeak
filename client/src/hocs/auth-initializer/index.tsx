import LoadingScreen from '@app/components/loading-screen';
import store, { observer } from '@app/stores';
import { type FC, type ReactNode, useEffect } from 'react';

type Props = {
  children: ReactNode;
};

const AuthInitializer: FC<Props> = observer(({ children }) => {
  const { initialize, isInitialized } = store.auth;

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized]);

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return children;
});

export default AuthInitializer;
