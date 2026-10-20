import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  assessClientFinancingApproval,
  assessClientFinancingApprovals,
} from '../../src/lib/clients/clientFinancingApprovalDomain.ts';

const day = '2026-10-13';
const approval = (overrides = {}) => ({
  id: 'approval-row-v2',
  logicalApprovalId: 'approval-logical',
  tenantId: 'tenant-native',
  clientId: 'client-native',
  financingPathId: 'path-native-xi',
  applicationReference: 'antrag-original-2026',
  appliedOn: '2026-01-10',
  requestedFrom: '2026-02-01',
  requestedUntil: '2026-12-31',
  decision: 'approved',
  decisionReference: 'bescheid-original-2026',
  decidedOn: '2026-01-20',
  approvedFrom: '2026-02-01',
  approvedUntil: '2026-12-31',
  followUpDueOn: '2026-12-01',
  version: 2,
  supersedesApprovalId: 'approval-row-v1',
  createdAt: '2026-01-20T12:00:00.123456Z',
  ...overrides,
});

test('vollständig belegte aktuelle Bewilligung zeigt exakte Restlaufzeit und getrennten Folgetermin', () => {
  const result = assessClientFinancingApproval(approval(), day);
  assert.equal(result.state, 'approved_current');
  assert.equal(result.remainingDays, 79);
  assert.equal(result.followUp, 'not_due');
  assert.deepEqual(result.issues, []);
});

test('letzter Bewilligungstag ist aktuell mit null Resttagen', () => {
  const result = assessClientFinancingApproval(approval({ approvedUntil: day }), day);
  assert.equal(result.state, 'approved_current');
  assert.equal(result.remainingDays, 0);
});

test('künftige und abgelaufene Bewilligung bleiben vor abrechenbarer Leistung sichtbar nicht aktuell', () => {
  const future = assessClientFinancingApproval(approval({ approvedFrom: '2026-10-14' }), day);
  const expired = assessClientFinancingApproval(approval({ approvedUntil: '2026-10-12' }), day);
  assert.equal(future.state, 'not_current');
  assert.ok(future.issues.includes('approval_not_started'));
  assert.equal(expired.state, 'not_current');
  assert.ok(expired.issues.includes('approval_expired'));
  assert.equal(expired.remainingDays, -1);
});

test('offener Antrag bleibt pending und wird nicht aus beantragtem Zeitraum genehmigt', () => {
  const result = assessClientFinancingApproval(approval({
    decision: 'pending', decisionReference: null, decidedOn: null,
    approvedFrom: null, approvedUntil: null,
  }), day);
  assert.equal(result.state, 'pending');
  assert.ok(result.issues.includes('not_approved'));
  assert.equal(result.remainingDays, null);
});

test('abgelehnte und zurückgezogene Entscheidung bleiben trotz Entscheidungsbeleg nicht aktuell', () => {
  for (const decision of ['rejected', 'withdrawn']) {
    const result = assessClientFinancingApproval(approval({ decision, approvedFrom: null, approvedUntil: null }), day);
    assert.equal(result.state, 'not_current');
    assert.ok(result.issues.includes('not_approved'));
    assert.ok(!result.issues.includes('decision_reference_missing'));
  }
});

test('Entscheidungsstatus allein erzeugt ohne Bescheid, Datum und Bewilligungszeitraum keine aktuelle Genehmigung', () => {
  const result = assessClientFinancingApproval(approval({
    decisionReference: null, decidedOn: null, approvedFrom: null, approvedUntil: null,
  }), day);
  assert.equal(result.state, 'incomplete');
  assert.ok(result.issues.includes('decision_reference_missing'));
  assert.ok(result.issues.includes('decision_date_invalid'));
  assert.ok(result.issues.includes('approved_period_invalid'));
});

test('beantragter Zeitraum und bewilligter Zeitraum bleiben getrennt', () => {
  const input = approval({ requestedFrom: '2026-01-01', requestedUntil: '2026-12-31', approvedFrom: '2026-04-01', approvedUntil: '2026-11-30' });
  const result = assessClientFinancingApproval(input, day);
  assert.equal(result.state, 'approved_current');
  assert.equal(result.approval.requestedFrom, '2026-01-01');
  assert.equal(result.approval.approvedFrom, '2026-04-01');
  assert.notEqual(result.approval.requestedUntil, result.approval.approvedUntil);
});

test('umgekehrte oder ungültige Antrags- und Bewilligungszeiträume werden verweigert', () => {
  const requested = assessClientFinancingApproval(approval({ requestedUntil: '2025-12-31' }), day);
  const approved = assessClientFinancingApproval(approval({ approvedFrom: '2026-04-01', approvedUntil: '2026-02-30' }), day);
  assert.ok(requested.issues.includes('requested_period_invalid'));
  assert.ok(approved.issues.includes('approved_period_invalid'));
});

for (const [field, issue] of [
  ['id', 'approval_identity_missing'],
  ['logicalApprovalId', 'logical_identity_missing'],
  ['tenantId', 'tenant_identity_missing'],
  ['clientId', 'client_identity_missing'],
  ['financingPathId', 'financing_path_identity_missing'],
  ['applicationReference', 'application_reference_missing'],
]) {
  test(`fehlende Originalbindung ${field} bleibt unvollständig`, () => {
    const result = assessClientFinancingApproval(approval({ [field]: '' }), day);
    assert.equal(result.state, 'incomplete');
    assert.ok(result.issues.includes(issue));
  });
}

test('Folgetermin überfällig, bald fällig, später oder ungültig bleibt eigener Zustand', () => {
  assert.equal(assessClientFinancingApproval(approval({ followUpDueOn: '2026-10-12' }), day).followUp, 'overdue');
  assert.equal(assessClientFinancingApproval(approval({ followUpDueOn: '2026-11-12' }), day).followUp, 'due_soon');
  assert.equal(assessClientFinancingApproval(approval({ followUpDueOn: '2026-11-13' }), day).followUp, 'not_due');
  const invalid = assessClientFinancingApproval(approval({ followUpDueOn: '2026-02-30' }), day);
  assert.equal(invalid.followUp, 'not_documented');
  assert.ok(invalid.issues.includes('follow_up_date_invalid'));
});

test('doppelte Genehmigungsidentität wird nicht still zusammengeführt', () => {
  assert.throws(() => assessClientFinancingApprovals([approval(), approval()], day), /Doppelte/);
});

test('Prüftag und Warnfrist werden streng validiert', () => {
  assert.throws(() => assessClientFinancingApproval(approval(), '2026-02-30'));
  assert.throws(() => assessClientFinancingApproval(approval(), day, -1));
  assert.throws(() => assessClientFinancingApproval(approval(), day, 1.5));
});

test('SQL bindet jede Genehmigung an Mandant, Pflegefall und konkreten Weg, bleibt append-only und ohne Backfill', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_financing_approvals.sql', import.meta.url), 'utf8');
  assert.match(sql, /FOREIGN KEY \(tenant_id, client_id, financing_path_id\)/);
  assert.match(sql, /REFERENCES public\.client_financing_paths\(tenant_id, client_id, id\)/);
  assert.match(sql, /decision IN \('pending', 'approved', 'rejected', 'withdrawn'\)/);
  assert.match(sql, /decision <> 'approved'[\s\S]+decision_reference IS NOT NULL[\s\S]+approved_until IS NOT NULL/);
  assert.doesNotMatch(sql, /GRANT[^;]*(UPDATE|DELETE)/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.client_financing_approvals\s*\([^;]+SELECT/is);
  assert.doesNotMatch(sql, /UPDATE\s+public\.client_financing_approvals/i);
  assert.match(sql, /tenant_id = public\.current_tenant_id\(\)/);
});

test('Web zeigt Genehmigungen je Pfad, ohne die native Standardkomponente zu verändern', async () => {
  const [web, nativeDefault] = await Promise.all([
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.web.tsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(web, /financingPathId === path\.id/);
  assert.match(web, /listClientFinancingApprovals/);
  assert.match(web, /bestätigt weder Anspruch, Genehmigung noch Abrechnungsfreigabe/);
  assert.match(nativeDefault, /return null/);
});
