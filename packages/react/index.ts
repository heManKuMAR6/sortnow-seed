'use client';
import {createElement, useEffect, useState, type ReactNode} from 'react';
import {selectExperience} from '../core/index.js';
export interface SeedAreaProps {
  experiences: readonly unknown[];
  /** Supplied by the trusted host, separately from drafts. Never auto-approve input. */
  approvals: readonly string[];
  area: 'banner' | 'hero';
  children?: ReactNode;
  /** Fixed preview clock; omit for live mode. Server and first client render use base content. */
  previewAt?: number;
}
export function SeedArea({experiences,approvals,area,children,previewAt}: SeedAreaProps) {
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
  if(!current) return createElement('div',{'data-seed-area':area},children);
  const t=current.theme;
  return createElement('div',{'data-seed-area':area,'data-seed-experience':current.id,style:{backgroundColor:t.background,color:t.foreground,borderTop:`3px solid ${t.accent}`,padding:'1rem'}},
    createElement('p',null,t.message),children);
}
