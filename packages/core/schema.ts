/** Structural contracts for editors and agents. Runtime validation remains authoritative. */
const hex = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
const palette = {
  type: 'object', additionalProperties: false,
  required: ['background', 'foreground', 'accent'],
  properties: { background: hex, foreground: hex, accent: hex },
};
export const experienceSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SortNow SEED experience v1',
  description: 'Structural contract only. Run seed validate for real UTC dates and startsAt < endsAt. Approval and collection constraints are enforced separately.',
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'id', 'startsAt', 'endsAt', 'priority', 'areas', 'theme'],
  properties: {
    schemaVersion: { const: 1 },
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$' },
    startsAt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$', description: 'Real canonical UTC instant, inclusive start.' },
    endsAt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$', description: 'Real canonical UTC instant after startsAt, exclusive end.' },
    priority: { type: 'integer', minimum: 0, maximum: 100 },
    areas: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { enum: ['banner', 'hero'] } },
    theme: {
      ...palette, required: [...palette.required, 'message'],
      properties: { ...palette.properties, message: {
        type: 'string', minLength: 1, maxLength: 240, pattern: '^[^\\u0000-\\u001f\\u007f]+$',
        description: 'Plain text, escaped when rendered. Runtime additionally limits UTF-16 length to 240 code units.',
      } },
    },
  },
} as const;
export const eventSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SortNow SEED event authoring input',
  description: 'Structural contract only. Run seed author for real dates, known IANA zones, and brand rules. Output is a draft that still needs review and approval.',
  type: 'object', additionalProperties: false,
  required: ['name', 'timeZone', 'startDate', 'lastDate', 'preset', 'message', 'areas'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    timeZone: { type: 'string', description: 'IANA name chosen by the owner, or UTC. Offsets and abbreviations are rejected.' },
    startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Begins at the start of this day in timeZone.' },
    lastDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Included. Ends when the following day begins in timeZone.' },
    preset: { enum: ['seasonal', 'promotion', 'launch'] },
    message: { type: 'string', minLength: 1, maxLength: 240 },
    areas: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { enum: ['banner', 'hero'] } },
    priority: { type: 'integer', minimum: 0, maximum: 100, default: 10 },
  },
} as const;
export const brandSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SortNow SEED brand policy',
  type: 'object', additionalProperties: false,
  required: ['base', 'palettes', 'allowedAreas', 'lockedTokens'],
  properties: {
    base: palette,
    palettes: { type: 'object', additionalProperties: false, required: ['seasonal', 'promotion', 'launch'], properties: { seasonal: palette, promotion: palette, launch: palette } },
    allowedAreas: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { enum: ['banner', 'hero'] } },
    lockedTokens: { type: 'array', maxItems: 3, uniqueItems: true, items: { enum: ['background', 'foreground', 'accent'] } },
    allowedSlots: { type: 'array', minItems: 1, maxItems: 4, uniqueItems: true, items: { enum: ['banner', 'hero', 'accent', 'overlay'] }, description: 'Schema v2 slots. Defaults to allowedAreas.' },
    effects: { enum: ['off', 'on'], default: 'off', description: 'Overlay effects are opt-in by the integrator.' },
    signatureColors: { enum: ['allow', 'deny'], default: 'deny', description: 'Whether pack signature colours may appear.' },
  },
} as const;

const assetId = { type: 'string', pattern: '^[a-z][a-z0-9-]{0,31}$' };
const plainText = { type: 'string', minLength: 1, maxLength: 240, pattern: '^[^\\u0000-\\u001f\\u007f]+$' };
const utc = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$' };
export const experienceV2Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SortNow SEED experience v2 (theme packs and slots)',
  description: 'Structural contract only. Run seed validate for real dates, and against installed packs for asset ids and the pack hash. Approval is separate.',
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'id', 'startsAt', 'endsAt', 'priority', 'pack', 'palette', 'signatureColors', 'slots'],
  properties: {
    schemaVersion: { const: 2 },
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$' },
    startsAt: utc, endsAt: utc,
    priority: { type: 'integer', minimum: 0, maximum: 100 },
    pack: { type: 'object', additionalProperties: false, required: ['id', 'version', 'hash'], properties: {
      id: assetId, version: { type: 'string', pattern: '^\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}$' }, hash: { type: 'string', pattern: '^sha256-[0-9a-f]{64}$' } } },
    palette,
    signatureColors: { type: 'array', maxItems: 8, uniqueItems: true, items: assetId },
    slots: { type: 'object', additionalProperties: false, minProperties: 1, properties: {
      banner: { type: 'object', additionalProperties: false, required: ['message'], properties: { message: plainText, icon: assetId } },
      hero: { type: 'object', additionalProperties: false, minProperties: 1, properties: { message: plainText, illustration: assetId, placement: { enum: ['start', 'end', 'background'] } } },
      accent: { type: 'object', additionalProperties: false, required: ['decoration', 'corner'], properties: { decoration: assetId, corner: { enum: ['top-start', 'top-end', 'bottom-start', 'bottom-end'] } } },
      overlay: { oneOf: [
        { type: 'object', additionalProperties: false, required: ['effect', 'asset', 'direction', 'durationMs'], properties: { effect: { const: 'flyby' }, asset: assetId, direction: { enum: ['ltr', 'rtl'] }, durationMs: { type: 'integer', minimum: 2000, maximum: 6000 } } },
        { type: 'object', additionalProperties: false, required: ['effect', 'particle', 'density', 'durationMs'], properties: { effect: { const: 'particles' }, particle: assetId, density: { enum: ['light', 'medium'] }, durationMs: { type: 'integer', minimum: 3000, maximum: 8000 } } },
      ] },
    } },
  },
} as const;
export const bundleSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SortNow SEED bundle v1',
  description: 'Drafts or reviewed experiences a host commits. Never carries approvals or signatures.',
  type: 'object', additionalProperties: false, required: ['bundleVersion', 'experiences'],
  properties: { bundleVersion: { const: 1 }, experiences: { type: 'array', maxItems: 100, items: { oneOf: [experienceSchema, experienceV2Schema] } } },
} as const;
