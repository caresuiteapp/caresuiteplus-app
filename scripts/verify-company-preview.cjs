// DOM startup and navigation checks only. No browser, URL fetch, screenshots, or live API access.
const fs = require('node:fs');
const path = require('node:path');
(async () => {
 const { Window } = await import('happy-dom');
 const window = new Window({ url: 'https://ui-test.invalid/?platform=1#/auth/register' });
 // Happy DOM has no layout engine; provide viewport dimensions for RN's resize events.
 Object.defineProperties(window.document.documentElement, {
  clientWidth: { get: () => window.innerWidth },
  clientHeight: { get: () => window.innerHeight },
 });
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
  window.happyDOM.setWindowSize({ width: 780, height: 800 });
  await new Promise(resolve => setTimeout(resolve, 250));
  const menu = () => window.document.getElementById('desktop-module-navigation');
  const control = label => window.document.querySelector(`[aria-label="${label}"]`);
  if (menu() || !control('Navigation öffnen')) throw new Error('Narrow navigation must start closed and remain reachable.');
  control('Navigation öffnen').click();
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!menu()) throw new Error('Narrow navigation did not open.');
  control('Navigation schließen').click();
  await new Promise(resolve => setTimeout(resolve, 250));
  if (menu()) throw new Error('Narrow navigation did not close.');
  control('Navigation öffnen').click();
  await new Promise(resolve => setTimeout(resolve, 250));
  control('Mandanten').click();
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (menu() || !window.document.getElementById('preview').textContent.includes('Musterbetrieb Pflege')) throw new Error('Navigation must close after selecting a company route.');
  const cards = window.document.getElementById('compact-company-list');
  if (!cards) throw new Error('Narrow company directory must show the compact list.');
  for (const label of ['Datenart', 'Status', 'Tarif', 'Registriert', 'Einrichtung', 'Abrechnung']) {
   if (!cards.firstElementChild.textContent.includes(label)) throw new Error('Company card is missing ' + label);
  }
  const openCompany = control('Unternehmen Beispielunternehmen 2 öffnen');
  if (!openCompany) throw new Error('Company opening action is missing from the compact list.');
  openCompany.click();
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (window.location.hash !== '#/platform/tenants/qa-2' || !window.document.getElementById('preview').textContent.includes('Datenklassifizierung')) throw new Error('Company card must open its own record.');
  window.location.hash = '/platform/tenants';
  await new Promise(resolve => setTimeout(resolve, 1000));
  window.happyDOM.setWindowSize({ width: 1440, height: 900 });
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!menu()) throw new Error('Desktop sidebar did not return after resizing.');
  if (window.document.getElementById('compact-company-list')) throw new Error('Wide company directory must return to the table.');
  console.log(JSON.stringify({ narrowMenu: 'open-close-navigate', compactCompany: 'all-fields-open-qa-2', desktopResize: true, passed: true }));
  if (errors.length) throw new Error(errors.join(' | '));
 } finally { await window.happyDOM.abort(); window.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
