import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DICTS, type Dict } from './i18n';
import { emptyConstellation, emptySat, emptyStar, type Constellation } from './model';

const STORAGE_KEY = 'constellamind:v1';

function load(): Constellation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    // Storage unavailable (private mode) or corrupt: start fresh.
  }
  return emptyConstellation();
}

/** Fills any missing fields so older or hand-edited backups still open. */
export function normalize(input: unknown): Constellation {
  if (!input || typeof input !== 'object' || (input as { version?: unknown }).version !== 1) {
    throw new Error('not a ConstellaMind backup');
  }
  const base = emptyConstellation();
  const data = input as Partial<Constellation>;
  const merged: Constellation = { ...base, ...data, settings: { ...base.settings, ...data.settings } };
  for (const k of Object.keys(base.stars)) merged.stars[k] = { ...emptyStar(), ...data.stars?.[k] };
  for (const k of Object.keys(base.sats)) merged.sats[k] = { ...emptySat(), ...data.sats?.[k] };
  return merged;
}

interface Store {
  data: Constellation;
  update: (mutate: (draft: Constellation) => void) => void;
  replace: (next: Constellation) => void;
  t: Dict;
  /** Displays an internal address ("3.2") in the current language ("É3.2" / "S3.2"). */
  fmt: (addr: string) => string;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Constellation>(load);
  const timer = useRef<number>();

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Quota exceeded or storage blocked: the export button remains the safety net.
      }
    }, 250);
  }, [data]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
    document.documentElement.lang = data.settings.lang;
  }, [data.settings.theme, data.settings.lang]);

  const update = useCallback((mutate: (draft: Constellation) => void) => {
    setData((prev) => {
      const draft = structuredClone(prev);
      mutate(draft);
      return draft;
    });
  }, []);

  const value = useMemo<Store>(() => {
    const t = DICTS[data.settings.lang];
    return { data, update, replace: setData, t, fmt: (a) => `${t.prefix}${a}` };
  }, [data, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** Minimal hash router: "#/etoile/3" → ["etoile", "3"]. */
export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => {
  window.location.hash = path;
};
