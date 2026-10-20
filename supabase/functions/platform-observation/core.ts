export const OBSERVATION_RELEASE = 'caresuite-platform-operations-20261007';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[a-f0-9]{64}$/;
const areas = ['website','registration','login','office','assist','care','employee','client','relative','platform','other'];
const surfaces = ['website','registration','software','platform'];
export type Observation = {
  kind: 'heartbeat'|'registration'|'error'; sessionId: string; sessionSecret: string;
  surface: string; area: string; active: boolean; eventId?: string;
  attemptId?: string; stage?: number; state?: string; issue?: string;
  category?: string; operation?: string; httpStatus?: number;
};

/** Construct an allowlisted payload. Names, form values, URLs and tokens never enter it. */
export function normalizeObservation(value: unknown): Observation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!['heartbeat','registration','error'].includes(String(body.kind)) || typeof body.sessionId!=='string' || !UUID.test(body.sessionId)
    || typeof body.sessionSecret!=='string' || !SECRET.test(body.sessionSecret) || !surfaces.includes(String(body.surface))
    || !areas.includes(String(body.area)) || typeof body.active !== 'boolean') return null;
  const base: Observation = { kind: body.kind as Observation['kind'], sessionId: String(body.sessionId),
    sessionSecret: String(body.sessionSecret),surface:String(body.surface),area:String(body.area),active:body.active };
  if (base.kind === 'registration') {
    if (!UUID.test(String(body.attemptId)) || !UUID.test(String(body.eventId)) || !Number.isInteger(body.stage)
      || Number(body.stage)<0 || Number(body.stage)>4 || !['progress','submitting','left','failed'].includes(String(body.state))
      || (body.issue != null && !['validation','connection','permission','timeout','server','unknown'].includes(String(body.issue)))) return null;
    return {...base,attemptId:String(body.attemptId),eventId:String(body.eventId),stage:Number(body.stage),state:String(body.state),
      ...(body.issue == null ? {} : {issue:String(body.issue)})};
  }
  if (base.kind === 'error') {
    if (!['connection','permission','timeout','validation','server','render','unexpected'].includes(String(body.category))
      || !['database','login','storage','registration','function','page'].includes(String(body.operation))
      || (body.httpStatus != null && (!Number.isInteger(body.httpStatus) || Number(body.httpStatus)<400 || Number(body.httpStatus)>599))) return null;
    return {...base,category:String(body.category),operation:String(body.operation),
      ...(body.httpStatus == null ? {} : {httpStatus:Number(body.httpStatus)})};
  }
  return base;
}

export function observationCorrelation(value: unknown): {sessionId:string;sessionSecret:string;attemptId:string} | null {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null;
  const b=value as Record<string,unknown>;
  return UUID.test(String(b.sessionId)) && UUID.test(String(b.attemptId)) && SECRET.test(String(b.sessionSecret))
    ? {sessionId:String(b.sessionId),sessionSecret:String(b.sessionSecret),attemptId:String(b.attemptId)} : null;
}

/** Secret-salted daily HMAC for rate limiting; no IP address is retained. */
export async function observationIpHash(ip: string,serverSecret: string,date: string) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(serverSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${date}:${ip}`))))
    .map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

type ObservationDb = {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>};
export async function confirmRegistrationObservation(client: ObservationDb,correlation: unknown,status: number,result: Record<string,unknown>) {
  const observation=observationCorrelation(correlation);
  if (!observation) return;
  const owner=result.owner as {id?:unknown}|undefined;
  // Bounded, optional telemetry cannot delay or change the actual registration.
  let timer: ReturnType<typeof setTimeout>|undefined;
  try {
    await Promise.race([Promise.resolve(client.rpc('platform_confirm_registration_observation',{
      p_session_id:observation.sessionId,p_session_secret:observation.sessionSecret,p_attempt_id:observation.attemptId,
      p_tenant_id:status===201&&typeof result.tenantId==='string'?result.tenantId:null,
      p_owner_id:status===201&&typeof owner?.id==='string'?owner.id:null,p_http_status:status,
    })),new Promise<void>(resolve=>{timer=setTimeout(resolve,1500);})]);
  } catch { /* Monitoring never rolls back a successfully created company. */ }
  finally {if(timer)clearTimeout(timer);}
}
