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
  },
} as const;
