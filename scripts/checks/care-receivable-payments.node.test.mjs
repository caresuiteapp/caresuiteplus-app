import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { buildCareReceivablesLedger } from '../../src/lib/pflege/careReceivablesDomain.ts';

const invoice=(overrides={})=>({openItemId:'11111111-1111-4111-8111-111111111111',invoiceApprovalId:'21111111-1111-4111-8111-111111111111',invoiceNumber:'RE-2026-100',tenantId:'tenant-1',clientId:'client-1',claimLineageId:'31111111-1111-4111-8111-111111111111',documentFingerprint:'1'.repeat(32),approvedAt:'2026-10-13T10:15:12.123456Z',dueDate:'2026-10-27',receivableAmountCents:1250,...overrides});
const payment=(overrides={})=>({paymentEventId:'41111111-1111-4111-8111-111111111111',clientRequestId:'51111111-1111-4111-8111-111111111111',tenantId:'tenant-1',clientId:'client-1',eventKind:'payment_received',paymentMethod:'bank_transfer',bankTransactionId:'BANK-2026-1',bookingReference:'Zahlung RE-2026-100',valueDate:'2026-10-14',recordedAt:'2026-10-14T08:00:00.123456Z',amountCents:500,allocations:[{openItemId:'11111111-1111-4111-8111-111111111111',invoiceApprovalId:'21111111-1111-4111-8111-111111111111',claimLineageId:'31111111-1111-4111-8111-111111111111',amountCents:500}],reversesPaymentEventId:null,reversalReason:null,...overrides});
const reversal=(overrides={})=>payment({paymentEventId:'61111111-1111-4111-8111-111111111111',clientRequestId:'71111111-1111-4111-8111-111111111111',eventKind:'payment_reversal',bankTransactionId:'BANK-2026-1-STORNO',bookingReference:'Storno BANK-2026-1',valueDate:'2026-10-15',recordedAt:'2026-10-15T08:00:00.123456Z',allocations:[],reversesPaymentEventId:'41111111-1111-4111-8111-111111111111',reversalReason:'Bankrückgabe dokumentiert.',...overrides});

test('Teilzahlung bleibt teilbezahlt und erhält den centgenauen Rest',()=>{
  const ledger=buildCareReceivablesLedger([invoice()],[payment()],'2026-10-14');
  assert.equal(ledger.openItems[0].paymentStatus,'partially_paid');assert.equal(ledger.openItems[0].paidAmountCents,500);assert.equal(ledger.openItems[0].remainingAmountCents,750);assert.equal(ledger.totalRemainingCents,750);
});

test('vollständige Zahlung gilt nur bei Restbetrag null als bezahlt',()=>{
  const full=payment({amountCents:1250,allocations:[{...payment().allocations[0],amountCents:1250}]});
  const item=buildCareReceivablesLedger([invoice()],[full],'2026-10-14').openItems[0];assert.equal(item.paymentStatus,'paid');assert.equal(item.dueStatus,'settled');assert.equal(item.remainingAmountCents,0);
});

test('ohne Zahlungsereignis bleibt die Forderung vollständig offen',()=>{
  const item=buildCareReceivablesLedger([invoice()],[],'2026-10-14').openItems[0];assert.equal(item.paymentStatus,'open');assert.equal(item.paidAmountCents,0);assert.equal(item.remainingAmountCents,1250);
});

test('Fälligkeit wird getrennt von Zahlung als zukünftig, heute oder überfällig bewertet',()=>{
  assert.equal(buildCareReceivablesLedger([invoice()],[],'2026-10-26').openItems[0].dueStatus,'not_due');
  assert.equal(buildCareReceivablesLedger([invoice()],[],'2026-10-27').openItems[0].dueStatus,'due_today');
  assert.equal(buildCareReceivablesLedger([invoice()],[],'2026-10-28').openItems[0].dueStatus,'overdue');
});

test('vollständiges Zahlungsstorno setzt den offenen Rest wieder auf die Originalforderung',()=>{
  const item=buildCareReceivablesLedger([invoice()],[payment(),reversal()],'2026-10-15').openItems[0];assert.equal(item.paymentStatus,'open');assert.equal(item.paidAmountCents,0);assert.equal(item.remainingAmountCents,1250);
});

test('Zahlungsstorno muss einen vorhandenen noch nicht stornierten Eingang treffen',()=>{
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[reversal()],'2026-10-15'),/vorhandenen/);
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment(),reversal(),reversal({paymentEventId:'81111111-1111-4111-8111-111111111111',clientRequestId:'91111111-1111-4111-8111-111111111111',bankTransactionId:'BANK-2026-1-STORNO-2'})],'2026-10-15'),/noch nicht stornierten/);
});

test('Storno kehrt Betrag und Zahlungsart vollständig und später um',()=>{
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment(),reversal({amountCents:499})],'2026-10-15'),/Betrag und Zahlungsart/);
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment(),reversal({paymentMethod:'cash',bankTransactionId:null})],'2026-10-15'),/Betrag und Zahlungsart/);
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment(),reversal({recordedAt:payment().recordedAt,valueDate:'2026-10-14'})],'2026-10-15'),/später erfasst/);
});

test('Zahlungsbetrag und Zuordnungen müssen centgenau übereinstimmen',()=>assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({amountCents:499})],'2026-10-14'),/centgenau/));

test('Überzahlung wird nicht still als bezahlt oder Guthaben ausgegeben',()=>assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({amountCents:1251,allocations:[{...payment().allocations[0],amountCents:1251}]})],'2026-10-14'),/übersteigen/));

test('Zuordnung bindet offenen Posten, Freigabe und Forderungshistorie exakt',()=>{
  for(const [field,value] of [['openItemId','x'],['invoiceApprovalId','x'],['claimLineageId','x']])assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({allocations:[{...payment().allocations[0],[field]:value}]})],'2026-10-14'),/nicht exakt/);
});

test('derselbe offene Posten darf in einem Ereignis nicht doppelt zugeordnet werden',()=>assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({amountCents:1000,allocations:[payment().allocations[0],payment().allocations[0]]})],'2026-10-14'),/mehrfach/));

test('Zahlung darf nicht vor der freigegebenen Forderung liegen',()=>{
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({valueDate:'2026-10-12'})],'2026-10-14'),/vor der freigegebenen/);
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({recordedAt:'2026-10-13T10:15:12.123456Z',valueDate:'2026-10-13'})],'2026-10-14'),/vor der freigegebenen/);
});

test('Wertstellung darf nicht nach der tatsächlichen Erfassung liegen',()=>assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({valueDate:'2026-10-15'})],'2026-10-15'),/nach der tatsächlichen Erfassung/));

test('Rechnung und Zahlungsereignis erhalten sechs UTC-Mikrosekundenstellen',()=>{
  assert.throws(()=>buildCareReceivablesLedger([invoice({approvedAt:'2026-10-13T10:15:12.123Z'})],[],'2026-10-14'),/sechs UTC-Mikrosekundenstellen/);
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({recordedAt:'2026-10-14T08:00:00.123Z'})],'2026-10-14'),/sechs UTC-Mikrosekundenstellen/);
});

test('Fälligkeit darf nicht vor der Rechnungsfreigabe liegen',()=>assert.throws(()=>buildCareReceivablesLedger([invoice({dueDate:'2026-10-12'})],[],'2026-10-14'),/vor der Rechnungsfreigabe/));

test('offene Posten bewahren einen gemeinsamen Mandanten- und Pflegefallumfang',()=>{
  const second=invoice({openItemId:'12222222-2222-4222-8222-222222222222',invoiceApprovalId:'22222222-2222-4222-8222-222222222222',invoiceNumber:'RE-2026-101',claimLineageId:'32222222-2222-4222-8222-222222222222'});
  assert.throws(()=>buildCareReceivablesLedger([invoice(),{...second,tenantId:'tenant-x'}],[],'2026-10-14'),/demselben Mandanten/);
  assert.throws(()=>buildCareReceivablesLedger([invoice(),{...second,clientId:'client-x'}],[],'2026-10-14'),/demselben Mandanten/);
});

test('native Rechnungs- und Forderungsidentitäten sind innerhalb der Projektion eindeutig',()=>{
  assert.throws(()=>buildCareReceivablesLedger([invoice(),invoice({openItemId:'x'})],[],'2026-10-14'),/doppelte native/);
  assert.throws(()=>buildCareReceivablesLedger([invoice(),invoice({invoiceApprovalId:'x'})],[],'2026-10-14'),/doppelte native/);
});

test('Zahlungsereignis darf Mandant oder Pflegefall nicht wechseln',()=>{
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({tenantId:'tenant-x'})],'2026-10-14'),/anderen Mandanten/);
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({clientId:'client-x'})],'2026-10-14'),/anderen Mandanten/);
});

test('Ereignis-, Anfrage- und Banktransaktionsidentitäten sind eindeutig',()=>{
  const second=payment({paymentEventId:'42222222-2222-4222-8222-222222222222',clientRequestId:'52222222-2222-4222-8222-222222222222',recordedAt:'2026-10-14T09:00:00.123456Z',amountCents:250,allocations:[{...payment().allocations[0],amountCents:250}]});
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment(),{...second,paymentEventId:payment().paymentEventId}],'2026-10-14'),/doppelte Ereignis/);
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment(),{...second,bankTransactionId:payment().bankTransactionId}],'2026-10-14'),/Banktransaktion/);
});

test('Bankzahlung benötigt Transaktions-ID, Barzahlung nicht',()=>{
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({bankTransactionId:null})],'2026-10-14'),/Banktransaktions-ID/);
  assert.equal(buildCareReceivablesLedger([invoice()],[payment({paymentMethod:'cash',bankTransactionId:null})],'2026-10-14').totalPaidCents,500);
});

test('Eingang trägt keine Stornoreferenz und Storno keine neue Zuordnung',()=>{
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment({reversesPaymentEventId:'x'})],'2026-10-14'),/keine Stornoreferenz/);
  assert.throws(()=>buildCareReceivablesLedger([invoice()],[payment(),reversal({allocations:[payment().allocations[0]]})],'2026-10-15'),/keine neue Forderungszuordnung/);
});

test('Ausgabe und verschachtelte Historien sind unveränderlich',()=>{
  const ledger=buildCareReceivablesLedger([invoice()],[payment()],'2026-10-14');assert.ok(Object.isFrozen(ledger));assert.ok(Object.isFrozen(ledger.openItems));assert.ok(Object.isFrozen(ledger.openItems[0]));assert.ok(Object.isFrozen(ledger.openItems[0].appliedPaymentEventIds));assert.ok(Object.isFrozen(ledger.paymentEvents));assert.ok(Object.isFrozen(ledger.paymentEvents[0].allocations));
});

test('SQL schützt drei Tabellen append-only, aktiviert RLS und gewährt nur Lesen',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_receivable_payments.sql',import.meta.url),'utf8');assert.equal((sql.match(/BEFORE UPDATE OR DELETE/g)??[]).length,3);assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g)??[]).length,3);assert.match(sql,/REVOKE ALL ON public\.pfleger_receivable_open_items, public\.pfleger_receivable_payment_events, public\.pfleger_receivable_payment_allocations FROM PUBLIC, anon, authenticated/);assert.match(sql,/GRANT SELECT ON/);assert.match(sql,/pflege\.billing\.view/);
});

test('SQL-Funktionen sind gehärtet, voll qualifiziert und eng ausführbar',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_receivable_payments.sql',import.meta.url),'utf8');assert.equal((sql.match(/SECURITY DEFINER SET search_path = ''/g)??[]).length,3);assert.match(sql,/has_permission\('pflege\.invoices\.manage'\)/);assert.match(sql,/REVOKE ALL ON FUNCTION public\.record_pfleger_receivable_payment\(jsonb,uuid\) FROM PUBLIC, anon, authenticated/);assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.record_pfleger_receivable_payment\(jsonb,uuid\) TO authenticated/);
});

test('SQL serialisiert Anforderung, Zahlungsereignis und jeden offenen Posten',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_receivable_payments.sql',import.meta.url),'utf8');assert.ok((sql.match(/pg_advisory_xact_lock/g)??[]).length>=4);assert.match(sql,/client_request_id = p_client_request_id/);assert.match(sql,/open_item_id=i\.id/);assert.match(sql,/übersteigt den offenen Restbetrag/);
});

test('Service nutzt getrennte Tabellen, Domänenprüfung und einen eigenen RPC',async()=>{
  const service=await fs.readFile(new URL('../../src/lib/pflege/careBillingLiveService.ts',import.meta.url),'utf8');for(const token of [/listCareReceivables/,/pfleger_receivable_open_items/,/pfleger_receivable_payment_events/,/pfleger_receivable_payment_allocations/,/buildCareReceivablesLedger/,/record_pfleger_receivable_payment/])assert.match(service,token);assert.match(service,/'pflege\.invoices\.manage'/);
});

test('Web zeigt Zahlung, Teilzahlung, Rest und Fälligkeit; Native bleibt leer',async()=>{
  const web=await fs.readFile(new URL('../../src/components/office/ClientReceivablesSummary.web.tsx',import.meta.url),'utf8');const native=await fs.readFile(new URL('../../src/components/office/ClientReceivablesSummary.tsx',import.meta.url),'utf8');const panel=await fs.readFile(new URL('../../src/components/office/ClientBillingPrepPanel.tsx',import.meta.url),'utf8');for(const token of [/Zahlungen und offene Posten/,/Teilbezahlt/,/Restbetrag/,/Fällig/,/Teilzahlung gleicht/,/keinen Zahlungseingang/])assert.match(web,token);assert.match(native,/return null/);assert.match(panel,/ClientReceivablesSummary/);
});
