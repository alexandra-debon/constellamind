import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DICTS, type Dict } from './i18n';
import { emptyPage, type InkBook, type InkPage } from './ink';
import { emptyConstellation, emptySat, emptyStar, uid, type Constellation, type Settings } from './model';
import { loadText, removeText, saveText, writer } from './persist';

// Storage layout
//   library            → which constellations exist, which one is open, global settings
//   doc-<id> / ink-<id> → one constellation's content and handwriting
// Older versions stored a single constellation under "constellation" / "ink".

const LIBRARY_FILE = 'library';
const docFile = (id: string) => `doc-${id}`;
const inkFile = (id: string) => `ink-${id}`;

export interface DocMeta {
  id: string;
  name: string;
  /** Last local change (ms). */
  updatedAt: number;
  /** Server version this device last synced with (ms), if any. */
  syncedAt?: number;
}

export interface Library {
  version: 1;
  current: string;
  docs: DocMeta[];
  settings: Settings;
  /** Deleted constellations still to be removed from the server. */
  tombstones?: string[];
}

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

const parse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export async function readDoc(id: string): Promise<{ data: Constellation; ink: InkBook }> {
  let data = emptyConstellation();
  try {
    const raw = await loadText(docFile(id));
    if (raw) data = normalize(JSON.parse(raw));
  } catch {
    // corrupt file: open empty rather than crash
  }
  return { data, ink: parse<InkBook>(await loadText(inkFile(id)), {}) };
}

async function loadLibrary(): Promise<Library> {
  const lib = parse<Library | null>(await loadText(LIBRARY_FILE), null);
  if (lib?.docs?.length) {
    return { ...lib, settings: { ...emptyConstellation().settings, ...lib.settings } };
  }
  // First launch of this version: adopt the single constellation of v1, if any.
  const id = uid();
  let data = emptyConstellation();
  try {
    const raw = (await loadText('constellation')) ?? localStorage.getItem('constellamind:v1');
    if (raw) data = normalize(JSON.parse(raw));
  } catch {
    // nothing to migrate
  }
  const ink = parse<InkBook>(await loadText('ink'), {});
  await saveText(docFile(id), JSON.stringify(data));
  await saveText(inkFile(id), JSON.stringify(ink));
  const fresh: Library = {
    version: 1,
    current: id,
    docs: [{ id, name: data.settings.lang === 'en' ? 'My constellation' : 'Ma constellation', updatedAt: Date.now() }],
    settings: data.settings,
  };
  await saveText(LIBRARY_FILE, JSON.stringify(fresh));
  return fresh;
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

  library: Library;
  currentDoc: DocMeta;
  openDoc: (id: string) => Promise<void>;
  createDoc: (name: string) => Promise<string>;
  renameDoc: (id: string, name: string) => void;
  deleteDoc: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Used by sync: store a server copy locally (and show it if it is open). */
  applyRemote: (meta: { id: string; name: string; updatedAt: number }, data: Constellation, ink: InkBook) => Promise<void>;
  markSynced: (id: string, at: number) => void;
  clearTombstone: (id: string) => void;
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

interface State {
  library: Library;
  data: Constellation;
  ink: InkBook;
}

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const saveLib = useRef(writer(LIBRARY_FILE, 200));
  const docWriters = useRef(new Map<string, { data: ReturnType<typeof writer>; ink: ReturnType<typeof writer> }>());
  const writersFor = (id: string) => {
    let w = docWriters.current.get(id);
    if (!w) {
      w = { data: writer(docFile(id)), ink: writer(inkFile(id), 800) };
      docWriters.current.set(id, w);
    }
    return w;
  };
  const systemDark = useSystemDark();

  useEffect(() => {
    void (async () => {
      const library = await loadLibrary();
      const { data, ink } = await readDoc(library.current);
      setState({ library, data: { ...data, settings: library.settings }, ink });
    })();
  }, []);

  // Persist whatever changed. Content changes also bump the doc's updatedAt.
  const prev = useRef<State | null>(null);
  useEffect(() => {
    if (!state) return;
    const p = prev.current;
    prev.current = state;
    const id = state.library.current;
    if (p && p.library.current === id) {
      if (p.data !== state.data) writersFor(id).data(() => JSON.stringify(state.data));
      if (p.ink !== state.ink) writersFor(id).ink(() => JSON.stringify(state.ink));
    }
    if (!p || p.library !== state.library) saveLib.current(() => JSON.stringify(state.library));
  }, [state]);

  const touch = (lib: Library): Library => ({
    ...lib,
    docs: lib.docs.map((d) => (d.id === lib.current ? { ...d, updatedAt: Date.now() } : d)),
  });

  const settings = state?.library.settings;
  const appearance = settings?.appearance ?? 'system';
  const dark = appearance === 'dark' || (appearance === 'system' && systemDark);
  const loaded = !!state;
  const theme = settings?.theme;
  const lang = settings?.lang;
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
    setState((s) => {
      if (!s) return s;
      const draft = structuredClone(s.data);
      mutate(draft);
      // Settings are global to the app: mirror any change into the library.
      const settingsChanged = JSON.stringify(draft.settings) !== JSON.stringify(s.data.settings);
      const lib = settingsChanged ? { ...s.library, settings: draft.settings } : s.library;
      const contentChanged = JSON.stringify({ ...draft, settings: 0 }) !== JSON.stringify({ ...s.data, settings: 0 });
      return { ...s, data: draft, library: contentChanged ? touch(lib) : lib };
    });
  }, []);

  const setInkPage = useCallback((key: string, page: InkPage | null) => {
    setState((s) => {
      if (!s) return s;
      const next = { ...s.ink };
      // Keep a page if it holds ink or was given extra space; drop empty ones.
      if (page && (page.strokes.length || page.h !== emptyPage().h)) next[key] = page;
      else delete next[key];
      return { ...s, ink: next, library: touch(s.library) };
    });
  }, []);

  const flushCurrent = (s: State) => {
    const w = writersFor(s.library.current);
    w.data(() => JSON.stringify(s.data));
    w.ink(() => JSON.stringify(s.ink));
  };

  const openDoc = useCallback(async (id: string) => {
    const s = prev.current;
    if (!s || s.library.current === id) return;
    await saveText(docFile(s.library.current), JSON.stringify(s.data));
    await saveText(inkFile(s.library.current), JSON.stringify(s.ink));
    const { data, ink } = await readDoc(id);
    setState((cur) => (cur ? { library: { ...cur.library, current: id }, data: { ...data, settings: cur.library.settings }, ink } : cur));
  }, []);

  const createDoc = useCallback(async (name: string) => {
    const id = uid();
    await saveText(docFile(id), JSON.stringify(emptyConstellation()));
    await saveText(inkFile(id), '{}');
    setState((s) => (s ? { ...s, library: { ...s.library, docs: [...s.library.docs, { id, name, updatedAt: Date.now() }] } } : s));
    return id;
  }, []);

  const renameDoc = useCallback((id: string, name: string) => {
    setState((s) =>
      s ? { ...s, library: { ...s.library, docs: s.library.docs.map((d) => (d.id === id ? { ...d, name, updatedAt: Date.now() } : d)) } } : s,
    );
  }, []);

  const deleteDoc = useCallback(async (id: string) => {
    const s = prev.current;
    if (!s || s.library.docs.length < 2) return;
    const rest = s.library.docs.filter((d) => d.id !== id);
    const wasSynced = s.library.docs.find((d) => d.id === id)?.syncedAt;
    let next: State = {
      ...s,
      library: { ...s.library, docs: rest, tombstones: wasSynced ? [...(s.library.tombstones ?? []), id] : s.library.tombstones },
    };
    if (s.library.current === id) {
      const other = await readDoc(rest[0].id);
      next = { library: { ...next.library, current: rest[0].id }, data: { ...other.data, settings: s.library.settings }, ink: other.ink };
    }
    setState(next);
    await removeText(docFile(id));
    await removeText(inkFile(id));
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) =>
      update((d) => {
        Object.assign(d.settings, patch);
      }),
    [update],
  );

  const applyRemote = useCallback(async (meta: { id: string; name: string; updatedAt: number }, data: Constellation, ink: InkBook) => {
    await saveText(docFile(meta.id), JSON.stringify(data));
    await saveText(inkFile(meta.id), JSON.stringify(ink));
    setState((s) => {
      if (!s) return s;
      const known = s.library.docs.some((d) => d.id === meta.id);
      const entry: DocMeta = { id: meta.id, name: meta.name, updatedAt: meta.updatedAt, syncedAt: meta.updatedAt };
      const docs = known ? s.library.docs.map((d) => (d.id === meta.id ? entry : d)) : [...s.library.docs, entry];
      const library = { ...s.library, docs };
      if (s.library.current !== meta.id) return { ...s, library };
      // Replace the open constellation without re-bumping updatedAt.
      const next = { library, data: { ...data, settings: s.library.settings }, ink };
      prev.current = next;
      return next;
    });
  }, []);

  const markSynced = useCallback((id: string, at: number) => {
    setState((s) =>
      s ? { ...s, library: { ...s.library, docs: s.library.docs.map((d) => (d.id === id ? { ...d, syncedAt: at, updatedAt: Math.max(d.updatedAt, at) } : d)) } } : s,
    );
  }, []);

  const clearTombstone = useCallback((id: string) => {
    setState((s) => (s ? { ...s, library: { ...s.library, tombstones: (s.library.tombstones ?? []).filter((x) => x !== id) } } : s));
  }, []);

  useEffect(() => {
    const onHide = () => prev.current && flushCurrent(prev.current);
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  });

  const value = useMemo<Store | null>(() => {
    if (!state) return null;
    const t = DICTS[state.library.settings.lang];
    const currentDoc = state.library.docs.find((d) => d.id === state.library.current) ?? state.library.docs[0];
    return {
      data: state.data,
      update,
      replace: (next, nextInk) =>
        setState((s) => (s ? { library: touch(s.library), data: { ...next, settings: s.library.settings }, ink: nextInk ?? s.ink } : s)),
      ink: state.ink,
      inkPage: (key) => state.ink[key],
      setInkPage,
      t,
      fmt: (a) => `${t.prefix}${a}`,
      dark,
      library: state.library,
      currentDoc,
      openDoc,
      createDoc,
      renameDoc,
      deleteDoc,
      updateSettings,
      applyRemote,
      markSynced,
      clearTombstone,
    };
  }, [state, update, setInkPage, dark, openDoc, createDoc, renameDoc, deleteDoc, updateSettings, applyRemote, markSynced, clearTombstone]);

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
