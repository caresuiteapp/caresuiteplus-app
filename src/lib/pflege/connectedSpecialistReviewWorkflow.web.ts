import {commitConnectedReview,confirmConnectedReview} from './connectedSpecialistReviewRepository.supabase.web';
import type {ConnectedReviewOriginal,ConnectedReviewPacket} from './connectedSpecialistReview.web';

type Scope=Pick<ConnectedReviewPacket,'tenantId'|'clientId'|'actorId'> & {subject:Pick<ConnectedReviewPacket['subject'],'domain'|'rootId'>};
type Journal=Readonly<{version:1;phase:'prepared'|'dispatched';packet:ConnectedReviewPacket}>;
type Result={ok:true;data:ConnectedReviewOriginal}|{ok:false;error:string;uncertain?:boolean};
const prefix='caresuite:pflege:connected-specialist-review:v1:';
const key=(v:Scope)=>`${prefix}${v.subject.domain}:${v.tenantId}:${v.clientId}:${v.subject.rootId}:${v.actorId}`;
const storage=()=>typeof localStorage==='undefined'?null:localStorage;
const same=(a:Scope,b:Scope)=>a.tenantId===b.tenantId&&a.clientId===b.clientId&&a.actorId===b.actorId&&a.subject.domain===b.subject.domain&&a.subject.rootId===b.subject.rootId;
function read(c:Scope):{journal:Journal|null;corrupt:boolean}{try{const raw=storage()?.getItem(key(c));if(!raw)return {journal:null,corrupt:false};const j=JSON.parse(raw) as Journal;return j.version===1&&['prepared','dispatched'].includes(j.phase)&&j.packet&&same(j.packet,c)?{journal:j,corrupt:false}:{journal:null,corrupt:true};}catch{return {journal:null,corrupt:true};}}
function persist(j:Journal){const store=storage();if(!store)throw Error('Lokaler sichere Speicher ist nicht verfügbar.');const k=key(j.packet);store.setItem(k,JSON.stringify(j));if(store.getItem(k)!==JSON.stringify(j))throw Error('Lokale Fachprüfanfrage konnte nicht unverändert bestätigt werden.');}
function clear(c:Scope){const store=storage();if(!store)return false;store.removeItem(key(c));return store.getItem(key(c))===null;}
async function locked<T>(k:string,run:()=>Promise<T>):Promise<T>{const locks=typeof navigator==='undefined'?undefined:navigator.locks;if(!locks)throw Error('Exklusive Browsersperre ist nicht verfügbar.');return locks.request(k,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Die Fachprüfung ist in einem anderen Tab gesperrt.');return run();});}

export async function saveConnectedReviewDurably(input:ConnectedReviewPacket,isCurrent:()=>boolean):Promise<Result>{
 const packet=structuredClone(input);try{return await locked(key(packet),async()=>{const previous=read(packet);if(previous.corrupt||previous.journal?.phase==='dispatched')return {ok:false,error:'Ein früherer Fachprüfvorgang ist beschädigt oder noch ungeklärt.',uncertain:true};if(previous.journal&&!clear(packet))return {ok:false,error:'Frühere lokale Fachprüfanfrage konnte nicht sicher bereinigt werden.',uncertain:true};persist({version:1,phase:'prepared',packet});if(!isCurrent()){clear(packet);return {ok:false,error:'Pflegefall, Originale oder Rechtekontext haben gewechselt.'};}persist({version:1,phase:'dispatched',packet});const result=await commitConnectedReview(packet,isCurrent);if(result.ok){if(clear(packet))return result;return {ok:false,error:'Quittung wurde bestätigt, das lokale Journal aber nicht sicher bereinigt.',uncertain:true};}if(result.rejected||result.uncertain!==true){clear(packet);return {ok:false,error:result.error};}return {ok:false,error:result.error,uncertain:true};});}catch(cause){return {ok:false,error:cause instanceof Error?cause.message:'Fachprüfung konnte nicht gesichert werden.'};}
}
export async function recoverConnectedReview(c:Scope,isCurrent:()=>boolean):Promise<Result|null>{
 try{return await locked(key(c),async()=>{const found=read(c);if(found.corrupt)return {ok:false,error:'Beschädigtes Fachprüfjournal bleibt zur Klärung erhalten.',uncertain:true};if(!found.journal)return null;if(found.journal.phase==='prepared'){clear(c);return {ok:false,error:'Nicht versandte lokale Fachprüfanfrage wurde verworfen.'};}const result=await confirmConnectedReview(found.journal.packet,isCurrent);if(result.ok&&clear(c))return result;return {ok:false,error:result.ok?'Lokales Journal konnte nicht sicher bereinigt werden.':result.error,uncertain:true};});}catch(cause){return {ok:false,error:cause instanceof Error?cause.message:'Fachprüfquittung konnte nicht gelesen werden.',uncertain:true};}
}
