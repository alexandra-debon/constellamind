import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isStar, pairKey, parseAddress, SATS, STARS, STATUSES, type Status } from '../model';
import { hasPen } from '../ink';
import { usePremium } from '../account';
import { CLOSE, segments, toggleHighlight } from '../highlight';
import { useStore } from '../store';
import { Icon } from './icons';
import { InkCanvas } from './Ink';

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
  const [sheet, setSheet] = useState(false);
  const items: [string, string, string][] = [
    ['', t.nav.core, 'star'],
    ['nebuleuse', t.nav.nebula, 'nebula'],
    ['passerelles', t.nav.bridges, 'bridges'],
    ['matrice', t.nav.matrix, 'matrix'],
    ['actions', t.nav.actions, 'actions'],
    ['notes', t.nav.notes, 'notes'],
    ['methode', t.nav.method, 'method'],
    ['constellations', t.docs.title, 'layers'],
    ['compte', t.account.title, 'user'],
  ];
  // Phone tab bar keeps the four daily destinations; the rest lives under "More".
  const primary = new Set(['', 'nebuleuse', 'actions', 'passerelles']);
  const secondaryActive = !primary.has(active);
  const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

  return (
    <>
      <nav className="rail" aria-label="Navigation">
        <a href="#/" className="rail-logo" aria-label="ConstellaMind">
          <StarIcon size={26} />
        </a>
        {items.map(([k, lbl, icon]) => (
          <a key={k} href={`#/${k}`} className={`rail-item n-${k || 'core'} ${active === k ? 'on' : ''}`}>
            <Icon name={icon} size={22} />
            <span>{label(lbl)}</span>
          </a>
        ))}
      </nav>

      <nav className="tabbar" aria-label="Navigation">
        {items
          .filter(([k]) => primary.has(k))
          .map(([k, lbl, icon]) => (
            <a key={k} href={`#/${k}`} className={`tab-item n-${k || 'core'} ${active === k ? 'on' : ''}`}>
              <Icon name={icon} size={22} />
              <span>{label(lbl)}</span>
            </a>
          ))}
        <button type="button" className={`tab-item ${secondaryActive ? 'on' : ''}`} onClick={() => setSheet(true)}>
          <Icon name="more" size={22} />
          <span>{t.more}</span>
        </button>
      </nav>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            {items
              .filter(([k]) => !primary.has(k))
              .map(([k, lbl, icon]) => (
                <a key={k} href={`#/${k}`} className={`sheet-item n-${k}`} onClick={() => setSheet(false)}>
                  <Icon name={icon} size={22} /> {label(lbl)}
                </a>
              ))}
          </div>
        </div>
      )}
    </>
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
  highlight = false,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  /** Offer the (premium) highlighter on selected text. */
  highlight?: boolean;
}) {
  const { t } = useStore();
  const { premium, require } = usePremium();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  const trackSelection = () => {
    const el = ref.current;
    if (!el) return;
    setSel(el.selectionStart !== el.selectionEnd ? { start: el.selectionStart, end: el.selectionEnd } : null);
  };

  const applyHighlight = () => {
    if (!sel || !require('highlight')) return;
    const next = toggleHighlight(value, sel.start, sel.end);
    onChange(next.text);
    requestAnimationFrame(() => {
      ref.current?.setSelectionRange(next.start, next.end);
      trackSelection();
    });
  };

  const inHighlight = sel ? segments(value.slice(0, sel.end)).some((g) => g.marked) && value.slice(sel.start, sel.end).indexOf(CLOSE) < 0 : false;

  return (
    <div className="lined-wrap">
      <div className="lined lined-backdrop" aria-hidden="true">
        {segments(value).map((g, i) => (g.marked ? <mark key={i}>{g.text}</mark> : <span key={i}>{g.text}</span>))}
        {'\n'}
      </div>
      <textarea
        ref={ref}
        className="lined lined-input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onSelect={trackSelection}
        onKeyUp={trackSelection}
        onMouseUp={trackSelection}
        onTouchEnd={() => window.setTimeout(trackSelection, 0)}
        onBlur={() => window.setTimeout(() => setSel(null), 150)}
      />
      {highlight && sel && (
        <button type="button" className="hl-btn" onMouseDown={(e) => e.preventDefault()} onClick={applyHighlight}>
          <Icon name="marker" size={16} /> {inHighlight ? t.unhighlight : t.highlight}
          {!premium && <span className="pro">PRO</span>}
        </button>
      )}
    </div>
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


/**
 * A writing field offering both keyboard text and handwriting. The two contents
 * are kept side by side; the toggle only chooses which one you are working on.
 */
export function WriteField({
  value,
  onChange,
  inkKey,
  rows = 3,
  placeholder,
  inkHeight,
}: {
  value: string;
  onChange: (v: string) => void;
  inkKey: string;
  rows?: number;
  placeholder?: string;
  inkHeight?: number;
}) {
  const { data, inkPage, t } = useStore();
  const hasInk = !!inkPage(inkKey)?.strokes.length;
  const [mode, setMode] = useState<'keyboard' | 'pen'>(() => {
    if (hasInk && !value) return 'pen';
    if (value && !hasInk) return 'keyboard';
    const pref = data.settings.writing;
    return pref === 'pen' || (pref === 'auto' && hasPen()) ? 'pen' : 'keyboard';
  });
  const minH = inkHeight ?? Math.max(220, rows * 88);

  return (
    <div className="write-field">
      <div className="write-toggle" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'keyboard'} className={mode === 'keyboard' ? 'on' : ''} onClick={() => setMode('keyboard')}>
          <Icon name="keyboard" size={16} /> {t.write.keyboard}
          {mode === 'pen' && value && <span className="has" title={t.write.hasOther} />}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'pen'} className={mode === 'pen' ? 'on' : ''} onClick={() => setMode('pen')}>
          <Icon name="pen" size={16} /> {t.write.pen}
          {mode === 'keyboard' && hasInk && <span className="has" title={t.write.hasOther} />}
        </button>
      </div>
      {mode === 'keyboard' ? (
        <Lined value={value} onChange={onChange} rows={rows} placeholder={placeholder} highlight />
      ) : (
        <InkCanvas inkKey={inkKey} minHeight={minH} />
      )}
    </div>
  );
}
