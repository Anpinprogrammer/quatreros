export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'quatreros-theme';

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function resolveTheme(): Theme {
  const stored = storedTheme();
  if (stored) return stored;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    // jsdom y entornos sin matchMedia: el modo claro es el valor por defecto.
    return 'light';
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0D0E10' : '#FAFAF9');
}

/** Se llama antes del primer render para que el tema guardado no provoque un destello. */
export function initTheme() {
  applyTheme(resolveTheme());
}

export { STORAGE_KEY as THEME_STORAGE_KEY };
