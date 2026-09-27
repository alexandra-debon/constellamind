// Core data model of the NÉSO method: 12 stars (idées-mères), 6 satellites each.
// Internal addresses are language-neutral: "3" is star 3, "3.2" its second satellite.

export const STAR_COUNT = 12;
export const SAT_COUNT = 6;

export const STARS = Array.from({ length: STAR_COUNT }, (_, i) => i + 1);
export const SATS = Array.from({ length: SAT_COUNT }, (_, i) => i + 1);

export type Status = 'germ' | 'exploring' | 'ripe' | 'action' | 'dormant';
export const STATUSES: Status[] = ['germ', 'exploring', 'ripe', 'action', 'dormant'];

export type Nature = 'P' | 'O' | 'N' | 'F' | 'Q';
export const NATURES: Nature[] = ['P', 'O', 'N', 'F', 'Q'];

export interface Star {
  title: string;
  status: Status | null;
  intuition: string;
  notes: string;
}

export interface Satellite {
  title: string;
  status: Status | null;
  origin: string;
  development: string;
  relatedTo: string[];
  todos: { text: string; done: boolean }[];
}

export interface Shard {
  id: string;
  text: string;
  /** True when the shard was handwritten (ink stored under `shard:<id>`). */
  ink?: boolean;
  address: string;
  createdAt: string;
}

export interface Action {
  id: string;
  star: number;
  done: boolean;
  text: string;
  origin: string;
  who: string;
  due: string;
  project: string;
  prio: '' | '1' | '2' | '3';
}

export interface Bridge {
  id: string;
  from: string;
  to: string;
  nature: Nature | '';
  why: string;
  date: string;
}

export interface Settings {
  lang: 'fr' | 'en';
  /** Colour edition or black & white edition (e-ink tablets). */
  theme: 'color' | 'bw';
  /** Light paper, night sky, or follow the system. */
  appearance: 'system' | 'light' | 'dark';
  /** Default writing mode for new fields. */
  writing: 'auto' | 'keyboard' | 'pen';
  onboarded: boolean;
}

export interface Constellation {
  version: 1;
  source: string;
  stars: Record<string, Star>;
  sats: Record<string, Satellite>;
  nebula: Shard[];
  actions: Action[];
  /** Quick links "circled with the stylus": unordered pairs of addresses. */
  links: [string, string][];
  bridges: Bridge[];
  /** Star matrix: key "i-j" with i<j, strength 0..3. */
  matrix: Record<string, number>;
  matrixInsight: string;
  notes: string;
  rules: string;
  settings: Settings;
}

export const emptyStar = (): Star => ({ title: '', status: null, intuition: '', notes: '' });
export const emptySat = (): Satellite => ({
  title: '',
  status: null,
  origin: '',
  development: '',
  relatedTo: ['', '', '', ''],
  todos: [
    { text: '', done: false },
    { text: '', done: false },
    { text: '', done: false },
  ],
});

export function emptyConstellation(): Constellation {
  const stars: Record<string, Star> = {};
  const sats: Record<string, Satellite> = {};
  for (const s of STARS) {
    stars[s] = emptyStar();
    for (const k of SATS) sats[`${s}.${k}`] = emptySat();
  }
  return {
    version: 1,
    source: '',
    stars,
    sats,
    nebula: [],
    actions: [],
    links: [],
    bridges: [],
    matrix: {},
    matrixInsight: '',
    notes: '',
    rules: '',
    settings: {
      lang: navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en',
      theme: 'color',
      appearance: 'system',
      writing: 'auto',
      onboarded: false,
    },
  };
}

export const isStar = (addr: string) => /^\d+$/.test(addr);
export const starOf = (addr: string) => parseInt(addr.split('.')[0], 10);

export function isValidAddress(addr: string): boolean {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(addr);
  if (!m) return false;
  const s = +m[1];
  if (s < 1 || s > STAR_COUNT) return false;
  if (m[2] === undefined) return true;
  const k = +m[2];
  return k >= 1 && k <= SAT_COUNT;
}

/** Accepts "É4.2", "e4.2", "S4.2", "4.2" … and returns "4.2", or null. */
export function parseAddress(input: string): string | null {
  const clean = input.trim().replace(/^[ÉéEeSs]\s*/, '');
  return isValidAddress(clean) ? clean : null;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
