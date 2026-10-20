import {confirmCareDocumentationPacket,commitCareDocumentationPacket} from './careDocumentationRepository.supabase.web';
import type {CareDocumentationOriginal,CareDocumentationPacket} from './careDocumentationPacket.web';

type Journal={version:1;phase:'prepared'|'dispatched';packet:CareDocumentationPacket};
type Result={ok:true;data:CareDocumentationOriginal}|{ok:false;error:string;uncertain?:boolean};
const prefix='caresuite:care-documentation:web:v1:';
const key=(packet:Pick<CareDocumentationPacket,'tenantId'|'clientId'|'actorId'>)=>`${prefix}${packet.tenantId}:${packet.clientId}:${packet.actorId}`;
const storage=():Storage|null=>{try{return typeof window==='undefined'?null:window.localStorage;}catch{return null;}};
async function exclusive<T>(lockKey:string,operation:()=>Promise<T>):Promise<T>{
 const locks=typeof navigator==='undefined'?undefined:navigator.locks;if(!locks)throw Error('Eine browserweite Schreibsperre ist nicht verfügbar; es wurde nichts gesendet.');
 return locks.request(lockKey,{mode:'exclusive'},operation);
}
function save(journal:Journal):boolean{try{const target=storage();if(!target)return false;const value=JSON.stringify(journal);target.setItem(key(journal.packet),value);return target.getItem(key(journal.packet))===value;}catch{return false;}}
function read(context:Pick<CareDocumentationPacket,'tenantId'|'clientId'|'actorId'>):Journal|null{try{const raw=storage()?.getItem(key(context));if(!raw)return null;const value=JSON.parse(raw) as Journal;return value.version===1&&['prepared','dispatched'].includes(value.phase)&&value.packet?.tenantId===context.tenantId&&value.packet.clientId===context.clientId&&value.packet.actorId===context.actorId?value:null;}catch{return null;}}
function clear(context:Pick<CareDocumentationPacket,'tenantId'|'clientId'|'actorId'>){try{storage()?.removeItem(key(context));}catch{/* closed */}}

export async function saveCareDocumentationDurably(packet:CareDocumentationPacket,isCurrent:()=>boolean):Promise<Result>{
 const captured=structuredClone(packet);try{return await exclusive(key(captured),async()=>{
  const previous=read(captured);if(previous?.phase==='dispatched')return {ok:false as const,error:'Ein früherer Speichervorgang ist noch ungeklärt.',uncertain:true};if(previous)clear(captured);
  if(!save({version:1,phase:'prepared',packet:captured}))return {ok:false as const,error:'Das lokale Versandjournal konnte nicht dauerhaft bestätigt werden; es wurde nichts gesendet.'};
  if(!save({version:1,phase:'dispatched',packet:captured}))return {ok:false as const,error:'Das lokale Versandjournal konnte vor dem Versand nicht bestätigt werden; es wurde nichts gesendet.'};
  const result=await commitCareDocumentationPacket(captured,isCurrent);if(result.ok){clear(captured);return result;}if(result.rejected){clear(captured);return {ok:false as const,error:result.error};}return {ok:false as const,error:result.error,uncertain:true};
 });}catch(error){return {ok:false,error:error instanceof Error?error.message:'Browserweite Schreibsperre fehlt.'};}
}
export async function recoverCareDocumentation(context:Pick<CareDocumentationPacket,'tenantId'|'clientId'|'actorId'>,isCurrent:()=>boolean):Promise<Result|null>{
 const pending=read(context);if(!pending)return null;
 try{return await exclusive(key(context),async()=>{const journal=read(context);if(!journal)return null;if(journal.phase==='prepared'){clear(context);return null;}
  const result=await confirmCareDocumentationPacket(journal.packet,isCurrent);if(result.ok){clear(context);return result;}return {ok:false,error:result.error,uncertain:true};
 });}catch(error){return {ok:false,error:error instanceof Error?error.message:'Browserweite Schreibsperre fehlt.'};}
}
export const careDocumentationJournal=Object.freeze({read,clear});
