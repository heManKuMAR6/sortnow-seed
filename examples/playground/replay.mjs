/** Preview tooling only: lets the owner watch an effect again after it has played once this visit. */
export function forgetEffects(storage = globalThis.sessionStorage) {
  try { for (const key of Object.keys(storage)) if (key.startsWith('seed-effect:')) storage.removeItem(key); } catch { /* storage unavailable */ }
}
