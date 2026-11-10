/**
 * Authoring only: compiles an owner's event into a draft schema v1 experience.
 * Kept out of the main entry so the runtime engine and React adapter stay dependency-free.
 * Output still needs preview, review, and approval through the existing snapshot mechanism.
 */
import {Temporal} from 'temporal-polyfill';
import {createPreset, effectivePalette, validateBrand, type Brand, type Preset, type Slot} from './brand.js';
import {validateExperience, type Diagnostic, type Experience} from './index.js';
import {validateExperienceV2, brandAllowsV2, resolvePack, type ExperienceV2} from './v2.js';
import type {CompiledPack} from './pack.js';
import {packs as installedPacks} from '../packs/index.js';
import {upcomingOccasions, defaultPack, OCCASIONS_NOTICE, OCCASIONS} from './occasions.js';
const OCCASION_IDS = new Set(OCCASIONS.map(o => o.id));

export interface EventInput {
  name: string;
  /** IANA name chosen by the owner, such as America/New_York. Never inferred from a host or visitor. */
  timeZone: string;
  /** YYYY-MM-DD. The experience begins at the start of this day in timeZone. */
  startDate: string;
  /** YYYY-MM-DD. This day is included; the experience ends when the following day begins in timeZone. */
  lastDate: string;
  preset: Preset;
  message: string;
  areas: Experience['areas'];
  priority?: number;
  /** Theme pack id. With a pack the draft is schema v2 (artwork, decorations, effect); without one it stays v1 colours only. */
  pack?: string;
  /** Pack asset ids, or "none". Omitted fields get a sensible default from the pack and brand policy. */
  illustration?: string;
  icon?: string;
  decoration?: string;
  /** "flyby", "particles", or "none". Default: the pack's effect when the brand has effects on. */
  effect?: string;
  /** Use the pack's signature colours (such as Santa's red). Default: true when the brand allows them. */
  signatureColors?: boolean;
}
export interface Schedule { eventName: string; timeZone: string; startDate: string; lastDate: string; startsAt: string; endsAt: string }
export type AuthoringResult = {ok: true; draft: true; approved: false; experience: Experience | ExperienceV2; schedule: Schedule} | {ok: false; errors: Diagnostic[]};

export const END_SEMANTICS = 'Runs from the start of the first day through the end of the last day, in the selected time zone.';
export const SAMPLE_NOTICE = 'Illustrative samples for trying the flow, not a holiday database. Dates are not authoritative for any market, and no time zone is implied.';
export const sampleEvents = [
  {key: 'winter-season', name: 'Winter season', preset: 'seasonal', startDate: '2026-12-01', lastDate: '2026-12-31', message: 'A little warmth for the winter season.'},
  {key: 'featured-finds', name: 'Featured finds week', preset: 'promotion', startDate: '2026-12-07', lastDate: '2026-12-13', message: 'A week of thoughtful finds. Explore our featured collection.'},
  {key: 'studio-launch', name: 'Studio collection launch', preset: 'launch', startDate: '2027-02-01', lastDate: '2027-02-14', message: 'Introducing the studio collection. Made for everyday rituals.'},
  {key: 'black-friday', name: 'Black Friday week', preset: 'promotion', pack: 'black-friday', startDate: '2026-11-27', lastDate: '2026-11-30', message: 'Our biggest week of the year is here.'},
  {key: 'christmas', name: 'Christmas', preset: 'seasonal', pack: 'christmas', startDate: '2026-12-01', lastDate: '2026-12-25', message: 'Wishing you a warm and joyful holiday season.'},
] as const;

const FIELDS = ['name', 'timeZone', 'startDate', 'lastDate', 'preset', 'message', 'areas', 'priority', 'pack', 'illustration', 'icon', 'decoration', 'effect', 'signatureColors'];
const PACK_FIELDS = ['illustration', 'icon', 'decoration', 'effect', 'signatureColors'];
const PRESETS = ['seasonal', 'promotion', 'launch'];
const plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const utc = (z: Temporal.ZonedDateTime) => new Date(z.epochMilliseconds).toISOString();
const slug = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Offsets and bare abbreviations are rejected: the owner must pick a named zone that follows its DST rules. */
function resolveZone(value: unknown): string | null {
  if (typeof value !== 'string' || !/^(UTC|[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+)$/.test(value)) return null;
  try { return Temporal.PlainDate.from('2000-01-01').toZonedDateTime(value).timeZoneId; } catch { return null; }
}
function resolveDate(value: unknown): Temporal.PlainDate | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try { return Temporal.PlainDate.from(value, {overflow: 'reject'}); } catch { return null; }
}
/** Readable and deterministic. The zone is part of the id so a zone edit always changes the snapshot, even between zones that share the same instants. */
function eventId(name: string, start: Temporal.PlainDate, zone: string): string {
  const suffix = `${start.toString().replaceAll('-', '')}-${slug(zone)}`;
  const base = slug(name);
  const prefix = /^[a-z]/.test(base) ? base : `event${base && `-${base}`}`;
  return `${prefix.slice(0, 64 - suffix.length - 1).replace(/-+$/, '')}-${suffix}`;
}

export function authorExperience(input: unknown, brand: unknown, packs: readonly CompiledPack[] = installedPacks): AuthoringResult {
  const errors: Diagnostic[] = [];
  const error = (path: string, code: string, message: string) => errors.push({path, code, message});
  const policy = validateBrand(brand);
  if (!policy.ok) return {ok: false, errors: policy.errors.map(e => ({...e, path: `brand.${e.path}`}))};
  if (!plain(input)) return {ok: false, errors: [{path: '$', code: 'OBJECT_REQUIRED', message: 'Expected a plain JSON object describing the event.'}]};

  for (const k of Object.keys(input)) if (!FIELDS.includes(k)) error(k, 'UNKNOWN_FIELD', 'Unsupported field. Local times, recurrence, HTML, and URLs are not accepted.');
  const {name, timeZone, startDate, lastDate, preset, message, areas, priority = 10} = input;
  if (typeof name !== 'string' || !name.trim() || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) error('name', 'EVENT_NAME', 'Use 1–80 characters of plain text.');
  if (!Array.isArray(areas) || areas.length < 1 || areas.length > 2 || new Set(areas).size !== areas.length || areas.some(a => a !== 'banner' && a !== 'hero'))
    error('areas', 'AREAS', 'Choose one or both unique areas: banner, hero.');
  const zone = resolveZone(timeZone);
  if (!zone) error('timeZone', 'TIME_ZONE', 'Choose an IANA time zone such as America/New_York, or UTC. Offsets like +05:30 and abbreviations like EST are not accepted.');
  const start = resolveDate(startDate), last = resolveDate(lastDate);
  if (!start) error('startDate', 'DATE', 'Use a real calendar date: YYYY-MM-DD.');
  if (!last) error('lastDate', 'DATE', 'Use a real calendar date: YYYY-MM-DD.');
  if (start && last && Temporal.PlainDate.compare(last, start) < 0) error('lastDate', 'DATE_RANGE', 'The last day is included in the event and must be on or after the first day.');
  if (typeof preset !== 'string' || !PRESETS.includes(preset)) error('preset', 'PRESET', 'Choose seasonal, promotion, or launch.');
  const packId = input.pack;
  const pack = packId === undefined ? undefined : packs.find(p => p.id === packId);
  if (packId !== undefined && !pack) error('pack', 'PACK', `Choose an installed pack: ${packs.map(p => p.id).join(', ')}.`);
  if (packId === undefined) for (const k of PACK_FIELDS) if (Object.hasOwn(input, k)) error(k, 'PACK_REQUIRED', 'Choose a theme pack before choosing artwork or effects.');
  const permitted: readonly Slot[] = pack ? policy.value.allowedSlots ?? policy.value.allowedAreas : policy.value.allowedAreas;
  if (Array.isArray(areas)) for (const a of areas) if ((a === 'banner' || a === 'hero') && !permitted.includes(a)) error('areas', 'BRAND_AREA', `Brand policy does not permit the ${a} area.`);
  if (errors.length) return {ok: false, errors};

  // Without a time, Temporal resolves each date to the first instant of that day, including where midnight is skipped or repeated by a DST change.
  const startsAt = utc(start!.toZonedDateTime(zone!));
  const endsAt = utc(last!.add({days: 1}).toZonedDateTime(zone!));
  const id = eventId(name as string, start!, zone!);
  const schedule = {eventName: name as string, timeZone: zone!, startDate: startDate as string, lastDate: lastDate as string, startsAt, endsAt};
  if (pack) return authorPackExperience(input, pack, policy.value, {id, startsAt, endsAt, priority: priority as number, preset: preset as Preset, message: message as string, areas: areas as Experience['areas']}, schedule);
  const settings = {id, startsAt, endsAt, priority: priority as number, areas: areas as Experience['areas']};
  const checked = validateExperience({...settings, schemaVersion: 1, theme: {...policy.value.palettes[preset as Preset], message}});
  if (!checked.ok) return {ok: false, errors: checked.errors.map(e => ({...e, path: e.path === 'theme.message' ? 'message' : e.path}))};
  return {
    ok: true, draft: true, approved: false,
    experience: createPreset(preset as Preset, policy.value, {...settings, message: message as string}),
    schedule: {eventName: name as string, timeZone: zone!, startDate: startDate as string, lastDate: lastDate as string, startsAt, endsAt},
  };
}

type PackSettings = {id: string; startsAt: string; endsAt: string; priority: number; preset: Preset; message: string; areas: Experience['areas']};
/** Builds a v2 draft from a pack. Defaults follow the pack and the brand's opt-ins; explicit choices that the brand forbids are errors, never silently dropped. */
function authorPackExperience(input: Record<string, unknown>, pack: CompiledPack, brand: Brand, s: PackSettings, schedule: Schedule): AuthoringResult {
  const errors: Diagnostic[] = [];
  const error = (path: string, code: string, message: string) => errors.push({path, code, message});
  const slotsAllowed: readonly Slot[] = brand.allowedSlots ?? brand.allowedAreas;
  const pick = (field: string, record: Record<string, unknown>, fallback: string | undefined, kind: string): string | undefined => {
    const v = input[field];
    if (v === undefined) return fallback;
    if (v === 'none') return undefined;
    if (typeof v !== 'string' || !Object.hasOwn(record, v)) { error(field, 'ASSET', `Pack ${pack.id} has no ${kind} ${String(v)}. Choose one of: ${Object.keys(record).join(', ')}, or none.`); return undefined; }
    return v;
  };
  const flyby = pack.effects.flyby?.assets ?? [];
  const illustration = pick('illustration', pack.illustrations, Object.keys(pack.illustrations).find(i => !flyby.includes(i)) ?? Object.keys(pack.illustrations)[0], 'illustration');
  const icon = pick('icon', pack.icons, Object.keys(pack.icons)[0], 'icon');
  const decoration = pick('decoration', pack.decorations, slotsAllowed.includes('accent') ? Object.keys(pack.decorations)[0] : undefined, 'decoration');
  if (decoration && !slotsAllowed.includes('accent')) error('decoration', 'BRAND_AREA', 'Brand policy does not permit the accent slot.');

  const available = (['flyby', 'particles'] as const).filter(e => pack.effects[e]);
  let effect = input.effect as string | undefined;
  if (effect === undefined) effect = brand.effects === 'on' && slotsAllowed.includes('overlay') ? available[0] ?? 'none' : 'none';
  else if (effect !== 'none' && !available.includes(effect as 'flyby')) { error('effect', 'EFFECT', `Pack ${pack.id} offers: ${[...available, 'none'].join(', ')}.`); effect = 'none'; }
  if (effect !== 'none' && (brand.effects !== 'on' || !slotsAllowed.includes('overlay'))) error('effect', 'BRAND_EFFECTS', 'Brand policy has effects off. The integrator turns them on in brand.json.');

  const sigInput = input.signatureColors;
  if (sigInput !== undefined && typeof sigInput !== 'boolean') error('signatureColors', 'BOOLEAN', 'Use true or false.');
  const useSig = sigInput === undefined ? brand.signatureColors === 'allow' : sigInput === true;
  if (useSig && brand.signatureColors !== 'allow') error('signatureColors', 'BRAND_SIGNATURE', 'Brand policy denies pack signature colours; they fall back to the brand accent.');
  if (errors.length) return {ok: false, errors};

  const slots: ExperienceV2['slots'] = {};
  if (s.areas.includes('banner')) slots.banner = {message: s.message, ...(icon ? {icon} : {})};
  if (s.areas.includes('hero')) slots.hero = {message: s.message, ...(illustration ? {illustration, placement: 'end' as const} : {})};
  if (decoration) slots.accent = {decoration, corner: 'top-end'};
  if (effect === 'flyby') slots.overlay = {effect: 'flyby', asset: flyby[0], direction: 'ltr', durationMs: 4500};
  if (effect === 'particles') slots.overlay = {effect: 'particles', particle: pack.effects.particles!.assets[0], density: 'light', durationMs: 4500};

  const checked = validateExperienceV2({
    schemaVersion: 2, id: s.id, startsAt: s.startsAt, endsAt: s.endsAt, priority: s.priority,
    pack: {id: pack.id, version: pack.version, hash: pack.hash},
    palette: effectivePalette(s.preset, brand),
    signatureColors: useSig ? Object.keys(pack.signatureColors) : [],
    slots,
  });
  if (!checked.ok) return {ok: false, errors: checked.errors.map(e => ({...e, path: /^slots\.(banner|hero)\.message$/.test(e.path) ? 'message' : e.path}))};
  const resolved = resolvePack(checked.value, [pack]);
  if (!resolved.ok) return {ok: false, errors: resolved.errors};
  if (!brandAllowsV2(checked.value, brand)) return {ok: false, errors: [{path: '$', code: 'BRAND_POLICY', message: 'Brand policy does not permit this design.'}]};
  return {ok: true, draft: true, approved: false, experience: checked.value, schedule};
}

export {MARKETS, OCCASIONS, OCCASIONS_NOTICE, upcomingOccasions, defaultPack} from './occasions.js';
export type {Market, Category, Occasion, OccasionInstance} from './occasions.js';

export interface PlanInput {
  markets: string[]; from: string; days?: number; timeZone: string; areas: Experience['areas'];
  /** Instance ids from upcomingOccasions that the owner ticked. Nothing is planned unless chosen. */
  occasions: string[];
  overrides?: Record<string, {message?: string; pack?: string; startDate?: string; lastDate?: string}>;
}
export type PlanResult =
  | {ok: true; draft: true; approved: false; bundle: {bundleVersion: 1; experiences: (Experience | ExperienceV2)[]}; drafts: {occasion: string; confirm: boolean; source: string; schedule: Schedule}[]; overlaps: string[][]; notice: string}
  | {ok: false; errors: Diagnostic[]};

/** Turns the occasions an owner chose into one draft bundle. Each draft goes through authorExperience and still needs approval. */
export function planExperiences(input: unknown, brand: unknown, packs: readonly CompiledPack[] = installedPacks): PlanResult {
  if (!plain(input)) return {ok: false, errors: [{path: '$', code: 'OBJECT_REQUIRED', message: 'Expected a plain JSON object describing the plan.'}]};
  const errors: Diagnostic[] = [];
  for (const k of Object.keys(input)) if (!['markets', 'from', 'days', 'timeZone', 'areas', 'occasions', 'overrides'].includes(k)) errors.push({path: k, code: 'UNKNOWN_FIELD', message: 'Unsupported field.'});
  const upcoming = upcomingOccasions({markets: input.markets, from: input.from, days: input.days});
  if (!upcoming.ok) return {ok: false, errors: [...errors, ...upcoming.errors]};
  const chosen = input.occasions, overrides = input.overrides ?? {};
  if (!Array.isArray(chosen) || !chosen.length || new Set(chosen).size !== chosen.length) errors.push({path: 'occasions', code: 'OCCASIONS', message: 'Choose one or more upcoming occasions by id. SEED never chooses them for you.'});
  if (!plain(overrides)) errors.push({path: 'overrides', code: 'OBJECT_REQUIRED', message: 'Overrides map occasion ids to message, pack, startDate, or lastDate.'});
  if (errors.length) return {ok: false, errors};
  const experiences: (Experience | ExperienceV2)[] = [], drafts: {occasion: string; confirm: boolean; source: string; schedule: Schedule}[] = [];
  for (const id of chosen as unknown[]) {
    const instance = upcoming.occasions.find(o => o.id === id);
    if (!instance) { errors.push({path: `occasions`, code: 'OCCASION', message: `${String(id)} is not upcoming in these markets and dates.`}); continue; }
    const over = (overrides as Record<string, unknown>)[instance.id] ?? {};
    if (!plain(over) || Object.keys(over).some(k => !['message', 'pack', 'startDate', 'lastDate'].includes(k))) { errors.push({path: `overrides.${instance.id}`, code: 'OVERRIDE', message: 'Override only message, pack, startDate, or lastDate.'}); continue; }
    const pack = over.pack === 'none' ? undefined : (over.pack as string | undefined) ?? defaultPack(instance, packs);
    const result = authorExperience({
      name: instance.name, timeZone: input.timeZone, startDate: over.startDate ?? instance.startDate, lastDate: over.lastDate ?? instance.lastDate,
      preset: instance.preset, message: over.message ?? instance.message, areas: input.areas, priority: instance.priority, ...(pack ? {pack} : {}),
    }, brand, packs);
    if (!result.ok) { errors.push(...result.errors.map(e => ({...e, path: `occasions.${instance.id}.${e.path}`}))); continue; }
    experiences.push(result.experience);
    drafts.push({occasion: instance.id, confirm: instance.confirm, source: instance.source, schedule: result.schedule});
  }
  if (errors.length) return {ok: false, errors};
  const overlaps: string[][] = [];
  for (let i = 0; i < drafts.length; i++) for (let j = i + 1; j < drafts.length; j++) {
    const a = drafts[i].schedule, b = drafts[j].schedule;
    if (a.startsAt < b.endsAt && b.startsAt < a.endsAt) overlaps.push([drafts[i].occasion, drafts[j].occasion]);
  }
  return {ok: true, draft: true, approved: false, bundle: {bundleVersion: 1, experiences}, drafts, overlaps, notice: `${OCCASIONS_NOTICE} Where drafts overlap, the shorter occasion has higher priority.`};
}

export {importBrand, proposeBrand, colorsFromCss, colorsFromTokens, parseColor} from './brand-import.js';
export type {BrandImportResult, BrandProposal, ColorSource} from './brand-import.js';

export type ReplanResult =
  | {ok: true; plan: PlanInput; result: Extract<PlanResult, {ok: true}> | null; carried: {from: string; to: string}[]; missing: {occasion: string; reason: string}[]; notes: string[]}
  | {ok: false; errors: Diagnostic[]};
/** The same occasion one year later: christmas-2026 -> christmas-2027. */
export function nextOccurrenceId(id: string): string | null {
  const m = /^([a-z][a-z0-9-]*)-(\d{4})$/.exec(id);
  return m ? `${m[1]}-${Number(m[2]) + 1}` : null;
}
/**
 * Builds next year's plan from this year's: the same markets, time zone, areas, and chosen occasions, one year on.
 * Message and pack choices carry over; hand-set dates do not, because the calendar moved. Occasions whose next
 * date is not published yet are reported, never guessed. Every new draft needs a new approval.
 */
export function replanNextYear(previous: unknown, brand: unknown, packs: readonly CompiledPack[] = installedPacks): ReplanResult {
  if (!plain(previous)) return {ok: false, errors: [{path: '$', code: 'OBJECT_REQUIRED', message: 'Provide last year\'s plan: {markets, from, days?, timeZone, areas, occasions, overrides?}.'}]};
  const from = typeof previous.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(previous.from) ? (() => { try { return Temporal.PlainDate.from(previous.from as string, {overflow: 'reject'}); } catch { return null; } })() : null;
  if (!from) return {ok: false, errors: [{path: 'from', code: 'DATE', message: 'Use a real calendar date: YYYY-MM-DD.'}]};
  if (!Array.isArray(previous.occasions) || !previous.occasions.length) return {ok: false, errors: [{path: 'occasions', code: 'OCCASIONS', message: 'Last year\'s plan has no chosen occasions.'}]};
  // Occasions move between years (Diwali 2026-11-08, 2027-10-29), so search around next year's dates rather than
  // shifting the window exactly, then fit the new window to the occasions found.
  const days = typeof previous.days === 'number' ? previous.days : 120;
  const searchFrom = from.add({years: 1}).subtract({days: 60});
  const upcoming = upcomingOccasions({markets: previous.markets, from: searchFrom.toString(), days: Math.min(400, days + 120)});
  if (!upcoming.ok) return {ok: false, errors: upcoming.errors};
  const carried: {from: string; to: string}[] = [], missing: {occasion: string; reason: string}[] = [], notes: string[] = [];
  const oldOverrides = plain(previous.overrides) ? previous.overrides : {};
  const overrides: Record<string, {message?: string; pack?: string}> = {};
  for (const id of previous.occasions) {
    const next = typeof id === 'string' ? nextOccurrenceId(id) : null;
    if (!next) { missing.push({occasion: String(id), reason: 'Not an occasion id.'}); continue; }
    if (!upcoming.occasions.some(o => o.id === next)) {
      const known = OCCASION_IDS.has(next.replace(/-\d{4}$/, ''));
      missing.push({occasion: next, reason: known ? 'Its date for next year is not published in SEED yet. Add it when the date is announced.' : 'Unknown occasion.'});
      continue;
    }
    carried.push({from: id as string, to: next});
    const o = (oldOverrides as Record<string, unknown>)[id as string];
    if (plain(o)) {
      const keep: {message?: string; pack?: string} = {};
      if (typeof o.message === 'string') keep.message = o.message;
      if (typeof o.pack === 'string') keep.pack = o.pack;
      if (Object.keys(keep).length) overrides[next] = keep;
      if (o.startDate !== undefined || o.lastDate !== undefined) notes.push(`${next}: last year's hand-set dates were not carried over; the default window for next year is used. Adjust if needed.`);
    }
  }
  const found = upcoming.occasions.filter(o => carried.some(c => c.to === o.id));
  const start = found.length ? found.map(o => o.startDate).sort()[0] : from.add({years: 1}).toString();
  const end = found.length ? found.map(o => o.lastDate).sort().at(-1)! : start;
  const span = Temporal.PlainDate.from(start).until(Temporal.PlainDate.from(end)).days + 1;
  const plan: PlanInput = {
    markets: previous.markets as string[], from: start, days: Math.max(1, Math.min(400, span)),
    timeZone: previous.timeZone as string, areas: previous.areas as Experience['areas'], occasions: carried.map(c => c.to),
    ...(Object.keys(overrides).length ? {overrides} : {}),
  };
  notes.push('These are new drafts. Last year\'s approvals do not apply to them; review and approve each one again.');
  if (!carried.length) return {ok: true, plan, result: null, carried, missing, notes};
  const result = planExperiences(plan, brand, packs);
  if (!result.ok) return {ok: false, errors: result.errors};
  return {ok: true, plan, result, carried, missing, notes};
}
