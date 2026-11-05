import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {authorExperience} from '../dist/core/authoring.js';
import {approvalSnapshot,selectExperience,validateExperience} from '../dist/core/index.js';
import {draftFile,downloadDraft} from '../examples/playground/export.mjs';
const brand=JSON.parse(readFileSync('examples/playground/brand.json','utf8'));
const {experience}=authorExperience({name:'Winter sale',timeZone:'America/New_York',startDate:'2026-12-01',lastDate:'2026-12-31',preset:'seasonal',message:'Hello',areas:['hero']},brand);
const cli=(...a)=>{const p=spawnSync(process.execPath,['dist/cli/index.js',...a],{encoding:'utf8',timeout:5000});return {status:p.status,result:JSON.parse(p.stdout)};};
const fakeEnv=(click=()=>{})=>{const log=[];const blobs=[];let link;return {log,blobs,get link(){return link;},URL:{createObjectURL(b){blobs.push(b);log.push('create');return 'blob:x';},revokeObjectURL(u){log.push(`revoke ${u}`);}},document:{createElement(){return link={click(){log.push('click');click();}};}},setTimeout:f=>f()};};

test('exported file is exactly the experience and passes the CLI validator',()=>{
  const {filename,json}=draftFile(experience);
  assert.equal(filename,'winter-sale-20261201-america-new-york.draft.json');
  assert.deepEqual(JSON.parse(json),experience);
  const dir=mkdtempSync(join(tmpdir(),'seed-export-'));
  try{
    const file=join(dir,filename);writeFileSync(file,json);
    const validated=cli('validate',file);
    assert.equal(validated.status,0);
    assert.deepEqual(validated.result.value,experience);
    assert.equal(cli('snapshot',file).result.snapshot,approvalSnapshot(experience),'file round-trips to the same exact content');
  }finally{rmSync(dir,{recursive:true});}
});
test('export carries no approval and grants none',()=>{
  const {json}=draftFile(experience);
  assert.deepEqual(Object.keys(JSON.parse(json)).sort(),['areas','endsAt','id','priority','schemaVersion','startsAt','theme']);
  assert.equal(selectExperience([JSON.parse(json)],[],Date.parse('2026-12-15T00:00:00.000Z'),'hero').experience,null);
});
test('invalid or padded objects cannot be exported, so filenames stay safe',()=>{
  for(const bad of [{...experience,id:'../../evil'},{...experience,snapshot:'x'},{...experience,approvals:[]},null])assert.throws(()=>draftFile(bad));
  const env=fakeEnv();
  assert.throws(()=>downloadDraft({...experience,id:'../evil'},env));
  assert.deepEqual(env.log,[],'nothing is created for an invalid draft');
});
test('download saves the named file and releases its object URL, even if the click fails',async()=>{
  const env=fakeEnv();
  downloadDraft(experience,env);
  assert.deepEqual(env.log,['create','click','revoke blob:x']);
  assert.equal(env.link.download,draftFile(experience).filename);
  assert.equal(env.link.href,'blob:x');
  assert.equal(await env.blobs[0].text(),draftFile(experience).json);
  assert.equal(env.blobs[0].type,'application/json');
  const failing=fakeEnv(()=>{throw new Error('blocked');});
  assert.throws(()=>downloadDraft(experience,failing));
  assert.ok(failing.log.includes('revoke blob:x'));
});
test('the copyable example starts with no approvals and never derives them',()=>{
  const dir='examples/existing-project';
  assert.deepEqual(JSON.parse(readFileSync(`${dir}/seed/reviewed-approvals.json`,'utf8')),[]);
  assert.equal(validateExperience(JSON.parse(readFileSync(`${dir}/seed/draft.json`,'utf8'))).ok,true);
  assert.ok(!/approvalSnapshot|snapshot\(/.test(readFileSync(`${dir}/CampaignHero.jsx`,'utf8')));
});
