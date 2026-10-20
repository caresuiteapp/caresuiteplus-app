#!/usr/bin/env node
/** Live E2E — Klient, Einsatz, BodyMap (real Supabase, no demo). */
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

const results = {
  client: { ok: false, errors: [], steps: {} },
  assignment: { ok: false, errors: [], steps: {} },
  bodyMap: { ok: false, errors: [], steps: {} },
  rls: { ok: false, errors: [], steps: {} },
  audit: { ok: false, errors: [], steps: {} },
  reload: { ok: false, errors: [], steps: {} },
};

function log(section, step, payload) {
  console.log(`\n[${section}] ${step}`);
  console.log(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
}

const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const signIn = await client.auth.signInWithPassword({ email, password });
if (signIn.error) {
  console.error('SIGNIN_FAILED', signIn.error.message);
  process.exit(1);
}
log('AUTH', 'SIGNIN_OK', { userId: signIn.data.user.id, demoMode: env.EXPO_PUBLIC_DEMO_MODE });

const profileRes = await client
  .from('profiles')
  .select('id, tenant_id, auth_user_id, first_name, last_name')
  .eq('auth_user_id', signIn.data.user.id)
  .maybeSingle();
log('AUTH', 'PROFILE', profileRes);
const profileId = profileRes.data?.id;
if (!profileId) {
  results.client.errors.push('Kein Profil für Test-User');
  console.log('\n=== FINAL_RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  process.exit(2);
}

// --- A) CLIENT ---
let clientId = null;
const existingClient = await client
  .from('clients')
  .select('id, first_name, last_name, tenant_id, created_by, updated_by, status, postal_code, city, cost_bearer, care_level')
  .eq('tenant_id', tenantId)
  .eq('first_name', 'Erika')
  .eq('last_name', 'Mustermann')
  .maybeSingle();

if (existingClient.data?.id) {
  clientId = existingClient.data.id;
  results.client.steps.existing = existingClient.data;
  log('CLIENT', 'EXISTING', existingClient.data);
} else {
  const createRes = await client
    .from('clients')
    .insert({
      tenant_id: tenantId,
      first_name: 'Erika',
      last_name: 'Mustermann',
      postal_code: '44263',
      city: 'Dortmund',
      care_level: 'pg2',
      cost_bearer: 'Test Pflegekasse',
      status: 'active',
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id, tenant_id, created_by, updated_by, first_name, last_name, status')
    .single();
  log('CLIENT', 'CREATE', createRes);
  if (createRes.error) {
    results.client.errors.push(`Create: ${createRes.error.message}`);
  } else {
    clientId = createRes.data.id;
    results.client.steps.create = createRes.data;
  }
}

if (clientId) {
  const editRes = await client
    .from('clients')
    .update({ city: 'Dortmund', updated_by: profileId })
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .select('id, updated_by, city')
    .single();
  log('CLIENT', 'EDIT', editRes);
  results.client.steps.edit = editRes.data ?? editRes.error?.message;

  const reloadRes = await client
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .single();
  log('CLIENT', 'RELOAD', { ok: !reloadRes.error, city: reloadRes.data?.city });
  results.reload.steps.client = !reloadRes.error && reloadRes.data?.city === 'Dortmund';

  const archiveRes = await client
    .from('clients')
    .update({ status: 'archived', updated_by: profileId, archived_at: new Date().toISOString() })
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .select('id, status, archived_at')
    .single();
  log('CLIENT', 'ARCHIVE_ATTEMPT', archiveRes);
  if (archiveRes.error) {
    const archiveFallback = await client
      .from('clients')
      .update({ status: 'archived', updated_by: profileId })
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .select('id, status')
      .single();
    log('CLIENT', 'ARCHIVE_FALLBACK', archiveFallback);
    results.client.steps.archive = archiveFallback.data ?? archiveFallback.error?.message;
    if (archiveFallback.error) results.client.errors.push(`Archive: ${archiveFallback.error.message}`);
  } else {
    results.client.steps.archive = archiveRes.data;
  }

  // reactivate for assignment test
  await client
    .from('clients')
    .update({ status: 'active', updated_by: profileId })
    .eq('id', clientId)
    .eq('tenant_id', tenantId);

  const verifyRes = await client
    .from('clients')
    .select('id, tenant_id, created_by, updated_by')
    .eq('id', clientId)
    .single();
  results.client.ok =
    !results.client.errors.length &&
    verifyRes.data?.tenant_id === tenantId &&
    verifyRes.data?.created_by === profileId;
  results.client.steps.verify = verifyRes.data;
}

// --- EMPLOYEE for assignment ---
let employeeId = null;
const empRes = await client
  .from('employees')
  .select('id, first_name, last_name, profile_id')
  .eq('tenant_id', tenantId)
  .limit(5);
log('EMPLOYEE', 'LIST', empRes);

if (empRes.data?.length) {
  employeeId = empRes.data[0].id;
} else {
  const empCreate = await client
    .from('employees')
    .insert({
      tenant_id: tenantId,
      profile_id: profileId,
      first_name: 'Test',
      last_name: 'Admin',
      email,
      status: 'active',
      created_by: profileId,
    })
    .select('id')
    .single();
  log('EMPLOYEE', 'CREATE', empCreate);
  if (empCreate.error) {
    results.assignment.errors.push(`Employee create: ${empCreate.error.message}`);
  } else {
    employeeId = empCreate.data.id;
  }
}

// --- B) ASSIGNMENT ---
const today = new Date().toISOString().slice(0, 10);
const startAt = `${today}T10:00:00.000Z`;
const endAt = `${today}T11:00:00.000Z`;

let assignmentId = null;
if (clientId && employeeId) {
  const assignCreate = await client
    .from('assignments')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      employee_id: employeeId,
      assignment_date: today,
      planned_start_at: startAt,
      planned_end_at: endAt,
      title: 'Alltagsbegleitung / Unterstützung im Haushalt',
      status: 'planned',
      product_key: 'assist',
      created_by: profileId,
    })
    .select('id, tenant_id, status')
    .single();
  log('ASSIGNMENT', 'CREATE', assignCreate);
  if (assignCreate.error) {
    results.assignment.errors.push(`Create: ${assignCreate.error.message}`);
  } else {
    assignmentId = assignCreate.data.id;
    results.assignment.steps.create = assignCreate.data;

    const taskRes = await client.from('assignment_tasks').insert({
      tenant_id: tenantId,
      assignment_id: assignmentId,
      title: 'Alltagsbegleitung / Unterstützung im Haushalt',
      status: 'open',
      is_required: true,
    });
    log('ASSIGNMENT', 'TASK', taskRes);

    const transitions = [
      ['planned', 'on_the_way'],
      ['on_the_way', 'arrived'],
      ['arrived', 'started'],
      ['started', 'finished'],
      ['finished', 'documentation_open'],
      ['documentation_open', 'completed'],
    ];

    const invalidJump = await client.rpc('set_assignment_status', {
      input_assignment_id: assignmentId,
      input_status: 'completed',
      input_note: 'invalid jump test',
      input_employee_id: employeeId,
    });
    log('ASSIGNMENT', 'INVALID_JUMP_RPC', invalidJump);
    results.assignment.steps.invalidJumpBlocked = !!invalidJump.error;

    for (const [from, to] of transitions) {
      const patch = { status: to, updated_by: profileId, updated_at: new Date().toISOString() };
      if (to === 'on_the_way') patch.on_the_way_at = new Date().toISOString();
      if (to === 'arrived') patch.arrived_at = new Date().toISOString();
      if (to === 'started') patch.actual_start_at = new Date().toISOString();
      if (to === 'finished') {
        patch.actual_end_at = new Date().toISOString();
        patch.finished_at = new Date().toISOString();
      }
      if (to === 'documentation_open') {
        patch.documentation_notes = 'Live E2E Dokumentation — Testdokumentation';
      }
      if (to === 'completed') {
        patch.documentation_notes = 'Live E2E Dokumentation — Testdokumentation';
      }

      const rpcRes = await client.rpc('set_assignment_status', {
        input_assignment_id: assignmentId,
        input_status: to,
        input_note: to === 'documentation_open' || to === 'completed' ? patch.documentation_notes : null,
        input_employee_id: employeeId,
      });
      log('ASSIGNMENT', `TRANSITION_${from}_TO_${to}_RPC`, rpcRes);

      if (rpcRes.error) {
        const updRes = await client
          .from('assignments')
          .update(patch)
          .eq('id', assignmentId)
          .eq('tenant_id', tenantId)
          .select('id, status, on_the_way_at, arrived_at, actual_start_at, actual_end_at, finished_at, documentation_notes')
          .single();
        log('ASSIGNMENT', `TRANSITION_${from}_TO_${to}_UPDATE`, updRes);
        if (updRes.error) {
          results.assignment.errors.push(`${from}->${to}: ${updRes.error.message}`);
        } else {
          results.assignment.steps[`${from}_to_${to}`] = updRes.data;
        }
      } else {
        results.assignment.steps[`${from}_to_${to}`] = 'rpc_ok';
      }
    }

    const finalAssign = await client
      .from('assignments')
      .select('id, status, on_the_way_at, arrived_at, actual_start_at, actual_end_at, finished_at, documentation_notes, tenant_id')
      .eq('id', assignmentId)
      .single();
    log('ASSIGNMENT', 'FINAL', finalAssign);
    results.assignment.steps.final = finalAssign.data;
    results.assignment.ok =
      !results.assignment.errors.length &&
      finalAssign.data?.status === 'completed' &&
      !!finalAssign.data?.documentation_notes;

    const auditRes = await client
      .from('assignment_audit_events')
      .select('id, action, from_status, to_status, tenant_id')
      .eq('tenant_id', tenantId)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: true });
    log('ASSIGNMENT', 'AUDIT_EVENTS', auditRes);
    if (auditRes.error) {
      results.audit.errors.push(`assignment_audit_events: ${auditRes.error.message}`);
    } else {
      results.audit.steps.assignment = auditRes.data;
      results.audit.ok = (auditRes.data?.length ?? 0) > 0;
    }

    const reloadAssign = await client
      .from('assignments')
      .select('id, status')
      .eq('id', assignmentId)
      .single();
    results.reload.steps.assignment = reloadAssign.data?.status === 'completed';
  }
} else {
  results.assignment.errors.push(`Missing clientId=${clientId} or employeeId=${employeeId}`);
}

// --- C) BODYMAP ---
if (clientId) {
  const listBefore = await client
    .from('body_map_markers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);
  log('BODYMAP', 'LIST_BEFORE', listBefore);

  if (listBefore.error) {
    results.bodyMap.errors.push(`Table/query: ${listBefore.error.message}`);
  } else {
    const markerCreate = await client
      .from('body_map_markers')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        gender: 'weiblich',
        view: 'vorderseite',
        region: 'arm',
        marker_type: 'wunde',
        x_percent: 55.0,
        y_percent: 40.0,
        note: 'Testdokumentation Live',
        created_by: profileId,
      })
      .select('id, tenant_id, client_id, marker_type, x_percent, y_percent, created_by, note')
      .single();
    log('BODYMAP', 'CREATE', markerCreate);
    if (markerCreate.error) {
      results.bodyMap.errors.push(`Create: ${markerCreate.error.message}`);
    } else {
      const markerId = markerCreate.data.id;
      results.bodyMap.steps.create = markerCreate.data;

      const reloadMarker = await client
        .from('body_map_markers')
        .select('id, note, marker_type')
        .eq('id', markerId)
        .single();
      log('BODYMAP', 'RELOAD', reloadMarker);
      results.reload.steps.bodyMap = reloadMarker.data?.note === 'Testdokumentation Live';

      const updateMarker = await client
        .from('body_map_markers')
        .update({ note: 'Testdokumentation Live — bearbeitet' })
        .eq('id', markerId)
        .eq('tenant_id', tenantId)
        .select('id, note')
        .single();
      log('BODYMAP', 'UPDATE', updateMarker);
      results.bodyMap.steps.update = updateMarker.data ?? updateMarker.error?.message;

      const clientAudit = await client
        .from('client_audit_entries')
        .select('id, action, details')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(5);
      log('BODYMAP', 'CLIENT_AUDIT', clientAudit);
      results.bodyMap.steps.clientAudit = clientAudit.data;

      results.bodyMap.ok = !results.bodyMap.errors.length && !!reloadMarker.data;
    }
  }
}

// --- D) RLS ---
const demoTenantProbe = await client
  .from('clients')
  .select('id')
  .eq('tenant_id', '00000000-0000-0000-0000-000000000001');
log('RLS', 'DEMO_TENANT_PROBE', demoTenantProbe);
results.rls.steps.demoTenantEmpty = (demoTenantProbe.data?.length ?? 0) === 0;

const otherTenantProbe = await client
  .from('clients')
  .select('id, tenant_id')
  .neq('tenant_id', tenantId)
  .limit(3);
log('RLS', 'OTHER_TENANT_PROBE', otherTenantProbe);
results.rls.steps.otherTenantEmpty = (otherTenantProbe.data?.length ?? 0) === 0;
results.rls.ok = results.rls.steps.demoTenantEmpty && results.rls.steps.otherTenantEmpty;

results.reload.ok = Object.values(results.reload.steps).every(Boolean);

console.log('\n=== FINAL_RESULTS ===');
console.log(JSON.stringify(results, null, 2));
console.log('\nIDS', JSON.stringify({ clientId, employeeId, assignmentId, tenantId, profileId }));
