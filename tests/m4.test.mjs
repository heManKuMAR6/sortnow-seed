import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {importBrand, parseColor, colorsFromCss, colorsFromTokens, authorExperience} from '../dist/core/authoring.js';
import {validateBrand, contrastRatio, selectPage, approvalSnapshot} from '../dist/core/index.js';
import {packs} from '../dist/packs/index.js';
import {brandFile} from '../examples/playground/export.mjs';

const css = readFileSync('examples/brand-import/site.css', 'utf8');
const tokens = readFileSync('examples/brand-import/tokens.json', 'utf8');
const ok = text => { const r = importBrand(text); assert.equal(r.ok, true, JSON.stringify(r.errors)); return r; };

test('colour parsing covers common CSS forms and rejects everything else', () => {
  assert.equal(parseColor('#ABC'), '#aabbcc');
  assert.equal(parseColor('#11223344'), '#112233');
  assert.equal(parseColor('rgb(255 0 0 / 50%)'), '#ff0000');
  assert.equal(parseColor('rgba(0, 128, 255, 0.4)'), '#0080ff');
  assert.equal(parseColor('hsl(0, 100%, 50%)'), '#ff0000');
  for (const bad of ['red', 'url(x)', 'expression(alert(1))', '#12', 'var(--x)', '']) assert.equal(parseColor(bad), null, bad);
});

test('CSS variables map to roles by name and resolve var() references', () => {
  const r = ok(css);
  assert.deepEqual(Object.fromEntries(Object.entries(r.mapping).map(([k, v]) => [k, v.token])), {background: '--color-surface', foreground: '--color-text', accent: '--color-primary'});
  assert.ok(colorsFromCss(css).some(c => c.token === '--button-bg' && c.value === r.mapping.accent.value), 'var() resolved');
  assert.ok(!colorsFromCss(css).some(c => c.token === '--radius' || c.token === '--font-body'), 'non-colours ignored');
});

test('design tokens (W3C $value) work, including dark themes', () => {
  const r = ok(tokens);
  assert.equal(r.brand.base.background, '#0f1720');
  assert.equal(r.mapping.accent.token, 'color.brand.primary');
  assert.ok(colorsFromTokens(JSON.parse(tokens)).every(c => !c.token.startsWith('spacing')));
});

test('the proposal is a valid, readable, conservative brand policy', () => {
  for (const r of [ok(css), ok(tokens)]) {
    assert.equal(validateBrand(r.brand).ok, true);
    assert.deepEqual(r.brand.lockedTokens, ['foreground']);
    assert.equal(r.brand.effects, 'off');
    assert.equal(r.brand.signatureColors, 'deny');
    for (const p of [r.brand.base, ...Object.values(r.brand.palettes)]) {
      assert.equal(p.foreground, r.brand.base.foreground, 'text colour locked');
      assert.ok(contrastRatio(p.accent, p.background) >= 4.5, `accent readable on ${p.background}`);
    }
  }
  const pale = ok(':root{--bg:#ffffff;--text:#111111;--primary:#ffe066}');
  assert.ok(pale.notes.some(n => n.includes('adjusted')), 'an unreadable accent is adjusted and reported');
});

test('names are inferred from colours when variables are not named by role', () => {
  const r = ok(':root{--a:#fafafa;--b:#202020;--c:#d0342c;--d:#b0b0b0}');
  assert.equal(r.brand.base.background, '#fafafa');
  assert.equal(r.brand.base.foreground, '#202020');
  assert.equal(r.mapping.accent.token, '--c');
  assert.equal(importBrand(':root{--only:#ffffff}').errors[0].code, 'COLORS');
  assert.equal(importBrand('x'.repeat(70000)).errors[0].code, 'INPUT_SIZE');
  assert.equal(importBrand('{not json').errors[0].code, 'JSON_SYNTAX');
});

test('nothing but colour values reaches the brand, and packs render with it', () => {
  const hostile = ok(':root{--bg:#ffffff;--text:#111111;--primary:#2f6b4f;--evil:url(javascript:alert(1))} body{background:url(https://x.test/a.png)}');
  assert.ok(!JSON.stringify(hostile.brand).match(/url|javascript|body/));
  const brand = {...ok(css).brand, effects: 'on', signatureColors: 'allow'};
  const r = authorExperience({name: 'Christmas', timeZone: 'UTC', startDate: '2026-12-01', lastDate: '2026-12-25', preset: 'seasonal', message: 'Hi', areas: ['banner', 'hero'], pack: 'christmas'}, brand);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.experience.palette.background, brand.palettes.seasonal.background);
  assert.ok(selectPage([r.experience], [approvalSnapshot(r.experience)], Date.parse('2026-12-10T12:00:00.000Z'), {packs, brand}).experience);
  assert.equal(brandFile(brand).filename, 'brand.json');
  assert.throws(() => brandFile({...brand, css: 'body{}'}));
});

test('seed init reads a file you point to and prints a draft', () => {
  const run = (...a) => { const p = spawnSync(process.execPath, ['dist/cli/index.js', ...a], {encoding: 'utf8', timeout: 5000}); return {status: p.status, result: JSON.parse(p.stdout)}; };
  const r = run('init', 'examples/brand-import/site.css');
  assert.equal(r.status, 0);
  assert.equal(r.result.draft, true);
  assert.deepEqual(r.result.brand, ok(css).brand);
  assert.equal(run('init', 'examples/brand-import/tokens.json').status, 0);
  assert.equal(run('init', 'README.md').status, 1, 'a file without colour variables is reported, not guessed');
});
