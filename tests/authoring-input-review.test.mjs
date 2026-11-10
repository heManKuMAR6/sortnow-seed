import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authorExperience, planExperiences} from '../dist/core/authoring.js';
const brand = JSON.parse(readFileSync('examples/storefront/brand.json', 'utf8'));
const event = {name:'Review', timeZone:'UTC', startDate:'2026-12-01', lastDate:'2026-12-02', preset:'seasonal', message:'Hello', pack:'christmas'};
test('pack authoring rejects malformed areas without throwing or silently discarding them', () => {
  for (const areas of [undefined, null, {}, 'hero', [], ['hero','unknown'], ['hero','hero']]) {
    const result = authorExperience({...event, areas}, brand);
    assert.equal(result.ok, false, JSON.stringify(areas));
    assert.ok(result.errors.some(e => e.path === 'areas'));
  }
});
test('planner propagates malformed areas as diagnostics', () => {
  const result = planExperiences({markets:['US'], from:'2026-12-01', timeZone:'UTC', occasions:['christmas-2026']}, brand);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.path.endsWith('.areas')));
});
