import { createHash } from 'node:crypto';
import { buildClassicPayload, buildEncryptedOrder } from '../../src/lib/gkvExchange/edifact';
import { billingDay, GKV_SPEC, isIk, isMonth, type ExchangeDraft } from '../../src/lib/gkvExchange/model';
import { releaseIssues, type ReleaseEvidence } from '../../src/lib/gkvExchange/lifecycle';

/** Internal server contracts. There is deliberately no HTTP route accepting evidence/crypto results from a browser.
 * A concrete provider plus durable transactional outbox must be connected before live use.
 */
export const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export type FileArtifact={name:string;bytes:Uint8Array;sha256:string};
type DeliveryBinding={preparedDay:string;senderIk:string;receiverIk:string;insuranceIk:string;serviceType:string;month:string};
export type PreparedDelivery=DeliveryBinding & {channel:'classic'|'kim';files:FileArtifact[];payloadSha256:string;manifestSha256:string};
const artifact=(name:string,bytes:Uint8Array):FileArtifact=>({name,bytes:Uint8Array.from(bytes),sha256:sha256(bytes)});
const manifest=(d:Omit<PreparedDelivery,'manifestSha256'>)=>sha256(Buffer.from(JSON.stringify({channel:d.channel,payloadSha256:d.payloadSha256,preparedDay:d.preparedDay,senderIk:d.senderIk,receiverIk:d.receiverIk,insuranceIk:d.insuranceIk,serviceType:d.serviceType,month:d.month,files:d.files.map(f=>({name:f.name,sha256:f.sha256,bytes:f.bytes.length}))})));
const binding=(d:ExchangeDraft):DeliveryBinding=>({preparedDay:billingDay(d.createdAt),senderIk:d.profile.senderIk,receiverIk:d.receiverIk,insuranceIk:d.insuranceIk,serviceType:d.serviceType,month:d.month});
function current(d:ExchangeDraft,now:Date){
  const day=billingDay(now);
  if(!day||day<GKV_SPEC.validFrom||day>GKV_SPEC.validUntil||billingDay(d.createdAt)!==day)throw new Error('Versand benötigt einen aktuellen, serverseitig erzeugten Datenstand in der unterstützten Version.');
  if(d.cases.some(c=>typeof c.sourceInvoiceId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(c.sourceInvoiceId)))throw new Error('Echtversand benötigt vollständig verknüpfte Quellrechnungen.');
}
function release(d:ExchangeDraft,e:ReleaseEvidence,hash:string){
  if(e.payloadSha256!==hash)throw new Error('Prüfbeleg gehört nicht zu den tatsächlichen Dateibytes.');
  const errors=releaseIssues(d,e).filter(i=>i.severity==='error');if(errors.length)throw new Error(errors[0].message);
}
export type DtaSecurityAdapter={
  /** The implementation must use the registered sender certificate and recipient certificate/IK. */
  encryptAndSign(bytes:Uint8Array,context:{senderIk:string;receiverIk:string}):Promise<Uint8Array>;
  /** Independent verification of the produced container, certificate chain, validity and original content. */
  verify(bytes:Uint8Array,expected:{plaintextSha256:string;senderIk:string;receiverIk:string;day:string}):Promise<{valid:boolean;ciphertextSha256:string;plaintextSha256:string;senderIk:string;receiverIk:string;format:string}>;
};
export async function prepareClassicDelivery(draft:ExchangeDraft,evidence:ReleaseEvidence,security:DtaSecurityAdapter,now=new Date()):Promise<PreparedDelivery>{
  const d=structuredClone(draft),e=structuredClone(evidence);current(d,now);
  if(d.channel!=='classic')throw new Error('Klassischer DTA-Transport erforderlich.');
  const plain=buildClassicPayload(d),hash=sha256(plain.bytes);release(d,e,hash);
  const expected={plaintextSha256:hash,senderIk:d.profile.senderIk,receiverIk:d.receiverIk,day:billingDay(now)};
  const encrypted=Uint8Array.from(await security.encryptAndSign(Uint8Array.from(plain.bytes),expected));
  if(!encrypted.length||encrypted.length>20_000_000||sha256(encrypted)===hash)throw new Error('Kein zulässiger verschlüsselter Dateiinhalt.');
  // Give the verifier a copy; later mutations cannot alter the outgoing container.
  const proof=await security.verify(Uint8Array.from(encrypted),expected);
  if(!proof.valid||proof.format!=='PKCS#7'||proof.ciphertextSha256!==sha256(encrypted)||proof.plaintextSha256!==hash||proof.senderIk!==expected.senderIk||proof.receiverIk!==expected.receiverIk)throw new Error('Verschlüsselungs- und Signaturprüfung fehlgeschlagen.');
  const files=[artifact(plain.name,encrypted),artifact(`${plain.name}.AUF`,buildEncryptedOrder(d,plain.bytes.length,encrypted.length))];
  const prepared={...binding(d),channel:'classic' as const,files,payloadSha256:hash};
  return {...prepared,manifestSha256:manifest(prepared)};
}
export function kimFileName(d:ExchangeDraft):string {
  return `${d.mode==='production'?'E':'T'}PFL0_ABR_${d.profile.providerIk}_${d.serviceType}_${d.month.slice(5)}${d.month.slice(0,4)}_${String(d.sequence).padStart(2,'0')}.xml`;
}
export type KimPackageVerifier={
  /** Validate actual bytes against the pinned official XSD and all content/signature/IMG relations.
   * Verify EACH CMS component before parsing its signed content. A plain PDF/hash is insufficient.
   * services/gkv/monthly-xml.mjs validates one unsigned LNW only; it cannot implement this package contract.
   */
  verify(bytes:Uint8Array,expected:{providerIk:string;insuranceIk:string;serviceType:string;month:string;logicalVersion:'1.2.0'}):Promise<{valid:boolean;sha256:string;allComponentSignaturesValid:boolean;schemaValid:boolean;relationsValid:boolean}>;
};
export async function prepareKimDelivery(draft:ExchangeDraft,xml:Uint8Array,evidence:ReleaseEvidence,verifier:KimPackageVerifier,now=new Date()):Promise<PreparedDelivery>{
  const d=structuredClone(draft),e=structuredClone(evidence),bytes=Uint8Array.from(xml);current(d,now);
  if(d.channel!=='kim')throw new Error('KIM-Transport erforderlich.');
  if(!bytes.length||bytes.length>15_000_000)throw new Error('KIM-Anhang überschreitet 15 MB oder ist leer.');
  if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)throw new Error('KIM-XML darf keinen UTF-8-BOM enthalten.');
  new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const hash=sha256(bytes);release(d,e,hash);
  const proof=await verifier.verify(Uint8Array.from(bytes),{providerIk:d.profile.providerIk,insuranceIk:d.insuranceIk,serviceType:d.serviceType,month:d.month,logicalVersion:'1.2.0'});
  if(!proof.valid||proof.sha256!==hash||!proof.allComponentSignaturesValid||!proof.schemaValid||!proof.relationsValid)throw new Error('KIM-Paket besteht Schema-, Signatur- oder Zuordnungsprüfung nicht.');
  const files=[artifact(kimFileName(d),bytes)],prepared={...binding(d),channel:'kim' as const,files,payloadSha256:hash};
  return {...prepared,manifestSha256:manifest(prepared)};
}
export function verifyPreparedDelivery(delivery:PreparedDelivery):void{
  if(!['classic','kim'].includes(delivery.channel)||![delivery.senderIk,delivery.receiverIk,delivery.insuranceIk].every(isIk)||!isMonth(delivery.month)||!/^\d{2}$/.test(delivery.serviceType)||!/^\d{4}-\d{2}-\d{2}$/.test(delivery.preparedDay)||!/^[a-f0-9]{64}$/.test(delivery.payloadSha256)
    ||!delivery.files.length||delivery.files.length!==(delivery.channel==='classic'?2:1)||new Set(delivery.files.map(f=>f.name)).size!==delivery.files.length||delivery.files.some(f=>!f.bytes.length||f.bytes.length>20_000_000||sha256(f.bytes)!==f.sha256)||manifest(delivery)!==delivery.manifestSha256)throw new Error('Versandartefakte oder Empfängerbindung wurden nach der Prüfung verändert.');
}
const mailbox=(v:string)=>typeof v==='string'&&v.length<=254&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(v);
export type KimMessage={mime:Uint8Array;messageId:string;from:string;to:string;dsn:{notify:readonly ['SUCCESS','FAILURE','DELAY'];return:'HDRS'}};
/** MIME preparation only. Send this through the actual KIM client module, which performs TI encryption.
 * SMTP DSN is an envelope option, not a fabricated success header or read receipt.
 */
export function buildKimMessage(delivery:PreparedDelivery,input:{from:string;to:string;messageId:string;serviceType:string;date:Date}):KimMessage{
  verifyPreparedDelivery(delivery);const f=delivery.files[0];
  if(delivery.channel!=='kim'||!/^([ET])PFL0_ABR_[1-9]\d{8}_(01|07|10)_(0[1-9]|1[0-2])\d{4}_(0[1-9]|[1-9]\d)\.xml$/.test(f.name)||f.name.slice(20,22)!==input.serviceType||delivery.serviceType!==input.serviceType)throw new Error('KIM-Dateiname und Leistungsart passen nicht zusammen.');
  if(!mailbox(input.from)||!mailbox(input.to)||!/^<[A-Za-z0-9._-]+@[A-Za-z0-9.-]+>$/.test(input.messageId)||input.messageId.length>250||!Number.isFinite(input.date.getTime()))throw new Error('Ungültige Mailadressen, Message-ID oder Versandzeit.');
  if(f.bytes.length>15_000_000)throw new Error('KIM-Anhang überschreitet 15 MB.');
  const boundary=`gkv_${f.sha256.slice(0,40)}`;
  const base64=Buffer.from(f.bytes).toString('base64').match(/.{1,76}/g)!.join('\r\n');
  const mime=Buffer.from([
    `From: ${input.from}`,`To: ${input.to}`,`Date: ${input.date.toUTCString()}`,`Message-ID: ${input.messageId}`,
    `Subject: ${f.name.slice(0,-4)}`,`X-KIM-Dienstkennung: PFL;ABR-${input.serviceType};1.2.0`,
    'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',
    `--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 7bit','','',
    `--${boundary}`,`Content-Type: application/octet-stream; name="${f.name}"`,'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${f.name}"`,'Content-Description: PFL','',base64,`--${boundary}--`,'',
  ].join('\r\n'),'utf8');
  return {mime,messageId:input.messageId,from:input.from,to:input.to,dsn:{notify:['SUCCESS','FAILURE','DELAY'],return:'HDRS'}};
}

export type SendState='sending'|'sent'|'delivery_unknown';
export type DeliveryJournal={
  /** Atomic durable CAS: only an already authorized/reserved job can be claimed. False must never send. */
  claim(jobId:string,manifestSha256:string):Promise<boolean>;
  /** Persist before acknowledging completion. No retry of a sending/unknown job without provider reconciliation. */
  finish(jobId:string,state:SendState,providerReference?:string):Promise<void>;
};
export type DeliveryProvider={send(delivery:PreparedDelivery,context:{idempotencyKey:string}):Promise<{reference:string}>};
/** Provider and journal are server-owned implementations, not request arguments. A timeout never retries. */
export async function dispatchOnce(jobId:string,delivery:PreparedDelivery,journal:DeliveryJournal,provider:DeliveryProvider|undefined,now=new Date()):Promise<SendState|'already_claimed'>{
  if(!provider)throw new Error('Kein produktiver DTA-/KIM-Versandadapter angeschlossen.');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(jobId))throw new Error('Ungültige Versandkennung.');
  const copy=structuredClone(delivery);verifyPreparedDelivery(copy);
  const day=billingDay(now);
  if(!day||day!==copy.preparedDay||day<GKV_SPEC.validFrom||day>GKV_SPEC.validUntil)throw new Error('Vor dem Versand ist eine aktuelle serverseitige Prüfung erforderlich.');
  if(!await journal.claim(jobId,copy.manifestSha256))return 'already_claimed';
  let reference:string;
  try { const result=await provider.send(copy,{idempotencyKey:jobId});if(typeof result.reference!=='string'||!result.reference.trim()||result.reference.length>512)throw new Error('Versandquittung fehlt.');reference=result.reference; }
  catch { await journal.finish(jobId,'delivery_unknown');return 'delivery_unknown'; }
  // If durable persistence fails after successful sending, leave the claim in place. Never send again here.
  await journal.finish(jobId,'sent',reference);return 'sent';
}
