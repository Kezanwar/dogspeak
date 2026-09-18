import { Moon, Sun } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import store from '@app/stores';
import { Button } from '@app/components/ui/button';

const ToggleTheme = observer(() => {
  const toggleTheme = () => {
    const next = store.ui.theme === 'light' ? 'dark' : 'light';
    store.ui.setTheme(next);
  };

  return (
    <Button
      onClick={toggleTheme}
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      className="active:scale-90"
    >
      {store.ui.theme === 'dark' ? (
        <Sun className="text-foreground size-5" />
      ) : (
        <Moon className="text-foreground size-5" />
      )}
    </Button>
  );
});

export default ToggleTheme;
