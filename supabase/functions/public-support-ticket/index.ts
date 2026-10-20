import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {corsHeaders,getServiceClient,jsonResponse,readClientMeta} from '../_shared/http.ts';
import {type PublicAccessDb} from '../_shared/publicAccess.ts';
import {submitPublicSupport} from './core.ts';
serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return jsonResponse({ok:false,error:'Methode nicht erlaubt.'},405);
  let body:Record<string,unknown>;
  try {const raw=await req.text();if(raw.length>20000) return jsonResponse({ok:false,error:'Anfrage zu groß.'},413);body=JSON.parse(raw);if(!body || Array.isArray(body)) throw new Error();}
  catch {return jsonResponse({ok:false,error:'Bitte die Eingaben prüfen.'},400);}
  try {const result=await submitPublicSupport(getServiceClient() as unknown as PublicAccessDb,body,readClientMeta(req).ipAddress||'unknown');return jsonResponse(result.body,result.status);}
  catch {return jsonResponse({ok:false,error:'Das Ticket konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut.'},503);}
});
