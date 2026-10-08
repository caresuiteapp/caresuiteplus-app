/* Public operational settings. No analytics, identities, cookies or form contents. */
(() => {
  'use strict';
  if (!['www.caresuiteplus.app', 'caresuiteplus.app'].includes(window.location.hostname) || window.__csPlatformRuntime) return;
  window.__csPlatformRuntime = true;
  const release = 'caresuite-platform-runtime-controls-20261007';
  const endpoint = 'https://euagyyztvmemuaiumvxm.supabase.co/functions/v1/platform-observation';
  const key = 'sb_publishable_Ytq7qbmiw1oBnZze7sEg8w_ykL-DAa0';
  let settings = null, pending = false, overlay = null, notice = null, previousFocus = null, originalOverflow = '';
  const hidden = new Map();
  const registrationLinks = new Map();
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const exempt = path === '/platform' || path.startsWith('/platform/') || [
    '/impressum', '/datenschutz', '/nutzungsbedingungen', '/agb', '/support',
    '/auth/forgot-password', '/auth/reset-password', '/auth/recovery-bridge',
  ].includes(path);
  const registrationPath = value => ['/auth/register', '/auth/register-business', '/liquid-command/access/register'].includes(value.replace(/\/+$/, ''));
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function hideContent() {
    for (const node of document.body.children) {
      if (node === overlay || node === notice || node.tagName === 'STYLE' || node.tagName === 'SCRIPT') continue;
      if (!hidden.has(node)) hidden.set(node, { inert: node.hasAttribute('inert'), aria: node.getAttribute('aria-hidden') });
      node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true');
    }
  }
  function restoreContent() {
    for (const [node, before] of hidden) {
      if (!before.inert) node.removeAttribute('inert');
      if (before.aria === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', before.aria);
    }
    hidden.clear();
    if (document.body.style.overflow === 'hidden') document.body.style.overflow = originalOverflow;
  }
  function apply() {
    if (!settings || !document.body) return;
    if (settings.notice) {
      if (!notice) { notice = element('aside', undefined, 'cs-public-runtime-notice'); notice.setAttribute('role', 'status'); notice.tabIndex = 0; document.body.prepend(notice); }
      notice.textContent = settings.notice;
    } else { notice?.remove(); notice = null; }
    for (const link of document.querySelectorAll('a[href]')) {
      let url; try { url = new URL(link.href, window.location.href); } catch { continue; }
      if (url.origin !== window.location.origin || !registrationPath(url.pathname)) continue;
      if (!settings.registrationEnabled || settings.maintenanceMode) {
        if (!registrationLinks.has(link)) registrationLinks.set(link, { aria: link.getAttribute('aria-disabled'), title: link.getAttribute('title') });
        link.setAttribute('aria-disabled', 'true'); link.setAttribute('title', 'Firmenregistrierung derzeit pausiert');
      } else if (registrationLinks.has(link)) {
        const before = registrationLinks.get(link);
        if (before.aria === null) link.removeAttribute('aria-disabled'); else link.setAttribute('aria-disabled', before.aria);
        if (before.title === null) link.removeAttribute('title'); else link.setAttribute('title', before.title);
        registrationLinks.delete(link);
      }
    }
    const maintenance = settings.maintenanceMode && !exempt;
    if (maintenance && !overlay) {
      previousFocus = document.activeElement;
      originalOverflow = document.body.style.overflow;
      overlay = element('div', undefined, 'cs-public-runtime-overlay'); overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'cs-public-runtime-title');
      overlay.setAttribute('aria-describedby', 'cs-public-runtime-message'); overlay.tabIndex = -1;
      const card = element('section', undefined, 'cs-public-runtime-card');
      const logo = element('img'); logo.src = '/care-suite-brand/wordmark.png'; logo.alt = 'CareSuite HealthOS';
      const heading = element('h1', 'CareSuite wird gerade gewartet'); heading.id = 'cs-public-runtime-title';
      const message = element('p', 'Website und Websoftware stehen vorübergehend nicht zur Verfügung. Bitte versuchen Sie es später erneut.'); message.id = 'cs-public-runtime-message';
      const details = element('p', undefined, 'cs-public-runtime-details'); details.id = 'cs-public-runtime-details';
      const actions = element('nav', undefined, 'cs-public-runtime-actions'); actions.setAttribute('aria-label', 'Hilfe und weitere Informationen');
      const retry = element('button', 'Erneut prüfen'); retry.type = 'button'; retry.addEventListener('click', () => void check()); actions.append(retry);
      for (const [href, label] of [['/support', 'Hilfe und Kontakt'], ['/datenschutz', 'Datenschutz'], ['/impressum', 'Impressum'], ['/platform/login', 'Plattformverwaltung']]) {
        const link = element('a', label); link.href = href; actions.append(link);
      }
      card.append(logo, heading, message, details, actions); overlay.append(card); document.body.append(overlay);
      document.body.style.overflow = 'hidden'; hideContent(); overlay.focus();
    }
    if (maintenance && overlay) {
      const details = document.getElementById('cs-public-runtime-details'); details.textContent = settings.notice;
      details.hidden = !settings.notice; hideContent();
    } else if (overlay) {
      overlay.remove(); overlay = null; restoreContent();
      if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
      previousFocus = null;
    }
  }
  async function check() {
    if (pending || document.visibilityState === 'hidden') return;
    pending = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(endpoint, { method: 'GET', headers: { apikey: key }, credentials: 'omit', cache: 'no-store', signal: controller.signal });
      const data = await response.json(), value = data?.runtime;
      if (!response.ok || !value || value.release !== release || typeof value.maintenanceMode !== 'boolean'
        || typeof value.registrationEnabled !== 'boolean' || typeof value.notice !== 'string' || Array.from(value.notice).length > 2000) return;
      settings = { maintenanceMode: value.maintenanceMode, registrationEnabled: value.registrationEnabled, notice: value.notice }; apply();
    } catch { /* Keep the last confirmed closure. Retry without collecting visitor data. */ }
    finally { clearTimeout(timer); pending = false; }
  }
  const style = element('style'); style.textContent = `
    .cs-public-runtime-notice{box-sizing:border-box;max-height:min(28vh,240px);overflow:auto;padding:16px clamp(16px,4vw,40px);background:#eaf4ff;color:#12385b;border-bottom:1px solid #b6d7f7;line-height:1.6;font-family:Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}
    .cs-public-runtime-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;align-items:safe center;overflow:auto;padding:clamp(16px,4vw,48px);background:radial-gradient(ellipse at 30% 0,#164c78,#06172b 65%);color:#eef8ff;font-family:CareSuite,CenturyGothic,Arial,sans-serif;line-height:1.65;box-sizing:border-box}
    .cs-public-runtime-card{box-sizing:border-box;width:min(100%,680px);padding:clamp(24px,4vw,44px);border:1px solid #4f7aa0;border-radius:30px;background:#0c2640;box-shadow:0 20px 80px #0005;overflow-wrap:anywhere}
    .cs-public-runtime-card img{display:block;width:min(100%,320px);height:auto;margin:0 0 32px}.cs-public-runtime-card h1{font-size:clamp(1.65rem,4vw,2.4rem);line-height:1.2;margin:0 0 20px;color:#fff}.cs-public-runtime-card p{margin:0 0 20px}.cs-public-runtime-details{padding:16px 20px;border-radius:18px;border:1px solid #456b8c;background:#133650;white-space:pre-wrap}.cs-public-runtime-details[hidden]{display:none}
    .cs-public-runtime-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.cs-public-runtime-actions a,.cs-public-runtime-actions button{box-sizing:border-box;display:inline-flex;justify-content:center;align-items:center;min-height:48px;border:1px solid #729aba;border-radius:14px;padding:10px 18px;background:#123955;color:#fff;font:inherit;text-decoration:none;cursor:pointer;text-align:center}
    .cs-public-runtime-actions button{background:#086bea;border-color:#086bea}.cs-public-runtime-actions a:focus-visible,.cs-public-runtime-actions button:focus-visible{outline:3px solid #b8eaff;outline-offset:4px}@media(max-width:560px){.cs-public-runtime-card{border-radius:24px}.cs-public-runtime-actions{flex-direction:column}.cs-public-runtime-actions>*{width:100%}}`;
  document.head.append(style);
  const observer = new MutationObserver(() => { if (overlay) hideContent(); });
  const start = () => { observer.observe(document.body, { childList: true }); apply(); void check(); };
  document.addEventListener('keydown', event => {
    if (!overlay || event.key !== 'Tab') return;
    const nodes = overlay.querySelectorAll('a[href],button:not(:disabled)'), first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === overlay)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === overlay)) { event.preventDefault(); first.focus(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  setInterval(() => void check(), 30_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void check(); });
  window.addEventListener('focus', () => void check());
})();
