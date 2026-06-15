#!/usr/bin/env node
/** Live BodyMap E2E — no demo, real Supabase only. */
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

const email = process.argv[2] ?? 'test-admin+1781543170@caresuiteplus.local';
const password = process.argv[3] ?? 'Test1234!0';
const tenantId = process.argv[4] ?? 'a4ba83bd-65db-46cf-8cf7-61492cc78315';

const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function log(step, payload) {
  console.log(`\n=== ${step} ===`);
  console.log(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
}

const signIn = await client.auth.signInWithPassword({ email, password });
if (signIn.error) {
  log('SIGNIN_FAILED', signIn.error.message);
  process.exit(1);
}
log('SIGNIN_OK', { userId: signIn.data.user.id });

const profileRes = await client
  .from('profiles')
  .select('id, tenant_id, auth_user_id')
  .eq('auth_user_id', signIn.data.user.id)
  .maybeSingle();
log('PROFILE', profileRes);

const profileId = profileRes.data?.id ?? null;

const clientsBefore = await client.from('clients').select('id, first_name, last_name').eq('tenant_id', tenantId);
log('CLIENTS_BEFORE', clientsBefore);

let clientId = clientsBefore.data?.[0]?.id ?? null;
if (!clientId) {
  const created = await client
    .from('clients')
    .insert({
      tenant_id: tenantId,
      first_name: 'BodyMap',
      last_name: 'Test',
      status: 'active',
    })
    .select('id')
    .single();
  log('CLIENT_CREATE', created);
  clientId = created.data?.id ?? null;
}

if (!clientId) {
  log('BLOCKED', 'Kein Test-Client — BodyMap-Test nicht möglich.');
  process.exit(2);
}

const listBefore = await client
  .from('body_map_markers')
  .select('id, tenant_id, client_id, marker_type, note')
  .eq('tenant_id', tenantId)
  .eq('client_id', clientId);
log('BODY_MAP_LIST_BEFORE', listBefore);

const createMarker = await client
  .from('body_map_markers')
  .insert({
    tenant_id: tenantId,
    client_id: clientId,
    gender: 'weiblich',
    view: 'vorderseite',
    region: 'rumpf',
    marker_type: 'wunde',
    x_percent: 42.5,
    y_percent: 33.0,
    note: 'E2E Verletzung/Wunde · Lokalisation Rumpf · Schmerz 6/10',
    created_by: profileId,
  })
  .select('id, tenant_id, client_id, created_by, note')
  .single();
log('BODY_MAP_CREATE', createMarker);

let markerId = createMarker.data?.id ?? null;

if (markerId) {
  const listAfter = await client
    .from('body_map_markers')
    .select('id, note, updated_at')
    .eq('id', markerId)
    .maybeSingle();
  log('BODY_MAP_RELOAD', listAfter);

  const update = await client
    .from('body_map_markers')
    .update({ note: 'E2E aktualisiert — Verlauf Test', updated_at: new Date().toISOString() })
    .eq('id', markerId)
    .eq('tenant_id', tenantId)
    .select('id, note')
    .single();
  log('BODY_MAP_UPDATE', update);

  const audit = await client
    .from('client_audit_entries')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      action: 'BodyMap-Marker angelegt',
      actor_name: 'BodyMap',
      details: 'E2E audit probe',
    })
    .select('id')
    .maybeSingle();
  log('AUDIT_CLIENT_AUDIT_ENTRIES', audit);

  const auditLogs = await client
    .from('audit_logs')
    .select('id, action, entity_type')
    .eq('tenant_id', tenantId)
    .limit(3);
  log('AUDIT_LOGS_SAMPLE', auditLogs);

  const woundInsert = await client
    .from('wounds')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      title: 'E2E Wunde',
      body_location: 'Rumpf vorderseite',
      body_location_x: 42.5,
      body_location_y: 33,
      wound_type: 'Druckstelle',
      status: 'active',
      notes: 'E2E wound table probe',
      created_by: profileId,
    })
    .select('id, tenant_id, client_id, created_by')
    .single();
  log('WOUNDS_CREATE', woundInsert);

  const deleteMarker = await client
    .from('body_map_markers')
    .delete()
    .eq('id', markerId)
    .eq('tenant_id', tenantId);
  log('BODY_MAP_DELETE', deleteMarker);
}

const rlsProbe = await client
  .from('body_map_markers')
  .select('id')
  .eq('tenant_id', '00000000-0000-0000-0000-000000000001');
log('RLS_OTHER_TENANT_PROBE', rlsProbe);

console.log('\nTEST_CLIENT_ID', clientId);
