import test from 'node:test';import assert from 'node:assert/strict';
import {assessMedicationOrder as check} from '../../src/lib/pflege/medicationOrderIntegrity.ts';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {woundUuid} from '../../src/lib/pflege/woundCareDomain.ts';
import {validEventInstant} from '../../src/lib/pflege/medicationAdministrationDomain.ts';
const expected={id:'med',tenantId:'tenant',clientId:'client',updatedAt:'2026-10-08T12:00:00.123456Z'};
const row={id:'med',tenant_id:'tenant',client_id:'client',updated_at:expected.updatedAt,status:'active',name:'Präparat',dosage:'1 Tablette',route:'oral',prescribed_by:'Ärztliche Person',start_date:'2026-10-01',end_date:null,is_prn:false,is_controlled_substance:false,is_high_alert:false};
test('Vollständige gespeicherte Angaben sind keine automatische ärztliche Freigabe',()=>{const a=check(row,expected);assert.equal(a.canRecord,true);assert.deepEqual(a.missing,[]);assert.equal(a.status,'active');assert.equal('approved' in a,false);});
test('Unbekannter oder fehlender Status wird niemals aktiv',()=>{for(const status of [null,undefined,'unknown','',123,['active']]){const a=check({...row,status},expected);assert.equal(a.status,'unknown');assert.equal(a.canRecord,false);}});
test('Darreichungsform ersetzt keinen fehlenden Applikationsweg',()=>{const a=check({...row,route:null,form:'Tablette'},expected);assert.equal(a.route,null);assert.ok(a.missing.includes('Applikationsweg'));assert.ok(check({...row,route:'Nicht angegeben'},expected).missing.includes('Applikationsweg'));});
test('Fremde Zuordnung und zwischenzeitliche Änderung sperren neue Dokumentation',()=>{for(const change of [{tenant_id:'other'},{client_id:'other'},{id:'other'},{updated_at:'2026-10-08T12:00:00.123457Z'}])assert.equal(check({...row,...change},expected).canRecord,false);});
test('Ungültige und fehlende Zeitstempel ergeben keinen erfundenen Verordnungsstand',()=>{for(const updated_at of [null,'2026-02-30T12:00:00Z','2026-10-08T12:00:00'])assert.equal(check({...row,updated_at},{...expected,updatedAt:updated_at}).canRecord,false);});
test('Fehlende fachliche Angaben bleiben sichtbar ohne historische Tatsachen zu erfinden',()=>{const a=check({...row,name:' ',dosage:null,prescribed_by:null,start_date:null},expected);assert.deepEqual(a.missing,['Präparat','Dosierung','Verordnende Person','Verordnungsbeginn']);assert.equal(a.canRecord,true);});
test('Unklare Risikoangaben werden nicht als Nein behandelt',()=>{for(const key of ['is_prn','is_controlled_substance','is_high_alert'])assert.equal(check({...row,[key]:null},expected).canRecord,false);});
test('Ungültige Gültigkeitsdaten und widersprüchliche Zeiträume werden erkannt',()=>{for(const change of [{start_date:'2026-02-30'},{end_date:'2026-02-30'},{end_date:'2026-09-30'}])assert.equal(check({...row,...change},expected).canRecord,false);assert.equal(check({...row,end_date:row.start_date},expected).canRecord,true);});
test('Bedarfsverordnung benötigt sichtbare verordnete Bedarfsindikation',()=>{assert.ok(check({...row,is_prn:true,prn_reason:null},expected).missing.includes('Verordnete Bedarfsindikation'));assert.deepEqual(check({...row,is_prn:true,prn_reason:'Hinterlegte ärztliche Indikation'},expected).missing,[]);});

// Exercise the private Web receipt against the actual unchanged service-generated insert.
// Source extraction uses the existing Node runtime; it is neither an SDK nor a database test.
const receiptSource=fs.readFileSync(new URL('../../src/lib/pflege/medicationCreateReceipt.web.ts',import.meta.url),'utf8');
const receiptCode=stripTypeScriptTypes(receiptSource.slice(receiptSource.indexOf('type OwnAttempt =')),{mode:'strip'}).replace(/export /g,'');
const liveSource=fs.readFileSync(new URL('../../src/lib/pflege/medicationLiveService.ts',import.meta.url),'utf8');
const createCode=stripTypeScriptTypes(liveSource.slice(liveSource.indexOf('export async function createLiveMedication('),liveSource.indexOf('\nexport async function setLiveMedicationStatus')),{mode:'strip'}).replace(/^export /,'');
const nativeAttempt={id:'11111111-1111-4111-8111-111111111111',tenantId:'22222222-2222-4222-8222-222222222222',profileId:'33333333-3333-4333-8333-333333333333',clientId:'44444444-4444-4444-8444-444444444444',role:'business_admin',input:{clientId:'44444444-4444-4444-8444-444444444444',name:' Präparat ',activeIngredient:' Wirkstoff ',strength:' 5 mg ',form:' Tablette ',dosage:' 1 Tablette ',schedule:' 1-0-0-0 ',route:' oral ',prescribedBy:' Ärztliche Originalangabe ',indication:' Originalindikation ',notes:' ',startDate:'2026-10-11',morningDose:'1',noonDose:'',eveningDose:'',nightDose:'',isPrn:true,prnReason:' Verordnete Indikation ',isHighAlert:true,isControlledSubstance:false,intensiveCareRelevant:true,infusionRate:'2 ml/h',dilution:'Originalträger',pumpRequired:true}};
async function actualInsert(){
 let inserted;
 const create=new Function('guard','getServiceMode','getSupabaseClient','unavailable','fromUnknownTable','toGermanSupabaseError',createCode+'\nreturn createLiveMedication;')(()=>null,()=>'supabase',()=>({mock:true}),()=>({ok:false,error:'mock unavailable'}),()=>({insert(payload){inserted=structuredClone(payload);return {select(){return {single:async()=>({data:{id:nativeAttempt.id},error:null})};}};}}),String);
 assert.equal((await create(nativeAttempt.tenantId,nativeAttempt.profileId,structuredClone(nativeAttempt.input),nativeAttempt.role)).ok,true);
 return {...inserted,id:nativeAttempt.id,created_at:'2026-10-11T10:00:00.123456Z',updated_at:'2026-10-11T10:00:00.123457Z',untouched_original:{instant:'2026-10-11T12:00:00.123456+02:00'}};
}
function receiptRuntime(overrides={}){
 const deps={woundUuid,validEventInstant,enforcePermission:()=>null,guardServiceTenant:()=>null,getServiceMode:()=>'supabase',getSupabaseClient:()=>({mock:true}),withServiceQueryTimeout:p=>p,fromUnknownTable:()=>{throw Error('unexpected transport');},...overrides};
 return new Function(...Object.keys(deps),receiptCode+'\nreturn {assertMedicationCreateReceipt,readMedicationCreateReceipt};')(...Object.values(deps));
}
test('Web-Anlagenachweis passt zu sämtlichen tatsächlich normalisierten Insertfeldern ohne klinische Freigabe',async()=>{
 const raw=await actualInsert(),original=structuredClone(raw),verified=receiptRuntime().assertMedicationCreateReceipt(raw,nativeAttempt);
 assert.deepEqual(verified,raw);assert.deepEqual(raw,original);assert.equal(verified.status,'active');assert.equal('approved' in verified,false);
 assert.equal(verified.updated_at,'2026-10-11T10:00:00.123457Z');assert.equal(verified.notes,null);assert.equal(verified.name,'Präparat');
 verified.untouched_original.instant='changed';assert.deepEqual(raw,original);
});
test('Web-Anlagenachweis lehnt fremde gültige native Kennungen und Originalautoren ab',async()=>{
 const raw=await actualInsert(),verify=receiptRuntime().assertMedicationCreateReceipt;
 for(const key of ['id','tenant_id','client_id','created_by','updated_by'])assert.throws(()=>verify({...raw,[key]:'55555555-5555-4555-8555-555555555555'},nativeAttempt));
});
test('Jedes tatsächlich gesendete Verordnungsfeld muss unverändert rückgelesen werden',async()=>{
 const raw=await actualInsert(),verify=receiptRuntime().assertMedicationCreateReceipt;
 for(const key of Object.keys(raw).filter(key=>!['created_at','updated_at','untouched_original'].includes(key))){
  const changed=typeof raw[key]==='boolean'?!raw[key]:raw[key]===null?'changed':String(raw[key])+'changed';
  assert.throws(()=>verify({...raw,[key]:changed},nativeAttempt),key);
  const missing={...raw};delete missing[key];assert.throws(()=>verify(missing,nativeAttempt),key);
 }
});
test('Native Rohzeiten benötigen tatsächliche Strings und gültige Kalender mit Mikrosekunden',async()=>{
 const raw=await actualInsert(),verify=receiptRuntime().assertMedicationCreateReceipt;
 for(const key of ['created_at','updated_at'])for(const invalid of [null,42,{},['2026-10-11T10:00:00Z'],'2026-02-30T10:00:00Z','2026-10-11T10:00:00','2026-10-11T10:00:00.1234567Z'])assert.throws(()=>verify({...raw,[key]:invalid},nativeAttempt));
 assert.equal(verify({...raw,updated_at:'2026-10-11T12:00:00.123457+02:00'},nativeAttempt).updated_at,'2026-10-11T12:00:00.123457+02:00');
});
test('Privater Webreader liest nur explizite native Rückgabe und Mandant mit vollständiger Zeile',async()=>{
 const raw=await actualInsert(),calls=[],filters={};
 const builder={select(fields){calls.push(fields);return this;},eq(key,value){filters[key]=value;return this;},async maybeSingle(){return {data:raw,error:null};}};
 const verified=await receiptRuntime({fromUnknownTable:(_client,table)=>{calls.push(table);return builder;}}).readMedicationCreateReceipt(nativeAttempt,()=>true);
 assert.deepEqual(filters,{tenant_id:nativeAttempt.tenantId,id:nativeAttempt.id});assert.deepEqual(calls,['medications','*']);assert.deepEqual(verified,raw);
});
test('Privater Webreader sperrt nach Await widerrufenen eigenen Lesebezug vor Snapshotübernahme',async()=>{
 const raw=await actualInsert();let current=true,resolveRead;
 const builder={select(){return this;},eq(){return this;},maybeSingle(){return new Promise(resolve=>{resolveRead=resolve;});}};
 const pending=receiptRuntime({fromUnknownTable:()=>builder}).readMedicationCreateReceipt(nativeAttempt,()=>current);
 current=false;resolveRead({data:raw,error:null});await assert.rejects(pending);
 let calls=0;await assert.rejects(receiptRuntime({fromUnknownTable:()=>{calls++;return builder;}}).readMedicationCreateReceipt(nativeAttempt,()=>false));assert.equal(calls,0);
});
test('Fehlender Originalnachweis oder Transportfehler liefert keinen bestätigten Web-Anlagenachweis',async()=>{
 for(const result of [{data:null,error:null},{data:null,error:{code:'mock'}},Promise.reject(Error('mock transport'))]){
  const builder={select(){return this;},eq(){return this;},maybeSingle(){return result;}};
  await assert.rejects(receiptRuntime({fromUnknownTable:()=>builder}).readMedicationCreateReceipt(nativeAttempt,()=>true));
 }
});
