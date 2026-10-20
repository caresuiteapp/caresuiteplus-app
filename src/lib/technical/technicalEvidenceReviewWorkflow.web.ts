import {commitTechnicalReview,confirmTechnicalReview} from './technicalEvidenceReviewRepository.supabase.web';
import {technicalReviewPacketIssue,type TechnicalReviewOriginal,type TechnicalReviewPacket} from './technicalEvidenceReview.web';

type Scope=Readonly<{tenantId:string;actorId:string}>;
type Journal=Readonly<{version:1;phase:'prepared'|'dispatched';packet:TechnicalReviewPacket}>;
type Result={ok:true;data:TechnicalReviewOriginal}|{ok:false;error:string;uncertain?:boolean;rejected?:boolean;unsent?:boolean};
const key=(scope:Scope)=>`caresuite:technical:evidence-review:v1:${scope.tenantId}:${scope.actorId}`;
function storage(){if(typeof localStorage==='undefined')throw Error('Das dauerhafte Fachprüfjournal ist nicht verfügbar.');return localStorage;}
function read(scope:Scope):Journal|null{
 const raw=storage().getItem(key(scope));if(raw===null)return null;
 try{
  const value=JSON.parse(raw) as Journal;
  if(!value||Object.keys(value).sort().join(',')!=='packet,phase,version'||value.version!==1||!['prepared','dispatched'].includes(value.phase)||value.packet?.tenantId!==scope.tenantId||value.packet.actorId!==scope.actorId||technicalReviewPacketIssue(value.packet))throw Error();
  return structuredClone(value);
 }catch{throw Error('Das gespeicherte Fachprüfjournal ist beschädigt oder fremd. Es bleibt erhalten und sperrt eine neue Anfrage.');}
}
function persist(value:Journal){const store=storage(),raw=JSON.stringify(value);store.setItem(key(value.packet),raw);if(store.getItem(key(value.packet))!==raw)throw Error('Das Fachprüfjournal konnte nicht zuverlässig gesichert werden.');}
function clear(scope:Scope){const store=storage(),name=key(scope);store.removeItem(name);if(store.getItem(name)!==null)throw Error('Die Quittung wurde bestätigt, das Journal konnte jedoch nicht abgeschlossen werden.');}
async function locked<T>(name:string,run:()=>Promise<T>):Promise<T>{
 const locks=(globalThis.navigator as Navigator&{locks?:{request<T>(name:string,options:{mode:'exclusive';ifAvailable:boolean},callback:(lock:unknown)=>Promise<T>):Promise<T>}}|undefined)?.locks;
 if(!locks)throw Error('Die browserweite Exklusivsperre fehlt. Fachprüfung bleibt gesperrt.');
 return locks.request(name,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw Error('Ein anderes Fenster bearbeitet dieselbe Fachprüfung.');return run();});
}
export async function saveTechnicalReviewDurably(input:TechnicalReviewPacket,current:()=>boolean):Promise<Result>{
 const packet=structuredClone(input),issue=technicalReviewPacketIssue(packet);if(issue)return {ok:false,error:issue,rejected:true};
 try{return await locked(key(packet),async()=>{
  if(!current())return {ok:false,error:'Konto, Originalbestand oder Rechte wurden geändert.'};
  if(read(packet))return {ok:false,error:'Zuerst das vorhandene Fachprüfjournal abgleichen.',uncertain:true};
  persist({version:1,phase:'prepared',packet});
  if(!current())return {ok:false,error:'Kontextwechsel vor dem Versand. Die ungesendete Anfrage bleibt erhalten.',unsent:true,uncertain:true};
  persist({version:1,phase:'dispatched',packet});
  const result=await commitTechnicalReview(structuredClone(packet),current);
  if(!current())return {ok:false,error:'Kontextwechsel nach Versand. Ausschließlich die ursprüngliche Quittung lesen.',uncertain:true};
  if(result.ok){clear(packet);return result;}
  if(result.rejected===true&&result.uncertain!==true){clear(packet);return {ok:false,error:result.error,rejected:true};}
  return {ok:false,error:result.error,uncertain:true};
 });}catch(cause){return {ok:false,error:cause instanceof Error?cause.message:'Fachprüfung konnte nicht bestätigt werden.',uncertain:true};}
}
export async function recoverTechnicalReview(scope:Scope,current:()=>boolean):Promise<Result|null>{
 try{return await locked(key(scope),async()=>{
  if(!current())return {ok:false,error:'Der aktuelle Konto- und Rechtekontext fehlt.',uncertain:true};
  const journal=read(scope);if(!journal)return null;
  if(journal.phase==='prepared')return {ok:false,error:'Die gesicherte Anfrage wurde noch nicht gesendet. Sie kann ausdrücklich verworfen werden.',uncertain:true,unsent:true};
  const result=await confirmTechnicalReview(structuredClone(journal.packet),current);
  if(!current())return {ok:false,error:'Kontextwechsel während der Quittungsprüfung.',uncertain:true};
  if(result.ok){clear(scope);return result;}
  return {ok:false,error:result.error,uncertain:true};
 });}catch(cause){return {ok:false,error:cause instanceof Error?cause.message:'Fachprüfjournal konnte nicht gelesen werden.',uncertain:true};}
}
export async function discardPreparedTechnicalReview(scope:Scope,current:()=>boolean):Promise<void>{
 await locked(key(scope),async()=>{
  if(!current())throw Error('Aktuelles Konto und Rechte fehlen.');
  const journal=read(scope);if(!journal||journal.phase!=='prepared')throw Error('Eine möglicherweise gesendete Anfrage darf nicht verworfen werden.');
  clear(scope);
 });
}
