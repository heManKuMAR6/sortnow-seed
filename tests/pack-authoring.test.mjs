import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {authorExperience} from '../dist/core/authoring.js';
import {approvalSnapshot, selectPage, validateBundle} from '../dist/core/index.js';
import {packs} from '../dist/packs/index.js';
import {draftFile} from '../examples/playground/export.mjs';

const brand = JSON.parse(readFileSync('examples/playground/brand.json', 'utf8'));
const legacy = {base: brand.base, palettes: brand.palettes, allowedAreas: brand.allowedAreas, lockedTokens: brand.lockedTokens};
const event = (over = {}) => ({name: 'Christmas', timeZone: 'America/New_York', startDate: '2026-12-01', lastDate: '2026-12-25', preset: 'seasonal', message: 'Happy holidays', areas: ['banner', 'hero'], pack: 'christmas', ...over});
const author = (over, b = brand) => { const r = authorExperience(event(over), b); assert.equal(r.ok, true, JSON.stringify(r.errors)); return r.experience; };
const errorAt = (over, path, code, b = brand) => { const r = authorExperience(event(over), b); assert.equal(r.ok, false); assert.ok(r.errors.some(e => e.path === path && e.code === code), JSON.stringify(r.errors)); };
const DEC_10 = Date.parse('2026-12-10T12:00:00.000Z');

test('choosing a pack gives a complete, renderable design without writing JSON', () => {
  const e = author();
  assert.equal(e.schemaVersion, 2);
  assert.equal(e.startsAt, '2026-12-01T05:00:00.000Z');
  assert.deepEqual(e.pack, {id: 'christmas', version: '1.0.0', hash: packs.find(p => p.id === 'christmas').hash});
  assert.deepEqual(e.slots.banner, {message: 'Happy holidays', icon: 'gift'});
  assert.deepEqual(e.slots.hero, {message: 'Happy holidays', illustration: 'tree', placement: 'end'}, 'the flyby artwork is not reused as the hero default');
  assert.equal(e.slots.accent.decoration, 'holly-corner');
  assert.equal(e.slots.overlay.effect, 'flyby');
  assert.deepEqual(e.signatureColors, ['santa-red', 'gold', 'pine', 'frost']);
  assert.equal(e.palette.foreground, brand.base.foreground, 'locked token kept');
  assert.equal(selectPage([e], [], DEC_10, {packs, brand}).experience, null, 'a draft is never live');
  assert.equal(selectPage([e], [approvalSnapshot(e)], DEC_10, {packs, brand}).experience.id, e.id);
  assert.equal(author({pack: 'black-friday', preset: 'promotion'}).slots.overlay.effect, 'particles');
});

test('defaults respect brand opt-ins: no effect, decoration, or signature colours unless allowed', () => {
  const e = author({}, legacy);
  assert.equal(e.slots.overlay, undefined);
  assert.equal(e.slots.accent, undefined);
  assert.deepEqual(e.signatureColors, []);
  assert.ok(e.slots.hero.illustration, 'artwork in permitted slots still applies');
  assert.equal(selectPage([e], [approvalSnapshot(e)], DEC_10, {packs, brand: legacy}).experience.id, e.id, 'the default draft is renderable under that brand');
});

test('explicit choices the brand or pack forbids are errors, never silently dropped', () => {
  errorAt({effect: 'flyby'}, 'effect', 'BRAND_EFFECTS', legacy);
  errorAt({signatureColors: true}, 'signatureColors', 'BRAND_SIGNATURE', legacy);
  errorAt({decoration: 'holly-corner'}, 'decoration', 'BRAND_AREA', legacy);
  errorAt({pack: 'black-friday', preset: 'promotion', effect: 'flyby'}, 'effect', 'EFFECT');
  errorAt({illustration: 'gift'}, 'illustration', 'ASSET');
  errorAt({pack: 'not-a-pack'}, 'pack', 'PACK');
  errorAt({pack: undefined, effect: 'flyby'}, 'effect', 'PACK_REQUIRED');
  errorAt({signatureColors: 'yes'}, 'signatureColors', 'BOOLEAN');
});

test('"none" opts out, and every design edit needs a new approval', () => {
  const plain = author({illustration: 'none', icon: 'none', decoration: 'none', effect: 'none', signatureColors: false});
  assert.deepEqual(plain.slots, {banner: {message: 'Happy holidays'}, hero: {message: 'Happy holidays'}});
  const original = author(), approval = [approvalSnapshot(original)];
  for (const edit of [{illustration: 'gift-stack'}, {icon: 'star'}, {decoration: 'none'}, {effect: 'particles'}, {signatureColors: false}, {message: 'Changed'}])
    assert.equal(selectPage([author(edit)], approval, DEC_10, {packs, brand}).experience, null, JSON.stringify(edit));
});

test('pack drafts download as a bundle that the CLI validates; colour-only drafts are unchanged', () => {
  const e = author();
  const {filename, json} = draftFile(e);
  assert.equal(filename, `${e.id}.bundle.json`);
  const bundle = JSON.parse(json);
  assert.deepEqual(bundle, {bundleVersion: 1, experiences: [e]});
  assert.equal(validateBundle(bundle).ok, true);
  assert.ok(!('approvals' in bundle));
  assert.match(draftFile(author({pack: undefined})).filename, /\.draft\.json$/);
  const dir = mkdtempSync(join(tmpdir(), 'seed-pack-'));
  const run = (...a) => { const p = spawnSync(process.execPath, ['dist/cli/index.js', ...a], {encoding: 'utf8', timeout: 5000}); return {status: p.status, result: JSON.parse(p.stdout)}; };
  try {
    writeFileSync(join(dir, filename), json);
    assert.equal(run('validate', join(dir, filename)).status, 0);
    writeFileSync(join(dir, 'event.json'), JSON.stringify(event()));
    const authored = run('author', join(dir, 'event.json'), 'examples/playground/brand.json');
    assert.equal(authored.status, 0);
    assert.deepEqual(authored.result.experience, e);
    assert.equal(authored.result.approved, false);
  } finally { rmSync(dir, {recursive: true}); }
});
