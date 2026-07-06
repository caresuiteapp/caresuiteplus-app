#!/usr/bin/env node
/** Quick iPhone messenger thread check for K.1.4 */
import { chromium, devices } from 'playwright';
import { loadAuditEnv, pick } from './scripts/audit/lib/auditSupabaseClient.mjs';

const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8091').replace(/\/$/, '');
const PORTAL_SESSION_KEY = 'caresuite.portal.session.v1';

async function login(env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = pick(env, ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  const username = pick(env, ['AUDIT_CLIENT_USERNAME', 'TEST_CLIENT_USERNAME']);
  const code = pick(env, ['AUDIT_CLIENT_PORTAL_CODE', 'TEST_CLIENT_PORTAL_CODE']);
  const res = await fetch(`${url}/functions/v1/client-portal-login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, code }),
  });
  const data = await res.json();
  const portalSession = {
    sessionToken: data.sessionToken,
    tenantId: data.tenantId,
    loginType: 'client_portal',
    roleKey: 'client_portal',
    expiresAt: data.expiresAt,
    accountId: data.portalAccountId,
    clientId: data.clientId ?? null,
    displayName: data.displayName?.trim() || undefined,
  };
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  let sbPayload = null;
  if (data.supabaseAccessToken) {
    sbPayload = JSON.stringify({
      access_token: data.supabaseAccessToken,
      refresh_token: data.supabaseRefreshToken,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: null,
    });
  }
  return { portalSession, storageKey, sbPayload };
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
const page = await ctx.newPage();
const env = loadAuditEnv();
const loginData = await login(env);
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ([k, v, ak, av]) => {
    localStorage.setItem(k, v);
    if (ak && av) localStorage.setItem(ak, av);
  },
  [PORTAL_SESSION_KEY, JSON.stringify(loginData.portalSession), loginData.storageKey, loginData.sbPayload],
);
await page.goto(`${baseUrl}/portal/client/messages`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const row = page.locator('[data-testid^="portal-thread-row-"]').first();
const threadId = await row.getAttribute('data-testid').then((id) => id?.replace('portal-thread-row-', '') ?? null);
console.log('row visible', await row.isVisible().catch(() => false), 'threadId', threadId);
for (const [label, action] of [
  ['testid click', () => row.click({ force: true })],
  ['text click', () => page.getByText('E2E Klienten-Nachricht').click({ force: true })],
  ['evaluate click', () => row.evaluate((el) => el.click())],
]) {
  await page.goto(`${baseUrl}/portal/client/messages`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await action();
  await page.waitForTimeout(2500);
  const composer = await page.locator('[data-testid="messaging-composer"]').isVisible().catch(() => false);
  const mobile = await page.locator('[data-testid="messenger-mobile-thread"]').isVisible().catch(() => false);
  console.log(label, { composer, mobile });
  if (composer || mobile) break;
}
console.log('mobile thread', await page.locator('[data-testid="messenger-mobile-thread"]').isVisible().catch(() => false));
console.log('back btn', await page.locator('[data-testid="messenger-back-to-list"]').isVisible().catch(() => false));
console.log('bottom nav', await page.locator('[data-testid="portal-mobile-nav"]').isVisible().catch(() => false));
await page.screenshot({ path: 'docs/audit/k14-iphone-messenger-diag.png', fullPage: true });
await browser.close();
