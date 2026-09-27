import { useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { BottomLinks, hrefOf, StarIcon, TopNav } from '../components/common';
import { Icon } from '../components/icons';
import { isValidAddress, pairKey, SATS, STARS } from '../model';
import { tick } from '../native';
import { go, useStore } from '../store';

const SIZE = 720;
const C = SIZE / 2;
const ORBIT = 270;
const STAR_R = 31;
const SAT_DIST = 47;
const SAT_R = 11.5;
const SOURCE_R = 132;

function starPos(s: number) {
  const a = ((s - 1) * 30 - 90) * (Math.PI / 180);
  return { x: C + ORBIT * Math.cos(a), y: C + ORBIT * Math.sin(a), a };
}

function satPos(s: number, k: number) {
  const { x, y, a } = starPos(s);
  // Satellites fan out on the outer side of their star, like in the notebook.
  const b = a + ((k - 3.5) * 29 * Math.PI) / 180;
  return { x: x + SAT_DIST * Math.cos(b), y: y + SAT_DIST * Math.sin(b) };
}

export function posOf(addr: string) {
  const [s, k] = addr.split('.').map(Number);
  return k ? satPos(s, k) : starPos(s);
}

const NODES: { addr: string; x: number; y: number; r: number }[] = STARS.flatMap((s) => [
  { addr: String(s), ...starPos(s), r: STAR_R },
  ...SATS.map((k) => ({ addr: `${s}.${k}`, ...satPos(s, k), r: SAT_R })),
]);

/** Nearest idea to a point; `slop` widens small targets to finger size. */
function hit(x: number, y: number, slop = 10) {
  let best: { addr: string; d: number } | null = null;
  for (const n of NODES) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= Math.max(n.r + 10, slop) && (!best || d < best.d)) best = { addr: n.addr, d };
  }
  return best?.addr ?? null;
}

export default function Core() {
  const { data, update, t, fmt } = useStore();
  const svg = useRef<SVGSVGElement>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drag, setDrag] = useState<{ from: string; x: number; y: number; id: number } | null>(null);

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };

  // Apple Pencil (pen) always draws; fingers and mouse draw only in drawing mode.
  const draws = (e: RPointerEvent) => drawMode || e.pointerType === 'pen';

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (!draws(e)) return;
    const p = toSvg(e);
    const from = hit(p.x, p.y);
    if (!from) return;
    e.preventDefault();
    svg.current!.setPointerCapture(e.pointerId);
    setDrag({ from, ...p, id: e.pointerId });
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag || e.pointerId !== drag.id) return;
    setDrag({ ...drag, ...toSvg(e) });
  };
  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = toSvg(e);
    const to = hit(p.x, p.y);
    const from = drag.from;
    setDrag(null);
    if (!to) return;
    if (to === from) {
      go(hrefOf(from));
      return;
    }
    update((d) => {
      if (!d.links.some(([a, b]) => pairKey(a, b) === pairKey(from, to))) d.links.push([from, to]);
    });
    void tick();
  };

  // Taps resolve to the nearest idea within ~22 screen pixels, so the small
  // satellite circles stay easy to hit on a phone.
  const onTap = (e: RMouseEvent<SVGSVGElement>) => {
    if (drawMode || (e.target as Element).closest('.link')) return;
    const p = toSvg(e);
    const r = svg.current!.getBoundingClientRect();
    const addr = hit(p.x, p.y, (22 * SIZE) / r.width);
    if (addr) go(hrefOf(addr));
  };

  const removeLink = (a: string, b: string) => {
    if (!drawMode) return;
    update((d) => {
      d.links = d.links.filter(([x, y]) => pairKey(x, y) !== pairKey(a, b));
    });
  };

  const colorOf = (addr: string) => `var(--s${addr.split('.')[0]}-ink)`;

  return (
    <div className="page">
      <TopNav active="" />
      <header className="app-header">
        <div>
          <h1>ConstellaMind</h1>
          <p>
            {t.methodName} · {t.appTagline}
          </p>
        </div>
        <a className="icon-btn" href="#/methode" aria-label={t.settings}>
          <Icon name="settings" size={22} />
        </a>
      </header>

      <div className={`sky ${drawMode ? 'drawing' : ''}`}>
        <svg
          ref={svg}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setDrag(null)}
          onClick={onTap}
          role="img"
          aria-label={t.nav.core}
        >
          {STARS.map((s) => {
            const p = starPos(s);
            const inner = { x: C + SOURCE_R * Math.cos(p.a), y: C + SOURCE_R * Math.sin(p.a) };
            return (
              <line
                key={s}
                x1={inner.x}
                y1={inner.y}
                x2={p.x - STAR_R * Math.cos(p.a)}
                y2={p.y - STAR_R * Math.sin(p.a)}
                className="spoke"
              />
            );
          })}
          <circle cx={C} cy={C} r={SOURCE_R} className="source" />

          {data.bridges
            .filter((b) => isValidAddress(b.from) && isValidAddress(b.to) && b.from !== b.to)
            .map((b) => {
              const p = posOf(b.from);
              const q = posOf(b.to);
              return <line key={b.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="bridge-line" />;
            })}

          {data.links.map(([a, b]) => {
            const p = posOf(a);
            const q = posOf(b);
            return (
              <g key={pairKey(a, b)} onClick={() => removeLink(a, b)} className="link">
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="link-hit" />
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="link-line" style={{ stroke: colorOf(a) }} />
              </g>
            );
          })}

          {STARS.map((s) => {
            const p = starPos(s);
            const star = data.stars[s];
            return (
              <g key={s} data-star={s} className="node-group">
                {SATS.map((k) => {
                  const q = satPos(s, k);
                  const addr = `${s}.${k}`;
                  const sat = data.sats[addr];
                  return (
                    <g key={k} className="node-link">
                      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="tether" />
                      <circle
                        cx={q.x}
                        cy={q.y}
                        r={SAT_R}
                        className={`sat ${sat.title ? 'filled' : ''} ${sat.status ? `st-${sat.status}` : ''}`}
                      >
                        <title>{`${fmt(addr)} ${sat.title}`}</title>
                      </circle>
                      <text x={q.x} y={q.y + 4} className="sat-label">
                        {k}
                      </text>
                    </g>
                  );
                })}
                <g className="node-link" role="link" tabIndex={0} aria-label={`${fmt(String(s))} ${star.title}`} onKeyDown={(e) => e.key === 'Enter' && go(hrefOf(String(s)))}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={STAR_R}
                    className={`star ${star.title ? 'filled' : ''} ${star.status ? `st-${star.status}` : ''}`}
                  >
                    <title>{`${fmt(String(s))} ${star.title}`}</title>
                  </circle>
                  <text x={p.x} y={p.y + 6} className="star-label">
                    {fmt(String(s))}
                  </text>
                </g>
              </g>
            );
          })}

          {drag &&
            (() => {
              const p = posOf(drag.from);
              return <line x1={p.x} y1={p.y} x2={drag.x} y2={drag.y} className="drag-line" />;
            })()}
        </svg>

        <div className="source-box">
          <div className="source-head">
            <StarIcon size={26} filled={false} />
            <span>{t.sourceThought}</span>
          </div>
          <textarea
            value={data.source}
            placeholder={t.sourcePlaceholder}
            onChange={(e) => {
              const v = e.target.value;
              update((d) => {
                d.source = v;
              });
            }}
          />
        </div>
      </div>

      <p className="hint">{drawMode ? t.drawModeOn : t.coreHint}</p>
      <div className="core-tools">
        <button type="button" className={`chip ${drawMode ? 'on' : ''}`} onClick={() => setDrawMode((m) => !m)}>
          ✎ {t.drawMode}
        </button>
        {data.links.length > 0 && (
          <button
            type="button"
            className="chip ghost"
            onClick={() => {
              if (window.confirm(t.clearLinksConfirm))
                update((d) => {
                  d.links = [];
                });
            }}
          >
            {t.clearLinks}
          </button>
        )}
      </div>

      <BottomLinks />
    </div>
  );
}
