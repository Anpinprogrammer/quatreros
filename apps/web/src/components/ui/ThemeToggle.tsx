import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './form';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const nextLabel = theme === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro';
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      aria-label={nextLabel}
      title={nextLabel}
      className="size-11 min-h-11 shrink-0 px-0"
    >
      {theme === 'dark' ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
    </Button>
  );
}
