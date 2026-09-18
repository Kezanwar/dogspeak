import GuestHeader from '@app/layouts/guest/components/header';
import React, { type FC } from 'react';

type Props = {
  children: React.ReactNode;
};

const GuestLayout: FC<Props> = ({ children }) => {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <GuestHeader />
      <main className="flex flex-1 items-center justify-center px-4">
        {children}
      </main>
    </div>
  );
};

export default GuestLayout;
