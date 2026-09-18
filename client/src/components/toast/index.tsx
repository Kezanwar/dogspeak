import { Toaster as ShadToaster } from '@app/components/ui/sonner';
import { type FC } from 'react';

const ToastProvider: FC = () => {
  return (
    <div className="dark">
      <ShadToaster closeButton />
    </div>
  );
};

export default ToastProvider;
