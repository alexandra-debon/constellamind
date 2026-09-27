import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isStar, pairKey, parseAddress, SATS, STARS, STATUSES, type Status } from '../model';
import { useStore } from '../store';

export const hrefOf = (addr: string) => (isStar(addr) ? `#/etoile/${addr}` : `#/satellite/${addr}`);

export function StarIcon({ size = 16, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopNav({ active }: { active: string }) {
  const { t } = useStore();
  const tabs: [string, string][] = [
    ['nebuleuse', t.nav.nebula],
    ['passerelles', t.nav.bridges],
    ['matrice', t.nav.matrix],
    ['actions', t.nav.actions],
    ['notes', t.nav.notes],
    ['methode', t.nav.method],
  ];
  return (
    <nav className="topnav">
      <a className={`tab core ${active === '' ? 'on' : ''}`} href="#/">
        <StarIcon size={18} /> {t.nav.core}
      </a>
      <div className="tabs">
        {tabs.map(([k, label]) => (
          <a key={k} className={`tab t-${k} ${active === k ? 'on' : ''}`} href={`#/${k}`}>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export interface Crumb {
  label: string;
  href?: string;
  current?: boolean;
}

export function Breadcrumb({ crumbs, prev, next, tone }: { crumbs: Crumb[]; prev?: string; next?: string; tone?: number }) {
  const { t } = useStore();
  return (
    <div className="crumbbar" data-star={tone}>
      {prev ? (
        <a className="arrow" href={prev} aria-label={t.prev}>
          ◀
        </a>
      ) : (
        <span className="arrow ghost" />
      )}
      <div className="crumbs">
        <a className="crumb core" href="#/">
          <StarIcon size={14} /> {t.nav.core}
        </a>
        {crumbs.map((c, i) => (
          <span key={i} className="crumb-wrap">
            <span className="sep">›</span>
            {c.href && !c.current ? (
              <a className="crumb" href={c.href}>
                {c.label}
              </a>
            ) : (
              <span className="crumb current">{c.label}</span>
            )}
          </span>
        ))}
      </div>
      {next ? (
        <a className="arrow" href={next} aria-label={t.next}>
          ▶
        </a>
      ) : (
        <span className="arrow ghost" />
      )}
    </div>
  );
}

export function StatusPicker({ value, onChange }: { value: Status | null; onChange: (s: Status | null) => void }) {
  const { t } = useStore();
  return (
    <div className="field-row">
      <span className="label">{t.status}</span>
      <div className="statuses">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`status s-${s} ${value === s ? 'on' : ''}`}
            onClick={() => onChange(value === s ? null : s)}
            aria-pressed={value === s}
          >
            <StarIcon size={16} filled={value === s} /> {t.statuses[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Textarea that grows with its content, styled like the notebook's ruled lines. */
export function Lined({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="lined"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-title">
        <span>{title}</span>
        <span className="rule" />
        {aside}
      </h2>
      {children}
    </section>
  );
}

/** Address field ("É" prefix shown, digits typed). Stores the internal address, or the raw text while invalid. */
export function AddressInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { t } = useStore();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = draft === '' || parseAddress(draft) !== null;
  return (
    <label className={`addr ${valid ? '' : 'invalid'}`} title={valid ? '' : t.invalidAddress}>
      <span className="addr-prefix">{t.prefix}</span>
      <input
        inputMode="decimal"
        value={draft}
        placeholder={placeholder ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          const parsed = parseAddress(v);
          onChange(parsed ?? v.trim());
        }}
        onBlur={() => {
          const parsed = parseAddress(draft);
          if (parsed) setDraft(parsed);
        }}
      />
      {draft && valid && (
        <a className="addr-go" href={hrefOf(parseAddress(draft)!)} aria-label="→">
          ›
        </a>
      )}
    </label>
  );
}

/**
 * The "passerelles" strip at the bottom of star and satellite pages: the whole
 * constellation is clickable. In circle mode, tapping marks an idea as linked
 * to the current page (like circling it with the stylus in the notebook).
 */
export function PasserellesBar({ here }: { here: string }) {
  const { data, update, t, fmt } = useStore();
  const [circling, setCircling] = useState(false);
  const linked = new Set(
    data.links.filter(([a, b]) => a === here || b === here).map(([a, b]) => (a === here ? b : a)),
  );

  const toggle = (addr: string) => {
    if (addr === here) return;
    update((d) => {
      const key = pairKey(here, addr);
      const i = d.links.findIndex(([a, b]) => pairKey(a, b) === key);
      if (i >= 0) d.links.splice(i, 1);
      else d.links.push([here, addr]);
    });
  };

  const cell = (addr: string, label: string, cls: string) => {
    const className = `${cls} ${addr === here ? 'here' : ''} ${linked.has(addr) ? 'circled' : ''}`;
    return circling ? (
      <button key={addr} type="button" className={className} onClick={() => toggle(addr)}>
        {label}
      </button>
    ) : (
      <a key={addr} className={className} href={hrefOf(addr)}>
        {label}
      </a>
    );
  };

  return (
    <div className={`passerelles ${circling ? 'circling' : ''}`}>
      <div className="passerelles-head">
        <span>{circling ? t.circleModeOn : t.passerellesBar}</span>
        <button type="button" className={`chip ${circling ? 'on' : ''}`} onClick={() => setCircling((c) => !c)}>
          ◯ {t.circleMode}
        </button>
      </div>
      <div className="passerelles-grid">
        {STARS.map((s) => (
          <div key={s} className="pcol" data-star={s}>
            {cell(String(s), fmt(String(s)), 'pstar')}
            {SATS.map((k) => cell(`${s}.${k}`, `${s}.${k}`, 'psat'))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BottomLinks() {
  const { t } = useStore();
  return (
    <div className="bottom-links">
      <a href="#/nebuleuse" className="bl t-nebuleuse">
        {t.bottom.nebula}
      </a>
      <a href="#/passerelles" className="bl t-passerelles">
        {t.bottom.register}
      </a>
      <a href="#/matrice" className="bl t-matrice">
        {t.bottom.matrix}
      </a>
      <a href="#/actions" className="bl t-actions">
        {t.bottom.board}
      </a>
    </div>
  );
}

