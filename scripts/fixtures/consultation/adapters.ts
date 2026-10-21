/** Isolated browser test adapters. Never imported by the application. */
import {useSyncExternalStore} from 'react';
const uid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=()=>new URLSearchParams(window.location.search).get('actor')??'office';
const subscribe=(fn:()=>void)=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn);};
function location(){return useSyncExternalStore(subscribe,()=>window.location.href,()=>'/');}
export function useAuth(){location();return{user:{id:uid(actor()==='portal'?122:120)},profile:{tenantId:uid(10)}};}
export function usePortalActor(){location();return{tenantId:uid(10),actorId:uid(actor()==='portal'?60:20),isLinkedReady:true,employeeLinkReadOnly:false};}
export function useLocalSearchParams(){const url=new URL(location());return{id:url.pathname.match(/beratung\/(?:arbeitsplatz\/)?([0-9a-f-]{36})/)?.[1],visit:url.searchParams.get('visit')??undefined};}
export function useRouter(){return{push:(path:string)=>{const url=new URL(path,window.location.origin);url.searchParams.set('actor',actor());window.history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'));}};}
export function getSupabaseClient(){return{auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name:string,args:Record<string,unknown>)=>{try{return await(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,actor:actor()})})).json();}catch(e){return{data:null,error:{code:'network',message:String(e)}};}}};}

export function usePermissions(){return{canAll:()=>actor()!=='portal'};}
