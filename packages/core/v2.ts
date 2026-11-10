/**
 * Schema v2: theme packs and slots. Still data only: ids and enumerations validated against compiled packs.
 * v1 experiences, approvals, and selectExperience are unchanged.
 */
import {instant, validateExperience, type Diagnostic, type Experience} from './index.js';
import {validateBrand, paletteAllowed, type Brand, type Slot} from './brand.js';
import type {CompiledPack} from './pack.js';

export type {Slot};
export const SLOTS: readonly Slot[] = ['banner', 'hero', 'accent', 'overlay'];
export interface BannerSlot { message: string; icon?: string }
export interface HeroSlot { message?: string; illustration?: string; placement?: 'start' | 'end' | 'background' }
export interface AccentSlot { decoration: string; corner: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' }
export type OverlaySlot =
  | { effect: 'flyby'; asset: string; direction: 'ltr' | 'rtl'; durationMs: number }
  | { effect: 'particles'; particle: string; density: 'light' | 'medium'; durationMs: number };
export interface ExperienceV2 {
  schemaVersion: 2;
  id: string;
  startsAt: string;
  endsAt: string;
  priority: number;
  pack: { id: string; version: string; hash: string };
  palette: { background: string; foreground: string; accent: string };
  signatureColors: string[];
  slots: { banner?: BannerSlot; hero?: HeroSlot; accent?: AccentSlot; overlay?: OverlaySlot };
}
export type ValidationV2 = { ok: true; value: ExperienceV2 } | { ok: false; errors: Diagnostic[] };
export interface Bundle { bundleVersion: 1; experiences: (Experience | ExperienceV2)[] }
export type BundleValidation = { ok: true; value: Bundle } | { ok: false; errors: Diagnostic[] };

const plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const hex = /^#[\da-f]{6}$/i;
const assetId = /^[a-z][a-z0-9-]{0,31}$/;
const text = (v: unknown) => typeof v === 'string' && v.length >= 1 && v.length <= 240 && !/[\u0000-\u001f\u007f]/.test(v);
const TEXT = 'Use 1–240 characters of plain text without control characters.';
const PLACEMENTS = ['start', 'end', 'background'];
const CORNERS = ['top-start', 'top-end', 'bottom-start', 'bottom-end'];

export function validateExperienceV2(input: unknown): ValidationV2 {
  const errors: Diagnostic[] = [];
  const error = (path: string, code: string, message: string) => errors.push({path, code, message});
  const keys = (o: Record<string, unknown>, allowed: string[], prefix: string) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) error(`${prefix}${k}`, 'UNKNOWN_FIELD', 'Unsupported field; markup, styles, URLs, and code are not allowed.');
  };
  const id = (v: unknown, path: string) => { if (typeof v !== 'string' || !assetId.test(v)) error(path, 'ASSET_ID', 'Use a pack asset id: 1–32 lowercase letters, digits, and hyphens.'); };
  const oneOf = (v: unknown, options: string[], path: string) => { if (typeof v !== 'string' || !options.includes(v)) error(path, 'ENUM', `Use one of: ${options.join(', ')}.`); };
  const range = (v: unknown, min: number, max: number, path: string) => { if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) error(path, 'RANGE', `Use an integer from ${min} to ${max}.`); };

  if (!plain(input)) return {ok: false, errors: [{path: '$', code: 'OBJECT_REQUIRED', message: 'Expected a plain JSON object.'}]};
  keys(input, ['schemaVersion', 'id', 'startsAt', 'endsAt', 'priority', 'pack', 'palette', 'signatureColors', 'slots'], '');
  if (input.schemaVersion !== 2) error('schemaVersion', 'VERSION', 'Use schemaVersion 2.');
  if (typeof input.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(input.id)) error('id', 'ID', 'Use 1–64 lowercase letters, digits, and hyphens, starting with a letter.');
  const start = instant(input.startsAt), end = instant(input.endsAt);
  if (!Number.isFinite(start)) error('startsAt', 'DATE', 'Use a real UTC instant: YYYY-MM-DDTHH:mm:ss.sssZ.');
  if (!Number.isFinite(end)) error('endsAt', 'DATE', 'Use a real UTC instant: YYYY-MM-DDTHH:mm:ss.sssZ.');
  if (start >= end) error('endsAt', 'ORDER', 'End must be after start; end is exclusive.');
  range(input.priority, 0, 100, 'priority');

  const pack = input.pack;
  if (!plain(pack)) error('pack', 'OBJECT_REQUIRED', 'Reference a pack by id, version, and hash.');
  else {
    keys(pack, ['id', 'version', 'hash'], 'pack.');
    id(pack.id, 'pack.id');
    if (typeof pack.version !== 'string' || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(pack.version)) error('pack.version', 'VERSION', 'Use the pack version, such as 1.0.0.');
    if (typeof pack.hash !== 'string' || !/^sha256-[0-9a-f]{64}$/.test(pack.hash)) error('pack.hash', 'HASH', 'Use the pack hash from seed pack ID.');
  }
  const palette = input.palette;
  if (!plain(palette)) error('palette', 'OBJECT_REQUIRED', 'Provide background, foreground, and accent colors.');
  else {
    keys(palette, ['background', 'foreground', 'accent'], 'palette.');
    for (const k of ['background', 'foreground', 'accent']) if (typeof palette[k] !== 'string' || !hex.test(palette[k] as string)) error(`palette.${k}`, 'COLOR', 'Use a six-digit hex color.');
  }
  const sig = input.signatureColors;
  if (!Array.isArray(sig) || sig.length > 8 || sig.some(s => typeof s !== 'string' || !assetId.test(s)) || new Set(sig).size !== sig.length) error('signatureColors', 'SIGNATURE_COLORS', 'List up to 8 unique pack signature colour names, or [].');

  const slots = input.slots;
  if (!plain(slots)) error('slots', 'OBJECT_REQUIRED', 'Provide at least one slot.');
  else {
    keys(slots, [...SLOTS], 'slots.');
    if (!SLOTS.some(s => Object.hasOwn(slots, s))) error('slots', 'SLOTS', 'Provide at least one of banner, hero, accent, or overlay.');
    const b = slots.banner, h = slots.hero, a = slots.accent, o = slots.overlay;
    if (Object.hasOwn(slots, 'banner')) {
      if (!plain(b)) error('slots.banner', 'OBJECT_REQUIRED', 'Provide a banner message.');
      else { keys(b, ['message', 'icon'], 'slots.banner.'); if (!text(b.message)) error('slots.banner.message', 'TEXT', TEXT); if (Object.hasOwn(b, 'icon')) id(b.icon, 'slots.banner.icon'); }
    }
    if (Object.hasOwn(slots, 'hero')) {
      if (!plain(h)) error('slots.hero', 'OBJECT_REQUIRED', 'Provide a hero message and/or illustration.');
      else {
        keys(h, ['message', 'illustration', 'placement'], 'slots.hero.');
        if (!Object.hasOwn(h, 'message') && !Object.hasOwn(h, 'illustration')) error('slots.hero', 'SLOT_EMPTY', 'Provide a message, an illustration, or both.');
        if (Object.hasOwn(h, 'message') && !text(h.message)) error('slots.hero.message', 'TEXT', TEXT);
        if (Object.hasOwn(h, 'illustration')) id(h.illustration, 'slots.hero.illustration');
        if (Object.hasOwn(h, 'placement')) oneOf(h.placement, PLACEMENTS, 'slots.hero.placement');
      }
    }
    if (Object.hasOwn(slots, 'accent')) {
      if (!plain(a)) error('slots.accent', 'OBJECT_REQUIRED', 'Provide a decoration and corner.');
      else { keys(a, ['decoration', 'corner'], 'slots.accent.'); id(a.decoration, 'slots.accent.decoration'); oneOf(a.corner, CORNERS, 'slots.accent.corner'); }
    }
    if (Object.hasOwn(slots, 'overlay')) {
      if (!plain(o)) error('slots.overlay', 'OBJECT_REQUIRED', 'Choose one effect.');
      else if (o.effect === 'flyby') {
        keys(o, ['effect', 'asset', 'direction', 'durationMs'], 'slots.overlay.');
        id(o.asset, 'slots.overlay.asset'); oneOf(o.direction, ['ltr', 'rtl'], 'slots.overlay.direction'); range(o.durationMs, 2000, 6000, 'slots.overlay.durationMs');
      } else if (o.effect === 'particles') {
        keys(o, ['effect', 'particle', 'density', 'durationMs'], 'slots.overlay.');
        id(o.particle, 'slots.overlay.particle'); oneOf(o.density, ['light', 'medium'], 'slots.overlay.density'); range(o.durationMs, 3000, 8000, 'slots.overlay.durationMs');
      } else error('slots.overlay.effect', 'ENUM', 'Use one of: flyby, particles.');
    }
  }
  if (errors.length) return {ok: false, errors};

  // Rebuild in a fixed key order so snapshots are canonical, and never reuse untrusted objects.
  const p = pack as Record<string, string>, c = palette as Record<string, string>, s = slots as Record<string, Record<string, unknown>>;
  const out: ExperienceV2 = {
    schemaVersion: 2, id: input.id as string, startsAt: input.startsAt as string, endsAt: input.endsAt as string, priority: input.priority as number,
    pack: {id: p.id, version: p.version, hash: p.hash},
    palette: {background: c.background, foreground: c.foreground, accent: c.accent},
    signatureColors: [...sig as string[]],
    slots: {},
  };
  if (s.banner) out.slots.banner = {message: s.banner.message as string, ...(s.banner.icon !== undefined ? {icon: s.banner.icon as string} : {})};
  if (s.hero) out.slots.hero = {
    ...(s.hero.message !== undefined ? {message: s.hero.message as string} : {}),
    ...(s.hero.illustration !== undefined ? {illustration: s.hero.illustration as string} : {}),
    ...(s.hero.placement !== undefined ? {placement: s.hero.placement as HeroSlot['placement']} : {}),
  };
  if (s.accent) out.slots.accent = {decoration: s.accent.decoration as string, corner: s.accent.corner as AccentSlot['corner']};
  if (s.overlay) out.slots.overlay = s.overlay.effect === 'flyby'
    ? {effect: 'flyby', asset: s.overlay.asset as string, direction: s.overlay.direction as 'ltr' | 'rtl', durationMs: s.overlay.durationMs as number}
    : {effect: 'particles', particle: s.overlay.particle as string, density: s.overlay.density as 'light' | 'medium', durationMs: s.overlay.durationMs as number};
  return {ok: true, value: out};
}

/** Validates either schema version. */
export function validateAnyExperience(input: unknown): {ok: true; value: Experience | ExperienceV2} | {ok: false; errors: Diagnostic[]} {
  return plain(input) && input.schemaVersion === 2 ? validateExperienceV2(input) : validateExperience(input);
}

/** A bundle is what authoring produces and a host commits. It never carries approvals, so it cannot approve itself. */
export function validateBundle(input: unknown): BundleValidation {
  if (!plain(input)) return {ok: false, errors: [{path: '$', code: 'OBJECT_REQUIRED', message: 'Expected a plain JSON object.'}]};
  const errors: Diagnostic[] = [];
  for (const k of Object.keys(input)) if (k !== 'bundleVersion' && k !== 'experiences') errors.push({path: k, code: 'UNKNOWN_FIELD', message: 'Unsupported field. Bundles never carry approvals or signatures; approvals stay in trusted host configuration.'});
  if (input.bundleVersion !== 1) errors.push({path: 'bundleVersion', code: 'VERSION', message: 'Use bundleVersion 1.'});
  const list = input.experiences;
  if (!Array.isArray(list) || list.length > 100) return {ok: false, errors: [...errors, {path: 'experiences', code: 'LIMIT', message: 'Provide an array of at most 100 experiences.'}]};
  const value: Bundle['experiences'] = [], ids = new Set<string>();
  list.forEach((e, i) => {
    const r = validateAnyExperience(e);
    if (!r.ok) { errors.push(...r.errors.map(x => ({...x, path: `experiences[${i}].${x.path}`}))); return; }
    if (ids.has(r.value.id)) errors.push({path: `experiences[${i}].id`, code: 'DUPLICATE', message: 'Experience IDs must be unique.'});
    ids.add(r.value.id); value.push(r.value);
  });
  return errors.length ? {ok: false, errors} : {ok: true, value: {bundleVersion: 1, experiences: value}};
}

/** Finds the exact installed pack and checks every referenced asset. A mismatch fails closed. */
export function resolvePack(e: ExperienceV2, packs: readonly CompiledPack[]): {ok: true; pack: CompiledPack} | {ok: false; errors: Diagnostic[]} {
  const pack = packs.find(p => p.id === e.pack.id && p.version === e.pack.version && p.hash === e.pack.hash);
  if (!pack) return {ok: false, errors: [{path: 'pack', code: 'PACK_MISMATCH', message: `Pack ${e.pack.id}@${e.pack.version} with this hash is not installed. Changed artwork requires a new review and approval.`}]};
  const errors: Diagnostic[] = [];
  const need = (record: Record<string, unknown>, value: string | undefined, path: string) => { if (value !== undefined && !Object.hasOwn(record, value)) errors.push({path, code: 'ASSET_MISSING', message: `Pack ${pack.id} has no asset ${value} of this kind.`}); };
  need(pack.icons, e.slots.banner?.icon, 'slots.banner.icon');
  need(pack.illustrations, e.slots.hero?.illustration, 'slots.hero.illustration');
  need(pack.decorations, e.slots.accent?.decoration, 'slots.accent.decoration');
  const o = e.slots.overlay;
  if (o?.effect === 'flyby' && !pack.effects.flyby?.assets.includes(o.asset)) errors.push({path: 'slots.overlay.asset', code: 'ASSET_MISSING', message: `Pack ${pack.id} offers no flyby with ${o.asset}.`});
  if (o?.effect === 'particles' && !pack.effects.particles?.assets.includes(o.particle)) errors.push({path: 'slots.overlay.particle', code: 'ASSET_MISSING', message: `Pack ${pack.id} offers no particles with ${o.particle}.`});
  for (const name of e.signatureColors) if (!Object.hasOwn(pack.signatureColors, name)) errors.push({path: 'signatureColors', code: 'ASSET_MISSING', message: `Pack ${pack.id} has no signature colour ${name}.`});
  return errors.length ? {ok: false, errors} : {ok: true, pack};
}

/** Brand policy is a veto, never a mutation. Effects and signature colours are off unless the integrator opted in. */
export function brandAllowsV2(e: ExperienceV2, brand: unknown): boolean {
  const r = validateBrand(brand);
  if (!r.ok) return false;
  const b: Brand = r.value;
  const allowed: readonly Slot[] = b.allowedSlots ?? b.allowedAreas;
  const used = SLOTS.filter(s => e.slots[s] !== undefined);
  if (!used.every(s => allowed.includes(s))) return false;
  if (e.slots.overlay && b.effects !== 'on') return false;
  if (e.signatureColors.length && b.signatureColors !== 'allow') return false;
  return paletteAllowed(e.palette, b);
}

export interface PageSelection { experience: ExperienceV2 | null; pack: CompiledPack | null; errors: Diagnostic[] }
/**
 * One coherent winner for the whole page, so themes never mix: the highest-priority v2 experience that is
 * approved (exact snapshot), active, brand-allowed, and resolvable against an installed pack.
 * v1 entries are ignored here and keep competing per area through selectExperience.
 */
export function selectPage(inputs: readonly unknown[], trustedApprovals: readonly string[], now: number, options: {packs: readonly CompiledPack[]; /** Required for pack themes; without it they fail closed. */ brand?: unknown}): PageSelection {
  if (!Number.isFinite(now) || inputs.length > 100 || trustedApprovals.length > 100) return {experience: null, pack: null, errors: [{path: '$', code: 'LIMIT', message: 'Provide a finite clock and at most 100 experiences and approvals.'}]};
  const errors: Diagnostic[] = [], ids = new Set<string>();
  const candidates: {e: ExperienceV2; pack: CompiledPack}[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const raw = inputs[i];
    const r = validateAnyExperience(raw);
    if (!r.ok) { errors.push(...r.errors.map(x => ({...x, path: `[${i}].${x.path}`}))); continue; }
    const e = r.value;
    if (ids.has(e.id)) return {experience: null, pack: null, errors: [{path: 'id', code: 'DUPLICATE', message: 'Experience IDs must be unique.'}]};
    ids.add(e.id);
    if (e.schemaVersion !== 2) continue;
    if (!trustedApprovals.includes(JSON.stringify(e)) || !(instant(e.startsAt) <= now && now < instant(e.endsAt))) continue;
    const resolved = resolvePack(e, options.packs);
    if (!resolved.ok) { errors.push(...resolved.errors.map(x => ({...x, path: `[${i}].${x.path}`}))); continue; }
    // Effects, slots, and signature colours are opt-ins in brand.json, so a pack theme never renders without it.
    if (options.brand === undefined) { errors.push({path: `[${i}]`, code: 'BRAND_REQUIRED', message: 'Pack themes need the site brand policy (brand.json); the base site is shown.'}); continue; }
    if (!brandAllowsV2(e, options.brand)) { errors.push({path: `[${i}]`, code: 'BRAND_VETO', message: 'Brand policy does not permit this experience; the base site is shown.'}); continue; }
    candidates.push({e, pack: resolved.pack});
  }
  // Malformed configuration fails closed for the whole page, as in v1.
  if (errors.some(x => !['PACK_MISMATCH', 'ASSET_MISSING', 'BRAND_VETO', 'BRAND_REQUIRED'].includes(x.code))) return {experience: null, pack: null, errors};
  candidates.sort((a, b) => b.e.priority - a.e.priority || (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0));
  const win = candidates[0];
  return {experience: win?.e ?? null, pack: win?.pack ?? null, errors};
}
