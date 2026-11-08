// Demo only: switches the preview date. A live site needs none of this.
const root = document.querySelector('seed-root');
const state = document.getElementById('state');
for (const button of document.querySelectorAll('[data-at]')) button.addEventListener('click', () => root.setAttribute('preview-at', button.dataset.at));
document.addEventListener('seed-change', e => { state.textContent = e.detail.experience ? `Showing ${e.detail.experience}` : 'Showing the base site'; });
document.addEventListener('seed-error', e => { state.textContent = `SEED error: ${e.detail.errors[0].message}`; });
