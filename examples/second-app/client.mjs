import {createElement} from 'react';
import {hydrateRoot} from 'react-dom/client';
import {Demo} from './app.mjs';
import brand from './brand.json';
import experiences from './experiences.json';
import approvals from './reviewed-approvals.json';

hydrateRoot(document.getElementById('root'), createElement(Demo, {brand, experiences, approvals}));
