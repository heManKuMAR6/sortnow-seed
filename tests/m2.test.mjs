import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sameOriginUrl, checkConfig} from '../dist/element/index.js';
import {SeedRoot} from '../dist/react/index.js';
import {approvalSnapshot, validateBundle} from '../dist/core/index.js';
import {packs} from '../dist/packs/index.js';

const json = f => JSON.parse(readFileSync(f, 'utf8'));
const dir = 'examples/plain-html/seed';
const bundle = json(`${dir}/seed.bundle.json`), approvals = json(`${dir}/approvals.json`), brand = json(`${dir}/brand.json`);

test('configuration loads only from the page origin', () => {
  const page = 'https://shop.example/products/bread';
  assert.equal(sameOriginUrl('/seed/seed.bundle.json', page), 'https://shop.example/seed/seed.bundle.json');
  assert.equal(sameOriginUrl('seed/brand.json', page), 'https://shop.example/products/seed/brand.json');
  for (const bad of ['https://evil.example/seed.json', '//evil.example/seed.json', 'http://shop.example/x.json', 'javascript:alert(1)', 'data:application/json,{}', 'blob:https://shop.example/1'])
    assert.equal(sameOriginUrl(bad, page), null, bad);
});

test('element configuration is checked and fails closed', () => {
  assert.equal(checkConfig(bundle, approvals, brand).ok, true);
  assert.equal(checkConfig({...bundle, approvals}, approvals, brand).ok, false, 'a bundle cannot carry its own approvals');
  assert.equal(checkConfig(bundle, {approved: true}, brand).errors[0].code, 'APPROVALS');
  assert.equal(checkConfig(bundle, [1], brand).ok, false);
  assert.equal(checkConfig({bundleVersion: 1, experiences: [{schemaVersion: 2}]}, [], brand).ok, false);
});

test('the single-file script is self-contained, framework-free, and within budget', () => {
  const script = readFileSync('dist/seed-element.js', 'utf8');
  assert.ok(gzipSync(script).length <= 24 * 1024);
  assert.ok(!/from\s*["']|import\s*\(|require\(/.test(script), 'no external imports');
  assert.ok(!/react/i.test(script), 'no React inside');
  for (const p of packs) assert.ok(script.includes(p.hash), `includes ${p.id}`);
});

test('the plain HTML example ships reviewed, consistent configuration', () => {
  assert.equal(validateBundle(bundle).ok, true);
  assert.deepEqual(approvals, bundle.experiences.map(approvalSnapshot), 'demo approvals match the bundle exactly');
  for (const e of bundle.experiences) assert.ok(packs.some(p => p.id === e.pack.id && p.hash === e.pack.hash), e.id);
});

test('React SeedRoot renders nothing on the server, so SSR output is the base page', () => {
  assert.equal(renderToStaticMarkup(createElement(SeedRoot, {experiences: bundle.experiences, approvals, packs, brand})), '');
});
