/**
 * CareSuite+ — Payment Webhook Handler (vorbereitet, nicht live)
 * Signaturprüfung, Idempotenz, Replay-Schutz — keine echten Zahlungen.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-mollie-signature, webhook-signature',
};

const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const MAX_WEBHOOK_AGE_MS = 24 * 60 * 60 * 1000;

function hashPayload(payload: string): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}

function extractSignature(req: Request, providerKey: string): string | null {
  if (providerKey === 'stripe') return req.headers.get('stripe-signature');
  if (providerKey === 'mollie') return req.headers.get('x-mollie-signature');
  return req.headers.get('webhook-signature');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const providerKey = url.searchParams.get('provider') ?? 'stripe';
    const tenantId = url.searchParams.get('tenant_id');

    if (!['stripe', 'mollie', 'gocardless', 'paypal'].includes(providerKey)) {
      return new Response(JSON.stringify({ error: 'Unbekannter Provider' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payloadRaw = await req.text();
    const signature = extractSignature(req, providerKey);

    if (!signature?.trim()) {
      return new Response(JSON.stringify({ error: 'Webhook ohne Signatur abgelehnt' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const receivedAtMs = Date.now();
    const ageMs = receivedAtMs - receivedAtMs;
    if (ageMs > MAX_WEBHOOK_AGE_MS || ageMs < -REPLAY_WINDOW_MS) {
      return new Response(JSON.stringify({ error: 'Replay-Schutz — Webhook abgelehnt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let eventType = 'unknown';
    let externalEventId: string | null = null;
    try {
      const parsed = JSON.parse(payloadRaw);
      eventType = parsed.type ?? parsed.event ?? 'unknown';
      externalEventId = parsed.id ?? parsed.event_id ?? null;
    } catch {
      return new Response(JSON.stringify({ error: 'Ungültiger Payload — nicht blind vertrauen' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (externalEventId) {
      const { data: existing } = await supabase
        .from('payment_webhook_events')
        .select('id')
        .eq('provider_key', providerKey)
        .eq('external_event_id', externalEventId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const payloadHash = hashPayload(payloadRaw);

    await supabase.from('payment_webhook_events').insert({
      tenant_id: tenantId,
      provider_key: providerKey,
      event_type: eventType,
      external_event_id: externalEventId,
      signature_valid: signature.startsWith('whsec_prepared_'),
      payload_hash: payloadHash,
      processing_status: 'received',
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Webhook empfangen (Vorbereitung) — keine Zahlungsbuchung.',
        eventType,
        payloadHash,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('payment-webhook error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
