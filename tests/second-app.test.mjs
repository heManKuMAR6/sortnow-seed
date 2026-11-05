import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {approvalSnapshot,brandAllows,validateBrand,contrastReport,brandContrastReport,effectivePalette} from '../dist/core/index.js';
import {Page,Demo} from '../examples/second-app/app.mjs';
const data=name=>JSON.parse(readFileSync(new URL(`../examples/second-app/${name}.json`,import.meta.url)));
const config={brand:data('brand'),experiences:data('experiences'),approvals:data('reviewed-approvals')};
const during=Date.parse('2027-03-08T12:00:00.000Z'),after=Date.parse('2027-03-15T00:00:00.000Z');
const render=(previewAt,overrides={})=>renderToString(createElement(Page,{...config,...overrides,previewAt}));
const plans=html=>html.slice(html.indexOf('<section id="plans"'));

test('fixture is valid and approvals are exact snapshots of only the reviewed experiences',()=>{
  assert.equal(validateBrand(config.brand).ok,true);
  const byId=Object.fromEntries(config.experiences.map(e=>[e.id,e]));
  assert.deepEqual(config.approvals,[approvalSnapshot(byId['launch-week']),approvalSnapshot(byId['approved-banner'])]);
  assert.ok(!config.approvals.includes(approvalSnapshot(byId['unreviewed-draft'])));
});
test('server render and the live first render are base content',()=>{
  for(const html of [render(undefined),renderToString(createElement(Demo,config))]){
    assert.ok(!html.includes('data-seed-experience'));
    assert.ok(!html.includes('--seed-'));
    assert.ok(html.includes('Reconcile every account'));
  }
});
test('approved hero activates by tokens only, without changing its markup',()=>{
  const base=render(after),html=render(during);
  assert.ok(html.includes('data-seed-experience="launch-week"'));
  assert.ok(html.includes('--seed-accent:#b7c4ff'));
  assert.ok(!html.includes('Bank feeds are here.'),'variables mode adds no message text');
  const masthead=s=>s.slice(s.indexOf('<header'),s.indexOf('</header>'));
  assert.equal(masthead(html),masthead(base));
});
test('higher-priority unreviewed draft never renders',()=>{
  const html=render(during);
  assert.ok(!html.includes('unreviewed-draft'));
  assert.ok(!render(during,{approvals:[]}).includes('data-seed-experience'));
});
test('brand policy vetoes an approved banner and restores the base area',()=>{
  const banner=config.experiences.find(e=>e.id==='approved-banner');
  assert.ok(config.approvals.includes(approvalSnapshot(banner)));
  assert.equal(brandAllows(banner,config.brand),false);
  const html=render(during);
  assert.ok(!html.includes('approved-banner'));
  assert.ok(html.includes('<div data-seed-area="banner"></div>'));
});
test('content outside the areas is identical in every state and expiry restores base',()=>{
  assert.equal(plans(render(during)),plans(render(after)));
  assert.equal(plans(render(during)),plans(render(undefined)));
  assert.equal(render(after),render(undefined));
});
test('editing an approved experience invalidates it',()=>{
  const edited=structuredClone(config.experiences);
  edited[0].theme.accent='#7fd1c7';
  assert.ok(!render(during,{experiences:edited}).includes('data-seed-experience'));
});
test('fixture palettes pass the advisory contrast check after locks apply',()=>{
  assert.equal(brandContrastReport(config.brand).meetsMinimums,true);
  assert.equal(effectivePalette('launch',config.brand).background,config.brand.base.background);
  assert.equal(contrastReport(config.experiences[0].theme).meetsMinimums,true);
});
