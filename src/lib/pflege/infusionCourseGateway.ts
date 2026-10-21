import {infusionCourse,infusionCourseVersion,validateInfusionEpisode,validateInfusionEventDraft,type InfusionEpisode,type InfusionEvent,type InfusionEventDraft} from './infusionCourseDomain.ts';
import {woundUuid} from './woundCareDomain.ts';
type Row=Record<string,unknown>;
const exact=(v:unknown,keys:string[]):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export type InfusionRequest={episode:Omit<InfusionEpisode,'tenantId'>;expectedHeadId:string;draft:InfusionEventDraft};
export type InfusionRecord={episode:InfusionEpisode;events:InfusionEvent[];headId:string;eventCount:number;names:Record<string,{actorName:string;checkerName:string|null}>};
export function validateInfusionRequest(tenant:string,value:unknown,now=Date.now()):asserts value is InfusionRequest{
 if(!woundUuid(tenant)||!exact(value,['episode','expectedHeadId','draft'])||!exact(value.episode,['id','clientId','version','route','purpose','title'])||typeof value.expectedHeadId!=='string'||(value.expectedHeadId!==''&&!woundUuid(value.expectedHeadId)))throw Error('Infusionsanfrage oder Aktenkontext ungültig.');
 const episode={...value.episode,tenantId:tenant};validateInfusionEpisode(episode);validateInfusionEventDraft(value.draft,episode,now);
 const draft=value.draft as InfusionEventDraft;
 if([episode.id,episode.clientId,value.expectedHeadId,draft.orderId,draft.checkerId,draft.targetEventId,draft.expectedCorrectionId].some(id=>id!==id.toLowerCase()))throw Error('Ausgewählte Originalkennungen unverändert in kanonischer Schreibweise übernehmen.');
 if(value.expectedHeadId===''&&(value.draft as InfusionEventDraft).kind!=='start')throw Error('Neuer Verlauf benötigt eine ausdrücklich dokumentierte erste Durchführung.');
}
/** Deep snapshot for exact retry; no mutable draft objects survive in the pending request. */
export function snapshotInfusionRequest(tenant:string,value:InfusionRequest,now=Date.now()):InfusionRequest{
 validateInfusionRequest(tenant,value,now);const result=structuredClone(value);Object.freeze(result.episode);Object.freeze(result.draft);Object.freeze(result);return result;
}
export function decodeInfusionSnapshot(value:unknown,tenant:string,client:string|null,now=Date.now()):InfusionRecord[]{
 if(!woundUuid(tenant)||(client!==null&&!woundUuid(client))||!exact(value,['version','tenantId','clientId','count','courses'])||value.version!==infusionCourseVersion||value.tenantId!==tenant||value.clientId!==client||!Array.isArray(value.courses)||!Number.isSafeInteger(value.count)||value.count!==value.courses.length)throw Error('Infusionsbestand unvollständig oder fremd.');
 const ids=new Set<string>(),eventIds=new Set<string>(),requests=new Set<string>();
 return value.courses.map(item=>{
  if(!exact(item,['episode','events','headId','eventCount','names'])||!Array.isArray(item.events)||!Number.isSafeInteger(item.eventCount)||item.eventCount!==item.events.length||(item.eventCount as number)<1||typeof item.headId!=='string'||!exact(item.names,item.events.map(e=>String(e?.id))))throw Error('Infusionsverlauf fehlt oder ist abgeschnitten.');
  validateInfusionEpisode(item.episode);const episode=item.episode;
  if(episode.tenantId!==tenant||(client!==null&&episode.clientId!==client)||ids.has(episode.id))throw Error('Infusionsfall doppelt oder einer fremden Akte zugeordnet.');ids.add(episode.id);
  const events=item.events as InfusionEvent[],state=infusionCourse(episode,events,now);if(state.headId!==item.headId||state.sequence!==item.eventCount)throw Error('Infusionsrevision stimmt nicht mit dem vollständigen Verlauf überein.');
  for(const e of events){if(eventIds.has(e.id)||requests.has(e.requestId))throw Error('Ereignis oder Anfrage in mehreren Infusionsfällen vorhanden.');eventIds.add(e.id);requests.add(e.requestId);
   const name=item.names[e.id];if(!exact(name,['actorName','checkerName'])||typeof name.actorName!=='string'||!name.actorName.trim()||name.actorName.length>2000||(['start','parameters','device'].includes(e.draft.kind)?typeof name.checkerName!=='string'||!name.checkerName.trim()||name.checkerName.length>2000:name.checkerName!==null))throw Error('Gesicherter Personenbeleg fehlt oder widerspricht dem Ereignis.');
  }
  return structuredClone({episode,events,headId:item.headId,eventCount:item.eventCount as number,names:item.names as InfusionRecord['names']});
 });
}
export function decodeInfusionConfirmation(value:unknown,tenant:string,requestId:string,payload:InfusionRequest):{id:string}{
 if(!exact(value,['id','tenantId','episodeId','requestId','previousId','sequence'])||!woundUuid(value.id)||value.tenantId!==tenant||value.episodeId!==payload.episode.id||value.requestId!==requestId||value.previousId!==payload.expectedHeadId||!Number.isSafeInteger(value.sequence)||(payload.expectedHeadId===''?value.sequence!==1:(value.sequence as number)<2))throw Error('Passende Infusions-Speicherbestätigung fehlt. Dieselbe unveränderte Anfrage erneut prüfen.');return {id:value.id};
}
