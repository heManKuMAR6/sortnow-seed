import {forgetEffect} from '../../dist/render/index.js';
/** Preview tooling only: lets the owner watch an effect again after it has played once this visit. */
export function forgetEffects(win = globalThis) { forgetEffect(win); }
