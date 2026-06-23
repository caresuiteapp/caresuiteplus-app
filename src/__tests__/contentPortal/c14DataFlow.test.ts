import { describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

describe('C.14 seed creates assignments alongside assist_visits', () => {
  const seedPath = path.join(root, 'scripts/audit/contentPortalE2eSeed.mjs');

  it('seed script exists', () => {
    expect(existsSync(seedPath)).toBe(true);
  });

  it('seed creates assist_visits rows', () => {
    const seed = readFileSync(seedPath, 'utf8');
    expect(seed).toContain("restUpsert('assist_visits'");
    expect(seed).toContain('VISIT_TODAY');
    expect(seed).toContain('VISIT_TOMORROW');
  });

  it('seed creates assignments rows for employee portal', () => {
    const seed = readFileSync(seedPath, 'utf8');
    expect(seed).toContain("restUpsert('assignments'");
    expect(seed).toContain('ASSIGN_TODAY');
    expect(seed).toContain('ASSIGN_TOMORROW');
    expect(seed).toContain("status: 'confirmed'");
    expect(seed).toContain("status: 'planned'");
  });

  it('seed creates message threads', () => {
    const seed = readFileSync(seedPath, 'utf8');
    expect(seed).toContain("restUpsert('message_threads'");
    expect(seed).toContain('THREAD_EMPLOYEE');
    expect(seed).toContain('THREAD_CLIENT');
    expect(seed).toContain("thread_type: 'employee'");
    expect(seed).toContain("thread_type: 'client'");
  });

  it('seed creates messages in threads', () => {
    const seed = readFileSync(seedPath, 'utf8');
    expect(seed).toContain("restUpsert('messages'");
    expect(seed).toContain('MSG_EMP_1');
    expect(seed).toContain('MSG_CLIENT_1');
  });

  it('seed creates proof with portal_visible flag', () => {
    const seed = readFileSync(seedPath, 'utf8');
    expect(seed).toContain("restUpsert('assist_visit_proofs'");
    expect(seed).toContain('portal_visible');
    expect(seed).toContain('portal_release_status');
  });

  it('assignment statuses match PORTAL_APPOINTMENT_STATUSES', () => {
    const svc = readFileSync(
      path.join(root, 'src/lib/portal/portalAppointmentsLiveService.ts'),
      'utf8',
    );
    expect(svc).toContain("'planned'");
    expect(svc).toContain("'confirmed'");
    const seed = readFileSync(seedPath, 'utf8');
    expect(seed).toContain("status: 'confirmed'");
    expect(seed).toContain("status: 'planned'");
  });
});

describe('C.14 employee portal uses assignments table', () => {
  it('portalAppointmentsLiveService queries assignments table', () => {
    const svc = readFileSync(
      path.join(root, 'src/lib/portal/portalAppointmentsLiveService.ts'),
      'utf8',
    );
    expect(svc).toContain("fromUnknownTable(supabase, 'assignments')");
    expect(svc).toContain('PORTAL_APPOINTMENT_STATUSES');
  });

  it('employee portal tab uses PortalAppointmentsTab', () => {
    const tab = readFileSync(
      path.join(root, 'app/portal/employee/(tabs)/assignments.tsx'),
      'utf8',
    );
    expect(tab).toContain('PortalAppointmentsTab');
  });

  it('client portal tab uses PortalAppointmentsTab', () => {
    const tab = readFileSync(
      path.join(root, 'app/portal/client/(tabs)/appointments.tsx'),
      'utf8',
    );
    expect(tab).toContain('PortalAppointmentsTab');
  });
});

describe('C.14 message flow data integrity', () => {
  it('message threads reference employee and client IDs', () => {
    const seed = readFileSync(
      path.join(root, 'scripts/audit/contentPortalE2eSeed.mjs'),
      'utf8',
    );
    expect(seed).toContain('employee_id: EMPLOYEE');
    expect(seed).toContain('client_id: CLIENT_A');
  });

  it('PortalMessagesListShell component exists', () => {
    const msgs = readFileSync(
      path.join(root, 'src/screens/communication/PortalMessagesScreens.tsx'),
      'utf8',
    );
    expect(msgs).toContain('PortalMessagesListShell');
    expect(msgs).toContain('EmployeePortalMessagesScreen');
    expect(msgs).toContain('ClientPortalMessagesScreen');
  });
});

describe('C.14 browser E2E test exists', () => {
  const e2ePath = path.join(root, 'scripts/audit/contentPortalC14BrowserE2e.mjs');

  it('C.14 browser E2E script exists', () => {
    expect(existsSync(e2ePath)).toBe(true);
  });

  it('sends real messages with C14-MA and C14-KLIENT prefix', () => {
    const e2e = readFileSync(e2ePath, 'utf8');
    expect(e2e).toContain('C14-MA-');
    expect(e2e).toContain('C14-KLIENT-');
    expect(e2e).toContain('sendMessageViaApi');
  });

  it('tests proof release and revoke', () => {
    const e2e = readFileSync(e2ePath, 'utf8');
    expect(e2e).toContain('setProofPortalRelease');
    expect(e2e).toContain('proof_release_grant');
    expect(e2e).toContain('proof_release_revoke');
  });

  it('uses msedge channel', () => {
    const e2e = readFileSync(e2ePath, 'utf8');
    expect(e2e).toContain("channel: 'msedge'");
  });
});
