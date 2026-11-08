import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SeedArea} from '../../dist/react/index.js';
import {approvalSnapshot} from '../../dist/core/index.js';
import {authorExperience,sampleEvents,SAMPLE_NOTICE,END_SEMANTICS} from '../../dist/core/authoring.js';
import {mountSeed} from '../../dist/render/index.js';
import {packs} from '../../dist/packs/index.js';
import {downloadDraft} from './export.mjs';
import brand from './brand.json';
const descriptions={seasonal:'A little warmth for the winter season.',promotion:'A week of thoughtful finds. Explore our featured collection.',launch:'Introducing the studio collection. Made for everyday rituals.'};
const zones=(()=>{try{return ['UTC',...Intl.supportedValuesOf('timeZone')];}catch{return ['UTC'];}})();
// The same existing component is reused for every experience. It only consumes optional CSS tokens.
function ExistingHero({slot}){return <div className="hero" {...slot}><p>THOUGHTFULLY MADE</p><h2>Make room<br/>for the everyday.</h2><p>Good objects. Quiet details. A place to feel at home.</p><a href="#collection">Explore the collection ↗</a></div>;}
function Site({experiences,approvals,at,label}){return <section className="preview" aria-label={label}><nav><strong>FIELDNOTES</strong><span>Objects for everyday living</span></nav><SeedArea experiences={experiences} approvals={approvals} area="banner" brand={brand} previewAt={at}/><SeedArea experiences={experiences} approvals={approvals} area="hero" brand={brand} mode="variables" previewAt={at}><ExistingHero/></SeedArea><div className="site-note">Logo, typography, and navigation stay the same.</div></section>;}
// Pack themes render through the framework-neutral renderer. The host only marks which slots SEED may use.
const heroSlot={'data-seed-slot':'hero accent','data-seed-mode':'variables'};
function PackSite({experiences,approvals,at,label,replay}){
 const ref=useRef(null),seed=useRef(null);
 useEffect(()=>{seed.current=mountSeed({root:ref.current,experiences,approvals,packs,brand,now:at});return ()=>{seed.current.destroy();seed.current=null;};},[]);
 useEffect(()=>{seed.current?.update({experiences,approvals,now:at});},[experiences,approvals,at]);
 useEffect(()=>{if(replay)seed.current?.replay();},[replay]);
 return <section ref={ref} className="preview" aria-label={label}><nav><strong>FIELDNOTES</strong><span>Objects for everyday living</span></nav><div data-seed-slot="banner"/><ExistingHero slot={heroSlot}/><div className="site-note">Logo, typography, and navigation stay the same.</div></section>;
}
const assetOptions=record=>Object.entries(record).map(([id,a])=>({id,label:a.label??id.replace(/-/g,' ')}));
function App(){
 const first=sampleEvents[0];
 const [approvals,setApprovals]=useState([]),[date,setDate]=useState('2026-12-15'),[view,setView]=useState('draft');
 const [eventKey,setEventKey]=useState(first.key),[name,setName]=useState(first.name),[timeZone,setTimeZone]=useState('UTC'),[startDate,setStartDate]=useState(first.startDate),[lastDate,setLastDate]=useState(first.lastDate);
 const [preset,setPreset]=useState(first.preset),[message,setMessage]=useState(first.message),[areas,setAreas]=useState(brand.allowedAreas);
 const [pack,setPack]=useState(''),[choices,setChoices]=useState({}),[replay,setReplay]=useState(0);
 const custom=setter=>value=>{setEventKey('custom');setter(value);};
 const choosePack=id=>{setPack(id);setChoices({});};
 const choose=(field,value)=>setChoices({...choices,[field]:value});
 const chooseEvent=key=>{setEventKey(key);const sample=sampleEvents.find(e=>e.key===key);if(!sample)return;setName(sample.name);setStartDate(sample.startDate);setLastDate(sample.lastDate);setPreset(sample.preset);setMessage(sample.message);setDate(sample.startDate);choosePack(sample.pack??'');};
 const toggleArea=area=>setAreas(areas.includes(area)?areas.filter(a=>a!==area):brand.allowedAreas.filter(a=>a===area||areas.includes(a)));
 const result=authorExperience({name,timeZone,startDate,lastDate,preset,message,areas,...(pack?{pack,...choices}:{})},brand);
 const packInfo=packs.find(p=>p.id===pack), slots=result.ok&&result.experience.schemaVersion===2?result.experience.slots:{};
 const current={illustration:slots.hero?.illustration??'none',icon:slots.banner?.icon??'none',decoration:slots.accent?.decoration??'none',effect:slots.overlay?.effect??'none',signatureColors:result.ok&&result.experience.schemaVersion===2?result.experience.signatureColors.length>0:false};
 const SitePreview=pack?PackSite:Site;
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
 <label>Theme pack<select value={pack} onChange={e=>choosePack(e.target.value)}><option value="">None · colours only</option>{packs.map(p=><option key={p.id} value={p.id}>{p.name} · artwork and effect</option>)}</select></label><small>Packs add brand-tinted artwork and one optional effect. Logos and layout are never changed.</small>
 {packInfo&&<fieldset className="design"><legend>Design from the {packInfo.name} pack</legend>
  <label>Hero illustration<select value={choices.illustration??current.illustration} onChange={e=>choose('illustration',e.target.value)}>{assetOptions(packInfo.illustrations).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}<option value="none">None</option></select></label>
  <label>Banner icon<select value={choices.icon??current.icon} onChange={e=>choose('icon',e.target.value)}>{assetOptions(packInfo.icons).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}<option value="none">None</option></select></label>
  <label>Corner decoration<select value={choices.decoration??current.decoration} onChange={e=>choose('decoration',e.target.value)}>{assetOptions(packInfo.decorations).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}<option value="none">None</option></select></label>
  <label>Effect<select value={choices.effect??current.effect} onChange={e=>choose('effect',e.target.value)}>{packInfo.effects.flyby&&<option value="flyby">Fly-by ({packInfo.effects.flyby.assets[0].replace(/-/g,' ')})</option>}{packInfo.effects.particles&&<option value="particles">Falling {packInfo.effects.particles.assets[0]}</option>}<option value="none">None</option></select></label><small>Effects play once per visit on large screens and never for visitors who prefer reduced motion.</small>
  <label className="inline"><input type="checkbox" checked={choices.signatureColors??current.signatureColors} onChange={e=>choose('signatureColors',e.target.checked)}/>Use the pack's signature colours</label>
 </fieldset>}
 <label>Message<input value={message} maxLength={240} onChange={e=>setMessage(e.target.value.replace(/[\u0000-\u001f\u007f]/g,''))}/></label>
 <fieldset className="areas"><legend>Areas this brand permits</legend>{brand.allowedAreas.map(a=><label key={a}><input type="checkbox" checked={areas.includes(a)} onChange={()=>toggleArea(a)}/>{a==='hero'?'Hero':'Banner'}</label>)}</fieldset>
 {result.ok?<dl className="schedule"><dt>Starts (UTC)</dt><dd>{result.schedule.startsAt}</dd><dt>Ends before (UTC)</dt><dd>{result.schedule.endsAt}</dd></dl>:<ul className="problems" role="alert">{result.errors.map(e=><li key={e.path+e.code}><strong>{e.path}:</strong> {e.message}</li>)}</ul>}
 <label>Preview date (checked at 12:00 UTC)<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label>Right-hand preview<select value={view} onChange={e=>setView(e.target.value)}><option value="draft">Proposed draft — not published</option><option value="approved">Approved schedule</option></select></label><button className="secondary" disabled={!result.ok} onClick={()=>downloadDraft(result.experience)}>{pack?'Download draft bundle':'Download draft JSON'}</button>{slots.overlay&&<button className="secondary" onClick={()=>setReplay(replay+1)}>Replay effect</button>}<small>Saves a file to your computer. Downloading does not approve or publish this draft.</small><button disabled={!snapshot} onClick={()=>{setApprovals([snapshot]);setView('approved');}}>Approve this exact version</button><button className="secondary" onClick={()=>setApprovals([])}>Revoke approval</button><p role="status">{status}</p><small>Brand rules lock text color and restrict changes to the hero and banner. Approvals are session-only. Production permissions belong to the host.</small></aside><div className="comparison"><div><h3>Before · Original website</h3><SitePreview experiences={experiences} approvals={[]} at={at} label="Original website"/></div><div><h3>{view==='draft'?'After · Isolated proposal':'After · Approved schedule'}</h3><SitePreview experiences={experiences} approvals={displayed} at={at} label="Experience preview" replay={replay}/></div><p className="comparison-note">Outside the scheduled dates, both views restore the original design. Previewing a draft never saves approval.</p></div></main><section id="collection" className="collection-note">FIELDNOTES / A fictional storefront demonstrating integration. No checkout or live promotions.</section><footer>SEED — Scheduled Experiences & Extensible Design. No tracking. No external assets.</footer></>;
}
createRoot(document.getElementById('root')).render(<App/>);
