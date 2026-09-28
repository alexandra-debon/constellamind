import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as RPointerEvent } from 'react';
import {
  contentHeight,
  drawStroke,
  emptyPage,
  INK_WIDTH,
  notePen,
  onPen,
  resolveColor,
  strokesNear,
  type Stroke,
  type Tool,
} from '../ink';
import { usePremium } from '../account';
import { tick } from '../native';
import { askConfirm } from './confirm';
import { useStore } from '../store';
import { Icon } from './icons';

/* ───── Shared tool state (the same pen follows you from field to field) ───── */

interface ToolState {
  tool: Tool;
  penColor: string;
  markerColor: string;
  size: 0 | 1 | 2;
  finger: boolean;
}

let toolState: ToolState = { tool: 'pen', penColor: 'ink', markerColor: '#ffd400', size: 1, finger: true };
const toolListeners = new Set<() => void>();
const setTool = (patch: Partial<ToolState>) => {
  toolState = { ...toolState, ...patch };
  toolListeners.forEach((f) => f());
};
const useTool = () =>
  useSyncExternalStore(
    (f) => {
      toolListeners.add(f);
      return () => toolListeners.delete(f);
    },
    () => toolState,
  );

// Once an Apple Pencil / S Pen is seen, fingers scroll instead of drawing.
onPen(() => setTool({ finger: false }));

const PEN_SIZES = [2.2, 3.6, 6.5];
const MARKER_SIZES = [16, 24, 36];
const PEN_COLORS = ['ink', 'star', '#2563eb', '#dc2626', '#15803d'];
const MARKER_COLORS = ['#ffd400', '#6ee7b7', '#f9a8d4', '#93c5fd'];
const LINE_GAP = 44; // units between ruled lines

function Toolbar({ canUndo, canRedo, onUndo, onRedo, onClear }: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}) {
  const { t } = useStore();
  const { premium, require } = usePremium();
  const s = useTool();
  const colors = s.tool === 'marker' ? MARKER_COLORS : PEN_COLORS;
  const current = s.tool === 'marker' ? s.markerColor : s.penColor;
  return (
    <div className="ink-toolbar" role="toolbar" aria-label={t.ink.tools}>
      <div className="seg">
        <button type="button" className={s.tool === 'pen' ? 'on' : ''} onClick={() => setTool({ tool: 'pen' })} title={t.ink.pen} aria-label={t.ink.pen}>
          <Icon name="pen" />
        </button>
        <button
          type="button"
          className={s.tool === 'marker' ? 'on' : ''}
          onClick={() => require('highlight') && setTool({ tool: 'marker' })}
          title={t.ink.marker}
          aria-label={t.ink.marker}
        >
          <Icon name="marker" />
          {!premium && <span className="pro dot-pro" />}
        </button>
        <button type="button" className={s.tool === 'eraser' ? 'on' : ''} onClick={() => setTool({ tool: 'eraser' })} title={t.ink.eraser} aria-label={t.ink.eraser}>
          <Icon name="eraser" />
        </button>
      </div>
      {s.tool !== 'eraser' && (
        <>
          <div className="swatches">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch ${current === c ? 'on' : ''} ${c === 'ink' ? 'sw-ink' : c === 'star' ? 'sw-star' : ''}`}
                style={c.startsWith('#') ? { background: c } : undefined}
                onClick={() => setTool(s.tool === 'marker' ? { markerColor: c } : { penColor: c })}
                aria-label={c}
              />
            ))}
          </div>
          <div className="seg sizes">
            {([0, 1, 2] as const).map((z) => (
              <button key={z} type="button" className={s.size === z ? 'on' : ''} onClick={() => setTool({ size: z })} aria-label={`${z + 1}`}>
                <span className="dot" style={{ width: 4 + z * 4, height: 4 + z * 4 }} />
              </button>
            ))}
          </div>
        </>
      )}
      <div className="seg">
        <button type="button" onClick={onUndo} disabled={!canUndo} title={t.ink.undo} aria-label={t.ink.undo}>
          <Icon name="undo" />
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} title={t.ink.redo} aria-label={t.ink.redo}>
          <Icon name="redo" />
        </button>
      </div>
      <button
        type="button"
        className={`finger ${s.finger ? 'on' : ''}`}
        onClick={() => setTool({ finger: !s.finger })}
        title={s.finger ? t.ink.fingerOn : t.ink.fingerOff}
      >
        <Icon name="hand" /> <span>{s.finger ? t.ink.fingerOn : t.ink.fingerOff}</span>
      </button>
      <button type="button" className="clear" onClick={onClear} title={t.ink.clear} aria-label={t.ink.clear}>
        <Icon name="trash" />
      </button>
    </div>
  );
}

/**
 * A handwriting surface. Strokes are kept in "units" (width = 1000) so the page
 * scales to any screen. Apple Pencil pressure is honoured; once a stylus has been
 * used, touches scroll the page (palm rejection) unless finger drawing is on.
 */
export function InkCanvas({ inkKey, readOnly = false, minHeight = 360 }: { inkKey: string; readOnly?: boolean; minHeight?: number }) {
  const { inkPage, setInkPage, t } = useStore();
  const stored = inkPage(inkKey);
  const page = stored ?? emptyPage(minHeight);

  const wrap = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const tool = useTool();

  const current = useRef<{ id: number; stroke: Stroke; erasing: boolean } | null>(null);
  const scrollTouch = useRef<{ id: number; y: number } | null>(null);
  const history = useRef<{ undo: Stroke[][]; redo: Stroke[][] }>({ undo: [], redo: [] });
  const [, bump] = useState(0);

  const scale = width / INK_WIDTH;
  const h = readOnly ? Math.max(contentHeight(page) + 24, 60) : Math.max(page.h, minHeight);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const sizeCanvas = useCallback(
    (c: HTMLCanvasElement | null) => {
      if (!c || !width) return null;
      const dpr = window.devicePixelRatio || 1;
      const W = Math.round(width * dpr);
      const H = Math.round(h * scale * dpr);
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    },
    [width, h, scale],
  );

  // Redraw committed strokes whenever the page, size or theme changes.
  const { dark } = useStore();
  useEffect(() => {
    const ctx = sizeCanvas(base.current);
    if (!ctx || !base.current) return;
    ctx.clearRect(0, 0, width, h * scale);
    for (const s of page.strokes) drawStroke(ctx, s, scale, resolveColor(s.c, base.current));
    sizeCanvas(live.current);
  }, [page, width, h, scale, sizeCanvas, dark]);

  const commit = (strokes: Stroke[], nextH = page.h) => {
    history.current.undo.push(page.strokes);
    if (history.current.undo.length > 100) history.current.undo.shift();
    history.current.redo = [];
    setInkPage(inkKey, { h: nextH, strokes });
    bump((n) => n + 1);
  };

  const toUnits = (e: { clientX: number; clientY: number }) => {
    const r = live.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    if (e.pointerType === 'pen') notePen();
    const draws = e.pointerType !== 'touch' || toolState.finger;
    if (!draws) {
      scrollTouch.current = { id: e.pointerId, y: e.clientY };
      return;
    }
    if (current.current) return; // ignore a second contact (palm) while writing
    e.preventDefault();
    live.current!.setPointerCapture(e.pointerId);
    // Barrel/eraser button on styluses that report it acts as an eraser.
    const erasing = toolState.tool === 'eraser' || (e.buttons & 32) !== 0;
    const marker = toolState.tool === 'marker';
    const { x, y } = toUnits(e);
    const stroke: Stroke = {
      t: marker ? 'marker' : 'pen',
      c: marker ? toolState.markerColor : toolState.penColor,
      w: (marker ? MARKER_SIZES : PEN_SIZES)[toolState.size],
      p: [],
    };
    current.current = { id: e.pointerId, stroke, erasing };
    if (erasing) eraseAt(x, y);
    else addPoint(e, x, y);
  };

  const pressureOf = (e: PointerEvent | RPointerEvent) => (e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5);

  const addPoint = (e: PointerEvent | RPointerEvent, x: number, y: number) => {
    const s = current.current!.stroke;
    const n = s.p.length;
    if (n && Math.abs(s.p[n - 3] - x) < 0.8 && Math.abs(s.p[n - 2] - y) < 0.8) return;
    s.p.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pressureOf(e) * 100));
    const ctx = sizeCanvas(live.current);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, h * scale);
    drawStroke(ctx, s, scale, resolveColor(s.c, live.current!));
  };

  const erased = useRef<Set<number>>(new Set());
  const eraseAt = (x: number, y: number) => {
    for (const i of strokesNear(page.strokes, x, y, 10)) erased.current.add(i);
    if (!erased.current.size) return;
    // Preview: redraw without erased strokes.
    const ctx = sizeCanvas(base.current);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, h * scale);
    page.strokes.forEach((s, i) => !erased.current.has(i) && drawStroke(ctx, s, scale, resolveColor(s.c, base.current!)));
  };

  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const sc = scrollTouch.current;
    if (sc && sc.id === e.pointerId) {
      window.scrollBy(0, sc.y - e.clientY);
      sc.y = e.clientY;
      return;
    }
    const cur = current.current;
    if (!cur || cur.id !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const { x, y } = toUnits(ev);
      if (cur.erasing) eraseAt(x, y);
      else addPoint(ev, x, y);
    }
  };

  const onUp = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (scrollTouch.current?.id === e.pointerId) scrollTouch.current = null;
    const cur = current.current;
    if (!cur || cur.id !== e.pointerId) return;
    current.current = null;
    const ctx = sizeCanvas(live.current);
    ctx?.clearRect(0, 0, width, h * scale);
    if (cur.erasing) {
      if (erased.current.size) {
        const keep = page.strokes.filter((_, i) => !erased.current.has(i));
        erased.current = new Set();
        commit(keep);
      }
      return;
    }
    if (!cur.stroke.p.length) return;
    // Grow the page automatically when writing near the bottom.
    let nextH = Math.max(page.h, minHeight);
    const bottom = contentHeight({ h: nextH, strokes: [cur.stroke] });
    if (bottom > nextH - LINE_GAP) nextH = Math.ceil((bottom + LINE_GAP * 3) / LINE_GAP) * LINE_GAP;
    commit([...page.strokes, cur.stroke], nextH);
  };

  const undo = () => {
    const prev = history.current.undo.pop();
    if (!prev) return;
    history.current.redo.push(page.strokes);
    setInkPage(inkKey, { h: page.h, strokes: prev });
    bump((n) => n + 1);
  };
  const redo = () => {
    const next = history.current.redo.pop();
    if (!next) return;
    history.current.undo.push(page.strokes);
    setInkPage(inkKey, { h: page.h, strokes: next });
    bump((n) => n + 1);
  };
  const clear = async () => {
    if (!page.strokes.length || !(await askConfirm(t.ink.clearConfirm, t.ink.clear, t.cancel))) return;
    commit([], minHeight);
    void tick();
  };

  return (
    <div className={`ink ${readOnly ? 'readonly' : ''}`}>
      {!readOnly && (
        <Toolbar
          canUndo={history.current.undo.length > 0}
          canRedo={history.current.redo.length > 0}
          onUndo={undo}
          onRedo={redo}
          onClear={clear}
        />
      )}
      <div
        ref={wrap}
        className={`ink-surface tool-${tool.tool}`}
        style={{ height: width ? h * scale : minHeight / 3, ['--gap' as string]: `${LINE_GAP * scale}px` }}
      >
        <canvas ref={base} className="ink-base" />
        {!readOnly && (
          <canvas
            ref={live}
            className="ink-live"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onContextMenu={(e) => e.preventDefault()}
          />
        )}
      </div>
      {!readOnly && (
        <button type="button" className="ink-more" onClick={() => setInkPage(inkKey, { h: h + LINE_GAP * 6, strokes: page.strokes })}>
          <Icon name="plus" /> {t.ink.more}
        </button>
      )}
    </div>
  );
}

