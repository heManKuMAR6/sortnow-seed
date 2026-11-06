import {validateExperience} from '../../dist/core/index.js';

/** Re-validates so only the fields of a valid Experience can ever leave the page. Never includes approvals. */
export function draftFile(experience) {
  const result = validateExperience(experience);
  if (!result.ok) throw new Error('Cannot export an invalid experience.');
  // Validated ids contain only lowercase letters, digits, and hyphens, so this name is safe.
  return {filename: `${result.value.id}.draft.json`, json: `${JSON.stringify(result.value, null, 2)}\n`};
}
/** Saves a local file only. Downloading does not approve or publish anything. */
export function downloadDraft(experience, env = globalThis) {
  const {filename, json} = draftFile(experience);
  const url = env.URL.createObjectURL(new Blob([json], {type: 'application/json'}));
  const link = env.document.createElement('a');
  link.href = url;
  link.download = filename;
  try { link.click(); } finally { env.setTimeout(() => env.URL.revokeObjectURL(url), 0); }
}
