/**
 * Bundles the custom elements, renderer, core, and installed packs into one self-contained ES module:
 * dist/seed-element.js. Hosts without a bundler (plain HTML, Shopify themes) load this one file.
 */
import {build} from 'esbuild';
import {gzipSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';

const OUT = 'dist/seed-element.js', BUDGET_GZIP = 24 * 1024;
await build({entryPoints: ['dist/element/auto.js'], bundle: true, format: 'esm', minify: true, target: 'es2022', outfile: OUT, legalComments: 'none'});
const size = gzipSync(await readFile(OUT)).length;
if (size > BUDGET_GZIP) { console.error(`${OUT} is ${size} bytes gzipped; budget ${BUDGET_GZIP}`); process.exit(1); }
