#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {validateExperience,approvalSnapshot,instant,selectExperience} from '../core/index.js';
const [command,file,...args]=process.argv.slice(2);
async function readJson(path: string) {
  const handle=await open(path,'r');
  try {
    const stat=await handle.stat();
    if(!stat.isFile() || stat.size>65536) throw new Error('Input must be a regular JSON file of at most 64 KiB.');
    const buffer=Buffer.alloc(65537);
    let total=0;
    while(total<buffer.length) { const {bytesRead}=await handle.read(buffer,total,buffer.length-total,null); if(!bytesRead)break; total+=bytesRead; }
    if(total>65536)throw new Error('Input exceeds 64 KiB.');
    return JSON.parse(buffer.subarray(0,total).toString('utf8'));
  } finally {await handle.close();}
}
try {
  if(!file || !['validate','snapshot','inspect'].includes(command) || (command==='inspect' ? args.length!==1 : args.length!==0)) throw new Error('Usage: seed validate FILE | seed snapshot FILE | seed inspect FILE UTC_INSTANT. snapshot is a review artifact, not an authorization command.');
  const input=await readJson(file), result=validateExperience(input);
  if(!result.ok) { console.log(JSON.stringify(result)); process.exitCode=1; }
  else if(command==='snapshot') console.log(JSON.stringify({ok:true,snapshot:approvalSnapshot(input),notice:'Store only after owner review in trusted configuration.'}));
  else if(command==='inspect') {
    const now=instant(args[0]);
    if(!Number.isFinite(now))throw new Error('Use a valid UTC instant: YYYY-MM-DDTHH:mm:ss.sssZ.');
    console.log(JSON.stringify({ok:true,preview:true,approved:false,scheduledAtTime:!!selectExperience([input],[approvalSnapshot(input)],now,result.value.areas[0]).experience,experience:result.value}));
  } else console.log(JSON.stringify(result));
} catch(error) {console.log(JSON.stringify({ok:false,errors:[{code:'INPUT',message:error instanceof Error ? error.message : 'Invalid input'}]}));process.exitCode=1;}
