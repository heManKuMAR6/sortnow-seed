import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {replanNextYear, planExperiences, nextOccurrenceId} from '../dist/core/authoring.js';
import {selectPage, approvalSnapshot, validateBundle} from '../dist/core/index.js';
import {packs} from '../dist/packs/index.js';
import {planFile} from '../examples/playground/export.mjs';

const brand = JSON.parse(readFileSync('examples/storefront/brand.json', 'utf8'));
const lastYear = {markets: ['AE', 'US', 'IN'], from: '2026-11-08', timeZone: 'Asia/Dubai', areas: ['banner', 'hero'],
  occasions: ['diwali-2026', 'black-friday-2026', 'national-day-ae-2026', 'christmas-2026', 'new-year-2027'],
  overrides: {'christmas-2026': {message: 'Season greetings from Dubai', startDate: '2026-12-10'}, 'black-friday-2026': {pack: 'none'}}};

test('next year keeps the same occasions on their new dates, including ones that move earlier', () => {
  assert.equal(nextOccurrenceId('new-year-2027'), 'new-year-2028');
  const r = replanNextYear(lastYear, brand);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.plan.occasions, ['diwali-2027', 'black-friday-2027', 'national-day-ae-2027', 'christmas-2027', 'new-year-2028']);
  assert.equal(r.plan.from, '2027-10-26', 'Diwali 2027 (29 October) is earlier than this year and still included');
  assert.deepEqual(r.missing, []);
  const byName = Object.fromEntries(r.result.drafts.map(d => [d.occasion, d.schedule]));
  assert.equal(byName['black-friday-2027'].startDate, '2027-11-26');
  assert.equal(byName['diwali-2027'].startDate, '2027-10-26');
  assert.equal(validateBundle(r.result.bundle).ok, true);
});

test('message and pack choices carry over; hand-set dates do not, and the owner is told', () => {
  const r = replanNextYear(lastYear, brand);
  assert.deepEqual(r.plan.overrides, {'christmas-2027': {message: 'Season greetings from Dubai'}, 'black-friday-2027': {pack: 'none'}});
  assert.ok(r.notes.some(n => n.startsWith('christmas-2027') && n.includes('dates were not carried')));
  const xmas = r.result.bundle.experiences.find(e => e.id.startsWith('christmas'));
  assert.equal(xmas.slots.hero.message, 'Season greetings from Dubai');
  assert.equal(r.result.drafts.find(d => d.occasion === 'christmas-2027').schedule.startDate, '2027-12-01');
  assert.equal(r.result.bundle.experiences.find(e => e.id.startsWith('black-friday')).schemaVersion, 1, 'pack: none kept');
});

test('unpublished dates are reported, never guessed', () => {
  const r = replanNextYear({...lastYear, from: '2027-10-01', occasions: ['diwali-2027', 'christmas-2027'], overrides: undefined}, brand);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.plan.occasions, ['christmas-2028']);
  assert.equal(r.missing[0].occasion, 'diwali-2028');
  const none = replanNextYear({...lastYear, from: '2027-10-01', occasions: ['diwali-2027'], overrides: undefined}, brand);
  assert.equal(none.ok, true);
  assert.equal(none.result, null);
  assert.equal(replanNextYear({...lastYear, occasions: []}, brand).ok, false);
});

test("last year's approvals never activate next year's drafts", () => {
  const old = planExperiences(lastYear, brand);
  const approvals = old.bundle.experiences.map(approvalSnapshot);
  const next = replanNextYear(lastYear, brand).result.bundle.experiences;
  assert.equal(selectPage(next, approvals, Date.parse('2027-12-10T12:00:00.000Z'), {packs, brand}).experience, null);
});

test('plan choices download without approvals, and the CLI replans from them', () => {
  const {filename, json} = planFile({...lastYear, approvals: ['x']}, 'seed-plan-2026-11-08');
  assert.equal(filename, 'seed-plan-2026-11-08.plan.json');
  assert.ok(!('approvals' in JSON.parse(json)));
  assert.throws(() => planFile(lastYear, '../x'));
  const dir = mkdtempSync(join(tmpdir(), 'seed-replan-'));
  try {
    writeFileSync(join(dir, filename), json);
    const p = spawnSync(process.execPath, ['dist/cli/index.js', 'replan', join(dir, filename), 'examples/storefront/brand.json'], {encoding: 'utf8', timeout: 5000});
    assert.equal(p.status, 0);
    assert.deepEqual(JSON.parse(p.stdout).plan, replanNextYear(lastYear, brand).plan);
  } finally { rmSync(dir, {recursive: true}); }
});
