import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {draftWithAI,describeProviderError} from '../dist/ai/index.js';
const brand=JSON.parse(readFileSync('examples/storefront/brand.json','utf8'));
const request={description:'Ceramics',name:'Christmas',timeZone:'UTC',startDate:'2026-12-01',lastDate:'2026-12-25',areas:['hero'],pack:'christmas'};
const good={pack:'christmas',preset:'seasonal',message:'Hello',illustration:'tree',icon:'gift',decoration:'holly-corner',effect:'none',signatureColors:false,rationale:'A seasonal tree.'};
const clientFor=proposal=>{let calls=0;return {get calls(){return calls},beta:{messages:{create:async()=>{calls++;return {model:'fake',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(proposal)}]}}}}}};
test('invalid event input never incurs a model call',async()=>{
 for(const edit of [{timeZone:'Not/AZone'},{areas:null},{startDate:'2026-02-30'}]){
  const client=clientFor(good);const result=await draftWithAI({...request,...edit},brand,{client});
  assert.equal(result.ok,false);assert.equal(client.calls,0);
 }
});
test('local validation enforces requested pack and complete proposal schema',async()=>{
 for(const proposal of [{...good,pack:'none'},{...good,extra:'unknown'},{...good,rationale:'\u001b[31m'},{pack:'none',preset:'seasonal',message:'Hello'}]){
  const result=await draftWithAI(request,brand,{client:clientFor(proposal)});assert.equal(result.ok,false,JSON.stringify(proposal));
 }
});
test('provider error detail is never reflected to the caller',()=>{
 const result=describeProviderError({status:401,error:{error:{message:'Authorization: Bearer TEST_ONLY_SENTINEL'}}});
 assert.ok(!result.includes('TEST_ONLY_SENTINEL'));
});
