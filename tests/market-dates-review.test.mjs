import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingOccasions} from '../dist/core/authoring.js';
// Singapore Ministry of Manpower, 2027 gazetted holidays, published 2026-06-18.
const list=markets=>upcomingOccasions({markets,from:'2027-01-01',days:365}).occasions;
test('Singapore movable occasions use the Singapore dates',()=>{
 const sg=list(['SG']);
 for(const [prefix,date] of [['diwali','2027-10-28'],['eid-al-fitr','2027-03-10'],['eid-al-adha','2027-05-17']]) {
  const found=sg.filter(o=>o.occasion.startsWith(prefix));assert.equal(found.length,1);assert.equal(found[0].date,date);assert.match(found[0].source,/mom.gov.sg/);
 }
});
test('mixed markets preserve distinct regional drafts instead of one conflicting date',()=>{
 const all=list(['IN','SG']).filter(o=>o.occasion.startsWith('diwali'));
 assert.deepEqual(all.map(o=>o.date).sort(),['2027-10-28','2027-10-29']);
 assert.equal(new Set(all.map(o=>o.id)).size,2);
});
