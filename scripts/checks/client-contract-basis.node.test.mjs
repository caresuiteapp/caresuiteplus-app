import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assessClientContractBasis } from '../../src/lib/clients/clientContractBasisDomain.ts';

const referenceDate = '2026-10-13';
const complete = () => ({
  contractNumber: 'PV-2026-0042',
  contractPartner: 'Pflegekasse Beispiel',
  serviceBasis: 'Ambulante Sachleistung nach SGB XI',
  contractStart: '2026-01-01',
  contractEnd: null,
  status: 'aktiv',
  signedAt: '2026-01-01T08:15:00.123456Z',
  documentId: 'original-document-reference',
  contractVersion: 2,
});

test('vollständige aktuelle Vertragsgrundlage wird nur als dokumentiert aktuell eingeordnet', () => {
  const result = assessClientContractBasis(complete(), referenceDate);
  assert.equal(result.state, 'documented_current');
  assert.deepEqual(result.issues, []);
  assert.doesNotMatch(result.summary, /rechtswirksam|authentifiziert/i);
});

for (const [key, issue] of [
  ['contractNumber', 'contract_number_missing'],
  ['contractPartner', 'contract_partner_missing'],
  ['serviceBasis', 'service_basis_missing'],
  ['signedAt', 'signature_time_missing'],
  ['documentId', 'document_reference_missing'],
  ['contractVersion', 'contract_version_invalid'],
]) {
  test(`fehlendes Feld ${key} bleibt offen`, () => {
    const input = complete();
    input[key] = null;
    const result = assessClientContractBasis(input, referenceDate);
    assert.equal(result.state, 'incomplete');
    assert.ok(result.issues.includes(issue));
  });
}

test('künftiger Vertragsbeginn bleibt von einem tatsächlichen Beginn getrennt', () => {
  const result = assessClientContractBasis({ ...complete(), contractStart: '2026-10-14' }, referenceDate);
  assert.equal(result.state, 'not_current');
  assert.ok(result.issues.includes('contract_not_started'));
});

test('abgelaufener Vertrag ist am Folgetag nicht mehr aktuell', () => {
  const result = assessClientContractBasis({ ...complete(), contractEnd: '2026-10-12' }, referenceDate);
  assert.equal(result.state, 'not_current');
  assert.ok(result.issues.includes('contract_ended'));
});

test('Beginn und Ende gelten an ihren jeweiligen Kalendertagen einschließlich', () => {
  const start = assessClientContractBasis({ ...complete(), contractStart: referenceDate }, referenceDate);
  const end = assessClientContractBasis({ ...complete(), contractEnd: referenceDate }, referenceDate);
  assert.equal(start.state, 'documented_current');
  assert.equal(end.state, 'documented_current');
});

test('fehlendes Vertragsende ist nicht dasselbe wie ausdrücklich unbefristet', () => {
  const input = complete();
  delete input.contractEnd;
  const result = assessClientContractBasis(input, referenceDate);
  assert.equal(result.state, 'incomplete');
  assert.ok(result.issues.includes('contract_end_invalid'));
});

test('Workflowstatus allein erzeugt keine aktuelle Vertragsgrundlage', () => {
  const result = assessClientContractBasis({ ...complete(), status: 'abgeschlossen' }, referenceDate);
  assert.equal(result.state, 'not_current');
  assert.ok(result.issues.includes('contract_not_active'));
});

test('ungültige Kalenderdaten werden nicht normalisiert', () => {
  const start = assessClientContractBasis({ ...complete(), contractStart: '2026-02-30' }, referenceDate);
  const end = assessClientContractBasis({ ...complete(), contractEnd: '2025-02-29' }, referenceDate);
  assert.ok(start.issues.includes('contract_start_invalid'));
  assert.ok(end.issues.includes('contract_end_invalid'));
});

test('ungültige oder datumlose Unterzeichnungsangabe wird nicht als Signaturzeit gewertet', () => {
  for (const signedAt of ['2026-02-30T10:00:00Z', '2026-10-13', '']) {
    const result = assessClientContractBasis({ ...complete(), signedAt }, referenceDate);
    assert.ok(result.issues.includes('signature_time_missing'));
  }
});

test('Version muss eine positive ganze Zahl sein', () => {
  for (const contractVersion of [0, -1, 1.5, '2']) {
    const result = assessClientContractBasis({ ...complete(), contractVersion }, referenceDate);
    assert.ok(result.issues.includes('contract_version_invalid'));
  }
});

test('Prüftag selbst wird streng validiert', () => {
  assert.throws(() => assessClientContractBasis(complete(), '2026-02-30'));
  assert.throws(() => assessClientContractBasis(complete(), '2026-10-13T00:00:00Z'));
});

test('SQL ergänzt nur additive strukturierte Felder und lässt Bestandszeilen offen', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_contract_basis.sql', import.meta.url), 'utf8');
  for (const field of ['contract_partner', 'service_basis', 'contract_version']) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${field}`));
  }
  assert.match(sql, /contract_version IS NULL OR contract_version >= 1/);
  assert.doesNotMatch(sql, /UPDATE\s+public\.client_contracts/i);
});
