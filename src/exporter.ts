import { Capacitor } from '@capacitor/core';
import type { Dict } from './i18n';
import { contentHeight, drawStroke, INK_WIDTH, type InkBook, type InkPage } from './ink';
import { isValidAddress, SATS, STARS, type Constellation } from './model';
import { exportFile } from './persist';
import { stripMarks } from './highlight';

// PDF and image exports (premium). Everything is drawn from the data itself, so
// the result does not depend on the screen size or the current theme.

const COLORS: Record<number, [string, string]> = {
  1: ['#2f698c', '#d3e6f2'],
  2: ['#a83659', '#f9d3db'],
  3: ['#3f793a', '#d8ebd3'],
  4: ['#a8561f', '#fbdbc1'],
  5: ['#69498c', '#e6daef'],
  6: ['#2a7069', '#d1ebe8'],
  7: ['#9a4936', '#f6d6c8'],
  8: ['#3d4f95', '#dbe2f6'],
  9: ['#59792d', '#e2efc8'],
  10: ['#6e5236', '#efdfcf'],
  11: ['#8e3f79', '#f4d4eb'],
  12: ['#4f5d6e', '#e1e6eb'],
};
const GOLD = '#8c640f';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const SIZE = 720;
const C = SIZE / 2;
const starPos = (s: number) => {
  const a = ((s - 1) * 30 - 90) * (Math.PI / 180);
  return { x: C + 270 * Math.cos(a), y: C + 270 * Math.sin(a), a };
};
const satPos = (s: number, k: number) => {
  const { x, y, a } = starPos(s);
  const b = a + ((k - 3.5) * 29 * Math.PI) / 180;
  return { x: x + 47 * Math.cos(b), y: y + 47 * Math.sin(b) };
};
const posOf = (addr: string) => {
  const [s, k] = addr.split('.').map(Number);
  return k ? satPos(s, k) : starPos(s);
};

function wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > width && line) {
      lines.push(line);
      line = w;
      if (lines.length === max) break;
    } else line = test;
  }
  if (lines.length < max && line) lines.push(line);
  return lines;
}

/** Renders the sky map on a square canvas (px wide). */
export function drawSky(data: Constellation, t: Dict, px = 2048, title?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const header = title ? 150 : 0;
  canvas.width = px;
  canvas.height = px + header;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (title) {
    ctx.fillStyle = '#1f1c16';
    ctx.font = `800 ${px * 0.036}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, px / 2, header * 0.62);
  }
  ctx.translate(0, header);
  const k = px / SIZE;
  ctx.scale(k, k);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // spokes and source
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = '#d8c69a';
  ctx.lineWidth = 1.2;
  for (const s of STARS) {
    const p = starPos(s);
    ctx.beginPath();
    ctx.moveTo(C + 132 * Math.cos(p.a), C + 132 * Math.sin(p.a));
    ctx.lineTo(p.x - 31 * Math.cos(p.a), p.y - 31 * Math.sin(p.a));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(C, C, 132, 0, Math.PI * 2);
  ctx.fillStyle = '#fbefcf';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = `800 11px ${FONT}`;
  ctx.fillText(t.sourceThought, C, C - 70);
  ctx.fillStyle = '#1f1c16';
  ctx.font = `500 15px ${FONT}`;
  wrapLines(ctx, stripMarks(data.source), 200, 6).forEach((l, i, all) => ctx.fillText(l, C, C + 8 + (i - (all.length - 1) / 2) * 20));

  // links and bridges
  ctx.lineCap = 'round';
  for (const b of data.bridges) {
    if (!isValidAddress(b.from) || !isValidAddress(b.to) || b.from === b.to) continue;
    const p = posOf(b.from);
    const q = posOf(b.to);
    ctx.setLineDash([1, 5]);
    ctx.strokeStyle = '#69498c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const [a, b] of data.links) {
    const p = posOf(a);
    const q = posOf(b);
    ctx.strokeStyle = COLORS[+a.split('.')[0]][0];
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // stars and satellites
  for (const s of STARS) {
    const [ink, soft] = COLORS[s];
    const p = starPos(s);
    for (const k2 of SATS) {
      const q = satPos(s, k2);
      const sat = data.sats[`${s}.${k2}`];
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 11.5, 0, Math.PI * 2);
      ctx.fillStyle = sat.status === 'action' ? ink : sat.title ? soft : '#ffffff';
      ctx.fill();
      ctx.lineWidth = sat.title ? 2.2 : 1.3;
      ctx.stroke();
      ctx.fillStyle = sat.status === 'action' ? '#ffffff' : '#1f1c16';
      ctx.font = `700 11px ${FONT}`;
      ctx.fillText(String(k2), q.x, q.y + 0.5);
    }
    const star = data.stars[s];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 31, 0, Math.PI * 2);
    ctx.fillStyle = star.status === 'action' ? ink : soft;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = star.title ? 3.5 : 2;
    ctx.stroke();
    ctx.fillStyle = star.status === 'action' ? '#ffffff' : '#1f1c16';
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText(`${t.prefix}${s}`, p.x, p.y + 1);
    if (star.title) {
      ctx.font = `600 9px ${FONT}`;
      ctx.fillStyle = ink;
      // Titles sit between the star and the source, so they stay on the canvas.
      ctx.fillText(stripMarks(star.title).slice(0, 22), p.x - 44 * Math.cos(p.a), p.y - 44 * Math.sin(p.a));
    }
  }
  return canvas;
}

/** Renders a handwriting page to a canvas (white paper, dark ink). */
function drawInk(page: InkPage, starInk: string, px = 1400): HTMLCanvasElement | null {
  if (!page.strokes.length) return null;
  const h = contentHeight(page) + 20;
  const scale = px / INK_WIDTH;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.max(40, Math.round(h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const s of page.strokes) drawStroke(ctx, s, scale, s.c === 'ink' ? '#1f1c16' : s.c === 'star' ? starInk : s.c);
  return canvas;
}

const safeName = (name: string) => name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-') || 'constellation';
const today = () => new Date().toISOString().slice(0, 10);

async function saveBinary(filename: string, base64: string, mime: string) {
  if (Capacitor.isNativePlatform()) {
    const { Directory, Filesystem } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const res = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: base64 });
    await Share.share({ title: filename, files: [res.uri] });
    return;
  }
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportImage(data: Constellation, t: Dict, name: string) {
  const canvas = drawSky(data, t, 2048, name);
  const b64 = canvas.toDataURL('image/png').split(',')[1];
  await saveBinary(`${safeName(name)}-${today()}.png`, b64, 'image/png');
}

export async function exportBackup(payload: unknown, name: string) {
  await exportFile(`${safeName(name)}-${today()}.json`, JSON.stringify(payload));
}

// jsPDF's built-in fonts cover Latin-1/WinAnsi: replace the few symbols they lack.
const pdfText = (s: string) => stripMarks(s).replace(/→/g, '->').replace(/[✓✦]/g, '*').replace(/ /g, ' ');

export async function exportPdf(data: Constellation, ink: InkBook, t: Dict, name: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 16;
  const TW = W - M * 2;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > 297 - M) {
      doc.addPage();
      y = M;
    }
  };
  const heading = (text: string, color = '#1f1c16', size = 15) => {
    ensure(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(pdfText(text), M, y + 5);
    y += size * 0.55;
  };
  const label = (text: string) => {
    ensure(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor('#736d60');
    doc.text(pdfText(text), M, y + 4);
    y += 6;
  };
  const para = (text: string) => {
    const clean = pdfText(text).trim();
    if (!clean) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor('#1f1c16');
    for (const line of doc.splitTextToSize(clean, TW) as string[]) {
      ensure(5.5);
      doc.text(line, M, y + 4);
      y += 5.2;
    }
    y += 2;
  };
  const inkBlock = (key: string, starInk: string) => {
    const page = ink[key];
    if (!page) return;
    const c = drawInk(page, starInk);
    if (!c) return;
    const h = (c.height / c.width) * TW;
    ensure(Math.min(h, 250) + 3);
    doc.addImage(c.toDataURL('image/png'), 'PNG', M, y, TW, h);
    y += h + 3;
  };

  // Cover: name + sky map
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(GOLD);
  doc.text('ConstellaMind', M, y + 8);
  y += 14;
  doc.setFontSize(14);
  doc.setTextColor('#1f1c16');
  doc.text(pdfText(name), M, y + 4);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#736d60');
  doc.text(`${t.methodName} · ${new Date().toLocaleDateString(t.prefix === 'É' ? 'fr-FR' : 'en-GB')}`, M, y + 3);
  y += 8;
  const sky = drawSky(data, t, 1600);
  doc.addImage(sky.toDataURL('image/png'), 'PNG', M, y, TW, TW);
  y += TW + 4;

  // Stars and their satellites
  for (const s of STARS) {
    const star = data.stars[s];
    const satsWithContent = SATS.filter((k) => {
      const a = `${s}.${k}`;
      const sat = data.sats[a];
      return sat.title || sat.origin || sat.development || ink[`sat:${a}:origin`] || ink[`sat:${a}:dev`];
    });
    const hasStar = star.title || star.intuition || star.notes || ink[`star:${s}:intuition`] || ink[`star:${s}:notes`];
    if (!hasStar && !satsWithContent.length) continue;
    const [color] = COLORS[s];
    doc.addPage();
    y = M;
    heading(`${t.star} ${t.prefix}${s}${star.title ? ` · ${star.title}` : ''}`, color, 16);
    if (star.status) para(`${t.status} : ${t.statuses[star.status]}`);
    if (star.intuition || ink[`star:${s}:intuition`]) {
      label(t.intuition);
      para(star.intuition);
      inkBlock(`star:${s}:intuition`, color);
    }
    if (star.notes || ink[`star:${s}:notes`]) {
      label(t.notesLabel);
      para(star.notes);
      inkBlock(`star:${s}:notes`, color);
    }
    for (const k of satsWithContent) {
      const a = `${s}.${k}`;
      const sat = data.sats[a];
      y += 3;
      heading(`${t.satellite} ${t.prefix}${a}${sat.title ? ` · ${sat.title}` : ''}`, color, 12);
      if (sat.status) para(`${t.status} : ${t.statuses[sat.status]}`);
      if (sat.origin || ink[`sat:${a}:origin`]) {
        label(t.origin);
        para(sat.origin);
        inkBlock(`sat:${a}:origin`, color);
      }
      if (sat.development || ink[`sat:${a}:dev`]) {
        label(t.development);
        para(sat.development);
        inkBlock(`sat:${a}:dev`, color);
      }
      const related = sat.relatedTo.filter(isValidAddress);
      if (related.length) para(`${t.relatedTo} : ${related.map((r) => t.prefix + r).join(', ')}`);
    }
  }

  // Actions
  if (data.actions.length) {
    doc.addPage();
    y = M;
    heading(t.bottom.board, '#3f793a');
    for (const a of data.actions) {
      para(`${a.done ? '[x]' : '[ ]'} ${a.text}${a.origin ? `  (${t.prefix}${a.origin})` : ''}${a.due ? ` · ${a.due}` : ''}${a.prio ? ` · P${a.prio}` : ''}${a.project ? ` · ${a.project}` : ''}`);
    }
  }
  // Bridges
  if (data.bridges.length) {
    y += 4;
    heading(t.bottom.register, '#69498c');
    for (const b of data.bridges) {
      const nat = b.nature ? ` [${t.natures[b.nature][1]}]` : '';
      para(`${t.prefix}${b.from} -> ${t.prefix}${b.to}${nat} ${b.why}`);
    }
  }
  // Notes
  if (data.notes || ink.notes) {
    doc.addPage();
    y = M;
    heading(t.notesTitle);
    para(data.notes);
    inkBlock('notes', GOLD);
  }

  const b64 = doc.output('datauristring').split(',')[1];
  await saveBinary(`${safeName(name)}-${today()}.pdf`, b64, 'application/pdf');
}
