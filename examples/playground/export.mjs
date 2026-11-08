import {validateAnyExperience, validateBundle} from '../../dist/core/index.js';

/**
 * Re-validates so only the fields of a valid experience can ever leave the page. Never includes approvals.
 * Colour-only (v1) drafts export as one experience; pack (v2) drafts export as a bundle, which hosts commit as-is.
 */
export function draftFile(experience) {
  const result = validateAnyExperience(experience);
  if (!result.ok) throw new Error('Cannot export an invalid experience.');
  const value = result.value;
  // Validated ids contain only lowercase letters, digits, and hyphens, so these names are safe.
  if (value.schemaVersion === 2) return {filename: `${value.id}.bundle.json`, json: `${JSON.stringify({bundleVersion: 1, experiences: [value]}, null, 2)}\n`};
  return {filename: `${value.id}.draft.json`, json: `${JSON.stringify(value, null, 2)}\n`};
}
/** A planned set of drafts as one bundle file. Re-validated; never carries approvals. */
export function bundleFile(bundle, name) {
  const result = validateBundle(bundle);
  if (!result.ok) throw new Error('Cannot export an invalid bundle.');
  if (!/^[a-z0-9-]{1,80}$/.test(name)) throw new Error('Unsafe file name.');
  return {filename: `${name}.bundle.json`, json: `${JSON.stringify(result.value, null, 2)}\n`};
}
export function downloadBundle(bundle, name, env = globalThis) { save(bundleFile(bundle, name), env); }
/** Saves a local file only. Downloading does not approve or publish anything. */
export function downloadDraft(experience, env = globalThis) { save(draftFile(experience), env); }
function save({filename, json}, env) {
  const url = env.URL.createObjectURL(new Blob([json], {type: 'application/json'}));
  const link = env.document.createElement('a');
  link.href = url;
  link.download = filename;
  try { link.click(); } finally { env.setTimeout(() => env.URL.revokeObjectURL(url), 0); }
}
