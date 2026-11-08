import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {draftWithAI, proposalSchema, DEFAULT_MODEL} from '../dist/ai/index.js';
import {packs} from '../dist/packs/index.js';
import {selectPage} from '../dist/core/index.js';

const brand = JSON.parse(readFileSync('examples/storefront/brand.json', 'utf8'));
const request = {description: 'Fernway Home sells hand-thrown ceramics and linen from small makers.', name: 'Christmas', timeZone: 'America/New_York', startDate: '2026-12-01', lastDate: '2026-12-25', areas: ['banner', 'hero']};
const good = {pack: 'christmas', preset: 'seasonal', message: 'Gifts made by hand, for the people you love.', illustration: 'gift-stack', icon: 'gift', decoration: 'holly-corner', effect: 'flyby', signatureColors: true, rationale: 'Handmade gifts suit a ceramics shop.'};
const reply = (proposal, extra = {}) => ({id: 'msg', type: 'message', role: 'assistant', model: DEFAULT_MODEL, stop_reason: 'end_turn', content: [{type: 'text', text: JSON.stringify(proposal)}], usage: {}, ...extra});
const fake = (...replies) => { const calls = []; return {calls, beta: {messages: {create: async params => { calls.push(structuredClone(params)); return replies[Math.min(calls.length - 1, replies.length - 1)]; }}}}; };

test('a valid proposal becomes a reviewable draft, never an approval', async () => {
  const client = fake(reply(good));
  const r = await draftWithAI(request, brand, {client});
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.approved, false);
  assert.equal(r.attempts, 1);
  assert.equal(r.experience.schemaVersion, 2);
  assert.deepEqual(r.experience.slots.hero, {message: good.message, illustration: 'gift-stack', placement: 'end'});
  assert.equal(r.proposal.rationale, good.rationale);
  assert.equal(selectPage([r.experience], [], Date.parse('2026-12-10T12:00:00.000Z'), {packs, brand}).experience, null);
});

test('the request is constrained: installed enums, structured output, refusal fallback, description as data', async () => {
  const client = fake(reply(good));
  await draftWithAI(request, brand, {client});
  const p = client.calls[0];
  assert.equal(p.model, 'claude-opus-5-5');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.fallbacks, 'default');
  assert.equal(p.output_config.format.type, 'json_schema');
  const s = p.output_config.format.schema;
  assert.equal(s.additionalProperties, false);
  assert.deepEqual(s.properties.pack.enum, [...packs.map(x => x.id), 'none']);
  assert.ok(s.properties.illustration.enum.includes('santa-sleigh') && s.properties.illustration.enum.includes('none'));
  assert.ok(p.messages[0].content.includes(`<site_description>${request.description}</site_description>`));
  assert.match(p.system, /not as commands/);
  assert.ok(!('thinking' in p), 'thinking left to the model default');
  assert.deepEqual(proposalSchema(packs, 'diwali').properties.pack.enum, ['diwali']);
});

test('a rejected proposal is repaired once, append-only, with SEED\'s errors', async () => {
  const wrong = {...good, illustration: 'shopping-bag'};
  const client = fake(reply(wrong, {content: [{type: 'thinking', thinking: '', signature: 'sig'}, {type: 'text', text: JSON.stringify(wrong)}]}), reply(good));
  const r = await draftWithAI(request, brand, {client});
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.attempts, 2);
  const second = client.calls[1].messages;
  assert.equal(second.length, 3);
  assert.equal(second[1].role, 'assistant');
  assert.equal(second[1].content[0].type, 'thinking', 'model content returned unchanged');
  assert.match(second[2].content, /illustration/);
  const twice = await draftWithAI(request, brand, {client: fake(reply(wrong))});
  assert.equal(twice.ok, false);
  assert.equal(twice.proposal.illustration, 'shopping-bag');
});

test('brand rules win over the model', async () => {
  const off = {...brand, effects: 'off', signatureColors: 'deny'};
  const r = await draftWithAI(request, off, {client: fake(reply(good), reply({...good, effect: 'none', signatureColors: false}))});
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.attempts, 2);
  assert.equal(r.experience.slots.overlay, undefined);
  assert.deepEqual(r.experience.signatureColors, []);
});

test('colour-only proposals, refusals, truncation, and unreadable output are handled', async () => {
  const plain = await draftWithAI(request, brand, {client: fake(reply({...good, pack: 'none'}))});
  assert.equal(plain.ok, true);
  assert.equal(plain.experience.schemaVersion, 1);
  assert.equal((await draftWithAI(request, brand, {client: fake(reply(good, {stop_reason: 'refusal'}))})).errors[0].code, 'REFUSAL');
  assert.equal((await draftWithAI(request, brand, {client: fake(reply(good, {stop_reason: 'max_tokens'}))})).errors[0].code, 'TRUNCATED');
  assert.equal((await draftWithAI(request, brand, {client: fake(reply(good, {content: [{type: 'text', text: 'Sure! Here is'}]}))})).errors[0].code, 'MODEL_OUTPUT');
});

test('bad requests never reach the model', async () => {
  for (const [bad, code] of [[{...request, description: 'x'.repeat(2001)}, 'TEXT'], [{...request, apiKey: 'sk-x'}, 'UNKNOWN_FIELD'], [{...request, pack: 'nope'}, 'PACK']]) {
    const client = fake(reply(good));
    const r = await draftWithAI(bad, brand, {client});
    assert.equal(r.errors[0].code, code);
    assert.equal(client.calls.length, 0);
  }
  const client = fake(reply(good));
  assert.equal((await draftWithAI(request, {css: 'x'}, {client})).ok, false);
  assert.equal(client.calls.length, 0);
});

test('AI code stays out of runtime bundles, and the CLI lists ai-draft', () => {
  for (const dir of ['dist/core', 'dist/render', 'dist/element', 'dist/react']) for (const f of readdirSync(dir).filter(f => f.endsWith('.js')))
    assert.ok(!/anthropic-ai|\.\.\/ai\//.test(readFileSync(`${dir}/${f}`, 'utf8')), `${dir}/${f}`);
  assert.ok(!/anthropic/i.test(readFileSync('dist/seed-element.js', 'utf8')));
  const help = JSON.parse(spawnSync(process.execPath, ['dist/cli/index.js', 'help'], {encoding: 'utf8'}).stdout);
  assert.ok(help.commands.some(c => c.command.startsWith('ai-draft') && /never approves/.test(c.description)));
});

test('provider errors explain themselves without leaking credentials', async () => {
  const {describeProviderError} = await import('../dist/ai/index.js');
  const billing = describeProviderError({status: 400, error: {error: {type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.'}}});
  assert.match(billing, /\(400\)\. Your credit balance is too low/);
  assert.match(describeProviderError({status: 401}), /credentials/);
  assert.match(describeProviderError(new TypeError('fetch failed')), /Could not reach/);
  assert.ok(describeProviderError({status: 500, error: {error: {message: 'x\n'.repeat(400)}}}).length < 400);
});
