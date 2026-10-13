import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import { createPdfUploadHandler } from '../_shared/pdfUploadHandler.ts';

serve(createPdfUploadHandler({
  userClient: authorization => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  serviceClient: getServiceClient,
  respond: jsonResponse,
  corsHeaders,
}));
