#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {validateExperience,approvalSnapshot,instant,selectExperience,validateBrand,experienceSchema,brandSchema,eventSchema,contrastReport,brandContrastReport} from '../core/index.js';
const [command,file,...args]=process.argv.slice(2);
class InputError extends Error {
  constructor(public code:string,message:string,public path='$',public hint='Run seed help for supported commands.') { super(message); }
}
const contrastNotice='Advisory only: not a certification and not an approval gate. Ratios cover color pairs, not how the host maps tokens onto elements. Accent is held to the text minimum; 3:1 applies if it is used only for non-text.';
const brandHint='Compare with seed schema brand: required palettes, unique allowed areas, locked tokens, and six-digit hex colors.';
const help={
  ok:true,protocolVersion:1,readOnly:true,
  commands:[
    {command:'help',description:'Discover commands, limits, and trust boundaries.'},
    {command:'schema experience|brand|event',description:'Print raw JSON Schema for editor or agent use.'},
    {command:'validate FILE',description:'Validate one experience, including real dates and schedule order.'},
    {command:'validate-brand FILE',description:'Validate a brand policy; does not approve any experiences.'},
    {command:'snapshot FILE',description:'Create exact-content review material. Does not grant approval.'},
    {command:'inspect FILE UTC_INSTANT',description:'Preview schedule eligibility without approving or publishing.'},
    {command:'author EVENT_FILE BRAND_FILE',description:'Compile an event, IANA time zone, and date range into a draft experience. The last day is included. Does not approve or publish.'},
    {command:'samples',description:'List illustrative sample events. Not a holiday database; the owner still chooses the time zone.'},
    {command:'contrast FILE',description:'Advisory WCAG contrast ratios for one experience. Exit 0 even when a pair misses its minimum; read meetsMinimums.'},
    {command:'contrast-brand FILE',description:'Advisory contrast for the base and each preset palette after locked tokens apply.'},
  ],
  limits:{fileBytes:65536,experiences:100,approvals:100},
  exitCodes:{success:0,invalidInput:1},
  authorization:'All commands are read-only. Store snapshots in trusted configuration only after owner review. No publish or approve command exists.',
};
async function readJson(path: string) {
  // Nonblocking open prevents FIFOs from hanging before the regular-file check on POSIX.
  const handle=await open(path,constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat=await handle.stat();
    if(!stat.isFile())throw new InputError('FILE_TYPE','Input must be a regular JSON file.',path,'Pass a regular file, not a directory, device, or pipe.');
    if(stat.size>65536)throw new InputError('FILE_SIZE','Input exceeds 64 KiB.',path,'Reduce the JSON file to at most 65536 bytes.');
    const buffer=Buffer.alloc(65537);
    let total=0;
    while(total<buffer.length) { const {bytesRead}=await handle.read(buffer,total,buffer.length-total,null); if(!bytesRead)break; total+=bytesRead; }
    if(total>65536)throw new InputError('FILE_SIZE','Input exceeds 64 KiB.',path,'Reduce the JSON file to at most 65536 bytes.');
    try {return JSON.parse(buffer.subarray(0,total).toString('utf8'));}
    catch {throw new InputError('JSON_SYNTAX','Input is not valid JSON.',path,'Use strict JSON: double-quoted keys, no comments or trailing commas.');}
  } finally {await handle.close();}
}
async function main() {
  if(command==='help' && !file && args.length===0){console.log(JSON.stringify(help));return;}
  const schemas={experience:experienceSchema,brand:brandSchema,event:eventSchema};
  if(command==='schema' && args.length===0 && (file==='experience'||file==='brand'||file==='event')){console.log(JSON.stringify(schemas[file]));return;}
  if(command==='samples' && !file && args.length===0){
    // Loaded on demand so other commands never touch the time-zone library.
    const {sampleEvents,SAMPLE_NOTICE,END_SEMANTICS}=await import('../core/authoring.js');
    console.log(JSON.stringify({ok:true,events:sampleEvents,notice:SAMPLE_NOTICE,endSemantics:END_SEMANTICS}));return;
  }
  if(!file || !['validate','validate-brand','snapshot','inspect','author','contrast','contrast-brand'].includes(command) || (command==='inspect'||command==='author' ? args.length!==1 : args.length!==0)) throw new InputError('USAGE','Unsupported command or arguments.');
  const input=await readJson(file);
  if(command==='author'){
    const {authorExperience,END_SEMANTICS}=await import('../core/authoring.js');
    const authored=authorExperience(input,await readJson(args[0]));
    if(authored.ok)console.log(JSON.stringify({...authored,endSemantics:END_SEMANTICS,notice:'Draft only. Preview it, then store its snapshot in trusted configuration only after owner review.'}));
    else {console.log(JSON.stringify(authored));process.exitCode=1;}
    return;
  }
  if(command==='validate-brand'||command==='contrast-brand'){
    const brand=validateBrand(input);
    if(!brand.ok){console.log(JSON.stringify({ok:false,errors:brand.errors.map(e=>({...e,hint:brandHint}))}));process.exitCode=1;}
    else if(command==='validate-brand')console.log(JSON.stringify(brand));
    else console.log(JSON.stringify({ok:true,advisory:true,certified:false,...brandContrastReport(brand.value),notice:contrastNotice}));
    return;
  }
  const result=validateExperience(input);
  if(!result.ok) { console.log(JSON.stringify(result)); process.exitCode=1; }
  else if(command==='snapshot') console.log(JSON.stringify({ok:true,snapshot:approvalSnapshot(input),notice:'Store only after owner review in trusted configuration.'}));
  else if(command==='contrast') console.log(JSON.stringify({ok:true,advisory:true,certified:false,...contrastReport(result.value.theme),notice:contrastNotice}));
  else if(command==='inspect') {
    const now=instant(args[0]);
    if(!Number.isFinite(now))throw new InputError('DATE','Invalid preview time.','time','Use a real UTC instant: YYYY-MM-DDTHH:mm:ss.sssZ.');
    console.log(JSON.stringify({ok:true,preview:true,approved:false,scheduledAtTime:!!selectExperience([input],[approvalSnapshot(input)],now,result.value.areas[0]).experience,experience:result.value}));
  } else console.log(JSON.stringify(result));
}
try {await main();}
catch(error) {
  const e=error as NodeJS.ErrnoException;
  const diagnostic=error instanceof InputError ? {code:error.code,path:error.path,message:error.message,hint:error.hint} : {
    code:e.code==='ENOENT'?'FILE_NOT_FOUND':e.code==='EACCES'||e.code==='EPERM'?'FILE_ACCESS':'INPUT',
    path:file??'$',message:e.code==='ENOENT'?'Input file was not found.':'Unable to read input file.',hint:'Check the file path and your existing read permissions.',
  };
  console.log(JSON.stringify({ok:false,errors:[diagnostic]}));process.exitCode=1;
}
