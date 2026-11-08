import {validateAnyExperience} from './v2.js';
/** Configuration is data, never executable code. */
export interface Experience {
  schemaVersion: 1;
  id: string;
  startsAt: string;
  endsAt: string;
  priority: number;
  areas: ("banner" | "hero")[];
  theme: { background: string; foreground: string; accent: string; message: string };
}
export interface Diagnostic { path: string; code: string; message: string }
export type Validation = { ok: true; value: Experience } | { ok: false; errors: Diagnostic[] };
const plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const color = /^#[\da-f]{6}$/i;
// UTC only in v0.1. Calendar/local-time conversion belongs to authoring, not browsers.
export function instant(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return NaN;
  const n = Date.parse(value);
  return Number.isFinite(n) && new Date(n).toISOString() === value ? n : NaN;
}
export function validateExperience(input: unknown): Validation {
  const errors: Diagnostic[] = [];
  const error = (path: string, code: string, message: string) => errors.push({path, code, message});
  const keys = (o: Record<string, unknown>, allowed: string[], prefix: string) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) error(`${prefix}${k}`, 'UNKNOWN_FIELD', 'Unsupported field; executable styles, HTML, and URLs are not allowed.');
  };
  if (!plain(input)) return {ok:false, errors:[{path:'$', code:'OBJECT_REQUIRED', message:'Expected a plain JSON object.'}]};
  keys(input, ['schemaVersion','id','startsAt','endsAt','priority','areas','theme'], '');
  if (input.schemaVersion !== 1) error('schemaVersion','VERSION','Use schemaVersion 1.');
  if (typeof input.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(input.id)) error('id','ID','Use 1–64 lowercase letters, digits, and hyphens, starting with a letter.');
  const start = instant(input.startsAt), end = instant(input.endsAt);
  if (!Number.isFinite(start)) error('startsAt','DATE','Use a real UTC instant: YYYY-MM-DDTHH:mm:ss.sssZ.');
  if (!Number.isFinite(end)) error('endsAt','DATE','Use a real UTC instant: YYYY-MM-DDTHH:mm:ss.sssZ.');
  if (start >= end) error('endsAt','ORDER','End must be after start; end is exclusive.');
  if (!Number.isInteger(input.priority) || Number(input.priority) < 0 || Number(input.priority) > 100) error('priority','RANGE','Use an integer from 0 to 100.');
  if (!Array.isArray(input.areas) || input.areas.length < 1 || input.areas.length > 2 || input.areas.some(x => x !== 'banner' && x !== 'hero') || new Set(input.areas).size !== input.areas.length) error('areas','AREAS','Choose unique banner and/or hero areas.');
  if (!plain(input.theme)) error('theme','OBJECT_REQUIRED','Provide theme settings.');
  else {
    keys(input.theme,['background','foreground','accent','message'],'theme.');
    for (const k of ['background','foreground','accent']) if (typeof input.theme[k] !== 'string' || !color.test(input.theme[k] as string)) error(`theme.${k}`,'COLOR','Use a six-digit hex color.');
    if (typeof input.theme.message !== 'string' || input.theme.message.length < 1 || input.theme.message.length > 240 || /[\u0000-\u001f\u007f]/.test(input.theme.message)) error('theme.message','TEXT','Use 1–240 characters of plain text without control characters.');
  }
  if (errors.length) return {ok:false, errors};
  // Reconstruct rather than merge untrusted input into application objects.
  const t = input.theme as Experience['theme'];
  return {ok:true,value:{schemaVersion:1,id:input.id as string,startsAt:input.startsAt as string,endsAt:input.endsAt as string,priority:input.priority as number,areas:[...input.areas as Experience['areas']],theme:{background:t.background,foreground:t.foreground,accent:t.accent,message:t.message}}};
}
/** A stable exact-content snapshot. Not a signature, identity check, or authorization service. */
export function approvalSnapshot(input: unknown): string {
  const result = validateAnyExperience(input);
  if (!result.ok) throw new Error('Cannot snapshot invalid experience.');
  return JSON.stringify(result.value);
}
export interface Selection { experience: Experience | null; errors: Diagnostic[] }
export function selectExperience(inputs: readonly unknown[], trustedApprovals: readonly string[], now: number, area: 'banner' | 'hero'): Selection {
  const errors: Diagnostic[] = [];
  if (!Number.isFinite(now) || inputs.length > 100 || trustedApprovals.length > 100) return {experience:null,errors:[{path:'$',code:'LIMIT',message:'Provide a finite clock and at most 100 experiences and approvals.'}]};
  const ids = new Set<string>();
  const candidates: Experience[] = [];
  for (let i=0;i<inputs.length;i++) {
    // Schema v2 entries are selected per page by selectPage; they never compete for v1 areas.
    if (plain(inputs[i]) && (inputs[i] as Record<string, unknown>).schemaVersion === 2) continue;
    const result=validateExperience(inputs[i]);
    if (!result.ok) { errors.push(...result.errors.map(e=>({...e,path:`[${i}].${e.path}`}))); continue; }
    const e=result.value;
    if (ids.has(e.id)) return {experience:null,errors:[{path:'id',code:'DUPLICATE',message:'Experience IDs must be unique.'}]};
    ids.add(e.id);
    if (trustedApprovals.includes(approvalSnapshot(e)) && e.areas.includes(area) && instant(e.startsAt)<=now && now<instant(e.endsAt)) candidates.push(e);
  }
  // Fail closed on any malformed configuration rather than partially publish it.
  if(errors.length) return {experience:null,errors};
  candidates.sort((a,b)=> b.priority-a.priority || (a.id<b.id ? -1 : a.id>b.id ? 1 : 0));
  return {experience:candidates[0] ?? null,errors};
}

export {isBrand,validateBrand,brandAllows,createPreset,effectivePalette,paletteAllowed} from './brand.js';
export type {Brand,BrandValidation,Palette,Preset,ColorToken,Slot} from './brand.js';
export {validateExperienceV2,validateAnyExperience,validateBundle,resolvePack,brandAllowsV2,selectPage,SLOTS} from './v2.js';
export type {ExperienceV2,ValidationV2,Bundle,BundleValidation,PageSelection,BannerSlot,HeroSlot,AccentSlot,OverlaySlot} from './v2.js';
export {describePack} from './pack.js';
export type {CompiledPack,PackAsset,AssetKind} from './pack.js';
export {experienceSchema,experienceV2Schema,bundleSchema,brandSchema,eventSchema} from './schema.js';
export {contrastRatio,contrastReport,brandContrastReport} from './contrast.js';
export type {ContrastCheck,ContrastReport,BrandContrastReport} from './contrast.js';
