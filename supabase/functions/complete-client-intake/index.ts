// Deno resolves the pinned dependency in the deployed Edge runtime.
// eslint-disable-next-line import/no-unresolved
import { createClient } from 'npm:@supabase/supabase-js@2.108.1';
import { createIntakeCompletionHandler } from './handler.ts';
const url = Deno.env.get('SUPABASE_URL')!;
Deno.serve(createIntakeCompletionHandler({
  userClient: authorization => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } }),
  serviceClient: () => createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } }),
}));
