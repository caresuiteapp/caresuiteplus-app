import {commitBasicCarePacket,commitBasicCareReview,confirmBasicCarePacket,confirmBasicCareReview} from './basicCareRepository.supabase.web';
import type {BasicCareOriginal,BasicCarePacket,BasicCareReviewOriginal,BasicCareReviewPacket} from './basicCarePacket.web';

type Journal=Readonly<{version:1;phase:'prepared'|'dispatched';packet:BasicCarePacket}>;
type Result={ok:true;data:BasicCareOriginal}|{ok:false;error:string;uncertain?:boolean};
const prefix='caresuite:pflege:basic-care:v1:';
const key=(value:Pick<BasicCarePacket,'tenantId'|'clientId'|'actorId'>)=>`${prefix}${value.tenantId}:${value.clientId}:${value.actorId}`;
const storage=()=>typeof localStorage==='undefined'?null:localStorage;
function persist(journal:Journal){const target=storage();if(!target)throw Error('Dauerhaftes Versandjournal ist in diesem Browser nicht verfügbar.');target.setItem(key(journal.packet),JSON.stringify(structuredClone(journal)));const reread=target.getItem(key(journal.packet));if(reread!==JSON.stringify(journal))throw Error('Versandjournal konnte nicht bestätigt werden.');}
function read(context:Pick<BasicCarePacket,'tenantId'|'clientId'|'actorId'>):Journal|null{try{const raw=storage()?.getItem(key(context));if(!raw)return null;const value=JSON.parse(raw) as Journal;return value.version===1&&['prepared','dispatched'].includes(value.phase)&&value.packet?.tenantId===context.tenantId&&value.packet.clientId===context.clientId&&value.packet.actorId===context.actorId?value:null;}catch{return null;}}
function clear(context:Pick<BasicCarePacket,'tenantId'|'clientId'|'actorId'>){try{storage()?.removeItem(key(context));}catch{/* fail closed */}}
async function locked<T>(name:string,run:()=>Promise<T>):Promise<T>{const locks=(globalThis.navigator as Navigator&{locks?:{request<T>(name:string,options:{mode:'exclusive';ifAvailable:boolean},callback:(lock:unknown)=>Promise<T>):Promise<T>}}).locks;if(!locks)throw Error('Browserweite Exklusivsperre fehlt; Live-Sicherung wird nicht bestätigt.');return locks.request(name,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw Error('Ein anderer Tab bearbeitet diesen Grundpflegevorgang.');return run();});}

export async function saveBasicCareDurably(packet:BasicCarePacket,isCurrent:()=>boolean):Promise<Result>{
 return locked(key(packet),async()=>{const captured=structuredClone(packet),previous=read(captured);if(previous?.phase==='dispatched')return {ok:false,error:'Ein früherer Grundpflegeschreibvorgang ist noch ungeklärt.',uncertain:true};if(previous)clear(captured);persist({version:1,phase:'prepared',packet:captured});if(!isCurrent())return {ok:false,error:'Pflegefall oder Rechtekontext hat gewechselt.'};persist({version:1,phase:'dispatched',packet:captured});const result=await commitBasicCarePacket(captured,isCurrent);if(result.ok){clear(captured);return result;}if(result.rejected){clear(captured);return {ok:false,error:result.error};}return {ok:false,error:result.error,uncertain:true};});
}
export async function recoverBasicCare(context:Pick<BasicCarePacket,'tenantId'|'clientId'|'actorId'>,isCurrent:()=>boolean):Promise<Result|null>{
 return locked(key(context),async()=>{const journal=read(context);if(!journal)return null;if(journal.phase==='prepared'){clear(context);return {ok:false,error:'Nicht versandte lokale Anfrage wurde verworfen.'};}const result=await confirmBasicCarePacket(journal.packet,isCurrent);if(result.ok){clear(context);return result;}return {ok:false,error:result.error,uncertain:true};});
}

type ReviewJournal=Readonly<{version:1;phase:'prepared'|'dispatched';packet:BasicCareReviewPacket}>;
type ReviewResult={ok:true;data:BasicCareReviewOriginal}|{ok:false;error:string;uncertain?:boolean};
const reviewPrefix='caresuite:pflege:basic-care-review:v1:';
const reviewKey=(value:Pick<BasicCareReviewPacket,'tenantId'|'clientId'|'actorId'>)=>`${reviewPrefix}${value.tenantId}:${value.clientId}:${value.actorId}`;
function persistReview(journal:ReviewJournal){const target=storage();if(!target)throw Error('Dauerhaftes Prüfjournal ist in diesem Browser nicht verfügbar.');target.setItem(reviewKey(journal.packet),JSON.stringify(structuredClone(journal)));const reread=target.getItem(reviewKey(journal.packet));if(reread!==JSON.stringify(journal))throw Error('Prüfjournal konnte nicht bestätigt werden.');}
function readReview(context:Pick<BasicCareReviewPacket,'tenantId'|'clientId'|'actorId'>):ReviewJournal|null{try{const raw=storage()?.getItem(reviewKey(context));if(!raw)return null;const value=JSON.parse(raw) as ReviewJournal;return value.version===1&&['prepared','dispatched'].includes(value.phase)&&value.packet?.tenantId===context.tenantId&&value.packet.clientId===context.clientId&&value.packet.actorId===context.actorId?value:null;}catch{return null;}}
function clearReview(context:Pick<BasicCareReviewPacket,'tenantId'|'clientId'|'actorId'>){try{storage()?.removeItem(reviewKey(context));}catch{/* fail closed */}}
export async function saveBasicCareReviewDurably(packet:BasicCareReviewPacket,isCurrent:()=>boolean):Promise<ReviewResult>{
 return locked(reviewKey(packet),async()=>{const captured=structuredClone(packet),previous=readReview(captured);if(previous?.phase==='dispatched')return {ok:false,error:'Eine frühere Grundpflegeprüfung ist noch ungeklärt.',uncertain:true};if(previous)clearReview(captured);persistReview({version:1,phase:'prepared',packet:captured});if(!isCurrent())return {ok:false,error:'Pflegefall oder Rechtekontext hat gewechselt.'};persistReview({version:1,phase:'dispatched',packet:captured});const result=await commitBasicCareReview(captured,isCurrent);if(result.ok){clearReview(captured);return result;}if(result.rejected){clearReview(captured);return {ok:false,error:result.error};}return {ok:false,error:result.error,uncertain:true};});
}
export async function recoverBasicCareReview(context:Pick<BasicCareReviewPacket,'tenantId'|'clientId'|'actorId'>,isCurrent:()=>boolean):Promise<ReviewResult|null>{
 return locked(reviewKey(context),async()=>{const journal=readReview(context);if(!journal)return null;if(journal.phase==='prepared'){clearReview(context);return {ok:false,error:'Nicht versandte lokale Prüfanfrage wurde verworfen.'};}const result=await confirmBasicCareReview(journal.packet,isCurrent);if(result.ok){clearReview(context);return result;}return {ok:false,error:result.error,uncertain:true};});
}
