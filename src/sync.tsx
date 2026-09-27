import { useEffect, useRef, useState } from 'react';
import { supabase, useAccount } from './account';
import type { InkBook } from './ink';
import type { Constellation } from './model';
import { normalize, readDoc, useStore } from './store';

// Sync of constellations between devices (premium, signed in).
// Each constellation is one row: whole content + handwriting, last write wins.
// A device pushes what changed since its last sync and pulls newer server copies.

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

let status: { state: SyncState; at: number | null } = { state: 'off', at: null };
const listeners = new Set<() => void>();
const setStatus = (s: Partial<typeof status>) => {
  status = { ...status, ...s };
  listeners.forEach((f) => f());
};
export function useSyncStatus() {
  const [s, set] = useState(status);
  useEffect(() => {
    const f = () => set(status);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return s;
}

interface Row {
  id: string;
  name: string;
  updated_at: string;
}

/** Invisible component: runs sync while a premium user is signed in. */
export function SyncAgent() {
  const { user, premium } = useAccount();
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  const running = useRef(false);
  const again = useRef(false);

  const enabled = !!user && premium;

  const run = async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    const sb = await supabase();
    if (!sb || !user) return;
    running.current = true;
    setStatus({ state: 'syncing' });
    try {
      // 1. Deletions made on this device.
      for (const id of storeRef.current.library.tombstones ?? []) {
        await sb.from('constellations').delete().eq('user_id', user.id).eq('id', id);
        storeRef.current.clearTombstone(id);
      }

      // 2. What the server has.
      const { data: rows, error } = await sb.from('constellations').select('id, name, updated_at').eq('user_id', user.id);
      if (error) throw error;
      const remote = new Map((rows as Row[]).map((r) => [r.id, r]));

      // 3. Pull newer server copies.
      for (const r of remote.values()) {
        const at = new Date(r.updated_at).getTime();
        const local = storeRef.current.library.docs.find((d) => d.id === r.id);
        const localChangedSinceSync = local && local.updatedAt > (local.syncedAt ?? 0);
        const serverNewer = !local || at > (local.syncedAt ?? 0);
        if (serverNewer && (!localChangedSinceSync || at > local!.updatedAt)) {
          const { data: full, error: e } = await sb.from('constellations').select('data, ink').eq('user_id', user.id).eq('id', r.id).single();
          if (e) throw e;
          await storeRef.current.applyRemote({ id: r.id, name: r.name, updatedAt: at }, normalize(full.data), (full.ink ?? {}) as InkBook);
        }
      }

      // 4. Remove local copies deleted on another device.
      for (const d of storeRef.current.library.docs) {
        if (d.syncedAt && !remote.has(d.id) && storeRef.current.library.docs.length > 1) await storeRef.current.deleteDoc(d.id);
      }

      // 5. Push local changes.
      for (const d of storeRef.current.library.docs) {
        if (d.updatedAt <= (d.syncedAt ?? 0)) continue;
        const r = remote.get(d.id);
        if (r && new Date(r.updated_at).getTime() > d.updatedAt) continue; // server copy won
        const s = storeRef.current;
        let content: { data: Constellation; ink: InkBook };
        if (d.id === s.library.current) content = { data: s.data, ink: s.ink };
        else content = await readDoc(d.id);
        const { settings: _omit, ...data } = content.data;
        void _omit;
        const { error: e } = await sb.from('constellations').upsert({
          user_id: user.id,
          id: d.id,
          name: d.name,
          data: { ...data, settings: {} },
          ink: content.ink,
          updated_at: new Date(d.updatedAt).toISOString(),
        });
        if (e) throw e;
        storeRef.current.markSynced(d.id, d.updatedAt);
      }
      setStatus({ state: 'idle', at: Date.now() });
    } catch {
      setStatus({ state: 'error' });
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        void run();
      }
    }
  };

  // Start, then every minute and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!enabled) {
      setStatus({ state: 'off' });
      return;
    }
    void run();
    const timer = window.setInterval(() => void run(), 60_000);
    const onVisible = () => document.visibilityState === 'visible' && void run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, user?.id]);

  // Push a few seconds after local edits settle.
  const dirtyKey = store.library.docs.map((d) => `${d.id}:${d.updatedAt}:${d.syncedAt ?? 0}`).join('|') + (store.library.tombstones ?? []).join(',');
  useEffect(() => {
    if (!enabled) return;
    const dirty = store.library.docs.some((d) => d.updatedAt > (d.syncedAt ?? 0)) || !!store.library.tombstones?.length;
    if (!dirty) return;
    const timer = window.setTimeout(() => void run(), 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dirtyKey]);

  return null;
}

export const syncNow = () => {
  // Visibility trick: reuse the agent's foreground trigger.
  document.dispatchEvent(new Event('visibilitychange'));
};
