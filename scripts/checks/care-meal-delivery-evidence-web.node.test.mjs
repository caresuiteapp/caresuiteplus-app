import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careMealDeliveryEvidence.web.ts');
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}#${Date.now()}`);
}

test('meal-delivery boundary is immutable and rejects planned or referral inference', async () => {
  const { getCareMealDeliveryEvidence } = await loadEvidence();
  const evidence = getCareMealDeliveryEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.missingEvidence));
  assert.equal(evidence.mealIntakeMayStandForDelivery, false);
  assert.equal(evidence.referralMayStandForDelivery, false);
  assert.strictEqual(getCareMealDeliveryEvidence(), evidence);
});

test('marketplace schema provides meal-service category but referral is not an order', async () => {
  const sql = await read('supabase/migrations/0127_marketplace_prepared.sql');
  const referrals = sql.match(/CREATE TABLE IF NOT EXISTS public\.marketplace_referral_requests \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(sql, /\('essensdienst', 'Menü-\/Essensdienste', 'Essenslieferung und Menüplanung'/);
  assert.match(referrals, /request_subject/);
  assert.doesNotMatch(referrals, /meal_order_id|diet_type|delivery_due_at|delivery_status|delivered_at/i);
});

test('generic partner service has no client meal order or delivery event', async () => {
  const sql = await read('supabase/migrations/0127_marketplace_prepared.sql');
  const services = sql.match(/CREATE TABLE IF NOT EXISTS public\.marketplace_partner_services \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(services, /service_key/);
  assert.doesNotMatch(services, /client_id|meal_order_id|diet_version|delivery_at|recipient_id|handover/i);
});

test('current referral implementation remains demo-only and client-unbound', async () => {
  const service = await read('src/lib/marketplace/referralService.ts');
  assert.match(service, /const referralStore = new Map/);
  assert.match(service, /Marktplatz-Anfragen: Repository erweitern\./);
  assert.match(service, /clientReference: null/);
  assert.doesNotMatch(service, /delivery|dietType|mealOrder|recipient|handover/);
});

test('meal protocol documents intake and never supplier delivery', async () => {
  const domain = await read('src/lib/pflege/dailyProtocolDomain.ts');
  const labels = await read('src/lib/pflege/dailyProtocolLabels.ts');
  assert.match(domain, /kind:'drink'\|'meal'/);
  assert.match(labels, /meal:'Mahlzeitenunterstützung'/);
  assert.match(labels, /taken:'Tatsächlich aufgenommen'/);
  assert.doesNotMatch(domain, /deliveryPartnerId|deliveryEventId|recipientId|handoverAt/);
});

test('stationary demo meal planning is separate from ambulatory delivery', async () => {
  const demo = await read('src/data/demo/stationaerPlanning.ts');
  const service = await read('src/lib/stationaer/stationaerDedicatedService.ts');
  assert.match(demo, /function buildMeals/);
  assert.match(service, /getDemoMealPlans/);
  assert.doesNotMatch(service, /care_tours|marketplace_referral_requests|deliveryEvent|deliveredAt/);
});

test('request screen records only demo inquiry and not delivery outcome', async () => {
  const screen = await read('src/screens/marketplace/MarketplaceRequestScreen.tsx');
  assert.match(screen, /Anfrage gesendet \(Demo — keine echte Übertragung\)\./);
  assert.match(screen, /label="Betreff"/);
  assert.doesNotMatch(screen, /Kostform|Liefertermin|Ausgeliefert|Empfänger|Übergabe|Ausfallgrund/);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareMealDeliveryEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareMealDeliveryEvidencePanel.tsx');
  assert.match(screen, /<CareMealDeliveryEvidencePanel \/>/);
  assert.match(web, /Essensdienst-Anfrage ist keine Auslieferung/);
  assert.match(web, /Planung, Lieferung und Ausfall getrennt führen/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
