/** Validate retained synthetic SQL fixture packets against the actual current Web domains. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import {woundPathOriginalIssue,woundPathPacketIssue} from '../src/lib/pflege/woundPathPacket.web.ts';

const packetUrl=new URL('../src/lib/pflege/woundPathPacket.web.ts',import.meta.url).href;
const reviewSource=fs.readFileSync(new URL('../src/lib/pflege/woundPathReview.web.ts',import.meta.url),'utf8').replace("from './woundPathPacket.web'",`from '${packetUrl}'`);
const {woundPathReviewOriginalIssue,woundPathReviewPacketIssue,woundPathReviewStable}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(reviewSource,{mode:'strip'})).toString('base64'));

export function validateWoundStagingProjection(p){
const context={tenantId:p.tenantId,clientId:p.clientId,woundId:p.woundId};
for(const [name,packetIssue,originalIssue] of [['path',woundPathPacketIssue,woundPathOriginalIssue],['review',woundPathReviewPacketIssue,woundPathReviewOriginalIssue],['decision',woundPathReviewPacketIssue,woundPathReviewOriginalIssue]]){
 const packet=p[`${name}Packet`],receipt=p[`${name}Receipt`];
 assert.equal(packetIssue(packet),null,`${name} actual packet`);
 for(const key of ['tenantId','clientId','woundId'])assert.equal(packet[key],context[key],`${name} independently retained ${key}`);
 assert.equal(originalIssue(receipt?.original,context),null,`${name} actual retained original`);
 assert.equal(receipt.requestId,packet.requestId,`${name} own receipt request`);
 assert.equal(woundPathReviewStable(receipt.packet),woundPathReviewStable(packet),`${name} exact packet echo`);
 const last=receipt.original.history.at(-1);
 assert.equal(receipt.original.revision,packet.expectedRevision+1,`${name} exact expected revision`);
 if(name==='path'){
  assert.equal(last.id,packet.requestId,'path saved event identity');
  assert.equal(last.recordedBy,packet.actorId,'path actual author');
  assert.equal(last.previousId,packet.expectedHeadId,'path exact previous head');
  assert.equal(last.reason,packet.reason,'path actual change reason');
  assert.equal(woundPathReviewStable(last.payload),woundPathReviewStable(packet.entry),'path exact saved entry');
 }else{
  for(const key of ['requestId','actorId','action','reason','requiredChange','rationale'])assert.equal(last[key],packet[key],`${name} exact saved ${key}`);
  assert.equal(last.previousId,packet.expectedHeadId,`${name} exact previous review head`);
  assert.equal(receipt.original.woundHeadId,packet.woundOriginal.headId,`${name} exact wound head`);
  assert.equal(receipt.original.woundFingerprint,packet.woundOriginal.contentFingerprint,`${name} exact native wound fingerprint`);
 }

}
const review=p.reviewReceipt.original;
assert.equal(review.history[0].id,review.rootId,'initial review root is its first event');
assert.equal(review.headId,review.rootId,'initial review head is its first event');
return true;
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
if(process.argv.length!==3)throw Error('Usage: node scripts/check-wound-staging-projection.mjs /absolute/path/to/synthetic-projection.json');
validateWoundStagingProjection(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
console.log('PASS: actual SQL path, review request and synthetic decision packets, retained originals and exact receipts match the current Web domain contracts. This is synthetic SQL/domain evidence; it does not prove Auth HTTP, browser execution, Storage bytes or real clinical qualification.');
}
