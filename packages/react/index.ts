'use client';
import {createElement, useEffect, useRef, useState, type ReactNode, type CSSProperties} from 'react';
import {selectExperience, brandAllows, type Brand, type CompiledPack} from '../core/index.js';
import {mountSeed, type Motion, type SeedMount} from '../render/index.js';
export interface SeedAreaProps {
  experiences: readonly unknown[];
  /** Supplied by the trusted host, separately from drafts. Never auto-approve input. */
  approvals: readonly string[];
  area: 'banner' | 'hero';
  children?: ReactNode;
  brand?: Brand;
  /** Variables mode lets existing components opt into CSS tokens without wrapper layout changes. */
  mode?: 'wrapper' | 'variables';
  /** Fixed preview clock; omit for live mode. Server and first client render use base content. */
  previewAt?: number;
}
export function SeedArea({experiences,approvals,area,children,previewAt,brand,mode='wrapper'}: SeedAreaProps) {
  const [clock,setClock]=useState<number | null>(null);
  useEffect(()=>{
    if(previewAt !== undefined) return;
    const update=()=>setClock(Date.now());
    update();
    const timer=setInterval(update,1000);
    document.addEventListener('visibilitychange',update);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[previewAt]);
  const now=previewAt ?? clock;
  const current=now === null ? null : selectExperience(experiences,approvals,now,area).experience;
  if(!current || (brand !== undefined && !brandAllows(current,brand))) return createElement('div',{'data-seed-area':area},children);
  const t=current.theme;
  const variables={'--seed-background':t.background,'--seed-foreground':t.foreground,'--seed-accent':t.accent} as CSSProperties;
  const style=mode==='variables' ? variables : {...variables,backgroundColor:t.background,color:t.foreground,borderTop:`3px solid ${t.accent}`,padding:'1rem'};
  return createElement('div',{'data-seed-area':area,'data-seed-experience':current.id,style},
    mode==='wrapper' ? createElement('p',null,t.message) : null,children);
}

export interface SeedRootProps {
  experiences: readonly unknown[];
  /** Exact snapshots from trusted host configuration. Never derive these from drafts. */
  approvals: readonly string[];
  /** Theme packs to allow, usually `packs` from 'sortnow-seed/packs'. Passed explicitly so apps only ship what they use. */
  packs: readonly CompiledPack[];
  /** The site's brand policy. Required: pack themes never render without it. */
  brand: unknown;
  /** Fixed preview clock; omit for live mode. */
  previewAt?: number;
  motion?: Motion;
  /** Limit SEED to one part of the page, such as a preview pane. Defaults to the whole document. */
  root?: {readonly current: Element | null};
}
/**
 * Renders schema v2 (theme pack) experiences into elements marked with data-seed-slot anywhere in the page.
 * Renders nothing itself. Server output and the first client render stay base; activation happens after mount.
 * Mark slot containers whose children are elements, not a lone text node React may replace.
 */
export function SeedRoot({experiences, approvals, packs, brand, previewAt, motion = 'auto', root}: SeedRootProps) {
  const mount = useRef<SeedMount | null>(null);
  useEffect(() => {
    mount.current = mountSeed({root: root?.current ?? document, experiences, approvals, packs, brand, now: previewAt, motion});
    return () => { mount.current?.destroy(); mount.current = null; };
  }, [packs]);
  useEffect(() => { mount.current?.update({experiences, approvals, brand, now: previewAt, motion}); }, [experiences, approvals, brand, previewAt, motion]);
  return null;
}
