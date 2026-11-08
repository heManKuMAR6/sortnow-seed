import {approvalSnapshot} from '../../dist/core/index.js';
import {mountSeed} from '../../dist/render/index.js';
import {packs} from '../../dist/packs/index.js';
import bundle from './seed.bundle.json' with {type: 'json'};
import brand from './brand.json' with {type: 'json'};

const $ = id => document.getElementById(id);
const experiences = bundle.experiences;
const names = {'black-friday-2026': 'Black Friday', 'christmas-2026': 'Christmas'};
// Owner decisions for this demo only. A real host loads exact snapshots from a reviewed file.
const approved = new Set();
const at = () => Date.parse(`${$('date').value}T12:00:00.000Z`);
const approvals = () => $('draft-preview').checked ? experiences.map(approvalSnapshot) : [...approved];

const seed = mountSeed({experiences, approvals: approvals(), packs, brand, now: at(), onChange: ({experience}) => {
  const mode = $('draft-preview').checked ? 'draft preview, not approved' : 'approved';
  $('status').textContent = experience ? `Showing ${names[experience.id]} (${mode})` : 'Showing the base site';
}});
const refresh = () => {
  seed.update({approvals: approvals(), now: at(), motion: $('reduce').checked ? 'reduce' : 'auto'});
  $('experiences').replaceChildren(...experiences.map(e => {
    const li = document.createElement('li'), label = document.createElement('span'), small = document.createElement('small'), button = document.createElement('button');
    const isApproved = approved.has(approvalSnapshot(e));
    label.textContent = names[e.id];
    small.textContent = `${e.startsAt.slice(0, 10)} to ${e.endsAt.slice(0, 10)} · ${isApproved ? 'approved' : 'draft'}`;
    label.append(small);
    button.type = 'button';
    button.textContent = isApproved ? 'Revoke' : 'Approve this exact version';
    button.setAttribute('aria-label', `${isApproved ? 'Revoke' : 'Approve'} ${names[e.id]}`);
    button.onclick = () => { const s = approvalSnapshot(e); isApproved ? approved.delete(s) : approved.add(s); refresh(); };
    li.append(label, button);
    return li;
  }));
};
for (const b of document.querySelectorAll('[data-date]')) b.onclick = () => { $('date').value = b.dataset.date; refresh(); };
for (const id of ['date', 'draft-preview', 'reduce']) $(id).onchange = refresh;
$('replay').onclick = () => seed.replay();
refresh();
