import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

// Storage: app-private files on iOS/Android (never purged by the OS like WebView
// storage can be), IndexedDB on the web (no 5 MB cap, handwriting can be large).

const native = Capacitor.isNativePlatform();

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('constellamind', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv').objectStore('kv').get(key);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadText(name: string): Promise<string | null> {
  try {
    if (native) {
      const r = await Filesystem.readFile({ path: `${name}.json`, directory: Directory.Data, encoding: Encoding.UTF8 });
      return typeof r.data === 'string' ? r.data : null;
    }
    return localStorage.getItem(`constellamind:${name}`) ?? (await idbGet(name));
  } catch {
    return null;
  }
}

// On the web, small documents go to localStorage: it writes synchronously, so a
// change made just before closing the tab is never lost. Large ones (handwriting)
// go to IndexedDB, which has no 5 MB cap.
const SYNC_LIMIT = 1_500_000;

export async function saveText(name: string, text: string): Promise<void> {
  try {
    if (native) {
      await Filesystem.writeFile({ path: `${name}.json`, directory: Directory.Data, encoding: Encoding.UTF8, data: text });
    } else if (text.length < SYNC_LIMIT) {
      localStorage.setItem(`constellamind:${name}`, text);
    } else {
      await idbSet(name, text);
      localStorage.removeItem(`constellamind:${name}`);
    }
  } catch {
    // Disk full or storage blocked: the export button remains the safety net.
  }
}

/** Debounced writer so rapid edits don't hammer the disk. */
export function writer(name: string, delay = 300) {
  let timer: number | undefined;
  let pending: (() => string) | null = null;
  const flush = () => {
    window.clearTimeout(timer);
    if (pending) {
      const text = pending();
      pending = null;
      void saveText(name, text);
    }
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  return (serialize: () => string) => {
    pending = serialize;
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, delay);
  };
}

/** Exports a backup: native share sheet on iOS/Android, file download on the web. */
export async function exportFile(filename: string, text: string): Promise<void> {
  if (native) {
    const { Share } = await import('@capacitor/share');
    const res = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, encoding: Encoding.UTF8, data: text });
    await Share.share({ title: filename, files: [res.uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
