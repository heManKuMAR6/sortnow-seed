import {test, expect} from '@playwright/test';
import {buildSync} from 'esbuild';
import {readFileSync} from 'node:fs';
const js=buildSync({stdin:{contents:"import * as render from './dist/render/index.js';import {packs} from './dist/packs/index.js';window.review={...render,packs};",resolveDir:process.cwd()},bundle:true,write:false,format:'iife'}).outputFiles[0].text;
const bundle=JSON.parse(readFileSync('examples/storefront/seed.bundle.json','utf8'));
const brand=JSON.parse(readFileSync('examples/storefront/brand.json','utf8'));
async function setup(page, csp='') {
 await page.route('http://review.test/**',r=>r.fulfill(r.request().url().endsWith('/review.js')?{contentType:'text/javascript',body:js}:{contentType:'text/html',headers:csp?{'content-security-policy':csp}:{},body:'<div id="hero" data-seed-slot="hero accent">Host content</div><script src="/review.js"></script>'}));
 await page.goto('http://review.test/');
 await page.evaluate(({bundle,brand})=>{window.opts={experiences:bundle.experiences,approvals:[],brand,packs:review.packs,now:Date.parse('2026-12-12T12:00:00Z'),motion:'reduce'};}, {bundle,brand});
 // Exact snapshots are fixture approvals, not application approval logic.
 await page.evaluate(async()=>{const e=opts.experiences.find(e=>e.pack.id==='christmas');opts.experiences=[e];opts.approvals=[JSON.stringify(e)];});
}
test('a root that is itself a slot is decorated',async({page})=>{await setup(page);await page.evaluate(()=>window.mount=review.mountSeed({...opts,root:document.querySelector('#hero')}));await expect(page.locator('[data-seed-part="message"]')).toHaveCount(1)});
test('removing a slot opt-in restores it',async({page})=>{await setup(page);await page.evaluate(()=>{window.mount=review.mountSeed(opts);document.querySelector('#hero').removeAttribute('data-seed-slot')});await expect(page.locator('[data-seed-part]')).toHaveCount(0)});
test('host content replacement gets its decoration back without duplicates',async({page})=>{await setup(page);await page.evaluate(()=>{window.mount=review.mountSeed(opts);document.querySelector('#hero').textContent='New host content'});await expect(page.locator('[data-seed-part="message"]')).toHaveCount(1)});
test('restoration preserves a later host important priority',async({page})=>{await setup(page);const priority=await page.evaluate(()=>{window.mount=review.mountSeed(opts);const h=document.querySelector('#hero');h.style.setProperty('color',h.style.color,'important');mount.destroy();return h.style.getPropertyPriority('color')});expect(priority).toBe('important')});
test('a new reduced-motion preference cancels the running effect',async({page})=>{await setup(page);await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>window.mount=review.mountSeed({...opts,motion:'auto'}));await expect(page.locator('[data-seed-overlay]')).toHaveCount(1);await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('[data-seed-overlay]')).toHaveCount(0,{timeout:1000})});
test('Trusted Types rejection fails closed without partial styling',async({page})=>{await setup(page,"require-trusted-types-for 'script'");await page.evaluate(()=>{try{window.mount=review.mountSeed(opts)}catch{}});expect(await page.locator('#hero').getAttribute('style')).toBeNull();await expect(page.locator('[data-seed-part]')).toHaveCount(0)});
test('print hides decorative artwork and restores it afterwards',async({page})=>{await setup(page);await page.evaluate(()=>{window.mount=review.mountSeed(opts);window.dispatchEvent(new Event('beforeprint'))});await expect(page.locator('[data-seed-part="illustration"]')).toBeHidden();await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await expect(page.locator('[data-seed-part="illustration"]')).toBeVisible()});
