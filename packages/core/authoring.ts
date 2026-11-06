/**
 * Authoring only: compiles an owner's event into a draft schema v1 experience.
 * Kept out of the main entry so the runtime engine and React adapter stay dependency-free.
 * Output still needs preview, review, and approval through the existing snapshot mechanism.
 */
import {Temporal} from 'temporal-polyfill';
import {createPreset, validateBrand, type Preset} from './brand.js';
import {validateExperience, type Diagnostic, type Experience} from './index.js';

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
}
export interface Schedule { eventName: string; timeZone: string; startDate: string; lastDate: string; startsAt: string; endsAt: string }
export type AuthoringResult = {ok: true; draft: true; approved: false; experience: Experience; schedule: Schedule} | {ok: false; errors: Diagnostic[]};

export const END_SEMANTICS = 'Runs from the start of the first day through the end of the last day, in the selected time zone.';
export const SAMPLE_NOTICE = 'Illustrative samples for trying the flow, not a holiday database. Dates are not authoritative for any market, and no time zone is implied.';
export const sampleEvents = [
  {key: 'winter-season', name: 'Winter season', preset: 'seasonal', startDate: '2026-12-01', lastDate: '2026-12-31', message: 'A little warmth for the winter season.'},
  {key: 'featured-finds', name: 'Featured finds week', preset: 'promotion', startDate: '2026-12-07', lastDate: '2026-12-13', message: 'A week of thoughtful finds. Explore our featured collection.'},
  {key: 'studio-launch', name: 'Studio collection launch', preset: 'launch', startDate: '2027-02-01', lastDate: '2027-02-14', message: 'Introducing the studio collection. Made for everyday rituals.'},
] as const;

const FIELDS = ['name', 'timeZone', 'startDate', 'lastDate', 'preset', 'message', 'areas', 'priority'];
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

export function authorExperience(input: unknown, brand: unknown): AuthoringResult {
  const errors: Diagnostic[] = [];
  const error = (path: string, code: string, message: string) => errors.push({path, code, message});
  const policy = validateBrand(brand);
  if (!policy.ok) return {ok: false, errors: policy.errors.map(e => ({...e, path: `brand.${e.path}`}))};
  if (!plain(input)) return {ok: false, errors: [{path: '$', code: 'OBJECT_REQUIRED', message: 'Expected a plain JSON object describing the event.'}]};

  for (const k of Object.keys(input)) if (!FIELDS.includes(k)) error(k, 'UNKNOWN_FIELD', 'Unsupported field. Local times, recurrence, HTML, and URLs are not accepted.');
  const {name, timeZone, startDate, lastDate, preset, message, areas, priority = 10} = input;
  if (typeof name !== 'string' || !name.trim() || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) error('name', 'EVENT_NAME', 'Use 1–80 characters of plain text.');
  const zone = resolveZone(timeZone);
  if (!zone) error('timeZone', 'TIME_ZONE', 'Choose an IANA time zone such as America/New_York, or UTC. Offsets like +05:30 and abbreviations like EST are not accepted.');
  const start = resolveDate(startDate), last = resolveDate(lastDate);
  if (!start) error('startDate', 'DATE', 'Use a real calendar date: YYYY-MM-DD.');
  if (!last) error('lastDate', 'DATE', 'Use a real calendar date: YYYY-MM-DD.');
  if (start && last && Temporal.PlainDate.compare(last, start) < 0) error('lastDate', 'DATE_RANGE', 'The last day is included in the event and must be on or after the first day.');
  if (typeof preset !== 'string' || !PRESETS.includes(preset)) error('preset', 'PRESET', 'Choose seasonal, promotion, or launch.');
  if (Array.isArray(areas)) for (const a of areas) if ((a === 'banner' || a === 'hero') && !policy.value.allowedAreas.includes(a)) error('areas', 'BRAND_AREA', `Brand policy does not permit the ${a} area.`);
  if (errors.length) return {ok: false, errors};

  // Without a time, Temporal resolves each date to the first instant of that day, including where midnight is skipped or repeated by a DST change.
  const startsAt = utc(start!.toZonedDateTime(zone!));
  const endsAt = utc(last!.add({days: 1}).toZonedDateTime(zone!));
  const id = eventId(name as string, start!, zone!);
  const settings = {id, startsAt, endsAt, priority: priority as number, areas: areas as Experience['areas']};
  const checked = validateExperience({...settings, schemaVersion: 1, theme: {...policy.value.palettes[preset as Preset], message}});
  if (!checked.ok) return {ok: false, errors: checked.errors.map(e => ({...e, path: e.path === 'theme.message' ? 'message' : e.path}))};
  return {
    ok: true, draft: true, approved: false,
    experience: createPreset(preset as Preset, policy.value, {...settings, message: message as string}),
    schedule: {eventName: name as string, timeZone: zone!, startDate: startDate as string, lastDate: lastDate as string, startsAt, endsAt},
  };
}
