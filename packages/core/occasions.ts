/**
 * Occasion catalogue and planner (authoring only). Lists what is coming up in the owner's chosen markets and
 * turns the occasions the owner ticks into drafts. SEED never selects occasions on its own: religious, national,
 * and cultural days are opt-in like everything else, and every draft still needs review and approval.
 */
import {Temporal} from 'temporal-polyfill';
import type {Diagnostic} from './index.js';
import type {CompiledPack} from './pack.js';
import type {Preset} from './brand.js';

export type Market = 'US' | 'IN' | 'AE' | 'SG';
/** Markets are the owner's audiences, never inferred from where the site is hosted. */
export const MARKETS: Record<Market, string> = {US: 'United States', IN: 'India', AE: 'United Arab Emirates', SG: 'Singapore'};
export type Category = 'commercial' | 'secular' | 'national' | 'cultural' | 'religious';
type Rule =
  | {type: 'fixed'; month: number; day: number}
  | {type: 'nth-weekday'; month: number; weekday: number; n: number}
  | {type: 'after'; occasion: string; days: number}
  | {type: 'table'; dates: Record<number, string>};
export interface Occasion {
  id: string; name: string; category: Category; markets: Market[]; rule: Rule;
  /** The theme starts this many days before the occasion. */
  leadDays: number;
  /** Days the occasion itself lasts, including its date. */
  durationDays: number;
  packs: string[];
  message: string;
  source: string;
  /** Moon-sighting or almanac dates: the owner must confirm locally before approving. */
  confirm?: boolean;
}

const ALL: Market[] = ['US', 'IN', 'AE', 'SG'];
export const OCCASIONS: readonly Occasion[] = [
  {id: 'new-year', name: "New Year's Day", category: 'secular', markets: ALL, rule: {type: 'fixed', month: 1, day: 1}, leadDays: 1, durationDays: 1, packs: ['new-year'], message: 'Happy New Year from all of us.', source: 'Fixed calendar date.'},
  {id: 'republic-day-in', name: 'Republic Day (India)', category: 'national', markets: ['IN'], rule: {type: 'fixed', month: 1, day: 26}, leadDays: 0, durationDays: 1, packs: ['celebration'], message: 'Happy Republic Day.', source: 'Fixed national date (26 January).'},
  {id: 'lunar-new-year', name: 'Lunar New Year', category: 'cultural', markets: ['SG'], rule: {type: 'table', dates: {2027: '2027-02-06'}}, leadDays: 7, durationDays: 2, packs: ['lunar-new-year'], message: 'Wishing you a prosperous Lunar New Year.', source: 'Singapore Ministry of Manpower public holidays 2027 (announced 18 June 2026). Later years are added once published.', confirm: true},
  {id: 'valentines-day', name: "Valentine's Day", category: 'commercial', markets: ALL, rule: {type: 'fixed', month: 2, day: 14}, leadDays: 6, durationDays: 1, packs: ['valentines'], message: 'Something thoughtful for someone you love.', source: 'Fixed calendar date.'},
  {id: 'eid-al-fitr', name: 'Eid al-Fitr', category: 'religious', markets: ['AE', 'SG', 'IN'], rule: {type: 'table', dates: {2027: '2027-03-09'}}, leadDays: 2, durationDays: 3, packs: [], message: 'Eid Mubarak to everyone celebrating.', source: 'Expected date reported by Gulf News and Khaleej Times (2026); depends on moon sighting and can shift by a day, and may differ by country.', confirm: true},
  {id: 'mothers-day-us', name: "Mother's Day (US)", category: 'commercial', markets: ['US'], rule: {type: 'nth-weekday', month: 5, weekday: 7, n: 2}, leadDays: 7, durationDays: 1, packs: [], message: 'For the people who raised us.', source: 'Second Sunday of May (United States).'},
  {id: 'eid-al-adha', name: 'Eid al-Adha', category: 'religious', markets: ['AE', 'SG', 'IN'], rule: {type: 'table', dates: {2027: '2027-05-16'}}, leadDays: 1, durationDays: 3, packs: [], message: 'Eid Mubarak to everyone celebrating.', source: 'Expected date reported by Gulf News and ProPakistani (2026); depends on moon sighting and can shift by a day, and may differ by country.', confirm: true},
  {id: 'independence-day-us', name: 'Independence Day (US)', category: 'national', markets: ['US'], rule: {type: 'fixed', month: 7, day: 4}, leadDays: 3, durationDays: 1, packs: ['celebration'], message: 'Happy Fourth of July.', source: 'Fixed national date (4 July).'},
  {id: 'national-day-sg', name: 'National Day (Singapore)', category: 'national', markets: ['SG'], rule: {type: 'fixed', month: 8, day: 9}, leadDays: 2, durationDays: 1, packs: ['celebration'], message: 'Happy National Day, Singapore.', source: 'Fixed national date (9 August).'},
  {id: 'independence-day-in', name: 'Independence Day (India)', category: 'national', markets: ['IN'], rule: {type: 'fixed', month: 8, day: 15}, leadDays: 0, durationDays: 1, packs: ['celebration'], message: 'Happy Independence Day.', source: 'Fixed national date (15 August).'},
  {id: 'diwali', name: 'Diwali (Deepavali)', category: 'religious', markets: ['IN', 'SG', 'AE'], rule: {type: 'table', dates: {2026: '2026-11-08', 2027: '2027-10-29'}}, leadDays: 3, durationDays: 3, packs: ['diwali'], message: 'Wishing you a bright and joyful Diwali.', source: 'Lakshmi Puja dates from published panchang calendars (dekhopanchang.com, publicholidays.in), checked 2026-11-08. Regional almanacs can differ.', confirm: true},
  {id: 'halloween', name: 'Halloween', category: 'commercial', markets: ['US'], rule: {type: 'fixed', month: 10, day: 31}, leadDays: 13, durationDays: 1, packs: [], message: 'A little spooky, a lot of fun.', source: 'Fixed calendar date.'},
  {id: 'thanksgiving-us', name: 'Thanksgiving (US)', category: 'cultural', markets: ['US'], rule: {type: 'nth-weekday', month: 11, weekday: 4, n: 4}, leadDays: 6, durationDays: 1, packs: [], message: 'Grateful for you this Thanksgiving.', source: 'Fourth Thursday of November (United States federal rule).'},
  {id: 'black-friday', name: 'Black Friday to Cyber Monday', category: 'commercial', markets: ALL, rule: {type: 'after', occasion: 'thanksgiving-us', days: 1}, leadDays: 0, durationDays: 4, packs: ['black-friday'], message: "Black Friday weekend: explore this year's picks.", source: 'Friday after the fourth Thursday of November, through the following Monday.'},
  {id: 'national-day-ae', name: 'National Day (UAE, Eid Al Etihad)', category: 'national', markets: ['AE'], rule: {type: 'fixed', month: 12, day: 2}, leadDays: 0, durationDays: 2, packs: ['celebration'], message: 'Happy National Day to the UAE.', source: 'Fixed national dates (2–3 December).'},
  {id: 'christmas', name: 'Christmas', category: 'religious', markets: ALL, rule: {type: 'fixed', month: 12, day: 25}, leadDays: 24, durationDays: 1, packs: ['christmas'], message: 'Wishing you a warm and joyful holiday season.', source: 'Fixed calendar date.'},
];
export const OCCASIONS_NOTICE = 'SEED never selects occasions for you. Moon-sighting and almanac dates are estimates: confirm them for your audience before approving. Years without published dates are not listed.';

export interface OccasionInstance {
  id: string; occasion: string; name: string; category: Category; markets: Market[];
  date: string; startDate: string; lastDate: string;
  packs: string[]; preset: Preset; message: string; priority: number;
  confirm: boolean; source: string;
}
type Result<T> = ({ok: true} & T) | {ok: false; errors: Diagnostic[]};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (s: string) => { try { return DATE.test(s) ? Temporal.PlainDate.from(s, {overflow: 'reject'}) : null; } catch { return null; } };

function dateFor(o: Occasion, year: number): Temporal.PlainDate | null {
  const r = o.rule;
  if (r.type === 'fixed') return Temporal.PlainDate.from({year, month: r.month, day: r.day});
  if (r.type === 'table') return r.dates[year] ? Temporal.PlainDate.from(r.dates[year]) : null;
  if (r.type === 'after') { const base = OCCASIONS.find(x => x.id === r.occasion); const d = base && dateFor(base, year); return d ? d.add({days: r.days}) : null; }
  const first = Temporal.PlainDate.from({year, month: r.month, day: 1});
  return first.add({days: (r.weekday - first.dayOfWeek + 7) % 7 + (r.n - 1) * 7});
}
/** Shorter occasions win when windows overlap (a national day inside the Christmas season). */
const priorityFor = (windowDays: number) => 30 - Math.min(20, windowDays);

export function upcomingOccasions(input: {markets: unknown; from: unknown; days?: unknown}): Result<{occasions: OccasionInstance[]; notice: string}> {
  const errors: Diagnostic[] = [];
  const markets = input.markets;
  if (!Array.isArray(markets) || !markets.length || markets.some(m => !Object.hasOwn(MARKETS, m))) errors.push({path: 'markets', code: 'MARKETS', message: `Choose one or more markets: ${Object.keys(MARKETS).join(', ')}.`});
  const from = typeof input.from === 'string' ? day(input.from) : null;
  if (!from) errors.push({path: 'from', code: 'DATE', message: 'Use a real calendar date: YYYY-MM-DD.'});
  const days = input.days ?? 120;
  if (!Number.isInteger(days) || (days as number) < 1 || (days as number) > 400) errors.push({path: 'days', code: 'RANGE', message: 'Look ahead 1 to 400 days.'});
  if (errors.length) return {ok: false, errors};
  const end = from!.add({days: (days as number) - 1});
  const list: OccasionInstance[] = [];
  for (const o of OCCASIONS) {
    const shared = o.markets.filter(m => (markets as string[]).includes(m));
    if (!shared.length) continue;
    for (let year = from!.year - 1; year <= end.year + 1; year++) {
      const date = dateFor(o, year);
      if (!date) continue;
      const start = date.subtract({days: o.leadDays}), last = date.add({days: o.durationDays - 1});
      if (Temporal.PlainDate.compare(last, from!) < 0 || Temporal.PlainDate.compare(start, end) > 0) continue;
      const windowDays = start.until(last).days + 1;
      list.push({
        id: `${o.id}-${date.year}`, occasion: o.id, name: o.name, category: o.category, markets: shared,
        date: date.toString(), startDate: start.toString(), lastDate: last.toString(),
        packs: [...o.packs], preset: o.category === 'commercial' ? 'promotion' : 'seasonal', message: o.message, priority: priorityFor(windowDays),
        confirm: !!o.confirm, source: o.source,
      });
    }
  }
  list.sort((a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.id < b.id ? -1 : 1);
  return {ok: true, occasions: list, notice: OCCASIONS_NOTICE};
}

/** The pack an occasion uses by default: its first pack that is actually installed. */
export function defaultPack(instance: OccasionInstance, packs: readonly CompiledPack[]): string | undefined {
  return instance.packs.find(id => packs.some(p => p.id === id));
}
