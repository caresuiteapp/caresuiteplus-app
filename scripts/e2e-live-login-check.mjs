#!/usr/bin/env node
/** Live login + profile bootstrap check after registration. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error('Usage: node scripts/e2e-live-login-check.mjs <email> <password>');
  process.exit(1);
}

const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const signIn = await client.auth.signInWithPassword({ email, password });
console.log('SIGNIN_OK', !signIn.error);
if (signIn.error) {
  console.log('SIGNIN_ERROR', signIn.error.message);
  process.exit(1);
}

const userId = signIn.data.user?.id;
console.log('USER_ID', userId);

const profile = await client
  .from('profiles')
  .select('id, tenant_id, role_id, auth_user_id, first_name, last_name, full_name, email, roles(key)')
  .eq('id', userId)
  .maybeSingle();

console.log('PROFILE_SELECT_BY_ID', JSON.stringify(profile, null, 2));

const profileByAuth = await client
  .from('profiles')
  .select('id, tenant_id, auth_user_id, email')
  .eq('auth_user_id', userId)
  .maybeSingle();

console.log('PROFILE_SELECT_BY_AUTH_USER_ID', JSON.stringify(profileByAuth, null, 2));

const profileAppQuery = await client
  .from('profiles')
  .select('id, tenant_id, role_id, role_key, display_name, email, phone, avatar_url, created_at, updated_at, roles(key)')
  .eq('id', userId)
  .maybeSingle();

console.log('APP_TENANT_SERVICE_QUERY', JSON.stringify(profileAppQuery, null, 2));

const tenantId = profileByAuth.data?.tenant_id;
if (tenantId) {
  const moduleQuery = await client
    .from('tenant_products')
    .select('id, tenant_id, product_id, is_active, activated_at, access_source, included_by_module_key, is_base_included, billing_status, access_type, price_cents, premium_ready, products(key)')
    .eq('tenant_id', tenantId);

  console.log('APP_MODULE_ACCESS_QUERY', JSON.stringify(moduleQuery, null, 2));

  const moduleQueryRemote = await client
    .from('tenant_products')
    .select('id, tenant_id, product_key, status, is_default')
    .eq('tenant_id', tenantId);

  console.log('REMOTE_SCHEMA_MODULE_QUERY', JSON.stringify(moduleQueryRemote, null, 2));
}

