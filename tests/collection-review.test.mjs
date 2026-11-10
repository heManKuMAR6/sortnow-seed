import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {approvalSnapshot,selectPage,selectExperience} from '../dist/core/index.js';
import {packs} from '../dist/packs/index.js';
const brand=JSON.parse(readFileSync('examples/storefront/brand.json','utf8'));
const e=JSON.parse(readFileSync('examples/storefront/seed.bundle.json','utf8')).experiences.find(e=>e.pack.id==='christmas');
const v1={schemaVersion:1,id:'other',startsAt:e.startsAt,endsAt:e.endsAt,priority:10,areas:['hero'],theme:{...brand.base,message:'Hi'}};
const at=Date.parse('2026-12-12T12:00:00Z');
test('v2 selection rejects invalid entries of any version',()=>{
 for(const bad of [null,{}, {schemaVersion:99}, {...v1,theme:{}}]) assert.equal(selectPage([e,bad],[approvalSnapshot(e)],at,{packs,brand}).experience,null);
});
test('v1 selection rejects invalid v2 entries',()=>{
 assert.equal(selectExperience([v1,{schemaVersion:2}],[approvalSnapshot(v1)],at,'hero').experience,null);
});
test('duplicate IDs are rejected across versions by both selectors',()=>{
 const other={...v1,id:e.id}; const approvals=[approvalSnapshot(e),approvalSnapshot(other)];
 assert.equal(selectPage([e,other],approvals,at,{packs,brand}).experience,null);
 assert.equal(selectExperience([e,other],approvals,at,'hero').experience,null);
});
