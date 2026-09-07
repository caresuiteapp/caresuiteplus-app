// DOM startup checks only. No browser, URL fetch, screenshots, or live API access.
const fs = require('node:fs');
const path = require('node:path');
(async () => {
 const { Window } = await import('happy-dom');
 const window = new Window({ url: 'https://ui-test.invalid/?platform=1#/auth/register' });
 const errors = [];
 window.addEventListener('error', event => errors.push(event.message));
 window.console.error = (...args) => errors.push(args.map(value => value?.message ?? String(value)).join(' '));
 window.fetch = async () => { throw new Error('Network access is disabled in the DOM test.'); };
 window.document.body.innerHTML = '<div id="qa"></div><div id="preview"></div>';
 const bundle = fs.readFileSync(path.join(process.env.TEMP || '/tmp', 'caresuite-company-preview', 'company.js'), 'utf8');
 try {
  window.eval(bundle);
  const checks = [['/auth/register', 'Firmenname'], ['/platform/tenants', 'Musterbetrieb Pflege'], ['/platform/tenants/qa-1', 'Datenklassifizierung'], ['/platform/support', 'Rückfrage zum gespeicherten Einsatz']];
  for (const [route, expected] of checks) {
   window.location.hash = route;
   await new Promise(resolve => setTimeout(resolve, 1000));
   const text = window.document.getElementById('preview').textContent;
   if (!text.includes(expected)) throw new Error(route + ': expected content missing. ' + errors.join(' | '));
   console.log(JSON.stringify({ route, rendered: true }));
  }
  if (errors.length) throw new Error(errors.join(' | '));
 } finally { await window.happyDOM.abort(); window.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
