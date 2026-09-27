// Handwriting model. Coordinates are stored in "units" where the canvas width is
// always 1000, so a page written on an iPad looks the same on a phone or a desktop.

export const INK_WIDTH = 1000;

export type Tool = 'pen' | 'marker' | 'eraser';

export interface Stroke {
  /** pen = pressure-sensitive ink, marker = translucent highlighter. */
  t: 'pen' | 'marker';
  /** Colour: a CSS colour, or "ink"/"star" tokens resolved at render time. */
  c: string;
  /** Base width in units. */
  w: number;
  /** Flattened [x, y, pressure(0-100)] triples, rounded to integers. */
  p: number[];
}

export interface InkPage {
  /** Height in units (grows with "+ space"). */
  h: number;
  strokes: Stroke[];
}

export type InkBook = Record<string, InkPage>;

export const emptyPage = (h = 360): InkPage => ({ h, strokes: [] });

export function resolveColor(c: string, el: Element): string {
  if (c === 'ink' || c === 'star') {
    const v = getComputedStyle(el).getPropertyValue(c === 'ink' ? '--text' : '--ink').trim();
    return v || '#222';
  }
  return c;
}

/** Draws one stroke with pressure-varying width and midpoint smoothing. */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number, color: string) {
  const p = s.p;
  const n = p.length / 3;
  if (n === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  if (s.t === 'marker') {
    ctx.globalAlpha = 0.32;
    ctx.lineCap = 'butt';
  }
  const width = (i: number) => {
    if (s.t === 'marker') return s.w * scale;
    const pr = p[i * 3 + 2] / 100;
    return Math.max(0.6, s.w * scale * (0.35 + pr * 1.05));
  };

  if (n === 1) {
    ctx.beginPath();
    ctx.arc(p[0] * scale, p[1] * scale, width(0) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (s.t === 'marker') {
    // One path so overlapping segments don't darken the translucent marker.
    ctx.lineWidth = width(0);
    ctx.beginPath();
    ctx.moveTo(p[0] * scale, p[1] * scale);
    for (let i = 1; i < n; i++) ctx.lineTo(p[i * 3] * scale, p[i * 3 + 1] * scale);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Segment by segment so each piece gets its own pressure width.
  let px = p[0] * scale;
  let py = p[1] * scale;
  for (let i = 1; i < n; i++) {
    const x = p[i * 3] * scale;
    const y = p[i * 3 + 1] * scale;
    const mx = (px + x) / 2;
    const my = (py + y) / 2;
    ctx.lineWidth = width(i);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px, py, mx, my);
    ctx.lineTo(x, y);
    ctx.stroke();
    px = x;
    py = y;
  }
  ctx.restore();
}

/** Index of strokes passing within `r` units of (x, y). */
export function strokesNear(strokes: Stroke[], x: number, y: number, r: number): number[] {
  const hits: number[] = [];
  const r2 = r * r;
  strokes.forEach((s, i) => {
    const pad = r + s.w * (s.t === 'marker' ? 0.5 : 1);
    for (let k = 0; k < s.p.length; k += 3) {
      const dx = s.p[k] - x;
      const dy = s.p[k + 1] - y;
      if (dx * dx + dy * dy <= Math.max(r2, pad * pad)) {
        hits.push(i);
        return;
      }
    }
  });
  return hits;
}

/** Bottom of the lowest stroke, to crop read-only previews. */
export function contentHeight(page: InkPage): number {
  let max = 0;
  for (const s of page.strokes) for (let k = 1; k < s.p.length; k += 3) max = Math.max(max, s.p[k] + s.w * 2);
  return max;
}

// Remember globally whether a stylus has been used: once a pen is seen, fingers
// scroll instead of drawing (palm rejection), and ink becomes the default mode.
let penSeen = false;
const penListeners = new Set<() => void>();
export const hasPen = () => penSeen;
export function notePen() {
  if (penSeen) return;
  penSeen = true;
  penListeners.forEach((f) => f());
}
export function onPen(f: () => void) {
  penListeners.add(f);
  return () => penListeners.delete(f);
}
