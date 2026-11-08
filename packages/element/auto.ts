/** Entry for the single-file browser build: defines <seed-root> and <seed-area> on load. */
import {defineSeedElements} from './index.js';
export * from './index.js';
if (typeof customElements !== 'undefined') defineSeedElements();
