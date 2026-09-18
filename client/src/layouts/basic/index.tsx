import React, { type FC } from 'react';
import BasicHeader from './components/header';

type Props = {
  children: React.ReactNode;
};

const BasicLayout: FC<Props> = ({ children }) => {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <BasicHeader />
      <main className="px-4">{children}</main>
    </div>
  );
};

export default BasicLayout;
