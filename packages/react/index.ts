'use client';
import {createElement, useEffect, useState, type ReactNode, type CSSProperties} from 'react';
import {selectExperience, brandAllows, type Brand} from '../core/index.js';
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
