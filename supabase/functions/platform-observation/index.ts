import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders,getServiceClient,jsonResponse,readClientMeta } from '../_shared/http.ts';
import { normalizeObservation,observationIpHash,OBSERVATION_RELEASE } from './core.ts';

serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:{...corsHeaders,'Access-Control-Allow-Methods':'GET, POST, OPTIONS'}});
  if(req.method==='GET')return jsonResponse({release:OBSERVATION_RELEASE,ready:true});
  if(req.method!=='POST')return jsonResponse({ok:false},405);
  try {
    const raw=await req.text();
    if(raw.length>3000)return jsonResponse({ok:false},413);
    const body=normalizeObservation(JSON.parse(raw));
    if(!body)return jsonResponse({ok:false},400);
    const meta=readClientMeta(req);
    if(/bot|crawler|spider|headless|uptime/i.test(meta.userAgent??''))return jsonResponse({ok:true,accepted:false});
    const service=getServiceClient();
    const token=/^Bearer (.+)$/i.exec(req.headers.get('authorization')??'')?.[1];
    let userId:string|null=null;
    if(token){
      const verified=await service.auth.getUser(token);
      if(verified.error||!verified.data.user)return jsonResponse({ok:false},401);
      userId=verified.data.user.id;
    }
    const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!secret||!meta.ipAddress)return jsonResponse({ok:false},503);
    const ipHash=await observationIpHash(meta.ipAddress,secret,new Date().toISOString().slice(0,10));
    const result=await service.rpc('platform_collect_observation',{p_event:body,p_auth_user_id:userId,p_ip_hash:ipHash});
    if(result.error)return jsonResponse({ok:false},503);
    return jsonResponse({ok:true,accepted:result.data===true},result.data===true?200:429);
  }catch{return jsonResponse({ok:false},400);}
});
