import {commitNutritionEliminationPacket,confirmNutritionEliminationPacket,commitNutritionReview,confirmNutritionReview} from './nutritionEliminationRepository.supabase.web';
import type {NutritionEliminationOriginal,NutritionEliminationPacket,NutritionReviewOriginal,NutritionReviewPacket} from './nutritionEliminationPacket.web';

type Scope=Readonly<{tenantId:string;clientId:string;actorId:string}>;
type Journal<P extends Scope>=Readonly<{version:1;phase:'prepared'|'dispatched';packet:P}>;
type Result<T>={ok:true;data:T}|{ok:false;error:string;uncertain?:boolean;rejected?:boolean};
const prefix='caresuite:pflege:nutrition-elimination:v1:';
const reviewPrefix='caresuite:pflege:nutrition-review:v1:';
const key=(prefix:string,c:Scope)=>prefix+c.tenantId+':'+c.clientId+':'+c.actorId;
const storage=()=>{if(typeof localStorage==='undefined')throw Error('Dauerhaftes Versandjournal ist in diesem Browser nicht verfügbar.');return localStorage;};
function read<P extends Scope>(prefix:string,c:Scope):Journal<P>|null{
 const raw=storage().getItem(key(prefix,c));if(raw===null)return null;
 try{
  const j=JSON.parse(raw) as Journal<P>;
  if(!j||j.version!==1||!['prepared','dispatched'].includes(j.phase)||j.packet?.tenantId!==c.tenantId||j.packet.clientId!==c.clientId||j.packet.actorId!==c.actorId||typeof (j.packet as Scope&{requestId?:unknown}).requestId!=='string')throw Error();
  return j;
 }catch{throw Error('Das gespeicherte Journal ist unvollständig. Es bleibt erhalten; ein neuer Schreibvorgang ist gesperrt.');}
}
function persist<P extends Scope>(prefix:string,j:Journal<P>){
 const target=storage(),serialized=JSON.stringify(structuredClone(j));target.setItem(key(prefix,j.packet),serialized);
 if(target.getItem(key(prefix,j.packet))!==serialized)throw Error('Versandjournal konnte nicht bestätigt werden.');
}
function clear(prefix:string,c:Scope){
 const target=storage(),name=key(prefix,c);target.removeItem(name);
 if(target.getItem(name)!==null)throw Error('Die Quittung wurde gelesen, aber das Journal konnte noch nicht abgeschlossen werden.');
}
async function locked<T>(name:string,run:()=>Promise<T>):Promise<T>{
 const locks=(globalThis.navigator as Navigator&{locks?:{request<T>(name:string,options:{mode:'exclusive';ifAvailable:boolean},callback:(lock:unknown)=>Promise<T>):Promise<T>}}|undefined)?.locks;
 if(!locks)throw Error('Browserweite Exklusivsperre fehlt; Speichern bleibt gesperrt.');
 return locks.request(name,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw Error('Ein anderer Tab bearbeitet diesen Vorgang.');return run();});
}
async function save<P extends Scope,T>(prefix:string,p:P,current:()=>boolean,commit:(p:P,current:()=>boolean)=>Promise<Result<T>>):Promise<Result<T>>{
 const captured=structuredClone(p);
 try{return await locked(key(prefix,captured),async()=>{
  if(!current())return {ok:false,error:'Pflegefall oder Rechtekontext hat gewechselt.'};
  const previous=read<P>(prefix,captured);if(previous?.phase==='dispatched')return {ok:false,error:'Ein früherer Schreibvorgang ist noch ungeklärt.',uncertain:true};
  if(previous)clear(prefix,captured);
  persist(prefix,{version:1,phase:'prepared',packet:captured});
  if(!current())return {ok:false,error:'Pflegefall oder Rechtekontext hat gewechselt.'};
  persist(prefix,{version:1,phase:'dispatched',packet:captured});
  const result=await commit(captured,current);
  if(!current())return {ok:false,error:'Kontextwechsel nach Versand; ursprüngliche Quittung erneut lesen.',uncertain:true};
  if(result.ok){clear(prefix,captured);return result;}
  if(result.rejected){clear(prefix,captured);return {ok:false,error:result.error};}
  return {ok:false,error:result.error,uncertain:true};
 });}catch(cause){return {ok:false,error:cause instanceof Error?cause.message:'Journal oder Sperre konnte nicht bestätigt werden.',uncertain:true};}
}
async function recover<P extends Scope,T>(prefix:string,c:Scope,current:()=>boolean,confirm:(p:P,current:()=>boolean)=>Promise<Result<T>>):Promise<Result<T>|null>{
 try{return await locked(key(prefix,c),async()=>{
  if(!current())return {ok:false,error:'Pflegefall oder Rechtekontext hat gewechselt.',uncertain:true};
  const j=read<P>(prefix,c);if(!j)return null;
  if(j.phase==='prepared'){clear(prefix,c);return {ok:false,error:'Nicht versandte lokale Anfrage wurde verworfen.'};}
  const result=await confirm(structuredClone(j.packet),current);
  if(!current())return {ok:false,error:'Kontextwechsel während der Quittungsprüfung.',uncertain:true};
  if(result.ok){clear(prefix,c);return result;}
  return {ok:false,error:result.error,uncertain:true};
 });}catch(cause){return {ok:false,error:cause instanceof Error?cause.message:'Das ursprüngliche Journal bleibt ungeklärt.',uncertain:true};}
}
export const saveNutritionEliminationDurably=(p:NutritionEliminationPacket,current:()=>boolean)=>save<NutritionEliminationPacket,NutritionEliminationOriginal>(prefix,p,current,commitNutritionEliminationPacket);
export const recoverNutritionElimination=(c:Scope,current:()=>boolean)=>recover<NutritionEliminationPacket,NutritionEliminationOriginal>(prefix,c,current,confirmNutritionEliminationPacket);
export const saveNutritionReviewDurably=(p:NutritionReviewPacket,current:()=>boolean)=>save<NutritionReviewPacket,NutritionReviewOriginal>(reviewPrefix,p,current,commitNutritionReview);
export const recoverNutritionReview=(c:Scope,current:()=>boolean)=>recover<NutritionReviewPacket,NutritionReviewOriginal>(reviewPrefix,c,current,confirmNutritionReview);
