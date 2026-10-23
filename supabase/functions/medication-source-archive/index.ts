import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import {createArchiveHandler} from './handler.ts';
import {createMedicationArchiveGateway} from './gateway.ts';

serve(createArchiveHandler(authorization=>createMedicationArchiveGateway({
 url:Deno.env.get('SUPABASE_URL'),
 anonKey:Deno.env.get('SUPABASE_ANON_KEY'),
 serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
},authorization,(url,key,options)=>createClient(url,key,options))));
