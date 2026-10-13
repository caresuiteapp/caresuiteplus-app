import { createClient } from 'npm:@supabase/supabase-js@2.49.0';
import { createProofCompletionHandler } from './handler.ts';
import { renderVisitProofPdf } from './visitProofPdf.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
Deno.serve(createProofCompletionHandler({
 userClient: authorization => createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}}),
 serviceClient:()=>createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),
 render:renderVisitProofPdf,
}));
