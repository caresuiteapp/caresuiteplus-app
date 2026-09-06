import { getServiceClient, jsonResponse } from '../_shared/http.ts';
import { processPortalPush, type PushQueue, type PushTransport } from './worker.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' },405);
  try {
    const token = /^Bearer ([a-f0-9]{64})$/i.exec(req.headers.get('authorization') ?? '')?.[1];
    if (!token) return jsonResponse({ error: 'Unauthorized' },401);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const db=getServiceClient();
    const { data: allowed, error: authError }=await db.rpc('portal_push_worker_authorized',{token_hash:hash});
    if (authError || allowed!==true) return jsonResponse({error:'Unauthorized'},401);
    const queue: PushQueue = {
      async claim() { const {data,error}=await db.rpc('portal_push_claim',{batch_size:50}); if(error) throw error; return data ?? []; },
      async target(item) { const {data,error}=await db.rpc('portal_push_delivery_target',{outbox_id:item.id,claim_token:item.lease_token}); if(error) throw error; return data?.[0] ?? null; },
      async finish(item,outcome,ticket,failure) { const {data,error}=await db.rpc('portal_push_finish',{outbox_id:item.id,claim_token:item.lease_token,outcome,ticket,failure}); if(error || data!==true) throw error ?? new Error('Claim expired'); },
      async receipts() { const {data,error}=await db.from('portal_push_outbox').select('id,expo_ticket_id,updated_at').eq('state','accepted').lt('updated_at',new Date(Date.now()-15*60_000).toISOString()).order('updated_at').limit(300); if(error) throw error; return data ?? []; },
      async receipt(item,status,failure) { const {error}=await db.rpc('portal_push_receipt',{outbox_id:item.id,ticket:item.expo_ticket_id,receipt_status:status,failure}); if(error) throw error; },
    };
    async function post(path: 'send'|'getReceipts', body: unknown) {
      const expoToken=Deno.env.get('EXPO_ACCESS_TOKEN');
      const response=await fetch(`https://exp.host/--/api/v2/push/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',...(expoToken?{Authorization:`Bearer ${expoToken}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20_000)});
      if(!response.ok) throw new Error('Push transport unavailable');
      const payload=await response.json(); if(!payload.data) throw new Error('Invalid push response'); return payload.data;
    }
    const transport: PushTransport={send:messages=>post('send',messages),receipts:ids=>post('getReceipts',{ids})};
    return jsonResponse({ok:true,...await processPortalPush(queue,transport)});
  } catch { return jsonResponse({ok:false,error:'Push dispatch failed; queued work remains retryable.'},503); }
});
