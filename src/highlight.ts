// Highlights in typed text are stored inline with two invisible characters, so
// they survive copy/paste inside the app and need no separate range bookkeeping.
// Both are "default ignorable" characters: they take no space when displayed.

export const OPEN = '⁣';
export const CLOSE = '⁤';

const MARKS = /[⁣⁤]/g;

export const stripMarks = (s: string) => s.replace(MARKS, '');

export interface Segment {
  text: string;
  marked: boolean;
}

/** Splits text into plain / highlighted runs (markers kept so widths match the textarea). */
export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  let marked = false;
  let buf = '';
  for (const ch of text) {
    if (ch === OPEN || ch === CLOSE) {
      if (buf) out.push({ text: buf, marked });
      buf = ch;
      marked = ch === OPEN;
      continue;
    }
    buf += ch;
  }
  if (buf) out.push({ text: buf, marked });
  return out;
}

/** Is position `i` inside a highlight? */
function insideAt(text: string, i: number): boolean {
  const before = text.slice(0, i);
  return before.lastIndexOf(OPEN) > before.lastIndexOf(CLOSE);
}

/**
 * Toggles the highlight on [start, end): removes it when the selection is already
 * highlighted, otherwise adds it (swallowing any highlights inside the range).
 */
export function toggleHighlight(text: string, start: number, end: number): { text: string; start: number; end: number } {
  if (start === end) return { text, start, end };
  const inner = text.slice(start, end);
  const wasMarked = insideAt(text, start) && !inner.includes(CLOSE);
  const clean = stripMarks(inner);
  const opensBefore = insideAt(text, start);
  const closesAfter = insideAt(text, end);
  let mid: string;
  if (wasMarked) {
    // Cut the selection out of the surrounding highlight.
    mid = `${CLOSE}${clean}${OPEN}`;
  } else {
    mid = `${opensBefore ? '' : OPEN}${clean}${closesAfter ? '' : CLOSE}`;
  }
  const next = (text.slice(0, start) + mid + text.slice(end))
    // tidy: drop empty highlights and doubled markers
    .replace(new RegExp(`${OPEN}${CLOSE}`, 'g'), '')
    .replace(new RegExp(`${CLOSE}${OPEN}`, 'g'), '');
  return { text: next, start, end: start + mid.length };
}
