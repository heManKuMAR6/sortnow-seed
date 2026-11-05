import {validateExperience, type Diagnostic, type Experience} from './index.js';
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
export type BrandValidation={ok:true;value:Brand}|{ok:false;errors:Diagnostic[]};
/** Reports every violation by path and returns a fresh object. Validates policy; approves nothing. */
export function validateBrand(value:unknown):BrandValidation {
  const errors:Diagnostic[]=[];
  const error=(path:string,message:string)=>errors.push({path,code:'BRAND_POLICY',message});
  const fields=(v:Record<string,unknown>,keys:readonly string[],prefix:string)=>{
    const present=Object.keys(v);
    for(const k of present)if(!keys.includes(k))error(prefix+k,'Unsupported field; brand policy accepts no CSS, selectors, or URLs.');
    for(const k of keys)if(!present.includes(k))error(prefix+k,'Missing required field.');
  };
  const checkPalette=(v:unknown,path:string)=>{
    if(!object(v)){error(path,'Provide background, foreground, and accent colors.');return;}
    fields(v,tokens,path+'.');
    for(const k of tokens)if(Object.hasOwn(v,k)&&(typeof v[k]!=='string'||!/^#[\da-f]{6}$/i.test(v[k] as string)))error(`${path}.${k}`,'Use a six-digit hex color.');
  };
  if(!object(value))return {ok:false,errors:[{path:'$',code:'BRAND_POLICY',message:'Expected a plain JSON object.'}]};
  fields(value,['base','palettes','allowedAreas','lockedTokens'],'');
  if(Object.hasOwn(value,'base'))checkPalette(value.base,'base');
  if(Object.hasOwn(value,'palettes')){
    if(!object(value.palettes))error('palettes','Provide seasonal, promotion, and launch palettes.');
    else {
      fields(value.palettes,presets,'palettes.');
      for(const k of presets)if(Object.hasOwn(value.palettes,k))checkPalette(value.palettes[k],`palettes.${k}`);
    }
  }
  const areas=value.allowedAreas,locked=value.lockedTokens;
  if(Object.hasOwn(value,'allowedAreas')&&(!Array.isArray(areas)||areas.length<1||areas.length>2||areas.some(a=>a!=='banner'&&a!=='hero')||new Set(areas).size!==areas.length))error('allowedAreas','Choose unique banner and/or hero areas.');
  if(Object.hasOwn(value,'lockedTokens')&&(!Array.isArray(locked)||locked.length>3||locked.some(t=>!tokens.includes(t))||new Set(locked).size!==locked.length))error('lockedTokens','List unique background, foreground, or accent tokens.');
  if(errors.length)return {ok:false,errors};
  const copy=(p:Palette):Palette=>({background:p.background,foreground:p.foreground,accent:p.accent});
  const b=value as unknown as Brand;
  return {ok:true,value:{base:copy(b.base),palettes:{seasonal:copy(b.palettes.seasonal),promotion:copy(b.palettes.promotion),launch:copy(b.palettes.launch)},allowedAreas:[...b.allowedAreas],lockedTokens:[...b.lockedTokens]}};
}
export function isBrand(value:unknown):value is Brand {return validateBrand(value).ok;}
/** The colors a preset actually resolves to once locked tokens fall back to base values. */
export function effectivePalette(preset:Preset,brand:Brand):Palette {
  const colors={...brand.palettes[preset]};
  for(const token of brand.lockedTokens)colors[token]=brand.base[token];
  return colors;
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
  const result=validateExperience({...rest,schemaVersion:1,theme:{...effectivePalette(preset,brand),message}});
  if(!result.ok||!brandAllows(result.value,brand))throw new Error('Preset settings violate the experience schema or brand policy.');
  return result.value;
}
