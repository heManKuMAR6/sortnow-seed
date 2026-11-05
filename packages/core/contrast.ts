import {effectivePalette, type Brand, type Palette, type Preset} from './brand.js';
/** Advisory color arithmetic. It certifies nothing and never gates approval or rendering. */
export interface ContrastCheck { pair: 'foreground/background' | 'accent/background'; color: string; against: string; ratio: number; minimum: number; passes: boolean }
export interface ContrastReport { meetsMinimums: boolean; checks: ContrastCheck[] }
export interface BrandContrastReport { meetsMinimums: boolean; palettes: ({palette: 'base' | Preset} & ContrastReport)[] }
// WCAG 2.2 AA minimum for normal-size text.
const TEXT_MINIMUM = 4.5;
const luminance = (hex: string) => {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('Use a six-digit hex color.');
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const check = (pair: ContrastCheck['pair'], color: string, against: string): ContrastCheck => {
  const ratio = contrastRatio(color, against);
  // Judge the exact value and round the display down, so 4.499 can never read as a passing 4.5.
  return {pair, color, against, ratio: Math.floor(ratio * 100) / 100, minimum: TEXT_MINIMUM, passes: ratio >= TEXT_MINIMUM};
};
export function contrastReport(palette: Palette): ContrastReport {
  const checks = [check('foreground/background', palette.foreground, palette.background), check('accent/background', palette.accent, palette.background)];
  return {meetsMinimums: checks.every(c => c.passes), checks};
}
export function brandContrastReport(brand: Brand): BrandContrastReport {
  const presets: Preset[] = ['seasonal', 'promotion', 'launch'];
  const palettes = [
    {palette: 'base' as const, ...contrastReport(brand.base)},
    ...presets.map(palette => ({palette, ...contrastReport(effectivePalette(palette, brand))})),
  ];
  return {meetsMinimums: palettes.every(p => p.meetsMinimums), palettes};
}
