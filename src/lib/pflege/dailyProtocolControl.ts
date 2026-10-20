import {dailyProtocolVersion,decodeProtocolSnapshot,validateProtocolDraft,protocolUuid,type ProtocolDraft,type ProtocolRecord} from './dailyProtocolDomain.ts';
import {woundInstant} from './woundCareDomain.ts';
import type {ControlSource} from './clinicalControlDomain.ts';
export type ProtocolControlSnapshot={id:string;tenant_id:string;client_id:string;root_id:string;protocol_version:string;protocol_kind:string;sequence:number;previous_id:string;actor_id:string;actor_name:string;request_id:string;recorded_at:string;occurred_at:string;title:string;draft:ProtocolDraft};
const fields=['id','tenant_id','client_id','root_id','protocol_version','protocol_kind','sequence','previous_id','actor_id','actor_name','request_id','recorded_at','occurred_at','title','draft'];
export const protocolControlTitle=(kind:string)=>({drink:'Trinkprotokoll',meal:'Mahlzeitenprotokoll',stool:'Stuhl-/Darmprotokoll',urine:'Miktions-/Urinprotokoll',fluid_output:'Weitere Flüssigkeitsausfuhr'} as Record<string,string>)[kind];
/** Native current-event snapshot; a historical embedded snapshot remains legible after correction. */
export function validateProtocolControlSnapshot(v:unknown,tenant:string,client:string,now=Date.now()):asserts v is ProtocolControlSnapshot{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==fields.length||!fields.every(k=>Object.hasOwn(v,k)))throw Error('Vollständiger nativer Protokollbeleg fehlt.');
 const s=v as ProtocolControlSnapshot;
 if(![s.id,s.tenant_id,s.client_id,s.root_id,s.actor_id,s.request_id,tenant,client].every(protocolUuid)||s.tenant_id!==tenant||s.client_id!==client||s.protocol_version!==dailyProtocolVersion||!Number.isSafeInteger(s.sequence)||s.sequence<1||!(s.previous_id===''||protocolUuid(s.previous_id))||(s.sequence===1)!==(s.previous_id==='')||typeof s.actor_name!=='string'||!s.actor_name.trim()||s.actor_name.length>4000)throw Error('Protokollherkunft, ursprüngliche Person oder Fassungsbezug widersprüchlich.');
 validateProtocolDraft(s.draft,now);
 if(!s.draft.entry||s.draft.entry.kind!==s.protocol_kind||s.title!==protocolControlTitle(s.protocol_kind)||(s.sequence===1)!==(s.draft.action==='record')||s.occurred_at!==s.draft.entry.occurredAt)throw Error('Zurückgenommene oder widersprüchliche Protokollfassung ist keine auswählbare Kontrollquelle.');
 const recorded=woundInstant(s.recorded_at),at=woundInstant(s.occurred_at);if(!Number.isSafeInteger(now)||recorded===null||at===null||recorded<at||recorded>BigInt(now)*1000n)throw Error('Protokollzeitpunkte widersprüchlich.');
}
/** Validate whole own roster before projecting current non-withdrawn heads. Never a partial success. */
export function protocolControlSources(records:ProtocolRecord[],tenant:string,client:string,now=Date.now()):ControlSource[]{
 const full=decodeProtocolSnapshot({version:dailyProtocolVersion,tenantId:tenant,clientId:client,count:records.length,records},tenant,client,now);
 return full.flatMap(r=>{const e=r.events.at(-1)!;if(!e.draft.entry)return [];const snapshot:ProtocolControlSnapshot={id:e.id,tenant_id:tenant,client_id:client,root_id:r.root.id,protocol_version:r.root.version,protocol_kind:r.root.kind,sequence:e.sequence,previous_id:e.previousId,actor_id:e.actorId,actor_name:r.actorNames[e.id],request_id:e.requestId,recorded_at:e.recordedAt,occurred_at:e.draft.entry.occurredAt,title:protocolControlTitle(r.root.kind),draft:structuredClone(e.draft)};validateProtocolControlSnapshot(snapshot,tenant,client,now);return [{kind:'protocol_event',id:e.id,snapshot}];});
}
/** Conservative proof eligibility: reports, unknown intake and absent stool are no positive performance proof. */
export function assertProtocolControlEvidence(v:unknown,tenant:string,client:string,now=Date.now()):void{
 validateProtocolControlSnapshot(v,tenant,client,now);const e=v.draft.entry!;
 if(e.source!=='observed'||(e.kind==='urine'||e.kind==='fluid_output'?(!['passed','collected','zero_collected'].includes(e.occurrence)||e.actual.state==='not_measured'):e.kind==='stool'?e.occurrence!=='passed':!['taken','partial','none_taken'].includes(e.outcome)||e.actual.state==='not_measured'))throw Error('Fremdangabe, Beobachtungsgrenze oder fehlende Menge ist kein angebundener tatsächlicher Ergebnisbeleg.');
}
