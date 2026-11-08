import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {authorExperience,sampleEvents} from '../dist/core/authoring.js';
import {approvalSnapshot,selectExperience,validateExperience,instant} from '../dist/core/index.js';
const brand=JSON.parse(readFileSync('examples/playground/brand.json','utf8'));
const event=(over={})=>({name:'Winter sale',timeZone:'America/New_York',startDate:'2026-12-01',lastDate:'2026-12-31',preset:'seasonal',message:'Hello',areas:['hero'],...over});
const author=(over)=>{const r=authorExperience(event(over),brand);assert.equal(r.ok,true,JSON.stringify(r.errors));return r;};
const errorAt=(over,path,code)=>{const r=authorExperience(event(over),brand);assert.equal(r.ok,false);assert.ok(r.errors.some(e=>e.path===path&&e.code===code),JSON.stringify(r.errors));};
const hours=r=>(instant(r.experience.endsAt)-instant(r.experience.startsAt))/3600000;

test('local dates convert to canonical UTC with the last day included',()=>{
  const r=author();
  assert.equal(r.experience.startsAt,'2026-12-01T05:00:00.000Z');
  assert.equal(r.experience.endsAt,'2027-01-01T05:00:00.000Z');
  assert.equal(validateExperience(r.experience).ok,true);
  assert.equal(r.approved,false);
  const hero=(t)=>selectExperience([r.experience],[approvalSnapshot(r.experience)],t,'hero').experience;
  assert.ok(hero(Date.parse('2027-01-01T04:59:59.999Z')),'still active at the last local millisecond');
  assert.equal(hero(Date.parse('2027-01-01T05:00:00.000Z')),null,'end is exclusive');
  assert.equal(hero(Date.parse('2026-12-01T04:59:59.999Z')),null);
});
test('DST: day length follows the zone, and skipped or repeated midnights resolve to the first instant',()=>{
  const spring=author({startDate:'2027-03-14',lastDate:'2027-03-14'});
  assert.equal(spring.experience.startsAt,'2027-03-14T05:00:00.000Z');
  assert.equal(spring.experience.endsAt,'2027-03-15T04:00:00.000Z');
  assert.equal(hours(spring),23);
  assert.equal(hours(author({startDate:'2026-11-01',lastDate:'2026-11-01'})),25);
  // Havana changes clocks at midnight: 2027-03-14 00:00 does not exist, and 2026-11-01 00:00 happens twice.
  const gap=author({timeZone:'America/Havana',startDate:'2027-03-14',lastDate:'2027-03-14'});
  assert.equal(gap.experience.startsAt,'2027-03-14T05:00:00.000Z');
  assert.equal(hours(gap),23);
  const overlap=author({timeZone:'America/Havana',startDate:'2026-11-01',lastDate:'2026-11-01'});
  assert.equal(overlap.experience.startsAt,'2026-11-01T04:00:00.000Z');
  assert.equal(hours(overlap),25);
});
test('invalid zones, dates, and fields fail with actionable paths',()=>{
  for(const timeZone of ['Mars/Olympus','+05:30','EST','', 5])errorAt({timeZone},'timeZone','TIME_ZONE');
  for(const startDate of ['2026-02-30','12/01/2026','2026-12-01T00:00:00Z'])errorAt({startDate},'startDate','DATE');
  errorAt({lastDate:'2026-11-30'},'lastDate','DATE_RANGE');
  errorAt({startTime:'09:00'},'startTime','UNKNOWN_FIELD');
  errorAt({preset:'holiday'},'preset','PRESET');
  errorAt({name:' '},'name','EVENT_NAME');
  errorAt({message:''},'message','TEXT');
  errorAt({areas:[]},'areas','AREAS');
  assert.equal(author({startDate:'2026-12-01',lastDate:'2026-12-01'}).ok,true,'one-day event is valid');
});
test('brand restrictions still apply',()=>{
  const r=authorExperience(event({areas:['banner']}),{...brand,allowedAreas:['hero']});
  assert.equal(r.errors[0].code,'BRAND_AREA');
  assert.equal(authorExperience(event(),{}).errors[0].path.startsWith('brand.'),true);
  assert.equal(author({preset:'launch'}).experience.theme.foreground,brand.base.foreground,'locked token kept');
});
test('every authoring edit invalidates the previous approval',()=>{
  const original=author(), at=Date.parse('2026-12-15T00:00:00.000Z');
  const approval=[approvalSnapshot(original.experience)];
  assert.ok(selectExperience([original.experience],approval,at,'hero').experience);
  for(const edit of [{startDate:'2026-12-02'},{lastDate:'2026-12-30'},{timeZone:'America/Chicago'},{preset:'promotion'},{message:'Changed'}])
    assert.equal(selectExperience([author(edit).experience],approval,at,'hero').experience,null,JSON.stringify(edit));
  // These zones share the same instants, so only the id can carry the edit into the snapshot.
  const london=author({timeZone:'Europe/London'}),lisbon=author({timeZone:'Europe/Lisbon'});
  assert.equal(london.experience.startsAt,lisbon.experience.startsAt);
  assert.notEqual(approvalSnapshot(london.experience),approvalSnapshot(lisbon.experience));
});
test('ids stay schema-valid for awkward names and long zones',()=>{
  for(const name of ['2027 launch','日本語','x'.repeat(80),'---'])
    assert.equal(validateExperience(author({name,timeZone:'America/Argentina/ComodRivadavia'}).experience).ok,true,name);
});
test('samples are valid, carry no time zone, and need an owner-chosen one',()=>{
  for(const {key,...sample} of sampleEvents){assert.ok(!('timeZone' in sample),key);assert.equal(authorExperience({...sample,timeZone:'UTC',areas:['hero']},brand).ok,true,key);}
});
test('runtime entry points do not load the time-zone library',()=>{
  for(const dir of ['dist/core','dist/react','dist/render','dist/element'])for(const f of readdirSync(dir).filter(f=>f.endsWith('.js')&&!['authoring.js','occasions.js'].includes(f)))
    assert.ok(!readFileSync(join(dir,f),'utf8').includes('temporal-polyfill'),`${dir}/${f}`);
});
test('CLI authors a draft only and offers no approval path',()=>{
  const run=(...a)=>{const p=spawnSync(process.execPath,['dist/cli/index.js',...a],{encoding:'utf8',timeout:5000});return {status:p.status,result:JSON.parse(p.stdout)};};
  const dir=mkdtempSync(join(tmpdir(),'seed-author-'));
  try{
    const file=join(dir,'event.json');writeFileSync(file,JSON.stringify(event()));
    const ok=run('author',file,'examples/playground/brand.json');
    assert.equal(ok.status,0);assert.equal(ok.result.draft,true);assert.equal(ok.result.approved,false);assert.ok(!('snapshot' in ok.result));
    assert.deepEqual(ok.result.experience,author().experience);
    writeFileSync(file,JSON.stringify(event({timeZone:'Mars/Olympus'})));
    const bad=run('author',file,'examples/playground/brand.json');
    assert.equal(bad.status,1);assert.equal(bad.result.errors[0].path,'timeZone');
    assert.equal(run('author',file).result.errors[0].code,'USAGE');
    assert.equal(run('samples').result.events.length,sampleEvents.length);
    assert.ok(run('samples').result.notice.includes('not a holiday database'));
    assert.deepEqual(run('schema','event').result.required.sort(),['areas','lastDate','message','name','preset','startDate','timeZone']);
    const commands=run('help').result.commands.map(c=>c.command).join(' ');
    assert.ok(commands.includes('author')&&!/approve|publish/.test(commands));
  }finally{rmSync(dir,{recursive:true});}
});
