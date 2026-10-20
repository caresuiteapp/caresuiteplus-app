import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { buildCareCarrierResubmissionRecord, buildCareCarrierReturnRecord } from '../../src/lib/pflege/careCarrierReturnDomain.ts';

const hash=(character)=>character.repeat(64);
const positions=()=>[
  {positionNo:1,billingCaseId:'case-1',serviceProofId:'proof-1',amountCents:500},
  {positionNo:2,billingCaseId:'case-2',serviceProofId:'proof-2',amountCents:750},
];
const attempt=(overrides={})=>({transmissionAttemptId:'attempt-1',exportId:'export-1',invoiceApprovalId:'approval-1',invoiceDraftId:'draft-1',invoiceNumber:'RE-2026-100',tenantId:'tenant-1',clientId:'client-1',claimLineageId:'lineage-1',attemptNumber:1,replacementForAttemptId:null,transportMessageId:'message-1',senderIk:'123456789',receiverIk:'223456789',payloadSha256:hash('1'),orderFileSha256:hash('2'),transmittedAt:'2026-10-13T10:15:12.123456Z',transmissionState:'submitted',totalAmountCents:1250,positions:positions(),...overrides});
const returnRequest=(overrides={})=>({clientRequestId:'request-return-1',returnFileName:'RET00001',returnFileSha256:hash('3'),returnFileSizeBytes:500,receivedAt:'2026-10-13T10:16:12.123456Z',senderIk:'223456789',receiverIk:'123456789',referencedTransportMessageId:'message-1',codeSystem:'DAV-PFL',codeSystemVersion:'6.4.0',errors:[{errorId:'error-1',code:'FEH-4711',message:'Positionskennzeichen ist unzulässig.',scope:'position',positionNo:2,billingCaseId:'case-2',serviceProofId:'proof-2'}],...overrides});
const rejection=()=>buildCareCarrierReturnRecord(attempt(),returnRequest());
const correction=(overrides={})=>({correctionId:'correction-1',correctionVersion:1,correctedExportId:'export-2',correctedInvoiceApprovalId:'approval-2',correctedInvoiceDraftId:'draft-2',correctedInvoiceNumber:'RE-2026-100',correctedDocumentFingerprint:'a'.repeat(32),correctionReason:'Positionskennzeichen korrigiert.',correctedTotalAmountCents:1250,correctedPositions:positions(),...overrides});
const resubmission=(overrides={})=>({clientRequestId:'request-resubmit-1',transmissionAttemptId:'attempt-2',attemptNumber:2,replacementForAttemptId:'attempt-1',transportMessageId:'message-2',senderIk:'123456789',receiverIk:'223456789',payloadSha256:hash('4'),orderFileSha256:hash('5'),transmittedAt:'2026-10-13T10:17:12.123456Z',...overrides});

test('bindet den Rückläufer an den tatsächlich versandten Versuch und leitet weder Zahlung noch Annahme ab',()=>{
  const record=rejection();
  assert.equal(record.attempt.transmissionAttemptId,'attempt-1');assert.equal(record.attempt.claimLineageId,'lineage-1');
  assert.equal(record.returnState,'rejected_requires_correction');assert.equal(record.acceptanceStatus,'not_accepted');assert.equal(record.paymentStatus,'not_inferred');
  assert.ok(Object.isFrozen(record));assert.ok(Object.isFrozen(record.errors));assert.ok(Object.isFrozen(record.attempt.positions));
});

test('bewahrt eine echte Mikrosekundenreihenfolge auch innerhalb derselben Millisekunde',()=>{
  const record=buildCareCarrierReturnRecord(attempt({transmittedAt:'2026-10-13T10:15:12.123456Z'}),returnRequest({receivedAt:'2026-10-13T10:15:12.123457+00:00'}));
  assert.equal(record.receivedAt,'2026-10-13T10:15:12.123457+00:00');
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({receivedAt:'2026-10-13T10:15:12.123456+00:00'})),/zeitlich nach/);
});

test('akzeptiert nur einen tatsächlich dokumentierten Übermittlungsversuch mit vollständigen Originalidentitäten',()=>{
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({transmissionState:'queued'}),returnRequest()),/tatsächlich dokumentierten/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({transmissionAttemptId:' '}),returnRequest()),/Übermittlungsversuch fehlt/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({attemptNumber:2,replacementForAttemptId:null}),returnRequest()),/ersetzten Übermittlungsversuch/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({attemptNumber:1,replacementForAttemptId:'old'}),returnRequest()),/erste Übermittlungsversuch/);
});

test('verlangt unverwechselbare Originaldateien, IK und exakte Zeitwerte',()=>{
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({payloadSha256:'abc'}),returnRequest()),/SHA-256/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({orderFileSha256:hash('1')}),returnRequest()),/getrennte Originale/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({senderIk:'123'}),returnRequest()),/neun Ziffern/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({transmittedAt:'2026-10-13T10:15:12.123Z'}),returnRequest()),/sechs UTC-Mikrosekundenstellen/);
});

test('Rückläuferdatei braucht positiven Umfang, SHA-256 und exakte Empfangszeit',()=>{
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({returnFileSizeBytes:0})),/Rückläuferdateigröße/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({returnFileSha256:'abc'})),/SHA-256/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({receivedAt:'2026-10-13T10:16:12Z'})),/sechs UTC-Mikrosekundenstellen/);
});

test('Rückläufer muss Parteien und Transportnachricht exakt umkehren bzw. referenzieren',()=>{
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({senderIk:'323456789'})),/Parteien/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({receiverIk:'323456789'})),/Parteien/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({referencedTransportMessageId:'message-x'})),/andere Transportnachricht/);
});

test('Abweisung benötigt konkrete, eindeutige Fehlercodes mit Meldung',()=>{
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({errors:[]})),/mindestens einen/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({errors:[...returnRequest().errors,{...returnRequest().errors[0]}]})),/doppelt/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({errors:[{...returnRequest().errors[0],code:' '}]})),/Fehlercode fehlt/);
});

test('Rechnungsfehler erfinden keine Position und Positionsfehler binden die Originalposition',()=>{
  assert.doesNotThrow(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({errors:[{errorId:'invoice-error',code:'R01',message:'Rechnungsfehler',scope:'invoice',positionNo:null,billingCaseId:null,serviceProofId:null}]})));
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({errors:[{errorId:'invoice-error',code:'R01',message:'Rechnungsfehler',scope:'invoice',positionNo:1,billingCaseId:'case-1',serviceProofId:'proof-1'}]})),/keine erfundene Position/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt(),returnRequest({errors:[{...returnRequest().errors[0],billingCaseId:'case-1'}]})),/nicht zur übermittelten Originalposition/);
});

test('Originalpositionen sind lückenlos, eindeutig und rechnerisch vollständig',()=>{
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({positions:[{...positions()[0],positionNo:2},positions()[1]]}),returnRequest()),/lückenlos/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({positions:[positions()[0],{...positions()[1],serviceProofId:'proof-1'}]}),returnRequest()),/doppelt/);
  assert.throws(()=>buildCareCarrierReturnRecord(attempt({totalAmountCents:1300}),returnRequest()),/Positionssumme/);
});

test('Folgeversuch ersetzt genau die abgewiesene Forderung und bleibt nicht angenommen oder bezahlt',()=>{
  const record=buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission());
  assert.equal(record.claimLineageId,'lineage-1');assert.equal(record.claimAction,'replace_rejected_claim');
  assert.equal(record.transmissionState,'replacement_submitted_not_accepted');assert.equal(record.acceptanceStatus,'not_inferred');assert.equal(record.paymentStatus,'not_inferred');
  assert.ok(Object.isFrozen(record));assert.ok(Object.isFrozen(record.correction.correctedPositions));
});

test('Korrektur braucht Version 1, neue Fassungen und dieselbe Rechnungsnummer',()=>{
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction({correctionVersion:2}),resubmission()),/Korrekturversion 1/);
  for(const [key,value] of [['correctedExportId','export-1'],['correctedInvoiceApprovalId','approval-1'],['correctedInvoiceDraftId','draft-1']])assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction({[key]:value}),resubmission()),/neue Export-/);
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction({correctedInvoiceNumber:'RE-NEU'}),resubmission()),/dieselbe Forderung und Rechnungsnummer/);
});

test('Folgeversuch muss Nummer und Vorgänger lückenlos fortsetzen',()=>{
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission({attemptNumber:3})),/lückenlos ersetzen/);
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission({replacementForAttemptId:'attempt-x'})),/lückenlos ersetzen/);
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission({transmissionAttemptId:'attempt-1'})),/neue native Transportidentitäten/);
});

test('Folgeversuch bewahrt Parteien und braucht neue Nachrichten- und Dateihashes',()=>{
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission({senderIk:'323456789'})),/dieselben Transportparteien/);
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission({transportMessageId:'message-1'})),/neue native Transportidentitäten/);
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission({payloadSha256:hash('1')})),/neu erzeugte Originaldateien/);
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission({orderFileSha256:hash('4')})),/getrennte, neu erzeugte/);
});

test('erneute Übermittlung liegt nach dem Rückläufer auf Mikrosekundenebene',()=>{
  assert.doesNotThrow(()=>buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission({transmittedAt:'2026-10-13T10:16:12.123457+00:00'})));
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction(),resubmission({transmittedAt:returnRequest().receivedAt})),/nach dem dokumentierten Rückläufer/);
});

test('Korrektur darf keine vom Rückläufer betroffene Originalposition verlieren',()=>{
  assert.throws(()=>buildCareCarrierResubmissionRecord(rejection(),correction({correctedTotalAmountCents:500,correctedPositions:[positions()[0]]}),resubmission()),/verliert eine.*Originalposition/);
});

test('SQL-Historie ist append-only, mandantengebunden und nur lesbar freigegeben',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_carrier_returns.sql',import.meta.url),'utf8');
  assert.equal((sql.match(/BEFORE UPDATE OR DELETE/g)??[]).length,3);assert.match(sql,/Übermittlungsversuche, Rückläufer und Korrekturen bleiben unverändert/);
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g)??[]).length,3);assert.match(sql,/current_tenant_id\(\)/);assert.match(sql,/pflege\.billing\.view/);
  assert.match(sql,/REVOKE ALL ON public\.pfleger_cost_carrier_transmission_attempts, public\.pfleger_cost_carrier_returns, public\.pfleger_cost_carrier_corrections FROM PUBLIC, anon, authenticated/);
});

test('SQL erzwingt eine einzige Folge je Versuch und dieselbe Forderungshistorie',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_carrier_returns.sql',import.meta.url),'utf8');
  for(const token of [/claim_lineage_id uuid NOT NULL/,/UNIQUE \(tenant_id, claim_lineage_id, attempt_number\)/,/UNIQUE \(tenant_id, replacement_for_attempt_id\)/,/claim_action text NOT NULL DEFAULT 'replace_rejected_claim'/,/eine zweite Forderung ist nicht zulässig/])assert.match(sql,token);
  assert.match(sql,/original\.claim_lineage_id IS DISTINCT FROM rejection\.claim_lineage_id/);
});

test('SQL bindet Fehler an Originalposition, Parteien, Nachricht und Mikrosekundenzeit',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_carrier_returns.sql',import.meta.url),'utf8');
  for(const token of [/jsonb_array_elements\(attempt\.position_snapshot\)/,/position->>'billingCaseId' = error->>'billingCaseId'/,/senderIk' IS DISTINCT FROM attempt\.receiver_ik/,/referencedTransportMessageId' IS DISTINCT FROM attempt\.transport_message_id/,/\\\.\\d\{6\}/])assert.match(sql,token);
});

test('SQL serialisiert idempotente Rückläufer und Folgeversuche und erfindet keine Annahme oder Zahlung',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_carrier_returns.sql',import.meta.url),'utf8');
  assert.ok((sql.match(/pg_advisory_xact_lock/g)??[]).length>=5);assert.match(sql,/record_pfleger_cost_carrier_rejection/);assert.match(sql,/record_pfleger_cost_carrier_resubmission/);
  assert.match(sql,/acceptance_status text NOT NULL DEFAULT 'not_accepted'/);assert.match(sql,/payment_status text NOT NULL DEFAULT 'not_inferred'/);
  assert.doesNotMatch(sql,/payment_status[^\n]*= 'paid'/);assert.doesNotMatch(sql,/acceptance_status[^\n]*= 'accepted'/);
});

test('Service trennt Anzeige, Rückläufer-RPC und Erneutübermittlungs-RPC',async()=>{
  const service=await fs.readFile(new URL('../../src/lib/pflege/careBillingLiveService.ts',import.meta.url),'utf8');
  for(const token of [/listCareCarrierReturnCases/,/pfleger_cost_carrier_returns/,/pfleger_cost_carrier_corrections/,/buildCareCarrierReturnRecord/,/record_pfleger_cost_carrier_rejection/,/buildCareCarrierResubmissionRecord/,/record_pfleger_cost_carrier_resubmission/])assert.match(service,token);
  assert.match(service,/p_return_id:returnId/);assert.match(service,/handledByCorrection/);
});

test('Web macht Abweisung und Ersatz sichtbar; Native-Oberfläche bleibt unverändert leer',async()=>{
  const web=await fs.readFile(new URL('../../src/components/office/ClientCostCarrierReturnSummary.web.tsx',import.meta.url),'utf8');
  const native=await fs.readFile(new URL('../../src/components/office/ClientCostCarrierReturnSummary.tsx',import.meta.url),'utf8');
  const panel=await fs.readFile(new URL('../../src/components/office/ClientBillingPrepPanel.tsx',import.meta.url),'utf8');
  assert.match(web,/Korrektur erforderlich/);assert.match(web,/keine zweite Forderung/);assert.match(web,/nicht als angenommen oder bezahlt/);
  assert.match(native,/return null/);assert.match(panel,/ClientCostCarrierReturnSummary/);
});
