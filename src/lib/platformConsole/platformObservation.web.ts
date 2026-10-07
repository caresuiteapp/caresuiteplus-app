import { getSupabaseConfig,isDemoMode,isSupabaseConfigured } from '@/lib/supabase/config';

type Surface = 'website'|'registration'|'software'|'platform';
type ObservationCategory = 'connection'|'permission'|'timeout'|'validation'|'server'|'render'|'unexpected';
type Operation = 'database'|'login'|'storage'|'registration'|'function'|'page';
type RegistrationState = 'progress'|'submitting'|'left'|'failed';
type Correlation = {sessionId:string;sessionSecret:string;attemptId:string};
let identity: {sessionId:string;sessionSecret:string}|null=null;
let accessToken: string|null=null;
let collectionEnabled=false;
let context: {surface:Surface;area:string}={surface:'website',area:'website'};
let registration: {attemptId:string;stage:number;state:RegistrationState;issue?:string}|null=null;
const lastErrors=new Map<string,number>();

/** Only a random in-memory tab identity. No analytics cookie, storage or fingerprint. */
function eligibleBrowser() {
  return typeof window!=='undefined' && typeof document!=='undefined' && isSupabaseConfigured() && !isDemoMode()
    && navigator.doNotTrack!=='1' && !(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl
    && /^(www\.)?caresuiteplus\.app$/.test(window.location.hostname);
}
function enabled(){return collectionEnabled&&eligibleBrowser();}
/** Collection starts only after the approved server release and collector are confirmed. */
export function setObservationCollectionEnabled(value:boolean) {
  collectionEnabled=value;
  if(!value){identity=null;registration=null;lastErrors.clear();}
}
export async function isObservationCollectionReady():Promise<boolean>{
  if(!eligibleBrowser())return false;
  const {url,anonKey}=getSupabaseConfig();
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3000);
  const options={headers:{apikey:anonKey},signal:controller.signal};
  try{
    const response=await fetch(`${url.replace(/\/$/,'')}/rest/v1/rpc/platform_operations_release_status`,{
      ...options,method:'POST',headers:{...options.headers,'Content-Type':'application/json'},body:'{}',
    });
    if(!response.ok)return false;
    const status=await response.json();
    if(status.release!=='caresuite-platform-operations-20261007'||status.inventoryReady!==true||status.observationReady!==true)return false;
    const health=await fetch(`${url.replace(/\/$/,'')}/functions/v1/platform-observation`,options);
    if(!health.ok)return false;
    const collector=await health.json();
    return collector.release==='caresuite-platform-operations-20261007'&&collector.ready===true;
  }catch{return false;}
  finally{clearTimeout(timer);}
}
function tabIdentity() {
  if(!enabled())return null;
  if(!identity){
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    identity={sessionId:crypto.randomUUID(),sessionSecret:Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('')};
  }
  return identity;
}
export function observationPageContext(path: string,softwareHome=false): {surface:Surface;area:string} {
  const segments=path.split(/[?#]/,1)[0].split('/').filter(Boolean);
  if(segments[0]==='platform')return {surface:'platform',area:'platform'};
  if(!segments.length&&softwareHome)return {surface:'software',area:'other'};
  if((segments[0]==='auth'&&['register','register-business'].includes(segments[1]))
    ||(segments[0]==='liquid-command'&&segments[1]==='access'&&segments[2]==='register'))return {surface:'registration',area:'registration'};
  if(segments[0]==='portal')return {surface:'software',area:['employee','client','relative'].includes(segments[1])?segments[1]:'other'};
  if(['office','assist','care','ambulant','stationaer','beratung','akademie','company'].includes(segments[0]))
    return {surface:'software',area:['office','assist','care'].includes(segments[0])?segments[0]:'other'};
  return {surface:'website',area:segments[0]==='auth'?'login':'website'};
}
export function setObservationPage(path: string,softwareHome=false) {context=observationPageContext(path,softwareHome);}
export function setObservationAccessToken(token: string|null) {accessToken=token;}

async function send(fields:Record<string,unknown>,active?:boolean) {
  const id=tabIdentity();
  if(!id)return false;
  const pageActive=active??document.visibilityState==='visible';
  const {url,anonKey}=getSupabaseConfig();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),3000);
  try{
    const response=await fetch(`${url.replace(/\/$/,'')}/functions/v1/platform-observation`,{
      method:'POST',headers:{'Content-Type':'application/json',apikey:anonKey,...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},
      body:JSON.stringify({...id,...context,active:pageActive,...fields}),signal:controller.signal,keepalive:!pageActive,
    });
    return response.ok;
  }catch{return false;}
  finally{clearTimeout(timer);}
}
export function observeHeartbeat(active?:boolean) {
  if(registration&&context.surface==='registration'&&registration.state!=='left')
    return send({kind:'registration',...registration,eventId:crypto.randomUUID()},active);
  return send({kind:'heartbeat'},active);
}
export function observeRegistrationStep(stage:number) {
  if(!tabIdentity())return;
  registration={attemptId:registration?.attemptId??crypto.randomUUID(),stage,state:'progress'};
  void send({kind:'registration',...registration,eventId:crypto.randomUUID()});
}
export function observeRegistrationIssue(issue='validation') {
  if(!registration)return;
  registration={...registration,issue};
  void send({kind:'registration',...registration,eventId:crypto.randomUUID()});
}
export async function prepareRegistrationObservation(): Promise<Correlation|null> {
  const id=tabIdentity();
  if(!id)return null;
  registration={attemptId:registration?.attemptId??crypto.randomUUID(),stage:4,state:'submitting'};
  await send({kind:'registration',...registration,eventId:crypto.randomUUID()});
  return {...id,attemptId:registration.attemptId};
}
export function finishRegistrationObservation(success:boolean) {
  if(!registration)return;
  if(success){registration=null;return;}
  registration={...registration,state:'failed',issue:'unknown'};
  // The server's more precise error must not be overwritten by a client fallback.
}
export function leaveRegistrationObservation() {
  if(!registration)return;
  registration={...registration,state:'left'};
  void send({kind:'registration',...registration,eventId:crypto.randomUUID()},false);
}
export function classifyObservationError(status:number|undefined,cause?:unknown):ObservationCategory {
  if(status===401||status===403)return 'permission';
  if(status===408||status===504)return 'timeout';
  if(status&&status>=500)return 'server';
  if(status&&status>=400)return 'validation';
  if(cause instanceof Error&&/timeout|timed out|zu lange/i.test(cause.message))return 'timeout';
  return 'connection';
}
export function recordObservedError(category:ObservationCategory,operation:Operation,httpStatus?:number) {
  if(!enabled())return;
  const key=[context.surface,context.area,category,operation,httpStatus].join(':');
  const now=Date.now();
  if(now-(lastErrors.get(key)??0)<10_000)return;
  lastErrors.set(key,now);
  for(const [old,time]of lastErrors)if(now-time>60_000)lastErrors.delete(old);
  void send({kind:'error',category,operation,...(httpStatus?{httpStatus}:{})});
}

/** Observe HTTP failures without reading response bodies, form inputs or request queries. */
export function createObservedSupabaseFetch(base:typeof fetch):typeof fetch {
  return async(input,init)=>{
    let operation:Operation='database';let observe=false;
    try{
      const requestUrl=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
      const cfg=getSupabaseConfig();
      observe=enabled() && requestUrl.origin===new URL(cfg.url).origin && !requestUrl.pathname.endsWith('/platform-observation');
      operation=requestUrl.pathname.includes('/register-business-tenant')?'registration':requestUrl.pathname.startsWith('/auth/')?'login'
        :requestUrl.pathname.startsWith('/storage/')?'storage':requestUrl.pathname.startsWith('/functions/')?'function':'database';
    }catch{ /* Invalid URLs remain the transport's responsibility. */ }
    try{
      const response=await base(input,init);
      if(observe&&!response.ok){
        const status=response.status;
        // Only the fixed database error code is inspected; response text is never retained.
        try{
          void response.clone().json().then((body:unknown)=>{
            const code=body&&typeof body==='object'&&'code' in body&&typeof body.code==='string'?body.code:'';
            recordObservedError(code==='57014'?'timeout':classifyObservationError(status),operation,status);
          },()=>recordObservedError(classifyObservationError(status),operation,status));
        }catch{recordObservedError(classifyObservationError(status),operation,status);}
      }
      return response;
    }catch(cause){
      // Navigation and caller-requested cancellation are not software failures.
      if(observe&&!(init?.signal?.aborted)&&!(cause instanceof Error&&cause.name==='AbortError'))
        recordObservedError(classifyObservationError(undefined,cause),operation);
      throw cause;
    }
  };
}
