#!/usr/bin/env node
import { chromium, devices } from 'playwright';
import { loadAuditEnv, pick } from './scripts/audit/lib/auditSupabaseClient.mjs';

const baseUrl = (process.env.AUDIT_WEB_URL ?? 'http://localhost:8091').replace(/\/$/, '');
const env = loadAuditEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
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
  clientId: data.clientId,
};

const browser = await chromium.launch({ headless: true });
for (const name of ['iPhone 13', 'iPad Pro 11']) {
  const ctx = await browser.newContext({ ...devices[name], locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, v),
    ['caresuite.portal.session.v1', JSON.stringify(portalSession)],
  );
  await page.goto(`${baseUrl}/portal/client/messages`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const row = page.locator('[data-testid^="portal-thread-row-"]').first();
  await row.evaluate((el) => el.click());
  await page.waitForTimeout(3000);
  const composer = await page.locator('[data-testid="messaging-composer"]').isVisible().catch(() => false);
  const mobile = await page.locator('[data-testid="messenger-mobile-thread"]').isVisible().catch(() => false);
  console.log(name, { composer, mobile, width: devices[name].viewport?.width });
  await ctx.close();
}
await browser.close();
