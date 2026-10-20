import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { buildCareCostCarrierExportRecord, getSgbXi105ExportProfileForDate, SGB_XI_105_EXPORT_PROFILE } from '../../src/lib/pflege/careCostCarrierExportDomain.ts';

const hash=(character)=>character.repeat(64);
const candidate=(overrides={})=>({approvalId:'approval-1',invoiceDraftId:'draft-1',invoiceNumber:'RE-2026-100',tenantId:'tenant-1',clientId:'client-1',approvalVersion:1,approvedAt:'2026-10-13T10:11:12.123456Z',documentFingerprint:'a'.repeat(32),recipientIk:'123456789',legalBasis:'sgb_xi',transmissionStatus:'not_transmitted',totalAmountCents:1250,...overrides});
const request=(overrides={})=>({clientRequestId:'request-1',profileId:'sgb_xi_105_ta1_6_4_0',technicalSpecificationVersion:'6.4.0',keyDirectoryVersion:'6.4.0',carrierDirectoryFormatVersion:'5.2',specificationSha256:hash('1'),keyDirectorySha256:hash('2'),carrierDirectoryFormatSha256:hash('3'),carrierDirectory:{fileName:'PFL-KT-20261013.KE0',fileSha256:hash('4'),publishedOn:'2026-10-12',resolvedCostCarrierIk:'123456789',dataAcceptanceIk:'223456789',physicalReceiverIk:'323456789',encryptionReceiverIk:'423456789'},artifact:{payloadFileName:'ED000001',payloadSha256:hash('5'),payloadSizeBytes:2000,orderFileName:'AUF00001',orderFileSha256:hash('6'),orderFileSizeBytes:400,createdAt:'2026-10-13T10:12:12.123456Z'},validation:{validatorName:'Unabhängiger §105-Formatvalidator',validatorVersion:'2026.10',validatorRulesSha256:hash('7'),softwareTestCatalogVersion:'1.0',validationRunId:'validation-1',validatedAt:'2026-10-13T10:13:12.123456Z',payloadSha256:hash('5'),orderFileSha256:hash('6'),result:'valid',errors:[],warnings:['Empfängerannahme noch nicht geprüft.']},...overrides});

test('bindet aktuelle §105-SGB-XI-Spezifikation, Kostenträgerauflösung, Originaldateien und Prüfprotokoll',()=>{
  const record=buildCareCostCarrierExportRecord(candidate(),request());
  assert.equal(record.profileId,'sgb_xi_105_ta1_6_4_0');
  assert.equal(record.carrierDirectory.resolvedCostCarrierIk,candidate().recipientIk);
  assert.equal(record.validation.payloadSha256,record.artifact.payloadSha256);
  assert.equal(record.validationState,'format_validated_not_submitted');
  assert.equal(record.transmissionStatus,'not_transmitted');
  assert.equal(record.acceptanceStatus,'not_inferred');
  assert.ok(Object.isFrozen(record));assert.ok(Object.isFrozen(record.validation.errors));
});

test('wählt 6.4.0 nur an den dokumentierten Gültigkeitsgrenzen',()=>{
  assert.equal(getSgbXi105ExportProfileForDate('2026-05-01').technicalSpecificationVersion,'6.4.0');
  assert.equal(getSgbXi105ExportProfileForDate('2027-01-31').carrierDirectoryFormatVersion,'5.2');
  assert.throws(()=>getSgbXi105ExportProfileForDate('2026-04-30'),/nicht gültig/);
  assert.throws(()=>getSgbXi105ExportProfileForDate('2027-02-01'),/nicht gültig/);
  assert.throws(()=>getSgbXi105ExportProfileForDate('2026-02-30'),/ungültig/);
});

test('hinterlegt ausschließlich offizielle GKV-Primärquellen und den unabhängigen Prüfkatalog',()=>{
  for(const value of [SGB_XI_105_EXPORT_PROFILE.technicalSpecificationUrl,SGB_XI_105_EXPORT_PROFILE.keyDirectoryUrl,SGB_XI_105_EXPORT_PROFILE.carrierDirectoryFormatUrl,SGB_XI_105_EXPORT_PROFILE.softwareTestCatalogUrl])assert.match(value,/^https:\/\/www\.gkv-datenaustausch\.de\/media\/dokumente\//);
  assert.match(SGB_XI_105_EXPORT_PROFILE.softwareTestCatalogUrl,/ANH4_ANL1/);
});

test('verweigert §302-SGB-V- und Selbstzahlerfälle im §105-Profil',()=>{
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate({legalBasis:'sgb_v'}),request()),/§302 SGB V benötigt ein eigenes Profil/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate({recipientIk:''}),request()),/neun Ziffern/);
});

test('verweigert fehlende, abweichende oder bereits übertragene Freigabefassungen',()=>{
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate({approvalVersion:2}),request()),/Freigabeversion 1/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate({approvedAt:'2026-10-13T10:11:12.123Z'}),request()),/sechs UTC-Mikrosekundenstellen/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate({documentFingerprint:'kein-hash'}),request()),/Dokumentfingerprint/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate({transmissionStatus:'submitted'}),request()),/bereits als übertragen/);
});

test('verweigert fremde oder unvollständige Kostenträgerauflösung',()=>{
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({carrierDirectory:{...request().carrierDirectory,resolvedCostCarrierIk:'999999999'}})),/andere Kostenträger-IK/);
  for(const key of ['dataAcceptanceIk','physicalReceiverIk','encryptionReceiverIk'])assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({carrierDirectory:{...request().carrierDirectory,[key]:'123'}})),/neun Ziffern/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({carrierDirectory:{...request().carrierDirectory,publishedOn:'2026-10-14'}})),/erst nach dem Export/);
});

test('verweigert falsche technische, Schlüssel- und Kostenträgerdateiversionen',()=>{
  for(const [key,value] of [['technicalSpecificationVersion','6.3.0'],['keyDirectoryVersion','6.3.0'],['carrierDirectoryFormatVersion','5.1'],['profileId','beliebig']])assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({[key]:value})),/Empfangsprofil/);
});

test('verlangt SHA-256 für Spezifikationen, Kostenträgerdatei, Exportdateien und Validatorregeln',()=>{
  for(const key of ['specificationSha256','keyDirectorySha256','carrierDirectoryFormatSha256'])assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({[key]:'abc'})),/SHA-256/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({carrierDirectory:{...request().carrierDirectory,fileSha256:'abc'}})),/SHA-256/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({artifact:{...request().artifact,payloadSha256:'abc'}})),/SHA-256/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,validatorRulesSha256:'abc'}})),/SHA-256/);
});

test('bewahrt Auftrags- und Nutzdatendatei als getrennte positive Originale',()=>{
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({artifact:{...request().artifact,payloadSizeBytes:0}})),/Nutzdatendateigröße/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({artifact:{...request().artifact,orderFileName:'ED000001'}})),/getrennte Originale/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({artifact:{...request().artifact,orderFileSha256:hash('5')}})),/getrennte Originale/);
});

test('Prüfprotokoll muss exakt beide gespeicherten Dateihashes binden',()=>{
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,payloadSha256:hash('8')}})),/gehört nicht/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,orderFileSha256:hash('8')}})),/gehört nicht/);
});

test('Validierung darf nicht vor Dateierzeugung liegen und braucht Prüfkatalog 1.0',()=>{
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,validatedAt:'2026-10-13T10:11:12.123456Z'}})),/vor der Erzeugung/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,softwareTestCatalogVersion:'2.0'}})),/Prüfkatalogversion/);
});

test('gültiges Protokoll darf keine Fehler und ungültiges muss konkrete Fehler enthalten',()=>{
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,errors:['UNB fehlt']}})),/keine Formatfehler/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,result:'invalid',errors:[]}})),/mindestens einen konkreten/);
  const rejected=buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,result:'invalid',errors:['UNB fehlt'],warnings:[]}}));
  assert.equal(rejected.validationState,'format_rejected_not_submitted');
});

test('leere und doppelte Meldungen werden nicht als belastbares Prüfprotokoll gespeichert',()=>{
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,warnings:[' ']}})),/Validierungswarnung fehlt/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,warnings:['gleich','gleich']}})),/doppelte Einträge/);
  assert.throws(()=>buildCareCostCarrierExportRecord(candidate(),request({validation:{...request().validation,warnings:[null]}})),/ungültig/);
});

test('SQL ist append-only, mandantengebunden und bewahrt Übertragung und Annahme als offen',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_cost_carrier_exports.sql',import.meta.url),'utf8');
  assert.match(sql,/BEFORE UPDATE OR DELETE/);assert.match(sql,/Exportdateien und Formatprüfprotokolle bleiben unverändert/);
  assert.match(sql,/current_tenant_id\(\)/);assert.match(sql,/pflege\.invoices\.manage/);
  assert.match(sql,/transmission_status text NOT NULL DEFAULT 'not_transmitted'/);assert.match(sql,/acceptance_status text NOT NULL DEFAULT 'not_inferred'/);
  assert.doesNotMatch(sql,/acceptance_status[^\n]*accepted/);
});

test('SQL serialisiert Anfrage und Freigabe und hält Originalidentitäten fest',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_cost_carrier_exports.sql',import.meta.url),'utf8');
  assert.equal((sql.match(/pg_advisory_xact_lock/g)??[]).length,2);
  for(const token of [/invoice_approval_id uuid NOT NULL/,/invoice_draft_id uuid NOT NULL/,/document_fingerprint text NOT NULL/,/recipient_ik text NOT NULL/,/client_request_id uuid NOT NULL/])assert.match(sql,token);
});

test('SQL bindet aktuelle Versionen, Kostenträger-IK, Dateihashes und Validatorlauf erneut',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_cost_carrier_exports.sql',import.meta.url),'utf8');
  for(const token of [/'sgb_xi_105_ta1_6_4_0'/,/'6\.4\.0'/,/'5\.2'/,/resolvedCostCarrierIk/,/dataAcceptanceIk/,/physicalReceiverIk/,/encryptionReceiverIk/,/validatorRulesSha256/,/validationRunId/])assert.match(sql,token);
  assert.match(sql,/payloadSha256' IS DISTINCT FROM p_payload->'artifact'->>'payloadSha256'/);
});

test('SQL prüft ausschließlich §105-SGB-XI-Positionen und erfindet keine Übermittlung',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/patches/ambulatory_care_cost_carrier_exports.sql',import.meta.url),'utf8');
  assert.match(sql,/b\.legal_basis<>'sgb_xi'/);assert.match(sql,/noch nicht übertragene Freigabeversion 1/);
  assert.match(sql,/Keine Übermittlung oder Empfängerannahme/);
});

test('Service verwendet eigene Kandidatenabfrage, vollständige Fallgrundlagen und einen getrennten RPC',async()=>{
  const service=await fs.readFile(new URL('../../src/lib/pflege/careBillingLiveService.ts',import.meta.url),'utf8');
  assert.match(service,/listCareCostCarrierExportCandidates/);assert.match(service,/pfleger_cost_carrier_exports/);
  assert.match(service,/pfleger_invoice_draft_positions/);assert.match(service,/legal_basis/);
  assert.match(service,/buildCareCostCarrierExportRecord/);assert.match(service,/record_pfleger_cost_carrier_export_validation/);
});

test('Web zeigt versionsgebundene Prüflücke; Native-Oberfläche bleibt leer',async()=>{
  const web=await fs.readFile(new URL('../../src/components/office/ClientCostCarrierExportValidationSummary.web.tsx',import.meta.url),'utf8');
  const native=await fs.readFile(new URL('../../src/components/office/ClientCostCarrierExportValidationSummary.tsx',import.meta.url),'utf8');
  assert.match(web,/TA 1/);assert.match(web,/unabhängiger Validator/);assert.match(web,/nicht übermittelt/);assert.match(web,/§302 SGB V/);
  assert.match(native,/return null/);
});
