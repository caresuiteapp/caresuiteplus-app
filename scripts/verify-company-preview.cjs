// DOM startup and navigation checks only. No browser, URL fetch, screenshots, or live API access.
const fs = require('node:fs');
const path = require('node:path');
(async () => {
 const { Window } = await import('happy-dom');
 const window = new Window({ url: 'https://ui-test.invalid/?platform=1#/auth/register' });
 // This DOM host has no font loader or layout engine. Simulate font readiness only.
 window.FontFace = class { constructor(family) { this.family = family; this.status = 'loaded'; this.loaded = Promise.resolve(this); } load() { return this.loaded; } };
 Object.defineProperty(window.document, 'fonts', { value: { ready: Promise.resolve(), check: () => true, load: async () => [{}], add() {}, delete() {}, forEach() {} } });
 // Happy DOM has no layout engine; provide viewport dimensions for RN's resize events.
 Object.defineProperties(window.document.documentElement, {
  clientWidth: { get: () => window.innerWidth },
  clientHeight: { get: () => window.innerHeight },
 });
 window.HTMLMediaElement.prototype.play = async function() {};
 window.HTMLMediaElement.prototype.pause = function() {};
 const errors = [];
 window.addEventListener('error', event => errors.push(event.message));
 window.console.error = (...args) => errors.push(args.map(value => value?.message ?? String(value)).join(' '));
 window.fetch = async () => { throw new Error('Network access is disabled in the DOM test.'); };
 window.document.body.innerHTML = '<div id="qa"></div><div id="preview"></div>';
 const bundle = fs.readFileSync(path.join(process.env.TEMP || '/tmp', 'caresuite-company-preview', 'company.js'), 'utf8');
 try {
  window.eval(bundle);
  await new Promise(resolve => setTimeout(resolve, 500));
  const intro = window.document.querySelector('[data-caresuite-start-intro] video');
  const content = window.document.querySelector('[data-caresuite-intro-content]');
  if (!intro || !content.hasAttribute('inert') || !intro.src.includes('.mp4')) throw new Error('Web intro must gate the preview with a bundled video.');
  intro.dispatchEvent(new window.Event('ended'));
  await new Promise(resolve => setTimeout(resolve, 250));
  if (content.hasAttribute('inert') || window.document.querySelector('[data-caresuite-start-intro]')) throw new Error('Web intro did not release the preview after playback.');
  console.log(JSON.stringify({ introGate: true, mediaEventsSimulated: true }));
  const checks = [['/desktop', 'Mein Desktop'], ['/auth/register', 'Firmenname'], ['/platform/tenants', 'Musterbetrieb Pflege'], ['/platform/tenants/qa-1', 'Datenklassifizierung'], ['/platform/support', 'Rückfrage zum gespeicherten Einsatz']];
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
  window.location.hash = '/desktop';
  await new Promise(resolve => setTimeout(resolve, 1000));
  const widget = control('Klient:innen öffnen');
  const heading = widget?.querySelector('[role="heading"], h1, h2, h3, h4');
  const artwork = widget?.querySelector('img');
  if (!heading || !artwork || !(heading.compareDocumentPosition(artwork) & 4)) throw new Error('Desktop widget heading must precede its artwork.');
  if (parseFloat(window.getComputedStyle(heading).fontSize) < 20) throw new Error('Desktop widget heading lost its readable base size.');
  for (const width of [320, 780, 1440, 2560, 3440]) {
   window.happyDOM.setWindowSize({ width, height: 1080 });
   await new Promise(resolve => setTimeout(resolve, 450));
   if (!control('Apps und Widgets öffnen')) throw new Error('Desktop actions missing at ' + width);
   if ((width >= 900) !== Boolean(window.document.getElementById('desktop-home-navigation'))) throw new Error('Desktop navigation mode is wrong at ' + width);
  }
  window.happyDOM.setWindowSize({ width: 780, height: 800 });
  await new Promise(resolve => setTimeout(resolve, 450));
  control('Navigation öffnen').click();
  await new Promise(resolve => setTimeout(resolve, 450));
  const dialog = window.document.querySelector('[aria-modal="true"], [role="dialog"]');
  if (!dialog) throw new Error('Compact desktop menu did not open as a dialog.');
  dialog.querySelector('[aria-label="Navigation schließen"]').click();
  await new Promise(resolve => setTimeout(resolve, 450));
  // Happy DOM does not run CSS keyframes; deliver the host's animation-end event.
  for (const node of window.document.querySelectorAll('div')) {
   if (window.getComputedStyle(node).animationDuration === '250ms') node.dispatchEvent(new window.Event('animationend', { bubbles: true }));
  }
  await new Promise(resolve => setTimeout(resolve, 100));
  if (window.document.querySelector('[aria-modal="true"], [role="dialog"]')) throw new Error('Compact desktop menu did not close.');
  control('Apps und Widgets öffnen').click();
  await new Promise(resolve => setTimeout(resolve, 450));
  if (!control('Apps und Widgets durchsuchen')) throw new Error('Desktop app search is missing.');
  control('Center schließen').click();
  await new Promise(resolve => setTimeout(resolve, 450));
  console.log(JSON.stringify({ desktopTitleBeforeArtwork: true, desktopBaseFont: '20px', desktopWidths: [320,780,1440,2560,3440], desktopMenuAndCenter: true, geometryVerified: false }));
  if (errors.length) throw new Error(errors.join(' | '));
 } finally { await window.happyDOM.abort(); window.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
