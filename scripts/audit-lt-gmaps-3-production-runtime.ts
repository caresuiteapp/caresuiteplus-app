#!/usr/bin/env npx tsx
/**
 * LT.GMAPS.3 — Production runtime audit: auth as employee portal, probe all execution queries.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? '.', '..');
const REPORT = join(ROOT, '.audit-lt-gmaps-3-production-runtime-results.json');

const TENANT_ID = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const KEVIN_ASSIGNMENT_ID = '2a499c72-30f9-46bd-bfda-6a679ac85c73';
const KEVIN_EMPLOYEE_ID = 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2';

type ProbeResult = {
  id: string;
  label: string;
  ok: boolean;
  httpStatus: number;
  supabaseCode: string | null;
  supabaseMessage: string | null;
  rowCount: number | null;
};

function loadEnv() {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (/^(AUDIT_|EXPO_PUBLIC_SUPABASE_)/.test(key)) process.env[key] = val;
  }
}

async function loginEmployeePortal(
  username: string,
  password: string,
  supabaseUrl: string,
  anonKey: string,
) {
  const res = await fetch(`${supabaseUrl}/functions/v1/employee-portal-login`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    supabaseAccessToken?: string;
    account?: { employeeId?: string; tenantId?: string };
  };
  return {
    ok: res.ok && Boolean(data.ok && data.supabaseAccessToken),
    status: res.status,
    token: data.supabaseAccessToken ?? null,
    employeeId: data.account?.employeeId ?? null,
    tenantId: data.account?.tenantId ?? null,
    error: data.error ?? null,
  };
}

async function restGet(
  token: string,
  supabaseUrl: string,
  anonKey: string,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { message: text.slice(0, 400) } };
  }
}

async function restRpc(
  token: string,
  supabaseUrl: string,
  anonKey: string,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { message: text.slice(0, 400) } };
  }
}

function probeFromResponse(
  id: string,
  label: string,
  status: number,
  body: unknown,
  expectFailure = false,
): ProbeResult {
  const err = body as { code?: string; message?: string; hint?: string };
  if (expectFailure) {
    const failedAsExpected = status >= 400 || Boolean(err?.code);
    return {
      id,
      label,
      ok: failedAsExpected,
      httpStatus: status,
      supabaseCode: err?.code ?? String(status),
      supabaseMessage: err?.message ?? JSON.stringify(body).slice(0, 300),
      rowCount: null,
    };
  }
  if (status >= 400 || err?.code) {
    return {
      id,
      label,
      ok: false,
      httpStatus: status,
      supabaseCode: err?.code ?? String(status),
      supabaseMessage: err?.message ?? JSON.stringify(body).slice(0, 300),
      rowCount: null,
    };
  }
  const rows = Array.isArray(body) ? body : body ? [body] : [];
  return {
    id,
    label,
    ok: true,
    httpStatus: status,
    supabaseCode: null,
    supabaseMessage: null,
    rowCount: rows.length,
  };
}

const ASSIGNMENT_SELECT = encodeURIComponent(
  'id, tenant_id, client_id, employee_id, planned_start_at, planned_end_at, status, title, address_snapshot, clients(first_name, last_name, street, house_number, postal_code, city), employees(first_name, last_name)',
);

async function main() {
  loadEnv();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    '';
  const username = process.env.AUDIT_EMPLOYEE_USERNAME ?? '';
  const password = process.env.AUDIT_EMPLOYEE_PASSWORD ?? '';

  const probes: ProbeResult[] = [];
  const meta: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    supabaseUrl,
    projectRef: supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] ?? null,
    tenantId: TENANT_ID,
    assignmentId: KEVIN_ASSIGNMENT_ID,
    employeeId: KEVIN_EMPLOYEE_ID,
  };

  const loginResult = await loginEmployeePortal(username, password, supabaseUrl, anonKey);
  meta.authOk = loginResult.ok;
  meta.authStatus = loginResult.status;
  meta.authEmployeeId = loginResult.employeeId;
  meta.authTenantId = loginResult.tenantId;

  if (!loginResult.ok || !loginResult.token) {
    meta.error = loginResult.error ?? 'employee-portal-login failed';
    writeFileSync(REPORT, JSON.stringify({ meta, probes }, null, 2));
    console.error('Login failed:', meta.error);
    process.exit(2);
  }

  const token = loginResult.token;
  const employeeId = loginResult.employeeId ?? KEVIN_EMPLOYEE_ID;

  const paths: Array<[string, string, string]> = [
    ['G3-Q01', 'assignments nested clients/employees', `assignments?select=${ASSIGNMENT_SELECT}&tenant_id=eq.${TENANT_ID}&id=eq.${KEVIN_ASSIGNMENT_ID}`],
    ['G3-Q02', 'assignments scoped by employee_id', `assignments?select=id,status,employee_id&tenant_id=eq.${TENANT_ID}&id=eq.${KEVIN_ASSIGNMENT_ID}&employee_id=eq.${employeeId}`],
    ['G3-Q03', 'assignment_tasks', `assignment_tasks?select=*&tenant_id=eq.${TENANT_ID}&assignment_id=eq.${KEVIN_ASSIGNMENT_ID}`],
    ['G3-Q04', 'client_contacts safe emergency select', `client_contacts?select=full_name,phone,is_emergency_contact&tenant_id=eq.${TENANT_ID}&is_emergency_contact=eq.true&limit=1`],
    ['G3-Q05', 'client_contacts invalid is_emergency column', `client_contacts?select=full_name,is_emergency,is_emergency_contact&tenant_id=eq.${TENANT_ID}&limit=1`],
    ['G3-Q06', 'assist_tracking_sessions active', `assist_tracking_sessions?select=id,is_active,consent_granted_at,last_location_at&tenant_id=eq.${TENANT_ID}&visit_id=eq.${KEVIN_ASSIGNMENT_ID}&is_active=eq.true`],
    ['G3-Q07', 'assist_time_events', `assist_time_events?select=id,event_type,occurred_at&tenant_id=eq.${TENANT_ID}&visit_id=eq.${KEVIN_ASSIGNMENT_ID}&order=occurred_at.desc&limit=10`],
    ['G3-Q08', 'assist_location_points', `assist_location_points?select=id,recorded_at&tenant_id=eq.${TENANT_ID}&visit_id=eq.${KEVIN_ASSIGNMENT_ID}&order=recorded_at.desc&limit=1`],
    ['G3-Q09', 'clients direct read', `clients?select=id,first_name,last_name,street,house_number&tenant_id=eq.${TENANT_ID}&limit=1`],
    ['G3-Q10', 'employees nested in assignments', `assignments?select=id,employees(first_name,last_name)&tenant_id=eq.${TENANT_ID}&id=eq.${KEVIN_ASSIGNMENT_ID}`],
  ];

  for (const [id, label, path] of paths) {
    const res = await restGet(token, supabaseUrl, anonKey, path);
    const expectFailure = id === 'G3-Q05';
    probes.push(probeFromResponse(id, label, res.status, res.body, expectFailure));
  }

  const rpcScoped = await restRpc(token, supabaseUrl, anonKey, 'resolve_live_assignment', {
    p_tenant_id: TENANT_ID,
    p_raw_id: KEVIN_ASSIGNMENT_ID,
    p_employee_id: employeeId,
  });
  probes.push(probeFromResponse('G3-Q11', 'resolve_live_assignment RPC scoped', rpcScoped.status, rpcScoped.body));

  const failing = probes.filter((p) => !p.ok);
  meta.probePassCount = probes.filter((p) => p.ok).length;
  meta.probeTotal = probes.length;
  meta.failingQueries = failing.map((f) => ({
    id: f.id,
    code: f.supabaseCode,
    message: f.supabaseMessage,
  }));
  meta.rootCause = failing[0]
    ? `${failing[0].id}: ${failing[0].supabaseCode} — ${failing[0].supabaseMessage}`
    : null;

  writeFileSync(REPORT, JSON.stringify({ meta, probes }, null, 2));

  console.log('\n=== LT.GMAPS.3 Production Runtime Audit ===\n');
  for (const p of probes) {
    console.log(`${p.ok ? '✓' : '✗'} [${p.id}] ${p.label}`);
    if (!p.ok) console.log(`    ${p.supabaseCode}: ${p.supabaseMessage}`);
    else console.log(`    rows=${p.rowCount}`);
  }
  console.log(`\nErgebnis: ${meta.probePassCount}/${meta.probeTotal} bestanden`);
  if (meta.rootCause) console.log(`Root cause: ${meta.rootCause}`);
  console.log(`Report: ${REPORT}\n`);

  process.exit(failing.length > 0 ? 1 : 0);
}

main().catch((err) => {
  writeFileSync(REPORT, JSON.stringify({ error: String(err) }, null, 2));
  console.error(err);
  process.exit(3);
});
