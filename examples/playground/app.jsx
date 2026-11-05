import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SeedArea} from '../../dist/react/index.js';
import {approvalSnapshot} from '../../dist/core/index.js';
import {authorExperience,sampleEvents,SAMPLE_NOTICE,END_SEMANTICS} from '../../dist/core/authoring.js';
import brand from './brand.json';
const descriptions={seasonal:'A little warmth for the winter season.',promotion:'A week of thoughtful finds. Explore our featured collection.',launch:'Introducing the studio collection. Made for everyday rituals.'};
const zones=(()=>{try{return ['UTC',...Intl.supportedValuesOf('timeZone')];}catch{return ['UTC'];}})();
// The same existing component is reused for every experience. It only consumes optional CSS tokens.
function ExistingHero(){return <div className="hero"><p>THOUGHTFULLY MADE</p><h2>Make room<br/>for the everyday.</h2><p>Good objects. Quiet details. A place to feel at home.</p><a href="#collection">Explore the collection ↗</a></div>;}
function Site({experiences,approvals,at,label}){return <section className="preview" aria-label={label}><nav><strong>FIELDNOTES</strong><span>Objects for everyday living</span></nav><SeedArea experiences={experiences} approvals={approvals} area="banner" brand={brand} previewAt={at}/><SeedArea experiences={experiences} approvals={approvals} area="hero" brand={brand} mode="variables" previewAt={at}><ExistingHero/></SeedArea><div className="site-note">Logo, typography, and navigation stay the same.</div></section>;}
function App(){
 const first=sampleEvents[0];
 const [approvals,setApprovals]=useState([]),[date,setDate]=useState('2026-12-15'),[view,setView]=useState('draft');
 const [eventKey,setEventKey]=useState(first.key),[name,setName]=useState(first.name),[timeZone,setTimeZone]=useState('UTC'),[startDate,setStartDate]=useState(first.startDate),[lastDate,setLastDate]=useState(first.lastDate);
 const [preset,setPreset]=useState(first.preset),[message,setMessage]=useState(first.message),[areas,setAreas]=useState(brand.allowedAreas);
 const custom=setter=>value=>{setEventKey('custom');setter(value);};
 const chooseEvent=key=>{setEventKey(key);const sample=sampleEvents.find(e=>e.key===key);if(!sample)return;setName(sample.name);setStartDate(sample.startDate);setLastDate(sample.lastDate);setPreset(sample.preset);setMessage(sample.message);setDate(sample.startDate);};
 const toggleArea=area=>setAreas(areas.includes(area)?areas.filter(a=>a!==area):brand.allowedAreas.filter(a=>a===area||areas.includes(a)));
 const result=authorExperience({name,timeZone,startDate,lastDate,preset,message,areas},brand);
 const experiences=result.ok?[result.experience]:[];
 const snapshot=result.ok?approvalSnapshot(result.experience):null, approved=snapshot!==null&&approvals.includes(snapshot),at=Date.parse(date+'T12:00:00.000Z');
 // Draft preview uses an ephemeral snapshot only in this isolated pane. Stored approvals remain unchanged.
 const displayed=view==='draft'&&snapshot?[snapshot]:view==='draft'?[]:approvals;
 const status=!result.ok?'No draft yet. Fix the problems above before approving.':approved?'This version is approved in this demo.':'This version is a draft. Edits require approval.';
 return <><header><strong>SortNow / SEED</strong><span>BRAND EXPERIENCE STUDIO · ALPHA</span></header><main className="studio"><aside><p className="eyebrow">ONE BRAND. MANY MOMENTS.</p><h1>Change the moment.<br/>Keep the identity.</h1><p>Plan an event, compare the draft with the existing page, then approve its exact content.</p>
 <label>Event<select value={eventKey} onChange={e=>chooseEvent(e.target.value)}>{sampleEvents.map(e=><option key={e.key} value={e.key}>{e.name} (sample)</option>)}<option value="custom">Custom event</option></select></label><small>{SAMPLE_NOTICE}</small>
 <label>Event name<input value={name} maxLength={80} onChange={e=>custom(setName)(e.target.value)}/></label>
 <label>Time zone<input list="seed-time-zones" value={timeZone} spellCheck={false} onChange={e=>setTimeZone(e.target.value)}/><datalist id="seed-time-zones">{zones.map(z=><option key={z} value={z}/>)}</datalist></label><small>You choose this. SEED never infers it from the server or the visitor.</small>
 <label>First day<input type="date" value={startDate} onChange={e=>custom(setStartDate)(e.target.value)}/></label>
 <label>Last day (included)<input type="date" value={lastDate} onChange={e=>custom(setLastDate)(e.target.value)}/></label><small>{END_SEMANTICS}</small>
 <label>Experience<select value={preset} onChange={e=>{custom(setPreset)(e.target.value);setMessage(descriptions[e.target.value]);}}><option value="seasonal">Seasonal · Winter warmth</option><option value="promotion">Promotion · Featured finds</option><option value="launch">Product launch · Studio collection</option></select></label>
 <label>Message<input value={message} maxLength={240} onChange={e=>setMessage(e.target.value.replace(/[\u0000-\u001f\u007f]/g,''))}/></label>
 <fieldset className="areas"><legend>Areas this brand permits</legend>{brand.allowedAreas.map(a=><label key={a}><input type="checkbox" checked={areas.includes(a)} onChange={()=>toggleArea(a)}/>{a==='hero'?'Hero':'Banner'}</label>)}</fieldset>
 {result.ok?<dl className="schedule"><dt>Starts (UTC)</dt><dd>{result.schedule.startsAt}</dd><dt>Ends before (UTC)</dt><dd>{result.schedule.endsAt}</dd></dl>:<ul className="problems" role="alert">{result.errors.map(e=><li key={e.path+e.code}><strong>{e.path}:</strong> {e.message}</li>)}</ul>}
 <label>Preview date (checked at 12:00 UTC)<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label>Right-hand preview<select value={view} onChange={e=>setView(e.target.value)}><option value="draft">Proposed draft — not published</option><option value="approved">Approved schedule</option></select></label><button disabled={!snapshot} onClick={()=>{setApprovals([snapshot]);setView('approved');}}>Approve this exact version</button><button className="secondary" onClick={()=>setApprovals([])}>Revoke approval</button><p role="status">{status}</p><small>Brand rules lock text color and restrict changes to the hero and banner. Approvals are session-only. Production permissions belong to the host.</small></aside><div className="comparison"><div><h3>Before · Original website</h3><Site experiences={experiences} approvals={[]} at={at} label="Original website"/></div><div><h3>{view==='draft'?'After · Isolated proposal':'After · Approved schedule'}</h3><Site experiences={experiences} approvals={displayed} at={at} label="Experience preview"/></div><p className="comparison-note">Outside the scheduled dates, both views restore the original design. Previewing a draft never saves approval.</p></div></main><section id="collection" className="collection-note">FIELDNOTES / A fictional storefront demonstrating integration. No checkout or live promotions.</section><footer>SEED — Scheduled Experiences & Extensible Design. No tracking. No external assets.</footer></>;
}
createRoot(document.getElementById('root')).render(<App/>);
