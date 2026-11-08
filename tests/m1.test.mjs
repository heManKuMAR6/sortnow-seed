import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {validateExperienceV2, validateBundle, selectPage, selectExperience, approvalSnapshot, brandAllowsV2, validateBrand} from '../dist/core/index.js';
import {packs} from '../dist/packs/index.js';
import {sanitizeSvg} from '../scripts/svg-sanitize.mjs';

const bundle = JSON.parse(readFileSync('examples/storefront/seed.bundle.json', 'utf8'));
const brand = JSON.parse(readFileSync('examples/storefront/brand.json', 'utf8'));
const [blackFriday, christmas] = bundle.experiences;
const clone = v => JSON.parse(JSON.stringify(v));
const DEC_12 = Date.parse('2026-12-12T12:00:00.000Z'), NOV_28 = Date.parse('2026-11-28T12:00:00.000Z');
const page = (list, approvals, now, extra = {}) => selectPage(list, approvals, now, {packs, brand, ...extra});
const errorAt = (input, path, code) => { const r = validateExperienceV2(input); assert.equal(r.ok, false); assert.ok(r.errors.some(e => e.path === path && e.code === code), JSON.stringify(r.errors)); };

test('v2 validation rejects markup, unknown fields, and out-of-range effects with paths', () => {
  assert.equal(validateExperienceV2(christmas).ok, true);
  errorAt({...christmas, html: '<b>x</b>'}, 'html', 'UNKNOWN_FIELD');
  errorAt({...christmas, slots: {...christmas.slots, hero: {message: 'Hi', svg: '<svg/>'}}}, 'slots.hero.svg', 'UNKNOWN_FIELD');
  errorAt({...christmas, slots: {...christmas.slots, overlay: {...christmas.slots.overlay, durationMs: 60000}}}, 'slots.overlay.durationMs', 'RANGE');
  errorAt({...christmas, slots: {...christmas.slots, overlay: {effect: 'fireworks'}}}, 'slots.overlay.effect', 'ENUM');
  errorAt({...christmas, slots: {...christmas.slots, banner: {message: 'x\u0007'}}}, 'slots.banner.message', 'TEXT');
  errorAt({...christmas, slots: {...christmas.slots, banner: {message: 'Hi', icon: 'https://x.test/a.svg'}}}, 'slots.banner.icon', 'ASSET_ID');
  errorAt({...christmas, slots: {}}, 'slots', 'SLOTS');
  errorAt({...christmas, pack: {...christmas.pack, hash: 'abc'}}, 'pack.hash', 'HASH');
});

test('one coherent winner per page, only when approved and active', () => {
  const both = [blackFriday, christmas], approvals = both.map(approvalSnapshot);
  assert.equal(page(both, [], DEC_12).experience, null, 'drafts never render');
  assert.equal(page(both, approvals, DEC_12).experience.id, 'christmas-2026');
  assert.equal(page(both, approvals, NOV_28).experience.id, 'black-friday-2026');
  assert.equal(page(both, approvals, Date.parse('2026-12-26T00:00:00.000Z')).experience, null, 'end is exclusive');
  // Overlapping dates: the higher priority wins the whole page; themes never mix.
  const overlap = {...clone(christmas), startsAt: blackFriday.startsAt};
  assert.equal(page([blackFriday, overlap], [blackFriday, overlap].map(approvalSnapshot), NOV_28).experience.id, 'black-friday-2026');
  // v1 per-area selection ignores v2 entries instead of failing, so existing hosts keep working.
  const v1 = JSON.parse(readFileSync('examples/winter.json', 'utf8'));
  assert.ok(selectExperience([v1, christmas], [approvalSnapshot(v1)], Date.parse(v1.startsAt), v1.areas[0]).experience);
  assert.equal(page([{...christmas, slots: 'x'}, blackFriday], [approvalSnapshot(blackFriday)], NOV_28).experience, null, 'malformed config fails closed');
});

test('any slot, palette, or pack edit invalidates approval', () => {
  const approvals = [approvalSnapshot(christmas)];
  const edits = [
    e => { e.slots.hero.message = 'Changed'; }, e => { e.slots.overlay.durationMs = 5000; }, e => { e.palette.accent = '#9a3b12'; },
    e => { e.signatureColors = ['gold']; }, e => { delete e.slots.accent; }, e => { e.pack.hash = `sha256-${'0'.repeat(64)}`; },
  ];
  for (const edit of edits) { const e = clone(christmas); edit(e); assert.equal(page([e], approvals, DEC_12).experience, null, edit.toString()); }
});

test('changed or missing artwork fails closed with PACK_MISMATCH', () => {
  const stale = {...clone(christmas), pack: {...christmas.pack, hash: `sha256-${'1'.repeat(64)}`}};
  const r = page([stale], [approvalSnapshot(stale)], DEC_12);
  assert.equal(r.experience, null);
  assert.equal(r.errors[0].code, 'PACK_MISMATCH');
  const missing = clone(christmas); missing.slots.hero.illustration = 'reindeer';
  assert.equal(page([missing], [approvalSnapshot(missing)], DEC_12).errors[0].code, 'ASSET_MISSING');
});

test('brand policy vetoes effects, signature colours, and slots unless the integrator opted in', () => {
  const legacy = {base: brand.base, palettes: brand.palettes, allowedAreas: brand.allowedAreas, lockedTokens: brand.lockedTokens};
  assert.equal(validateBrand(legacy).ok, true, 'v1 brand files still validate');
  assert.equal(validateBrand({...legacy, effects: 'yes'}).ok, false);
  assert.equal(brandAllowsV2(christmas, brand), true);
  assert.equal(brandAllowsV2(christmas, legacy), false, 'defaults: effects off, signature colours denied, v1 areas only');
  assert.equal(brandAllowsV2(christmas, {...brand, effects: 'off'}), false);
  assert.equal(brandAllowsV2(christmas, {...brand, signatureColors: 'deny'}), false);
  assert.equal(brandAllowsV2(christmas, {...brand, allowedSlots: ['banner', 'hero', 'overlay']}), false);
  assert.equal(brandAllowsV2({...clone(christmas), palette: {...christmas.palette, foreground: '#000000'}}, brand), false, 'locked token');
  assert.equal(page([christmas], [approvalSnapshot(christmas)], DEC_12, {brand: legacy}).errors[0].code, 'BRAND_VETO');
});

test('pack themes never render without the brand policy', () => {
  const r = selectPage([christmas], [approvalSnapshot(christmas)], DEC_12, {packs});
  assert.equal(r.experience, null);
  assert.equal(r.errors[0].code, 'BRAND_REQUIRED');
  assert.ok(page([christmas], [approvalSnapshot(christmas)], DEC_12).experience, 'with the brand it renders');
});

test('bundles never carry approvals or signatures', () => {
  assert.equal(validateBundle(bundle).ok, true);
  for (const field of ['approvals', 'signature']) assert.equal(validateBundle({...bundle, [field]: []}).errors[0].code, 'UNKNOWN_FIELD');
  assert.equal(validateBundle({...bundle, experiences: [christmas, christmas]}).errors[0].code, 'DUPLICATE');
});

test('sanitizer rejects anything outside the drawing vocabulary and forces brand paint', () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0 L10 10" stroke="var(--seed-accent)"/></svg>';
  const opts = {prefix: 'seed-t-a', signatureColors: ['gold']};
  assert.match(sanitizeSvg(ok, opts).svg, /aria-hidden="true"/);
  const bad = {
    script: '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>',
    handler: '<svg viewBox="0 0 1 1" onload="alert(1)"></svg>',
    style: '<svg viewBox="0 0 1 1"><rect style="fill:red" width="1" height="1"/></svg>',
    hex: '<svg viewBox="0 0 1 1"><rect fill="#ff0000" width="1" height="1"/></svg>',
    externalRef: '<svg viewBox="0 0 1 1"><rect fill="url(https://x.test/#a)" width="1" height="1"/></svg>',
    href: '<svg viewBox="0 0 1 1"><use href="#a"/></svg>',
    image: '<svg viewBox="0 0 1 1"><image width="1" height="1"/></svg>',
    foreign: '<svg viewBox="0 0 1 1"><foreignObject/></svg>',
    comment: '<svg viewBox="0 0 1 1"><!-- x --></svg>',
    entity: '<svg viewBox="0 0 1 1"><title>&lt;</title></svg>',
    undeclaredSignature: '<svg viewBox="0 0 1 1"><rect fill="var(--seed-sig-red)" width="1" height="1"/></svg>',
    cssEscape: '<svg viewBox="0 0 1 1"><rect fill="var(--seed-accent);x:expression(1)" width="1" height="1"/></svg>',
    twoRoots: '<svg viewBox="0 0 1 1"></svg><svg viewBox="0 0 1 1"></svg>',
  };
  for (const [name, svg] of Object.entries(bad)) assert.throws(() => sanitizeSvg(svg, opts), undefined, name);
});

test('compiled packs are current, within budget, and pinned by the demo bundle', () => {
  const check = spawnSync(process.execPath, ['scripts/build-packs.mjs', '--check'], {encoding: 'utf8'});
  assert.equal(check.status, 0, check.stderr);
  for (const p of packs) {
    assert.ok(JSON.stringify(p).length < 60 * 1024, p.id);
    for (const kind of ['illustrations', 'icons', 'decorations', 'particles']) for (const a of Object.values(p[kind])) assert.ok(!/<script|on\w+=|style=|#[0-9a-f]{6}/i.test(a.svg));
  }
  for (const e of bundle.experiences) assert.ok(packs.some(p => p.id === e.pack.id && p.hash === e.pack.hash), `${e.id} pins the installed pack`);
});

test('CLI lists packs and validates v2 and bundles against installed packs', () => {
  const run = (...a) => { const p = spawnSync(process.execPath, ['dist/cli/index.js', ...a], {encoding: 'utf8', timeout: 5000}); return {status: p.status, result: JSON.parse(p.stdout)}; };
  assert.deepEqual(run('packs').result.packs.map(p => p.id), packs.map(p => p.id));
  const christmasPack = run('pack', 'christmas').result.pack;
  assert.ok(christmasPack.effects.flyby.assets.includes('santa-sleigh'));
  assert.ok(!JSON.stringify(christmasPack).includes('<svg'), 'artwork is not printed');
  assert.equal(run('validate', 'examples/storefront/seed.bundle.json').status, 0);
  assert.equal(run('schema', 'experience-v2').result.properties.schemaVersion.const, 2);
  const commands = run('help').result.commands.map(c => c.command).join(' ');
  assert.ok(!/approve|publish/.test(commands));
});
