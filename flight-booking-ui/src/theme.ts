// Two looks: 'blue' (light blue, default) and 'mono' (black & white).
// Pick with ?theme=mono, VITE_THEME, or the switch in the dev panel.
export type Theme = 'mono' | 'blue';

const KEY = 'flight-ui-theme';

function read(): Theme {
  const q = new URLSearchParams(location.search).get('theme');
  if (q === 'blue' || q === 'mono') return q;
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'blue' || s === 'mono') return s;
  } catch {
      // storage unavailable
  }
  return (import.meta.env.VITE_THEME as string | undefined) === 'mono' ? 'mono' : 'blue';
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'mono' ? 'mono' : 'blue';
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
      // storage unavailable
  }
}

export function initTheme() {
  document.documentElement.dataset.theme = read();
}
