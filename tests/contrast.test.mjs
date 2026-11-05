import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {contrastRatio,contrastReport,brandContrastReport,validateExperience,approvalSnapshot,selectExperience} from '../dist/core/index.js';
const run=(...args)=>{const p=spawnSync(process.execPath,['dist/cli/index.js',...args],{encoding:'utf8',timeout:3000});assert.ifError(p.error);return {status:p.status,result:JSON.parse(p.stdout)};};
const brand=JSON.parse(readFileSync('examples/playground/brand.json','utf8'));
const lowContrast={schemaVersion:1,id:'pale',startsAt:'2026-12-01T00:00:00.000Z',endsAt:'2027-01-01T00:00:00.000Z',priority:1,areas:['hero'],theme:{background:'#ffffff',foreground:'#777777',accent:'#000000',message:'Pale text'}};
const withFile=(value,fn)=>{const dir=mkdtempSync(join(tmpdir(),'seed-contrast-'));try{const file=join(dir,'input.json');writeFileSync(file,JSON.stringify(value));return fn(file);}finally{rmSync(dir,{recursive:true});}};

test('ratios match WCAG reference values and are symmetric',()=>{
  assert.ok(Math.abs(contrastRatio('#000000','#ffffff')-21)<1e-9);
  assert.equal(contrastRatio('#123456','#123456'),1);
  assert.equal(contrastRatio('#FFFFFF','#000000'),contrastRatio('#000000','#ffffff'));
  assert.ok(contrastRatio('#767676','#ffffff')>=4.5);
  assert.ok(contrastRatio('#777777','#ffffff')<4.5);
  assert.throws(()=>contrastRatio('red','#ffffff'));
});
test('a near miss is never displayed as a pass',()=>{
  const {checks:[fg],meetsMinimums}=contrastReport(lowContrast.theme);
  assert.equal(fg.passes,false);
  assert.equal(meetsMinimums,false);
  assert.ok(fg.ratio<4.5);
  assert.equal(fg.minimum,4.5);
});
test('brand report uses effective colors after locked tokens apply',()=>{
  const locked={...brand,palettes:{...brand.palettes,launch:{background:'#ffffff',foreground:'#ffffff',accent:'#000000'}},lockedTokens:['foreground']};
  const launch=brandContrastReport(locked).palettes.find(p=>p.palette==='launch');
  assert.equal(launch.checks[0].color,brand.base.foreground);
  assert.equal(launch.checks[0].passes,true);
  const unlocked=brandContrastReport({...locked,lockedTokens:[]});
  assert.equal(unlocked.palettes.find(p=>p.palette==='launch').checks[0].passes,false);
  assert.equal(unlocked.meetsMinimums,false);
  assert.deepEqual(brandContrastReport(brand).palettes.map(p=>p.palette),['base','seasonal','promotion','launch']);
});
test('low contrast is advisory: it does not block validation, approval, or selection',()=>{
  assert.equal(validateExperience(lowContrast).ok,true);
  const at=Date.parse('2026-12-15T00:00:00.000Z');
  assert.equal(selectExperience([lowContrast],[approvalSnapshot(lowContrast)],at,'hero').experience.id,'pale');
  withFile(lowContrast,file=>{
    const r=run('contrast',file);
    assert.equal(r.status,0);
    assert.equal(r.result.ok,true);
    assert.equal(r.result.advisory,true);
    assert.equal(r.result.certified,false);
    assert.equal(r.result.meetsMinimums,false);
    assert.ok(r.result.notice.includes('not a certification'));
    assert.equal(run('validate',file).status,0);
  });
});
test('contrast commands reject invalid input instead of reporting on it',()=>{
  withFile({...lowContrast,theme:{...lowContrast.theme,background:'red'}},file=>{
    const r=run('contrast',file);
    assert.equal(r.status,1);
    assert.equal(r.result.errors[0].path,'theme.background');
  });
  const wrongKind=run('contrast-brand','examples/winter.json');
  assert.equal(wrongKind.status,1);
  assert.equal(wrongKind.result.errors[0].code,'BRAND_POLICY');
  const good=run('contrast-brand','examples/playground/brand.json');
  assert.equal(good.status,0);
  assert.equal(good.result.palettes.length,4);
});
