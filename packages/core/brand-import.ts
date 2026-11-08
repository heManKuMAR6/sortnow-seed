/**
 * Brand onboarding (authoring only): reads colours from a CSS file or design-tokens JSON the integrator points to
 * and proposes a brand policy. It only reads colour values; selectors, names, and other CSS are never copied into
 * the result. The proposal is a draft for a person to review: effects and signature colours stay off until opted in.
 */
import {contrastRatio} from './contrast.js';
import {validateBrand, type Brand, type ColorToken, type Palette} from './brand.js';
import type {Diagnostic} from './index.js';

export interface ColorSource { token: string; value: string }
export interface BrandProposal {
  ok: true; draft: true;
  brand: Brand;
  /** Which input token became each role, or how it was inferred. */
  mapping: Record<ColorToken, ColorSource & {reason: string}>;
  /** Accents adjusted for readability, and other notes for the reviewer. */
  notes: string[];
  colorsFound: number;
}
export type BrandImportResult = BrandProposal | {ok: false; errors: Diagnostic[]};
const MAX_INPUT = 64 * 1024, MAX_COLORS = 500;

type RGB = [number, number, number];
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const hex = ([r, g, b]: RGB) => `#${[r, g, b].map(c => clamp(c).toString(16).padStart(2, '0')).join('')}`;
const toRgb = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;

/** Parses #rgb, #rrggbb (alpha ignored), rgb()/rgba(), and hsl()/hsla(). Anything else is not a colour. */
export function parseColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  let m = /^#([\da-f]{3,4})$/.exec(v);
  if (m) return hex([0, 1, 2].map(i => parseInt(m![1][i] + m![1][i], 16)) as RGB);
  m = /^#([\da-f]{6})([\da-f]{2})?$/.exec(v);
  if (m) return `#${m[1]}`;
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/.exec(v);
  if (m) return hex([m[1], m[2], m[3]].map(c => c.endsWith('%') ? parseFloat(c) * 2.55 : parseFloat(c)) as RGB);
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/.exec(v);
  if (m) {
    const h = (parseFloat(m[1]) % 360) / 360, s = Math.min(1, parseFloat(m[2]) / 100), l = Math.min(1, parseFloat(m[3]) / 100);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t: number) => { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
    return hex([f(h + 1 / 3), f(h), f(h - 1 / 3)]);
  }
  return null;
}

/** Collects CSS custom properties whose values are colours, resolving simple var() references. */
export function colorsFromCss(css: string): ColorSource[] {
  const raw = new Map<string, string>();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/(--[a-zA-Z0-9_-]{1,80})\s*:\s*([^;{}]{1,200})/g)) if (!raw.has(m[1])) raw.set(m[1], m[2].replace(/!important/i, '').trim());
  const resolve = (value: string, depth = 0): string | null => {
    const ref = /^var\(\s*(--[a-zA-Z0-9_-]{1,80})\s*(?:,\s*([^)]+))?\)$/.exec(value);
    if (!ref) return parseColor(value);
    if (depth > 5) return null;
    const target = raw.get(ref[1]);
    return target !== undefined ? resolve(target, depth + 1) : ref[2] ? resolve(ref[2], depth + 1) : null;
  };
  const out: ColorSource[] = [];
  for (const [token, value] of raw) { const c = resolve(value); if (c) out.push({token, value: c}); }
  return out.slice(0, MAX_COLORS);
}

/** Walks design tokens (W3C `$value`, Style Dictionary `value`, or plain nested objects) and collects colours by path. */
export function colorsFromTokens(tokens: unknown): ColorSource[] {
  const out: ColorSource[] = [];
  const walk = (node: unknown, path: string[], depth: number) => {
    if (out.length >= MAX_COLORS || depth > 12) return;
    if (typeof node === 'string') { const c = parseColor(node); if (c && path.length) out.push({token: path.join('.'), value: c}); return; }
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const o = node as Record<string, unknown>;
    const leaf = o.$value ?? o.value;
    if (typeof leaf === 'string') { walk(leaf, path, depth + 1); return; }
    for (const [k, v] of Object.entries(o)) if (!k.startsWith('$')) walk(v, [...path, k], depth + 1);
  };
  walk(tokens, [], 0);
  return out;
}

const lum = (h: string) => contrastRatio(h, '#000000');
const saturation = (h: string) => { const [r, g, b] = toRgb(h); const max = Math.max(r, g, b), min = Math.min(r, g, b); return max === 0 ? 0 : (max - min) / max; };
const ROLE_PATTERNS: Record<ColorToken, RegExp> = {
  background: /(^|[-_.])(bg|background|surface|paper|canvas|page|body-bg|base-100)([-_.]|$)/i,
  foreground: /(^|[-_.])(text|foreground|fg|ink|on-surface|on-background|body|content|copy|base-content)([-_.]|$)/i,
  accent: /(^|[-_.])(primary|accent|brand|action|link|cta|highlight)([-_.]|$)/i,
};
/** Prefers named roles; otherwise infers from the colours themselves (lightest, darkest, most saturated). */
function mapRoles(colors: ColorSource[]): Record<ColorToken, ColorSource & {reason: string}> | null {
  if (colors.length < 2) return null;
  const named = (role: ColorToken, avoid: string[]) => colors.find(c => ROLE_PATTERNS[role].test(c.token.replace(/^--/, '')) && !/(hover|active|muted|subtle|disabled|inverse|dark|light|\d{3,})/i.test(c.token) && !avoid.includes(c.value))
    ?? colors.find(c => ROLE_PATTERNS[role].test(c.token.replace(/^--/, '')) && !avoid.includes(c.value));
  const bgNamed = named('background', []);
  const background = bgNamed ? {...bgNamed, reason: 'named as a background or surface'} : {...[...colors].sort((a, b) => lum(b.value) - lum(a.value))[0], reason: 'lightest colour found'};
  const fgNamed = named('foreground', [background.value]);
  const foreground = fgNamed && contrastRatio(fgNamed.value, background.value) >= 3 ? {...fgNamed, reason: 'named as text or foreground'}
    : {...[...colors].sort((a, b) => contrastRatio(b.value, background.value) - contrastRatio(a.value, background.value))[0], reason: 'highest contrast with the background'};
  const acNamed = named('accent', [background.value, foreground.value]);
  const rest = colors.filter(c => c.value !== background.value && c.value !== foreground.value);
  const accent = acNamed ? {...acNamed, reason: 'named as primary, brand, or accent'}
    : rest.length ? {...[...rest].sort((a, b) => saturation(b.value) - saturation(a.value))[0], reason: 'most saturated remaining colour'} : {...foreground, reason: 'no separate accent found; using the text colour'};
  return {background, foreground, accent};
}

const mix = (a: string, b: string, t: number) => { const x = toRgb(a), y = toRgb(b); return hex(x.map((c, i) => c + (y[i] - c) * t) as RGB); };
/** Moves an accent towards the text colour until it reads as text on the background (4.5:1), and reports it. */
function readable(accent: string, background: string, foreground: string, label: string, notes: string[]): string {
  let out = accent;
  for (let t = 0.1; contrastRatio(out, background) < 4.5 && t <= 1; t += 0.1) out = mix(accent, foreground, t);
  if (out !== accent) notes.push(`${label} accent ${accent} was adjusted to ${out} for readable contrast on ${background}.`);
  return out;
}

/** Proposes a brand from colours. Foreground is locked; palettes are gentle tints of the brand's own colours. */
export function proposeBrand(colors: ColorSource[]): BrandImportResult {
  const roles = mapRoles(colors);
  if (!roles) return {ok: false, errors: [{path: '$', code: 'COLORS', message: 'Found fewer than two colours. Point to a file with CSS custom properties (--name: #hex) or colour design tokens.'}]};
  const notes: string[] = [];
  const {background: bg, foreground: fg, accent: ac} = roles;
  if (contrastRatio(fg.value, bg.value) < 4.5) notes.push(`Text ${fg.value} on ${bg.value} is below 4.5:1. Check the mapping before using it.`);
  const accent = readable(ac.value, bg.value, fg.value, 'Base', notes);
  const palette = (tint: number, label: string, deepen = 0): Palette => {
    const background = mix(bg.value, accent, tint);
    return {background, foreground: fg.value, accent: readable(deepen ? mix(accent, fg.value, deepen) : accent, background, fg.value, label, notes)};
  };
  const brand: Brand = {
    base: {background: bg.value, foreground: fg.value, accent},
    palettes: {seasonal: palette(0.1, 'Seasonal', 0.12), promotion: palette(0.16, 'Promotion'), launch: palette(0.05, 'Launch')},
    allowedAreas: ['banner', 'hero'], lockedTokens: ['foreground'],
    allowedSlots: ['banner', 'hero', 'accent', 'overlay'], effects: 'off', signatureColors: 'deny',
  };
  const checked = validateBrand(brand);
  if (!checked.ok) return {ok: false, errors: checked.errors};
  notes.push('Effects and pack signature colours are off. Turn them on in brand.json ("effects": "on", "signatureColors": "allow") if you want them.');
  return {ok: true, draft: true, brand: checked.value, mapping: roles, notes, colorsFound: colors.length};
}

/** Reads CSS text or a design-tokens JSON string and proposes a brand. */
export function importBrand(text: unknown): BrandImportResult {
  if (typeof text !== 'string' || !text.trim()) return {ok: false, errors: [{path: '$', code: 'INPUT', message: 'Provide CSS or design-tokens JSON text.'}]};
  if (text.length > MAX_INPUT) return {ok: false, errors: [{path: '$', code: 'INPUT_SIZE', message: 'Input exceeds 64 KiB. Point to the file that defines your colour variables.'}]};
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try { return proposeBrand(colorsFromTokens(JSON.parse(trimmed))); }
    catch { return {ok: false, errors: [{path: '$', code: 'JSON_SYNTAX', message: 'Input looks like JSON but does not parse.'}]}; }
  }
  return proposeBrand(colorsFromCss(trimmed));
}
