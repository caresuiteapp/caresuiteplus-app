/* Prepared for approved Web/Desktop collection. It stays off until the server explicitly enables it. */
(() => {
  if (window.__careSuitePlatformPresence) return;
  window.__careSuitePlatformPresence = true;
  const eligible = () => /^(www\.)?caresuiteplus\.app$/.test(window.location.hostname)
    && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl;
  if (!eligible()) return;
  const api = 'https://euagyyztvmemuaiumvxm.supabase.co';
  const apikey = 'sb_publishable_Ytq7qbmiw1oBnZze7sEg8w_ykL-DAa0';
  const release = 'caresuite-platform-operations-20261007';
  let enabled = false;
  let checking = false;
  let identity = null;
  let lastError = 0;
  async function request(path, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try { return await fetch(api + path, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  }
  async function send(fields, active = document.visibilityState === 'visible') {
    if (!enabled || !eligible()) return;
    try {
      if (!identity) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        identity = { sessionId: crypto.randomUUID(), sessionSecret: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') };
      }
      await request('/functions/v1/platform-observation', { method: 'POST', headers: { apikey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identity, surface: 'website', area: 'website', active, ...fields }), keepalive: !active });
    } catch { /* Optional collection never changes the public page. */ }
  }
  async function check() {
    if (checking || document.visibilityState === 'hidden' || !eligible()) return;
    checking = true;
    try {
      const response = await request('/rest/v1/rpc/platform_operations_release_status', { method: 'POST', headers: { apikey, 'Content-Type': 'application/json' }, body: '{}' });
      const status = response.ok ? await response.json() : null;
      enabled = false;
      if (status?.release === release && status.inventoryReady === true && status.observationReady === true) {
        const health = await request('/functions/v1/platform-observation', { headers: { apikey } });
        const collector = health.ok ? await health.json() : null;
        enabled = collector?.release === release && collector.ready === true;
      }
      if (enabled) void send({ kind: 'heartbeat' });
      else identity = null;
    } catch { enabled = false; identity = null; }
    finally { checking = false; }
  }
  const visibility = () => { void send({ kind: 'heartbeat' }); if (document.visibilityState === 'visible') void check(); };
  const error = category => {
    if (!enabled || Date.now() - lastError < 10000) return;
    lastError = Date.now();
    void send({ kind: 'error', category, operation: 'page' });
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', () => void send({ kind: 'heartbeat' }, false));
  window.addEventListener('pageshow', () => void check());
  window.addEventListener('error', () => error('render'), true);
  window.addEventListener('unhandledrejection', () => error('unexpected'));
  setInterval(() => { if (document.visibilityState === 'visible') void send({ kind: 'heartbeat' }); }, 30000);
  setInterval(() => void check(), 60000);
  void check();
})();
