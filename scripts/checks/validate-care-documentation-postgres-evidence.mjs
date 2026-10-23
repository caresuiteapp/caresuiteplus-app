// Consume the actual JSON emitted after the Staging fixture has rolled back all synthetic rows:
// node scripts/checks/validate-care-documentation-postgres-evidence.mjs /tmp/pflege-care-documentation-quarantine-synthetic-evidence.json
// No RPC, credentials, clinical signature or browser acceptance is supplied by this runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {careDocumentationEntryIssue,careDocumentationOriginalIssue,careDocumentationPacketIssue,makeCareDocumentationPacket} from '../../src/lib/pflege/careDocumentationPacket.web.ts';
import {decodeCareDocumentationPathContext,validateCareDocumentationPathCommand,assertCareDocumentationPathSelectionCurrent} from '../../src/lib/pflege/careDocumentationPathWorkspaceDomain.web.ts';

const clone=value=>structuredClone(value);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const proof=/^sha256:[0-9a-f]{64}$/;
function micros(value){
 const match=String(value).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/);
 assert.ok(match,'A retained timestamp with at most six explicit fractional digits is required.');
 const millis=Date.parse(match[1]+match[3]);assert.ok(Number.isFinite(millis));
 return BigInt(millis)*1000n+BigInt((match[2]??'').padEnd(6,'0'));
}
function nativeMatches(native,packet,expectedId,expectedPreviousId){
 assert.ok(native&&typeof native==='object');assert.equal(native.id,expectedId);
 assert.equal(native.tenant_id,packet.tenantId);assert.equal(native.client_id,packet.clientId);
 assert.equal(native.recorded_by,packet.actorId);assert.equal(native.recorded_by_name,'Synthetic documentation author');
 assert.equal(native.entry_type,'care_report');assert.equal(native.signature_status,'unsigned');
 assert.equal(native.title,packet.entry.title);assert.equal(native.content,packet.entry.observation);
 assert.equal(native.observations,packet.entry.observation);assert.equal(native.interventions,packet.entry.intervention);
 assert.equal(native.result,packet.entry.result);assert.equal(native.deviation,'');assert.equal(native.escalation,'');
 assert.equal(native.correction_of_id,expectedPreviousId);assert.equal(native.correction_reason,packet.correctionReason);
 assert.equal(micros(native.recorded_at),micros(packet.entry.occurredAt));
}
function retainedReceiptMatches(receipt,packet,expected,expectedId,revision){
 assert.equal(receipt.requestId,packet.requestId);assert.deepEqual(receipt.packet,packet);
 const original=receipt.original;
 assert.equal(careDocumentationOriginalIssue(original,expected),null);
 assert.equal(original.tenantId,expected.tenantId);assert.equal(original.clientId,expected.clientId);
 assert.equal(original.recordedBy,expected.actorId);assert.equal(original.recordedByName,'Synthetic documentation author');
 if(expectedId!==undefined)assert.equal(original.id,expectedId);
 assert.equal(original.id,original.headId);assert.equal(original.revision,revision);assert.equal(original.history.length,revision);
 assert.equal(original.kind,'care_report');assert.equal(original.signature,null);assert.equal(original.voided,false);
 assert.deepEqual(original.payload,packet.entry);assert.equal(original.occurredAt,packet.entry.occurredAt);
 assert.equal(original.createdAt,original.recordedAt);assert.match(original.contentFingerprint,proof);
 const latest=original.history.at(-1);assert.equal(latest.id,original.id);assert.deepEqual(latest.payload,original.payload);
 assert.equal(latest.recordedBy,expected.actorId);assert.equal(latest.recordedByName,original.recordedByName);
 assert.equal(latest.occurredAt,original.occurredAt);assert.equal(latest.recordedAt,original.recordedAt);
 assert.equal(latest.correctionReason,packet.correctionReason);assert.equal(latest.contentFingerprint,original.contentFingerprint);
 if(packet.action==='create')assert.equal(original.rootId,original.id);
 else {assert.equal(original.rootId,packet.original.rootId);assert.equal(latest.previousId,packet.expectedHeadId);assert.deepEqual(original.history.slice(0,-1),packet.original.history);}
 return original;
}

export async function registerCareDocumentationPostgresEvidenceTests(supplied){
 assert.ok(supplied,'Pass the actual saved Staging evidence JSON file.');
 let evidence=JSON.parse(readFileSync(supplied,'utf8'));
 if(Array.isArray(evidence)){assert.equal(evidence.length,1);evidence=evidence[0].evidence;}
 else if(evidence&&typeof evidence==='object'&&Object.hasOwn(evidence,'evidence'))evidence=evidence.evidence;
 if(typeof evidence==='string')evidence=JSON.parse(evidence);
 assert.ok(evidence&&typeof evidence==='object'&&!Array.isArray(evidence));
 assert.equal(evidence.schemaVersion,1);assert.equal(evidence.cleanupConfirmed,true);
 const expected=evidence.expected;assert.ok(expected&&typeof expected==='object');
 for(const key of ['tenantId','clientId','actorId','createRequestId','correctRequestId','blockedConfirmationRequestId','laterRequestId','firstVersionId','secondVersionId','thirdVersionId'])assert.match(expected[key],uuid,key);
 const primary=[['create','createPacket','createReceipt','createRequestId','firstVersionId',1],['correct','correctPacket','correctReceipt','correctRequestId','secondVersionId',2],['later correction','laterPacket','laterReceipt','laterRequestId','thirdVersionId',3]];
 const additional=[['tied root','extraPacket','extraReceipt',1],['second tied root','lowerPacket','lowerReceipt',1],['older-page correction','olderPacket','olderReceipt',2]];

 test('Actual CareDocumentation evidence proves rollback cleanup and same-profile different-account denial',()=>{
  assert.equal(evidence.cleanupConfirmed,true);assert.equal(evidence.sameProfileDifferentAuthReplayDenied,true);
  for(const key of ['nativeFirst','nativeSecondUnsigned','nativeThird','pathContext','blockedPathCommand','blockedConfirmationPacket','firstPage','secondPage','thirdPage','emptyPage'])assert.ok(evidence[key],key);
 });
 for(const [name,packetKey,receiptKey,requestKey,idKey,revision] of primary){
  test('Actual SQL '+name+' packet and exact own historical receipt satisfy the existing Web validators',()=>{
   const packet=evidence[packetKey];assert.equal(packet.requestId,expected[requestKey]);
   assert.equal(packet.tenantId,expected.tenantId);assert.equal(packet.clientId,expected.clientId);assert.equal(packet.actorId,expected.actorId);
   assert.equal(careDocumentationEntryIssue(packet.entry),null);assert.equal(careDocumentationPacketIssue(packet),null);
   assert.deepEqual(makeCareDocumentationPacket(packet),packet);
   retainedReceiptMatches(evidence[receiptKey],packet,expected,expected[idKey],revision);
  });
 }
 for(const [name,packetKey,receiptKey,revision] of additional){
  test('Actual SQL '+name+' remains bound to its independently retained own packet and full history',()=>{
   const packet=evidence[packetKey];assert.equal(careDocumentationPacketIssue(packet),null);
   assert.equal(packet.tenantId,expected.tenantId);assert.equal(packet.clientId,expected.clientId);assert.equal(packet.actorId,expected.actorId);
   retainedReceiptMatches(evidence[receiptKey],packet,expected,undefined,revision);
  });
 }
 for(const [name,nativeKey,packetKey,idKey,previousKey] of [['create','nativeFirst','createPacket','firstVersionId',null],['first correction','nativeSecondUnsigned','correctPacket','secondVersionId','firstVersionId'],['second correction','nativeThird','laterPacket','thirdVersionId','secondVersionId']]){
  test('Actual native '+name+' row retains exactly authored unsigned facts and the separate expected version identity',()=>nativeMatches(evidence[nativeKey],evidence[packetKey],expected[idKey],previousKey===null?null:expected[previousKey]));
 }
 test('Actual append-only originals preserve each earlier complete payload and one-microsecond event changes',()=>{
  assert.deepEqual(evidence.correctPacket.original,evidence.createReceipt.original);
  assert.deepEqual(evidence.laterPacket.original,evidence.correctReceipt.original);
  assert.deepEqual(evidence.laterReceipt.original.history.slice(0,2),evidence.correctReceipt.original.history);
  assert.equal(evidence.createReceipt.original.history.length,1);assert.equal(evidence.correctReceipt.original.history.length,2);
  assert.equal(micros(evidence.correctPacket.entry.occurredAt)-micros(evidence.createPacket.entry.occurredAt),1n);
  assert.equal(micros(evidence.laterPacket.entry.occurredAt)-micros(evidence.correctPacket.entry.occurredAt),1n);
 });
 test('Actual cursor pages preserve tied-time UUID order, explicit exhaustion and a single complete ledger proof',()=>{
  const pages=[evidence.firstPage,evidence.secondPage,evidence.thirdPage,evidence.emptyPage];
  const token=pages[0].stateFingerprint;assert.match(token,proof);const seen=new Set();
  for(const [index,page] of pages.entries()){
   assert.equal(page.stateFingerprint,token);assert.equal(page.rows.length,index===3?0:1);
   for(const original of page.rows){assert.equal(careDocumentationOriginalIssue(original,expected),null);assert.ok(!seen.has(original.id));seen.add(original.id);assert.equal(page.nextCursorId,original.id);assert.equal(page.nextCursorOccurredAt,original.occurredAt);}
  }
  assert.equal(pages[0].rows[0].id,expected.thirdVersionId);
  assert.deepEqual(pages[0].rows[0],evidence.laterReceipt.original);
  const tied=[evidence.extraReceipt.original,evidence.lowerReceipt.original].sort((left,right)=>left.id<right.id?1:-1);
  assert.deepEqual([pages[1].rows[0],pages[2].rows[0]],tied,'Both tied roots must be the exact retained SQL originals, including their authored payloads.');
  assert.equal(pages[1].rows[0].occurredAt,evidence.createPacket.entry.occurredAt);
  assert.equal(pages[2].rows[0].occurredAt,evidence.createPacket.entry.occurredAt);
  assert.ok(pages[1].rows[0].id>pages[2].rows[0].id);assert.equal(seen.size,3);
  assert.equal(pages[3].nextCursorOccurredAt,null);assert.equal(pages[3].nextCursorId,null);
  assert.deepEqual(evidence.olderPacket.original,pages[2].rows[0]);
  assert.notEqual(evidence.pathContext.sources.stateFingerprint,token,'An older-page correction must invalidate the full ledger although the first page is unchanged.');
 });
 test('Actual quarantined path context satisfies the existing Web decoder and retains exact native sources',()=>{
  const context=decodeCareDocumentationPathContext(evidence.pathContext,expected);assert.match(context.sources.stateFingerprint,proof);
  assert.equal(context.history.count,0);assert.equal(context.history.headId,null);assert.deepEqual(context.history.events,[]);
  const source=context.sources.rows.find(row=>row.kind==='care_documentation'&&row.id===expected.firstVersionId);
  assert.ok(source);assert.deepEqual(source.snapshot,evidence.nativeFirst);
  assert.equal(context.sources.rows.some(row=>row.kind==='care_visit'),false);
  const client=context.sources.rows.find(row=>row.kind==='client_record'&&row.id===expected.clientId);assert.ok(client);
  assert.deepEqual(Object.keys(client.snapshot).sort(),['first_name','id','last_name','lifecycle_status','status','tenant_id']);
  const command=evidence.blockedPathCommand;assert.equal(command.tenantId,expected.tenantId);assert.equal(command.clientId,expected.clientId);assert.equal(command.actorId,expected.actorId);
  assert.match(command.requestId,uuid);assert.match(command.eventId,uuid);assert.notEqual(command.requestId,command.eventId);assert.equal(command.expectedHeadId,null);
  validateCareDocumentationPathCommand(command);assertCareDocumentationPathSelectionCurrent(command,context);
 });
 test('The fully shaped content-confirmation request remains an explicit blocked bridge rather than a clinical signature',()=>{
  const packet=evidence.blockedConfirmationPacket;assert.equal(packet.requestId,expected.blockedConfirmationRequestId);
  assert.equal(packet.tenantId,expected.tenantId);assert.equal(packet.clientId,expected.clientId);assert.equal(packet.actorId,expected.actorId);
  assert.equal(packet.action,'confirm');assert.deepEqual(packet.original,evidence.correctReceipt.original);
  assert.equal(careDocumentationPacketIssue(packet),null);
  for(const key of ['createReceipt','correctReceipt','laterReceipt','extraReceipt','lowerReceipt','olderReceipt'])assert.equal(evidence[key].original.signature,null);
 });
 test('All six fully shaped unsupported clinical kinds retain their actual 42501 denial and no positive receipt',()=>{
  assert.equal(evidence.blockedNativeBridgeCases.length,6);
  assert.deepEqual(evidence.blockedNativeBridgeCases.map(row=>row.kind).sort(),['control','external','incident','planned_service','refusal','structured_protocol']);
  for(const row of evidence.blockedNativeBridgeCases){assert.equal(row.sqlState,'42501');assert.equal(row.packet.entry.kind,row.kind);assert.equal(row.packet.tenantId,expected.tenantId);assert.equal(row.packet.clientId,expected.clientId);assert.equal(row.packet.actorId,expected.actorId);assert.equal(careDocumentationPacketIssue(row.packet),null);assert.equal(Object.hasOwn(row,'receipt'),false);}
 });
 test('Retained actual receipts reject changed request/version/author/payload identities against separate call expectations',()=>{
  for(const mutate of [r=>{r.requestId=expected.correctRequestId;},r=>{r.original.id=expected.secondVersionId;r.original.headId=expected.secondVersionId;r.original.rootId=expected.secondVersionId;r.original.history[0].id=expected.secondVersionId;},r=>{r.original.recordedBy=expected.correctRequestId;},r=>{r.original.payload.observation+=' changed';},r=>{r.packet.entry.title+=' changed';}]){
   const wrong=clone(evidence.createReceipt);mutate(wrong);assert.throws(()=>retainedReceiptMatches(wrong,evidence.createPacket,expected,expected.firstVersionId,1));
  }
 });
 test('Actual native rows reject a one-microsecond change, wrong native actor and substituted retained version',()=>{
  for(const mutate of [n=>{n.recorded_at=evidence.correctPacket.entry.occurredAt;},n=>{n.recorded_by=expected.correctRequestId;},n=>{n.id=expected.secondVersionId;},n=>{n.observations+=' changed';},n=>{n.signature_status='signed';}]){const wrong=clone(evidence.nativeFirst);mutate(wrong);assert.throws(()=>nativeMatches(wrong,evidence.createPacket,expected.firstVersionId,null));}
 });
 test('Existing Web original validation rejects missing real history, foreign scope and a changed lexical event time',()=>{
  for(const mutate of [o=>{o.history.shift();},o=>{o.tenantId=expected.clientId;},o=>{o.clientId=expected.tenantId;},o=>{o.occurredAt=evidence.createPacket.entry.occurredAt;}]){const wrong=clone(evidence.correctReceipt.original);mutate(wrong);assert.ok(careDocumentationOriginalIssue(wrong,expected));}
 });
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await registerCareDocumentationPostgresEvidenceTests(process.argv[2]);
