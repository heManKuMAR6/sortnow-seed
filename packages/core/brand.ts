import {validateExperience, type Experience} from './index.js';
export type ColorToken = 'background' | 'foreground' | 'accent';
export type Palette = Record<ColorToken, string>;
export type Preset = 'seasonal' | 'promotion' | 'launch';
export interface Brand {
  base: Palette;
  palettes: Record<Preset, Palette>;
  allowedAreas: Experience['areas'];
  lockedTokens: ColorToken[];
}
const tokens: ColorToken[]=['background','foreground','accent'];
const presets: Preset[]=['seasonal','promotion','launch'];
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v) && Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k));
const palette=(v:unknown):v is Palette=>object(v)&&exact(v,tokens)&&tokens.every(k=>typeof v[k]==='string'&&/^#[\da-f]{6}$/i.test(v[k] as string));
export function isBrand(value:unknown):value is Brand {
  if(!object(value)||!exact(value,['base','palettes','allowedAreas','lockedTokens'])||!palette(value.base)||!object(value.palettes)||!exact(value.palettes,presets))return false;
  const p=value.palettes;
  return presets.every(k=>palette(p[k])) && Array.isArray(value.allowedAreas)&&value.allowedAreas.length>0&&value.allowedAreas.length<=2&&value.allowedAreas.every(a=>a==='banner'||a==='hero')&&new Set(value.allowedAreas).size===value.allowedAreas.length && Array.isArray(value.lockedTokens)&&value.lockedTokens.length<=3&&value.lockedTokens.every(t=>tokens.includes(t))&&new Set(value.lockedTokens).size===value.lockedTokens.length;
}
/** Brand policy is a veto, never a mutation of an approved experience. */
export function brandAllows(input:unknown,brand:unknown):boolean {
  const result=validateExperience(input);
  if(!result.ok||!isBrand(brand))return false;
  const e=result.value;
  return e.areas.every(a=>brand.allowedAreas.includes(a)) && tokens.every(k=>{
    const value=e.theme[k].toLowerCase();
    if(brand.lockedTokens.includes(k))return value===brand.base[k].toLowerCase();
    return [brand.base,...presets.map(p=>brand.palettes[p])].some(p=>p[k].toLowerCase()===value);
  });
}
/** Authoring helper only: its output still requires explicit review and approval. */
export function createPreset(preset:Preset,brand:Brand,settings:Omit<Experience,'schemaVersion'|'theme'> & {message:string}):Experience {
  if(!presets.includes(preset)||!isBrand(brand))throw new Error('Invalid preset or brand configuration.');
  const {message,...rest}=settings;
  const colors={...brand.palettes[preset]};
  for(const token of brand.lockedTokens)colors[token]=brand.base[token];
  const result=validateExperience({...rest,schemaVersion:1,theme:{...colors,message}});
  if(!result.ok||!brandAllows(result.value,brand))throw new Error('Preset settings violate the experience schema or brand policy.');
  return result.value;
}
