/**
 * Build-time SVG allowlist sanitizer for theme packs. Not shipped to browsers.
 * Rejects anything outside a small drawing vocabulary, forces brand-tint paint values,
 * prefixes ids, and re-serializes canonically so hashes are stable.
 */
const ELEMENTS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'title']);
const NUMBER = /^-?\d*\.?\d+(e-?\d+)?$/i;
const NUMBERS = /^[-\d.eE,\s]+$/;
const GEOMETRY = ['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'offset', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity'];
const PAINT = ['fill', 'stroke', 'stop-color'];
const ENUMS = {'stroke-linecap': ['butt', 'round', 'square'], 'stroke-linejoin': ['miter', 'round', 'bevel'], 'gradientUnits': ['userSpaceOnUse', 'objectBoundingBox'], 'fill-rule': ['nonzero', 'evenodd']};
const TRANSFORM = /^(\s*(translate|scale|rotate|skewX|skewY|matrix)\([-\d.eE,\s]+\)\s*)+$/;
const PATH = /^[MmLlHhVvCcSsQqTtAaZz\d.,\s eE-]+$/;
const ID = /^[a-z][a-z0-9-]{0,31}$/;

export class SanitizeError extends Error {}
const fail = (where, message) => { throw new SanitizeError(`${where}: ${message}`); };

export function sanitizeSvg(source, {where = 'svg', prefix, signatureColors = []}) {
  if (typeof source !== 'string') fail(where, 'expected text');
  const input = source.trim();
  for (const bad of ['<!', '<?', '&', ']]>']) if (input.includes(bad)) fail(where, `forbidden sequence ${JSON.stringify(bad)} (comments, doctypes, entities, and processing instructions are not allowed)`);
  const token = /<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[a-zA-Z][\w:-]*="[^"<>]*")*)\s*(\/?)>|([^<]+)/y;
  const root = {name: '#root', attrs: {}, children: []};
  const stack = [root];
  const ids = new Set(), refs = [];
  let match;
  token.lastIndex = 0;
  while (token.lastIndex < input.length) {
    const at = token.lastIndex;
    match = token.exec(input);
    if (!match || match.index !== at) fail(where, `unparseable markup near offset ${at}`);
    const [, close, open, attrText, selfClose, text] = match;
    const parent = stack[stack.length - 1];
    if (text !== undefined) {
      if (!text.trim()) continue;
      if (parent.name !== 'title') fail(where, 'text is only allowed inside <title>');
      parent.children.push({text: text.trim()});
      continue;
    }
    if (close) {
      if (parent.name !== close) fail(where, `mismatched </${close}>`);
      stack.pop();
      continue;
    }
    if (!ELEMENTS.has(open)) fail(where, `element <${open}> is not allowed`);
    if (open === 'svg' ? parent !== root : parent === root) fail(where, 'exactly one root <svg> is required');
    const attrs = {};
    for (const [, name, value] of attrText.matchAll(/\s+([a-zA-Z][\w:-]*)="([^"<>]*)"/g)) {
      if (Object.hasOwn(attrs, name)) fail(where, `duplicate attribute ${name}`);
      attrs[name] = checkAttr(where, open, name, value, {prefix, signatureColors, ids, refs});
    }
    const node = {name: open, attrs, children: []};
    parent.children.push(node);
    if (!selfClose) stack.push(node);
  }
  if (stack.length !== 1) fail(where, `unclosed <${stack[stack.length - 1].name}>`);
  const svg = root.children[0];
  if (!svg || root.children.length !== 1) fail(where, 'exactly one root <svg> is required');
  const box = (svg.attrs.viewBox ?? '').split(/[\s,]+/).map(Number);
  if (box.length !== 4 || box.some(n => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0) fail(where, 'root <svg> needs a numeric viewBox');
  for (const ref of refs) if (!ids.has(ref)) fail(where, `url(#${ref}) does not refer to a local id`);
  return {svg: serialize(svg, true), aspect: Math.round((box[2] / box[3]) * 1000) / 1000};
}

function checkAttr(where, element, name, value, ctx) {
  const at = `${where} <${element} ${name}>`;
  if (/^on/i.test(name) || name === 'style' || name === 'class' || name.includes(':')) fail(at, 'attribute is not allowed');
  if (name === 'xmlns') { if (element !== 'svg' || value !== 'http://www.w3.org/2000/svg') fail(at, 'only the SVG namespace on the root'); return value; }
  if (name === 'viewBox') { if (element !== 'svg' || !NUMBERS.test(value)) fail(at, 'numeric viewBox on the root only'); return value.trim().split(/[\s,]+/).join(' '); }
  if (name === 'id') { if (!ID.test(value)) fail(at, 'ids are lowercase letters, digits, and hyphens'); ctx.ids.add(value); return `${ctx.prefix}-${value}`; }
  if (name === 'd') { if (!PATH.test(value)) fail(at, 'path data only'); return value.trim().replace(/\s+/g, ' '); }
  if (name === 'stroke-dasharray') { if (!NUMBERS.test(value)) fail(at, 'numbers only'); return value.trim().replace(/\s+/g, ' '); }
  if (name === 'points') { if (!NUMBERS.test(value)) fail(at, 'numbers only'); return value.trim().replace(/\s+/g, ' '); }
  if (name === 'transform' || name === 'gradientTransform') { if (!TRANSFORM.test(value)) fail(at, 'transform functions with numbers only'); return value.trim().replace(/\s+/g, ' '); }
  if (GEOMETRY.includes(name)) { if (!NUMBER.test(value.replace(/%$/, ''))) fail(at, 'a number'); return value; }
  if (Object.hasOwn(ENUMS, name)) { if (!ENUMS[name].includes(value)) fail(at, `one of ${ENUMS[name].join(', ')}`); return value; }
  if (PAINT.includes(name)) return paint(at, value, ctx);
  return fail(at, 'attribute is not allowed');
}

/** Paint must follow the brand: SEED variables, pack signature colours, local gradients, none, or currentColor. Hex is rejected. */
function paint(at, value, ctx) {
  if (value === 'none' || value === 'currentColor') return value;
  const role = /^var\(--seed-(background|foreground|accent)\)$/.exec(value);
  if (role) return value;
  const sig = /^var\(--seed-sig-([a-z][a-z0-9-]{0,31})\)$/.exec(value);
  if (sig) { if (!ctx.signatureColors.includes(sig[1])) fail(at, `signature colour ${sig[1]} is not declared in pack.json`); return value; }
  const ref = /^url\(#([a-z][a-z0-9-]{0,31})\)$/.exec(value);
  if (ref) { ctx.refs.push(ref[1]); return `url(#${ctx.prefix}-${ref[1]})`; }
  return fail(at, 'use var(--seed-background|foreground|accent), var(--seed-sig-NAME), url(#local-id), none, or currentColor');
}

function serialize(node, isRoot = false) {
  if (node.text !== undefined) return node.text;
  const attrs = {...node.attrs};
  if (isRoot) Object.assign(attrs, {xmlns: 'http://www.w3.org/2000/svg', width: '100%', height: '100%', 'aria-hidden': 'true', focusable: 'false'});
  const text = Object.keys(attrs).sort().map(k => ` ${k}="${attrs[k]}"`).join('');
  const inner = node.children.map(c => serialize(c)).join('');
  return inner ? `<${node.name}${text}>${inner}</${node.name}>` : `<${node.name}${text}/>`;
}
