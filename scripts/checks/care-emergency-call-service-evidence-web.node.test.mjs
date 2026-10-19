import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careEmergencyCallServiceEvidence.web.ts');
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}#${Date.now()}`);
}

test('emergency-call service boundary is immutable and rejects referral inference', async () => {
  const { getCareEmergencyCallServiceEvidence } = await loadEvidence();
  const evidence = getCareEmergencyCallServiceEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.missingEvidence));
  assert.equal(evidence.referralMayStandForActiveContract, false);
  assert.equal(evidence.partnerCategoryMayStandForHandledAlarm, false);
  assert.strictEqual(getCareEmergencyCallServiceEvidence(), evidence);
});

test('marketplace schema provides category and referral but no client service contract', async () => {
  const sql = await read('supabase/migrations/0127_marketplace_prepared.sql');
  const referrals = sql.match(/CREATE TABLE IF NOT EXISTS public\.marketplace_referral_requests \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(sql, /\('hausnotruf', 'Hausnotruf', 'Notruf- und Telecare-Dienste'/);
  assert.match(referrals, /referral_status/);
  assert.match(referrals, /client_reference\s+TEXT/);
  assert.doesNotMatch(referrals, /service_contract_id|service_order_id|contract_version|valid_from|valid_until/i);
});

test('generic partner service is not a device installation or client assignment', async () => {
  const sql = await read('supabase/migrations/0127_marketplace_prepared.sql');
  const services = sql.match(/CREATE TABLE IF NOT EXISTS public\.marketplace_partner_services \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(services, /service_key/);
  assert.match(services, /partner_id/);
  assert.doesNotMatch(services, /client_id|device_id|serial_number|installed_at|returned_at|functional_check/i);
});

test('current referral implementation is demo memory state without bound client identity', async () => {
  const service = await read('src/lib/marketplace/referralService.ts');
  assert.match(service, /const referralStore = new Map/);
  assert.match(service, /Marktplatz-Anfragen: Repository erweitern\./);
  assert.match(service, /clientReference: null/);
  assert.doesNotMatch(service, /\.from\(['"]marketplace_referral_requests|supabase\.rpc/);
});

test('referral and consent states do not provide alarm handling fields', async () => {
  const types = await read('src/types/marketplace/index.ts');
  const referral = types.match(/export type MarketplaceReferralRequest = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(referral, /referralStatus/);
  assert.match(referral, /sentAt/);
  assert.doesNotMatch(referral, /deviceId|alarmAt|acceptedAt|escalatedAt|feedbackAt|contactChain/i);
});

test('marketplace audit is generic and no emergency alarm ledger exists', async () => {
  const sql = await read('supabase/migrations/0127_marketplace_prepared.sql');
  const audit = sql.match(/CREATE TABLE IF NOT EXISTS public\.marketplace_audit_events \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(audit, /event_type/);
  assert.match(audit, /summary/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS public\.(?:house_emergency|emergency_call|home_emergency)_alarms/);
  assert.doesNotMatch(audit, /alarm_received_at|alarm_accepted_at|escalated_at|feedback_at|contact_chain_version/i);
});

test('request screen explicitly makes no real transmission and captures only inquiry text', async () => {
  const screen = await read('src/screens/marketplace/MarketplaceRequestScreen.tsx');
  assert.match(screen, /Anfrage gesendet \(Demo — keine echte Übertragung\)\./);
  assert.match(screen, /label="Betreff"/);
  assert.match(screen, /label="Nachricht"/);
  assert.doesNotMatch(screen, /Gerätekennung|Alarmannahme|Kontaktkette|Eskalation|Rückmeldung/);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareEmergencyCallServiceEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareEmergencyCallServiceEvidencePanel.tsx');
  assert.match(screen, /<CareEmergencyCallServiceEvidencePanel \/>/);
  assert.match(web, /Partneranfrage ist kein aktiver Hausnotruf/);
  assert.match(web, /Alarmkette und Rückmeldung separat nachweisen/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
