import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  buildClientPortalActorScope,
  resolveClientPortalLinkRow,
} from '../../src/lib/portal/clientPortalActorScope.ts';

const id = (n) => `${String(n).padStart(8, '0')}-7777-4777-8777-777777777777`;

test('nur die authentifizierte Serververknüpfung bestimmt den Live-Pflegefall', () => {
  const scope = buildClientPortalActorScope({
    tenantId: id(1),
    accountId: id(2),
    roleKey: 'client_portal',
    cachedClientId: id(9),
    linkedClientId: id(3),
  });
  assert.equal(scope.clientId, id(3));
  assert.equal(scope.cachedClientId, id(9));
  assert.equal(scope.cachedLinkMatches, false);
  assert.equal(scope.source, 'authenticated_portal_link');
});

test('übereinstimmendes lokales Mapping bleibt reine Vergleichsinformation', () => {
  const scope = buildClientPortalActorScope({
    tenantId: id(1),
    accountId: id(2),
    roleKey: 'family_portal',
    cachedClientId: id(3),
    linkedClientId: id(3),
  });
  assert.equal(scope.clientId, id(3));
  assert.equal(scope.cachedLinkMatches, true);
  assert.equal(Object.isFrozen(scope), true);
});

test('ungültige oder fehlende native Identitäten und fremde Rollen schließen den Scope', () => {
  const base = {
    tenantId: id(1),
    accountId: id(2),
    roleKey: 'client_portal',
    linkedClientId: id(3),
  };
  assert.throws(() => buildClientPortalActorScope({ ...base, tenantId: 'tenant' }), /Kontext fehlt/);
  assert.throws(() => buildClientPortalActorScope({ ...base, accountId: 'konto' }), /Kontext fehlt/);
  assert.throws(() => buildClientPortalActorScope({ ...base, linkedClientId: '' }), /Kontext fehlt/);
  assert.throws(() => buildClientPortalActorScope({ ...base, roleKey: 'employee_portal' }), /Kontext fehlt/);
});

test('ungültige lokale IDs werden verworfen und niemals zur aktiven Identität', () => {
  const scope = buildClientPortalActorScope({
    tenantId: id(1),
    accountId: id(2),
    roleKey: 'client_portal',
    cachedClientId: 'erratener-pflegefall',
    linkedClientId: id(3),
  });
  assert.equal(scope.cachedClientId, null);
  assert.equal(scope.clientId, id(3));
  assert.equal(scope.cachedLinkMatches, false);
});

test('Linkzeilen müssen exakt zu Konto und Mandant gehören', () => {
  const row = { id: id(2), tenant_id: id(1), client_id: id(3) };
  assert.equal(resolveClientPortalLinkRow(id(1), row, id(2)), id(3));
  assert.equal(resolveClientPortalLinkRow(id(9), row, id(2)), null);
  assert.equal(resolveClientPortalLinkRow(id(1), row, id(9)), null);
  assert.equal(resolveClientPortalLinkRow(id(1), { ...row, client_id: 'Pflegefall' }, id(2)), null);
  const lowercaseAccount = `a0000002-7777-4777-8777-777777777777`;
  assert.equal(
    resolveClientPortalLinkRow(id(1), { ...row, id: lowercaseAccount.toUpperCase() }, lowercaseAccount),
    null,
  );
});

test('Live-Hook löst auch bei gespeichertem clientId die kanonische Verknüpfung auf', async () => {
  const hook = await fs.readFile(new URL('../../src/hooks/usePortalActor.ts', import.meta.url), 'utf8');
  assert.match(hook, /const clientId = isLivePortal\s*\? activeResolvedClientId \?\? null/);
  assert.match(hook, /fetchPortalClientIdByAccessAccount\(tenantId, portalAccountId\)/);
  assert.match(hook, /buildClientPortalActorScope\(/);
  assert.match(hook, /!scope\.cachedLinkMatches/);
  assert.doesNotMatch(hook, /!isClientPortalActor \|\| sessionClientId \|\| !tenantId/);
});

test('Link-Lookups prüfen zurückgegebene Konto-, Mandanten- und Pflegefall-IDs', async () => {
  const service = await fs.readFile(new URL('../../src/lib/portal/resolvePortalClientLink.ts', import.meta.url), 'utf8');
  assert.match(service, /select\('id, tenant_id, client_id'\)/);
  assert.match(service, /resolveClientPortalLinkRow\(tenantId, access, portalAccountId\)/);
  assert.match(service, /resolveClientPortalLinkRow\(tenantId, access\)/);
  assert.match(service, /resolveClientPortalLinkRow\(tenantId, relative\)/);
  assert.match(service, /!isClientPortalScopeId\(tenantId\)/);
  assert.match(service, /!isClientPortalScopeId\(portalAccountId\)/);
});

test('erratene Dokument- und Einsatz-IDs bleiben an den kanonischen Pflegefall gebunden', async () => {
  const documents = await fs.readFile(new URL('../../src/lib/portal/portalDocumentsLiveService.ts', import.meta.url), 'utf8');
  const appointments = await fs.readFile(new URL('../../src/lib/portal/portalAppointmentsLiveService.ts', import.meta.url), 'utf8');
  assert.match(documents, /\.eq\('client_id', clientId\)\s*\.eq\('id', documentId\)/);
  assert.match(documents, /fetchAssistProofPortalDocumentDetail\(tenantId, clientId, documentId\)/);
  assert.match(appointments, /visitDetail\.data\.clientId !== clientId/);
  assert.match(appointments, /visible\.data\.find\(\(candidate\) => candidate\.id === assignmentId\)/);
});

test('Profil-, Kontakt- und Versorgungsreads tragen den kanonischen Pflegefallfilter', async () => {
  const profile = await fs.readFile(new URL('../../src/lib/portal/clientProfileLiveService.ts', import.meta.url), 'utf8');
  for (const table of ['clients', 'client_portal_access', 'assignments', 'client_contacts']) {
    assert.match(profile, new RegExp(`fromUnknownTable\\(supabase, '${table}'\\)`));
  }
  assert.ok((profile.match(/\.eq\('client_id', clientId\)/g) ?? []).length >= 4);
  assert.match(profile, /\.eq\('id', clientId\)/);
});

test('aktuelle RLS-Autorität löst Pflegefall und Rolle nur aus aktivem Portal-Konto', async () => {
  const sql = await fs.readFile(new URL('../../supabase/migrations/20260827103000_portal_app_security_r14c.sql', import.meta.url), 'utf8');
  assert.match(sql, /cpa\.id = public\.current_portal_account_id\(\)/);
  assert.match(sql, /cpa\.auth_user_id = auth\.uid\(\)/);
  assert.match(sql, /cpa\.portal_enabled = TRUE/);
  assert.match(sql, /cpa\.status = 'aktiv'/);
  assert.match(sql, /WHEN 'relative' THEN \(/);
  assert.match(sql, /public\.current_role_key\(\) IN \('client_portal', 'family_portal'\)/);
  assert.match(sql, /public\.current_client_id\(\) IS NOT NULL/);
});
