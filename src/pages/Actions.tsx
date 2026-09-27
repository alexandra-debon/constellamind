import { useState } from 'react';
import { AddressInput, Breadcrumb, TopNav } from '../components/common';
import { isValidAddress, starOf, STARS, uid, type Action } from '../model';
import { useStore } from '../store';

export function ActionTable({ actions, mode }: { actions: Action[]; mode: 'orbit' | 'board' }) {
  const { update, t } = useStore();
  const set = (id: string, patch: Partial<Action>) =>
    update((d) => {
      const a = d.actions.find((x) => x.id === id);
      if (!a) return;
      Object.assign(a, patch);
      if (patch.origin !== undefined && isValidAddress(patch.origin)) a.star = starOf(patch.origin);
    });
  const remove = (id: string) =>
    update((d) => {
      d.actions = d.actions.filter((x) => x.id !== id);
    });

  return (
    <div className="table-wrap">
      <table className={`grid actions-table ${mode}`}>
        <thead>
          <tr>
            <th className="c-done">{t.cols.done}</th>
            <th>{t.cols.action}</th>
            <th className="c-addr">{mode === 'orbit' ? t.cols.origin : t.cols.address}</th>
            {mode === 'orbit' && <th className="c-who">{t.cols.who}</th>}
            <th className="c-date">{mode === 'orbit' ? t.cols.due : t.cols.deadline}</th>
            {mode === 'orbit' && <th className="c-proj">{t.cols.project}</th>}
            <th className="c-prio">{t.cols.prio}</th>
            {mode === 'board' && <th className="c-proj">{t.cols.project}</th>}
            <th className="c-x" />
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.id} className={a.done ? 'done' : ''} data-star={a.star}>
              <td className="c-done">
                <input type="checkbox" checked={a.done} onChange={(e) => set(a.id, { done: e.target.checked })} />
              </td>
              <td>
                <input className="cell" value={a.text} onChange={(e) => set(a.id, { text: e.target.value })} />
              </td>
              <td className="c-addr">
                <AddressInput value={a.origin} onChange={(origin) => set(a.id, { origin })} />
              </td>
              {mode === 'orbit' && (
                <td className="c-who">
                  <input className="cell" value={a.who} onChange={(e) => set(a.id, { who: e.target.value })} />
                </td>
              )}
              <td className="c-date">
                <input className="cell" type="date" value={a.due} onChange={(e) => set(a.id, { due: e.target.value })} />
              </td>
              {mode === 'orbit' && (
                <td className="c-proj">
                  <input className="cell" value={a.project} onChange={(e) => set(a.id, { project: e.target.value })} />
                </td>
              )}
              <td className="c-prio">
                <select
                  className="cell"
                  value={a.prio}
                  onChange={(e) => set(a.id, { prio: e.target.value as Action['prio'] })}
                >
                  <option value="" />
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </td>
              {mode === 'board' && (
                <td className="c-proj">
                  <input className="cell" value={a.project} onChange={(e) => set(a.id, { project: e.target.value })} />
                </td>
              )}
              <td className="c-x">
                <button type="button" className="x" aria-label={t.remove} title={t.remove} onClick={() => remove(a.id)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Sort = 'prio' | 'due' | 'origin';

export default function ActionsBoard() {
  const { data, update, t, fmt } = useStore();
  const [hideDone, setHideDone] = useState(false);
  const [sort, setSort] = useState<Sort>('prio');

  const cmpAddr = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  const sorted = data.actions
    .filter((a) => !(hideDone && a.done))
    .slice()
    .sort((a, b) => {
      if (sort === 'prio') return (a.prio || '9').localeCompare(b.prio || '9') || cmpAddr(a.origin, b.origin);
      if (sort === 'due') return (a.due || '9999').localeCompare(b.due || '9999');
      return cmpAddr(a.origin, b.origin);
    });

  return (
    <div className="page">
      <TopNav active="actions" />
      <Breadcrumb crumbs={[{ label: t.bottom.board, current: true }]} />
      <p className="intro">{t.boardIntro}</p>

      <div className="orbit-links">
        {STARS.map((s) => {
          const n = data.actions.filter((a) => a.star === s && !a.done).length;
          return (
            <a key={s} href={`#/orbite/${s}`} className="pill" data-star={s}>
              {fmt(String(s))}
              {n > 0 && <sup>{n}</sup>}
            </a>
          );
        })}
      </div>

      <div className="toolbar">
        <label className="check">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> {t.hideDone}
        </label>
        <label>
          {t.sortBy}{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="prio">{t.sortPrio}</option>
            <option value="due">{t.sortDue}</option>
            <option value="origin">{t.sortOrigin}</option>
          </select>
        </label>
      </div>

      {data.actions.length === 0 ? <p className="empty">{t.boardEmpty}</p> : <ActionTable actions={sorted} mode="board" />}
      <button
        type="button"
        className="chip add"
        onClick={() =>
          update((d) => {
            // star 0 = not attached to an orbit until an origin address is given.
            d.actions.push({ id: uid(), star: 0, done: false, text: '', origin: '', who: '', due: '', project: '', prio: '' });
          })
        }
      >
        {t.addAction}
      </button>
    </div>
  );
}
