import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {upcomingOccasions, planExperiences, OCCASIONS} from '../dist/core/authoring.js';
import {selectPage, approvalSnapshot, validateBundle} from '../dist/core/index.js';
import {packs} from '../dist/packs/index.js';
import {bundleFile} from '../examples/playground/export.mjs';

const brand = JSON.parse(readFileSync('examples/storefront/brand.json', 'utf8'));
const list = (markets, from = '2026-11-08', days = 120) => { const r = upcomingOccasions({markets, from, days}); assert.equal(r.ok, true, JSON.stringify(r.errors)); return r.occasions; };
const find = (occ, id) => occ.find(o => o.id === id);
const plan = (over = {}) => planExperiences({markets: ['AE', 'US'], from: '2026-11-08', timeZone: 'Asia/Dubai', areas: ['banner', 'hero'], occasions: ['national-day-ae-2026', 'christmas-2026'], ...over}, brand);

test('rule-based dates are computed correctly', () => {
  const us = list(['US'], '2026-11-01', 400);
  assert.equal(find(us, 'thanksgiving-us-2026').date, '2026-11-26');
  assert.equal(find(us, 'thanksgiving-us-2027').date, '2027-11-25');
  assert.deepEqual([find(us, 'black-friday-2026').startDate, find(us, 'black-friday-2026').lastDate], ['2026-11-27', '2026-11-30']);
  assert.equal(find(us, 'mothers-day-us-2027').date, '2027-05-09');
  const ny = find(us, 'new-year-2027');
  assert.deepEqual([ny.startDate, ny.lastDate], ['2026-12-31', '2027-01-01']);
});

test('markets filter occasions, and unpublished years are never guessed', () => {
  const sg = list(['SG'], '2026-11-08', 200);
  assert.ok(find(sg, 'lunar-new-year-2027'));
  assert.ok(!sg.some(o => o.occasion === 'republic-day-in' || o.occasion === 'thanksgiving-us'));
  const later = list(['IN'], '2028-01-01', 400);
  assert.ok(!later.some(o => o.occasion === 'diwali' || o.occasion === 'eid-al-fitr'), 'no table date, no listing');
  for (const o of list(['IN', 'AE', 'SG'], '2026-11-01', 400)) if (['diwali', 'eid-al-fitr', 'eid-al-adha', 'lunar-new-year'].includes(o.occasion)) assert.equal(o.confirm, true, o.id);
  assert.equal(upcomingOccasions({markets: ['XX'], from: '2026-11-08'}).ok, false);
  assert.equal(upcomingOccasions({markets: [], from: '2026-11-08'}).ok, false);
  assert.equal(upcomingOccasions({markets: ['US'], from: '2026-02-30'}).errors[0].code, 'DATE');
});

test('every catalogue pack is installed and every occasion has a source', () => {
  for (const o of OCCASIONS) {
    assert.ok(o.source.length > 10, o.id);
    for (const p of o.packs) assert.ok(packs.some(x => x.id === p), `${o.id} -> ${p}`);
  }
});

test('planning only uses chosen occasions and produces reviewable drafts', () => {
  assert.equal(plan({occasions: []}).errors[0].code, 'OCCASIONS', 'nothing is chosen for the owner');
  assert.equal(plan({occasions: ['republic-day-in-2027']}).errors[0].code, 'OCCASION', 'not upcoming in these markets');
  const r = plan();
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(validateBundle(r.bundle).ok, true);
  assert.deepEqual(r.overlaps, [['national-day-ae-2026', 'christmas-2026']]);
  const [day, xmas] = r.bundle.experiences;
  assert.equal(day.pack.id, 'celebration');
  assert.equal(xmas.pack.id, 'christmas');
  const at = Date.parse('2026-12-02T12:00:00.000Z');
  assert.equal(selectPage(r.bundle.experiences, [], at, {packs, brand}).experience, null, 'drafts are not live');
  const approvals = r.bundle.experiences.map(approvalSnapshot);
  assert.equal(selectPage(r.bundle.experiences, approvals, at, {packs, brand}).experience.id, day.id, 'the shorter occasion wins shared days');
  assert.equal(selectPage(r.bundle.experiences, approvals, Date.parse('2026-12-10T12:00:00.000Z'), {packs, brand}).experience.id, xmas.id);
});

test('owners can override message, pack, and dates; nothing else', () => {
  const r = plan({occasions: ['christmas-2026'], overrides: {'christmas-2026': {message: 'Season greetings', pack: 'none', startDate: '2026-12-10'}}});
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const e = r.bundle.experiences[0];
  assert.equal(e.schemaVersion, 1);
  assert.equal(e.theme.message, 'Season greetings');
  assert.equal(r.drafts[0].schedule.startDate, '2026-12-10');
  assert.equal(plan({overrides: {'christmas-2026': {approved: true}}}).errors[0].code, 'OVERRIDE');
  assert.equal(plan({approvals: []}).errors[0].code, 'UNKNOWN_FIELD');
});

test('plan bundles download safely and the CLI exposes occasions and plan', () => {
  const r = plan();
  assert.equal(bundleFile(r.bundle, 'seed-plan-2026-11-08').filename, 'seed-plan-2026-11-08.bundle.json');
  assert.throws(() => bundleFile(r.bundle, '../evil'));
  assert.throws(() => bundleFile({...r.bundle, approvals: []}, 'x'));
  const run = (...a) => { const p = spawnSync(process.execPath, ['dist/cli/index.js', ...a], {encoding: 'utf8', timeout: 5000}); return {status: p.status, result: JSON.parse(p.stdout)}; };
  const occ = run('occasions', 'IN,AE', '2026-11-08', '60');
  assert.equal(occ.status, 0);
  assert.ok(occ.result.occasions.some(o => o.id === 'national-day-ae-2026'));
  assert.equal(run('occasions', 'MARS', '2026-11-08').status, 1);
  const dir = mkdtempSync(join(tmpdir(), 'seed-plan-'));
  try {
    writeFileSync(join(dir, 'plan.json'), JSON.stringify({markets: ['AE', 'US'], from: '2026-11-08', timeZone: 'Asia/Dubai', areas: ['banner', 'hero'], occasions: ['national-day-ae-2026', 'christmas-2026']}));
    const planned = run('plan', join(dir, 'plan.json'), 'examples/storefront/brand.json');
    assert.equal(planned.status, 0);
    assert.deepEqual(planned.result.bundle, r.bundle);
    assert.equal(planned.result.approved, false);
  } finally { rmSync(dir, {recursive: true}); }
});

test('Eid and Halloween plan with their own packs and the brand-allowed effect', () => {
  const ae = planExperiences({markets: ['AE'], from: '2027-03-01', days: 90, timeZone: 'Asia/Dubai', areas: ['banner', 'hero'], occasions: ['eid-al-fitr-2027', 'eid-al-adha-2027']}, brand);
  assert.equal(ae.ok, true, JSON.stringify(ae.errors));
  for (const e of ae.bundle.experiences) { assert.equal(e.pack.id, 'eid'); assert.equal(e.slots.overlay.effect, 'particles'); }
  assert.ok(ae.drafts.every(d => d.confirm), 'moon-sighting dates stay flagged');
  const us = planExperiences({markets: ['US'], from: '2027-10-01', days: 60, timeZone: 'America/New_York', areas: ['banner', 'hero'], occasions: ['halloween-2027']}, brand);
  assert.equal(us.ok, true, JSON.stringify(us.errors));
  const h = us.bundle.experiences[0];
  assert.equal(h.pack.id, 'halloween');
  assert.equal(h.slots.overlay.effect, 'flyby', 'bats fly by');
  assert.equal(h.slots.hero.illustration, 'pumpkin');
  assert.equal(h.startsAt, '2027-10-18T04:00:00.000Z');
});
