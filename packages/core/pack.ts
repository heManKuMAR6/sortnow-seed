/**
 * Compiled theme packs. Packs ship inside the package, built and sanitized by scripts/build-packs.mjs.
 * Configuration only references a pack by id, version, and hash; it never carries markup.
 */
export interface PackAsset { svg: string; aspect: number; label?: string }
export type AssetKind = 'illustrations' | 'icons' | 'decorations' | 'particles';
export interface CompiledPack {
  packVersion: 1;
  id: string;
  version: string;
  /** sha256 over the canonical manifest and sanitized assets. Experiences pin it; any artwork change needs re-approval. */
  hash: string;
  name: string;
  occasions: string[];
  license: string;
  signatureColors: Record<string, string>;
  illustrations: Record<string, PackAsset>;
  icons: Record<string, PackAsset>;
  decorations: Record<string, PackAsset>;
  particles: Record<string, PackAsset>;
  copy: { hero: string[]; banner: string[] };
  effects: { flyby?: { assets: string[] }; particles?: { assets: string[] } };
}
/** A summary for agents and the CLI: names and labels, not artwork. */
export function describePack(pack: CompiledPack) {
  const names = (r: Record<string, PackAsset>) => Object.entries(r).map(([id, a]) => (a.label ? {id, label: a.label} : {id}));
  return {
    id: pack.id, version: pack.version, hash: pack.hash, name: pack.name, occasions: [...pack.occasions], license: pack.license,
    signatureColors: {...pack.signatureColors},
    illustrations: names(pack.illustrations), icons: names(pack.icons), decorations: names(pack.decorations), particles: names(pack.particles),
    copy: {hero: [...pack.copy.hero], banner: [...pack.copy.banner]},
    effects: Object.fromEntries(Object.entries(pack.effects).map(([k, v]) => [k, {assets: [...v.assets]}])),
  };
}
