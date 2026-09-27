import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DICTS, type Dict } from './i18n';
import { emptyPage, type InkBook, type InkPage } from './ink';
import { emptyConstellation, emptySat, emptyStar, type Constellation } from './model';
import { loadText, writer } from './persist';

const DATA_FILE = 'constellation';
const INK_FILE = 'ink';
const LEGACY_KEY = 'constellamind:v1';

/** Fills any missing fields so older or hand-edited backups still open. */
export function normalize(input: unknown): Constellation {
  if (!input || typeof input !== 'object' || (input as { version?: unknown }).version !== 1) {
    throw new Error('not a ConstellaMind backup');
  }
  const base = emptyConstellation();
  const data = input as Partial<Constellation>;
  const merged: Constellation = { ...base, ...data, settings: { ...base.settings, ...data.settings } };
  merged.stars = {};
  merged.sats = {};
  for (const k of Object.keys(base.stars)) merged.stars[k] = { ...emptyStar(), ...data.stars?.[k] };
  for (const k of Object.keys(base.sats)) merged.sats[k] = { ...emptySat(), ...data.sats?.[k] };
  return merged;
}

async function loadAll(): Promise<{ data: Constellation; ink: InkBook }> {
  let data = emptyConstellation();
  let ink: InkBook = {};
  try {
    const raw = (await loadText(DATA_FILE)) ?? localStorage.getItem(LEGACY_KEY);
    if (raw) data = normalize(JSON.parse(raw));
  } catch {
    // Corrupt file: start fresh rather than crash.
  }
  try {
    const raw = await loadText(INK_FILE);
    if (raw) ink = JSON.parse(raw) as InkBook;
  } catch {
    // idem
  }
  return { data, ink };
}

interface Store {
  data: Constellation;
  update: (mutate: (draft: Constellation) => void) => void;
  replace: (next: Constellation, ink?: InkBook) => void;
  ink: InkBook;
  inkPage: (key: string) => InkPage | undefined;
  setInkPage: (key: string, page: InkPage | null) => void;
  t: Dict;
  /** Displays an internal address ("3.2") in the current language ("É3.2" / "S3.2"). */
  fmt: (addr: string) => string;
  dark: boolean;
}

const Ctx = createContext<Store | null>(null);

function useSystemDark() {
  const q = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const [dark, setDark] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setDark(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [q]);
  return dark;
}

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [state, setState] = useState<{ data: Constellation; ink: InkBook } | null>(null);
  const saveData = useRef(writer(DATA_FILE));
  const saveInk = useRef(writer(INK_FILE, 800));
  const systemDark = useSystemDark();

  useEffect(() => {
    void loadAll().then(setState);
  }, []);

  const data = state?.data;
  const ink = state?.ink;

  useEffect(() => {
    if (data) saveData.current(() => JSON.stringify(data));
  }, [data]);
  useEffect(() => {
    if (ink) saveInk.current(() => JSON.stringify(ink));
  }, [ink]);

  const appearance = data?.settings.appearance ?? 'system';
  const dark = appearance === 'dark' || (appearance === 'system' && systemDark);

  const loaded = !!data;
  const theme = data?.settings.theme;
  const lang = data?.settings.lang;
  useEffect(() => {
    if (!loaded || !theme || !lang) return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.mode = dark ? 'dark' : 'light';
    root.lang = lang;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1120' : '#fffdf7');
    void import('./native').then((m) => m.syncStatusBar(dark));
  }, [loaded, theme, lang, dark]);

  const update = useCallback((mutate: (draft: Constellation) => void) => {
    setState((prev) => {
      if (!prev) return prev;
      const draft = structuredClone(prev.data);
      mutate(draft);
      return { ...prev, data: draft };
    });
  }, []);

  const setInkPage = useCallback((key: string, page: InkPage | null) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev.ink };
      // Keep a page if it holds ink or was given extra space; drop empty ones.
      if (page && (page.strokes.length || page.h !== emptyPage().h)) next[key] = page;
      else delete next[key];
      return { ...prev, ink: next };
    });
  }, []);

  const value = useMemo<Store | null>(() => {
    if (!data || !ink) return null;
    const t = DICTS[data.settings.lang];
    return {
      data,
      update,
      replace: (next, nextInk) => setState((prev) => ({ data: next, ink: nextInk ?? prev?.ink ?? {} })),
      ink,
      inkPage: (key) => ink[key],
      setInkPage,
      t,
      fmt: (a) => `${t.prefix}${a}`,
      dark,
    };
  }, [data, ink, update, setInkPage, dark]);

  if (!value) return <>{fallback}</>;
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
