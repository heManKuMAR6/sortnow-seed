import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const URL = 'http://127.0.0.1:4186/';
const root = page => page.locator('seed-root');
const parts = page => page.locator('[data-seed-part]');
const bundle = readFileSync('examples/plain-html/seed/seed.bundle.json','utf8');
const brand = readFileSync('examples/plain-html/seed/brand.json','utf8');
const approvals = readFileSync('examples/plain-html/seed/approvals.json','utf8');
async function active(page) { await page.emulateMedia({reducedMotion:'reduce'}); await page.goto(URL); await expect(root(page)).toHaveAttribute('data-state','active'); }
test('clearing config revokes the active theme immediately',async({page})=>{
 await active(page); await page.evaluate(()=>document.querySelector('seed-root').config=null);
 await expect(parts(page)).toHaveCount(0);
});
test('property configuration is validated and fails closed',async({page})=>{
 await active(page); await page.evaluate(()=>{const r=document.querySelector('seed-root');try{r.config={...r.config,approvals:null}}catch{}});
 await expect(root(page)).toHaveAttribute('data-state','error'); await expect(parts(page)).toHaveCount(0);
});
test('changing approvals URL invalidates the old approval',async({page})=>{
 await active(page); await page.route('**/revoked.json',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.evaluate(()=>document.querySelector('seed-root').setAttribute('approvals','/revoked.json'));
 await expect(parts(page)).toHaveCount(0);
});
test('external base URL is not treated as the page origin',async({page})=>{
 await page.route(URL,async route=>{const r=await route.fetch();const html=(await r.text()).replace('<head>','<head><base href="http://outside.test/">').replace('src="/seed-element.js"',`src="${URL}seed-element.js"`);await route.fulfill({headers:{'content-type':'text/html'},body:html})});
 const foreign=[];await page.route('http://outside.test/**',r=>{foreign.push(r.request().url());return r.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:r.request().url().includes('approvals')?approvals:r.request().url().includes('brand')?brand:bundle})});
 await page.goto(URL); await expect(root(page)).toHaveAttribute('data-state','error');
 expect(foreign.filter(u=>u.includes('/seed/'))).toEqual([]);
});
test('same-origin redirects are rejected before following external config',async({page})=>{
 await page.route('**/seed/approvals.json',r=>r.fulfill({status:302,headers:{location:'http://outside.test/approvals.json'}}));
 let hits=0;await page.route('http://outside.test/**',r=>{hits++;return r.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:approvals})});
 await page.route(URL,async route=>{const r=await route.fetch();await route.fulfill({headers:{'content-type':'text/html'},body:await r.text()})});
 await page.goto(URL);await expect(root(page)).toHaveAttribute('data-state','error');await expect(parts(page)).toHaveCount(0);expect(hits).toBe(0);
});
test('inline JSON obeys the same byte limit as fetched JSON',async({page})=>{
 await page.route(URL,async route=>{const r=await route.fetch();const html=(await r.text()).replace('</seed-root>',`<script type="application/json" data-seed="approvals">${' '.repeat(262145)}${approvals}</script></seed-root>`);await route.fulfill({response:r,body:html})});
 await page.goto(URL);await expect(root(page)).toHaveAttribute('data-state','error');await expect(parts(page)).toHaveCount(0);
});
test('a second seed-root cannot decorate the same document twice',async({page})=>{
 await active(page);const count=await parts(page).count();await page.evaluate(()=>{const first=document.querySelector('seed-root');const r=document.createElement('seed-root');r.id='second';r.config=first.config;r.setAttribute('preview-at',first.getAttribute('preview-at'));document.body.append(r)});
 await expect(page.locator('#second')).toHaveAttribute('data-state','error');expect(await parts(page).count()).toBe(count);
});
