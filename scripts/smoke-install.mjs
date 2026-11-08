/**
 * "Works for a stranger": packs the package, installs the tarball into a brand-new project outside this
 * repository, and uses every public entry point from there, including types and the CLI. Run after a build.
 */
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const repo = resolve('.');
const work = mkdtempSync(join(tmpdir(), 'seed-stranger-'));
const run = (cmd, args, cwd = work) => execFileSync(cmd, args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const step = (name, fn) => { fn(); console.log(`ok  ${name}`); };
try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work], repo))[0].filename;
  step('tarball contains only dist and docs', () => {
    const files = JSON.parse(run('npm', ['pack', '--dry-run', '--json'], repo))[0].files.map(f => f.path);
    const stray = files.filter(f => !/^(dist\/|README\.md$|LICENSE$|SECURITY\.md$|CHANGELOG\.md$|package\.json$)/.test(f));
    if (stray.length) throw new Error(`unexpected files: ${stray.join(', ')}`);
  });
  writeFileSync(join(work, 'package.json'), JSON.stringify({name: 'stranger-app', private: true, type: 'module'}));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(work, packed), 'react@19.3.1', 'react-dom@19.3.1']);

  writeFileSync(join(work, 'use.mjs'), `
import {validateBundle, selectPage, approvalSnapshot, validateBrand} from '@sortnow/seed';
import {authorExperience, upcomingOccasions, importBrand, planExperiences} from '@sortnow/seed/authoring';
import {packs} from '@sortnow/seed/packs';
import {mountSeed} from '@sortnow/seed/render';
import {sameOriginUrl} from '@sortnow/seed/element';
import {draftWithAI, proposalSchema} from '@sortnow/seed/ai';
import {SeedRoot, SeedArea} from '@sortnow/seed/react';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {existsSync} from 'node:fs';
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
const brand = importBrand(':root{--surface:#fffaf3;--text:#2b2622;--primary:#8a4b2a}').brand;
assert(validateBrand(brand).ok, 'brand import');
const b = {...brand, effects: 'on', signatureColors: 'allow'};
const r = authorExperience({name: 'Christmas', timeZone: 'America/New_York', startDate: '2026-12-01', lastDate: '2026-12-25', preset: 'seasonal', message: 'Happy holidays', areas: ['banner', 'hero'], pack: 'christmas'}, b);
assert(r.ok && r.experience.schemaVersion === 2, 'pack authoring');
assert(validateBundle({bundleVersion: 1, experiences: [r.experience]}).ok, 'bundle');
assert(selectPage([r.experience], [approvalSnapshot(r.experience)], Date.parse('2026-12-10T12:00:00Z'), {packs, brand: b}).experience, 'approved selection');
assert(selectPage([r.experience], [], Date.parse('2026-12-10T12:00:00Z'), {packs, brand: b}).experience === null, 'drafts stay off');
assert(upcomingOccasions({markets: ['IN'], from: '2026-11-08'}).ok, 'occasions');
assert(planExperiences({markets: ['US'], from: '2026-11-08', timeZone: 'UTC', areas: ['hero'], occasions: ['christmas-2026']}, b).ok, 'plan');
assert(packs.length >= 9 && typeof mountSeed === 'function' && sameOriginUrl('/x', 'https://a.test/') === 'https://a.test/x', 'packs, render, element');
assert(typeof draftWithAI === 'function' && proposalSchema(packs).properties.pack.enum.includes('christmas'), 'ai entry loads without the optional SDK');
assert(renderToStaticMarkup(createElement(SeedRoot, {experiences: [r.experience], approvals: [], packs, brand: b})) === '', 'React SeedRoot SSR');
assert(typeof SeedArea === 'function', 'React SeedArea');
assert(existsSync('node_modules/@sortnow/seed/dist/seed-element.js'), 'single-file script shipped');
console.log('runtime checks passed');
`);
  step('every entry point works from a fresh project', () => run(process.execPath, ['use.mjs']));

  writeFileSync(join(work, 'types.ts'), `
import {type ExperienceV2, type Brand, selectPage} from '@sortnow/seed';
import {authorExperience, type PlanInput} from '@sortnow/seed/authoring';
import {packs} from '@sortnow/seed/packs';
import {mountSeed, type SeedMount} from '@sortnow/seed/render';
import type {AIDraftRequest} from '@sortnow/seed/ai';
const plan: PlanInput = {markets: ['US'], from: '2026-11-08', timeZone: 'UTC', areas: ['hero'], occasions: ['christmas-2026']};
const req: AIDraftRequest = {description: 'x', name: 'n', timeZone: 'UTC', startDate: '2026-12-01', lastDate: '2026-12-02', areas: ['hero']};
export const use = (b: Brand, e: ExperienceV2): [unknown, unknown, typeof mountSeed, SeedMount | null] => [selectPage([e], [], 0, {packs, brand: b}), authorExperience(plan, b), mountSeed, null];
export {req};
`);
  writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({compilerOptions: {module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', strict: true, noEmit: true, skipLibCheck: false, lib: ['ES2022', 'DOM'], types: []}, files: ['types.ts']}));
  step('TypeScript types resolve for consumers', () => run(join(repo, 'node_modules/.bin/tsc'), ['-p', work]));

  step('CLI runs via npx', () => {
    const help = JSON.parse(run('npx', ['--no-install', 'seed', 'help']));
    if (!help.commands.some(c => c.command.startsWith('ai-draft'))) throw new Error('help');
    const occ = JSON.parse(run('npx', ['--no-install', 'seed', 'occasions', 'AE', '2026-11-08', '40']));
    if (!occ.ok || !occ.occasions.some(o => o.id === 'national-day-ae-2026')) throw new Error('occasions');
  });
  console.log(`stranger install passed (${readdirSync(work).length} files in a fresh project)`);
} catch (error) {
  console.error(error.stderr || error.stdout || error.message);
  process.exitCode = 1;
} finally {
  if (existsSync(work)) rmSync(work, {recursive: true, force: true});
}
