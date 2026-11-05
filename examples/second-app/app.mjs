// A fictional docs-and-pricing product, deliberately unlike the playground: dark theme, sidebar layout,
// server rendered and hydrated, configuration kept in separate JSON files, and a brand policy that allows
// only the hero. Pricing sits outside every SeedArea so no experience can restyle it.
import {createElement as h, useState} from 'react';
import {SeedArea} from '../../dist/react/index.js';

const views = [
  {key: 'live', label: 'Live clock', previewAt: undefined},
  {key: 'during', label: 'During launch', previewAt: Date.parse('2027-03-08T12:00:00.000Z')},
  {key: 'after', label: 'After launch', previewAt: Date.parse('2027-03-15T00:00:00.000Z')},
];
const plans = [['Starter', '3 ledgers'], ['Team', '25 ledgers'], ['Scale', 'Unlimited ledgers']];

function Masthead() {
  return h('header', {className: 'masthead'},
    h('p', {className: 'kicker'}, 'EXAMPLE LEDGER DOCS'),
    h('h1', null, 'Reconcile every account in one place.'),
    h('a', {href: '#plans'}, 'Compare plans'));
}
function Plans() {
  return h('section', {id: 'plans', className: 'plans', 'aria-label': 'Plans'},
    h('h2', null, 'Plans'),
    h('table', null,
      h('thead', null, h('tr', null, h('th', {scope: 'col'}, 'Plan'), h('th', {scope: 'col'}, 'Includes'))),
      h('tbody', null, plans.map(([name, includes]) => h('tr', {key: name}, h('td', null, name), h('td', null, includes))))));
}
export function Page({experiences, approvals, brand, previewAt}) {
  const shared = {experiences, approvals, brand, previewAt};
  return h('div', {className: 'shell'},
    h('nav', {className: 'sidebar', 'aria-label': 'Documentation'}, h('strong', null, 'Example Ledger'),
      h('a', {href: '#plans'}, 'Plans')),
    h('main', null,
      // The policy forbids banner experiences, so this stays empty even for an approved one.
      h(SeedArea, {...shared, area: 'banner'}),
      h(SeedArea, {...shared, area: 'hero', mode: 'variables'}, h(Masthead)),
      h(Plans)));
}
export function Demo(config) {
  const [key, setKey] = useState('live');
  const view = views.find(v => v.key === key);
  return h('div', null,
    h('div', {className: 'toolbar', role: 'group', 'aria-label': 'Preview clock'}, views.map(v =>
      h('button', {key: v.key, type: 'button', 'aria-pressed': v.key === key, onClick: () => setKey(v.key)}, v.label))),
    h(Page, {...config, previewAt: view.previewAt}));
}
