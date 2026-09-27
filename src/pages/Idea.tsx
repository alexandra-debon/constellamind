import { useState } from 'react';
import {
  AddressInput,
  Breadcrumb,
  hrefOf,
  PasserellesBar,
  Section,
  StatusPicker,
  TopNav,
  WriteField,
} from '../components/common';
import { SAT_COUNT, SATS, STAR_COUNT, uid, type Action } from '../model';
import { useStore } from '../store';
import { ActionTable } from './Actions';

export function StarPage({ s }: { s: number }) {
  const { data, update, t, fmt } = useStore();
  const star = data.stars[s];
  const addr = String(s);
  const set = (patch: Partial<typeof star>) =>
    update((d) => {
      Object.assign(d.stars[s], patch);
    });

  return (
    <div className="page" data-star={s}>
      <TopNav active="" />
      <Breadcrumb
        tone={s}
        crumbs={[{ label: `${t.star} ${fmt(addr)}`, current: true }]}
        prev={s > 1 ? `#/etoile/${s - 1}` : undefined}
        next={s < STAR_COUNT ? `#/etoile/${s + 1}` : undefined}
      />

      <div className="field-row">
        <span className="label">{t.title}</span>
        <input className="title-input" value={star.title} onChange={(e) => set({ title: e.target.value })} />
      </div>
      <StatusPicker value={star.status} onChange={(status) => set({ status })} />

      <Section title={t.intuition}>
        <WriteField inkKey={`star:${s}:intuition`} value={star.intuition} rows={3} onChange={(intuition) => set({ intuition })} />
      </Section>

      <Section title={t.satellites}>
        <div className="sat-grid">
          {SATS.map((k) => {
            const a = `${s}.${k}`;
            const sat = data.sats[a];
            return (
              <a key={k} href={hrefOf(a)} className={`sat-card ${sat.status ? `st-${sat.status}` : ''}`}>
                <span className="pill">{fmt(a)}</span>
                <span className={`sat-title ${sat.title ? '' : 'empty'}`}>{sat.title || t.untitled}</span>
                {sat.status && <span className="mini-status">{t.statuses[sat.status]}</span>}
              </a>
            );
          })}
        </div>
      </Section>

      <div className="link-row">
        <a className="chip strong" href={`#/orbite/${s}`}>
          {t.orbit} {fmt(addr)} ›
        </a>
        <a className="chip" href="#/passerelles">
          {t.bottom.register} ›
        </a>
      </div>

      <Section title={t.notesLabel}>
        <WriteField inkKey={`star:${s}:notes`} value={star.notes} rows={4} onChange={(notes) => set({ notes })} />
      </Section>

      <PasserellesBar here={addr} />
    </div>
  );
}

export function SatellitePage({ addr }: { addr: string }) {
  const { data, update, t, fmt } = useStore();
  const [s, k] = addr.split('.').map(Number);
  const sat = data.sats[addr];
  const [sent, setSent] = useState(false);
  const set = (mutate: (x: typeof sat) => void) =>
    update((d) => {
      mutate(d.sats[addr]);
    });

  // Walk through all 72 satellites in order: É1.1 … É1.6, É2.1 …
  const flat = (s - 1) * SAT_COUNT + (k - 1);
  const at = (i: number) => `${Math.floor(i / SAT_COUNT) + 1}.${(i % SAT_COUNT) + 1}`;
  const last = STAR_COUNT * SAT_COUNT - 1;

  const pending = sat.todos.filter((x) => x.text.trim() && !x.done);
  const sendToOrbit = () => {
    update((d) => {
      const todos = d.sats[addr].todos;
      for (const todo of todos) {
        if (!todo.text.trim() || todo.done) continue;
        const action: Action = {
          id: uid(),
          star: s,
          done: false,
          text: todo.text.trim(),
          origin: addr,
          who: '',
          due: '',
          project: '',
          prio: '',
        };
        d.actions.push(action);
        todo.done = true;
      }
    });
    setSent(true);
    window.setTimeout(() => setSent(false), 2200);
  };

  return (
    <div className="page" data-star={s}>
      <TopNav active="" />
      <Breadcrumb
        tone={s}
        crumbs={[
          { label: fmt(String(s)), href: `#/etoile/${s}` },
          { label: `${t.satellite} ${fmt(addr)}`, current: true },
        ]}
        prev={flat > 0 ? `#/satellite/${at(flat - 1)}` : undefined}
        next={flat < last ? `#/satellite/${at(flat + 1)}` : undefined}
      />

      <div className="field-row">
        <span className="label">{t.siblings}</span>
        <div className="siblings">
          {SATS.map((j) => (
            <a key={j} href={hrefOf(`${s}.${j}`)} className={`pill ${j === k ? 'on' : ''}`}>
              {fmt(`${s}.${j}`)}
            </a>
          ))}
        </div>
      </div>
      <div className="field-row">
        <span className="label">{t.title}</span>
        <input className="title-input" value={sat.title} onChange={(e) => set((x) => (x.title = e.target.value))} />
      </div>
      <StatusPicker value={sat.status} onChange={(status) => set((x) => (x.status = status))} />

      <Section title={t.origin}>
        <WriteField inkKey={`sat:${addr}:origin`} value={sat.origin} rows={2} onChange={(v) => set((x) => (x.origin = v))} />
      </Section>
      <Section title={t.development}>
        <WriteField inkKey={`sat:${addr}:dev`} value={sat.development} rows={8} onChange={(v) => set((x) => (x.development = v))} />
      </Section>

      <div className="two-col">
        <Section title={t.relatedTo}>
          <div className="related">
            {sat.relatedTo.map((r, i) => (
              <AddressInput key={i} value={r} onChange={(v) => set((x) => (x.relatedTo[i] = v))} />
            ))}
          </div>
        </Section>
        <Section title={t.toAction}>
          <div className="todos">
            {sat.todos.map((todo, i) => (
              <label key={i} className={`todo ${todo.done ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={(e) => set((x) => (x.todos[i].done = e.target.checked))}
                />
                <input value={todo.text} onChange={(e) => set((x) => (x.todos[i].text = e.target.value))} />
              </label>
            ))}
          </div>
          <button type="button" className="chip strong" disabled={!pending.length && !sent} onClick={sendToOrbit}>
            {sent ? t.sentToOrbit : `${t.sendToOrbit} ${fmt(String(s))} ›`}
          </button>
        </Section>
      </div>

      <PasserellesBar here={addr} />
    </div>
  );
}

export function OrbitPage({ s }: { s: number }) {
  const { data, update, t, fmt } = useStore();
  const addr = String(s);
  const actions = data.actions.filter((a) => a.star === s);

  return (
    <div className="page" data-star={s}>
      <TopNav active="actions" />
      <Breadcrumb
        tone={s}
        crumbs={[
          { label: fmt(addr), href: `#/etoile/${s}` },
          { label: `${t.orbit} ${fmt(addr)}`, current: true },
        ]}
        prev={s > 1 ? `#/orbite/${s - 1}` : undefined}
        next={s < STAR_COUNT ? `#/orbite/${s + 1}` : undefined}
      />
      <div className="field-row">
        <span className="label">{t.bornFrom}</span>
        <div className="siblings">
          <a className="pill strong" href={hrefOf(addr)}>
            {fmt(addr)}
          </a>
          {SATS.map((k) => (
            <a key={k} className="pill" href={hrefOf(`${s}.${k}`)}>
              {fmt(`${s}.${k}`)}
            </a>
          ))}
        </div>
      </div>

      <ActionTable actions={actions} mode="orbit" />
      <button
        type="button"
        className="chip add"
        onClick={() =>
          update((d) => {
            d.actions.push({ id: uid(), star: s, done: false, text: '', origin: addr, who: '', due: '', project: '', prio: '' });
          })
        }
      >
        {t.addAction}
      </button>

      <PasserellesBar here={addr} />
    </div>
  );
}
