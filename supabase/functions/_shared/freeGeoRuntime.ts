import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getServiceClient, jsonResponse } from './http.ts';
import type { ProviderRequest } from './freeGeoEngine.ts';
export async function handleFreeGeo(req: Request, action: (body: Record<string, unknown>, request: ProviderRequest) => Promise<unknown>): Promise<Response> {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST')
        return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
    try {
        const authorization = req.headers.get('authorization');
        if (!authorization?.startsWith('Bearer '))
            return jsonResponse({ ok: false, error: 'Anmeldung erforderlich.' }, 401);
        const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
        const { data: user, error: authError } = await client.auth.getUser();
        if (authError || !user.user)
            return jsonResponse({ ok: false, error: 'Anmeldung erforderlich.' }, 401);
        const { data: tenantId, error: tenantError } = await client.rpc('current_tenant_id');
        if (tenantError || !tenantId)
            return jsonResponse({ ok: false, error: 'Kein freigeschalteter Mandant.' }, 403);
        const reader = req.body?.getReader();
        let bodyText = '', bytes = 0;
        const decoder = new TextDecoder();
        if (reader) {
            while (true) {
                const part = await reader.read();
                if (part.done)
                    break;
                bytes += part.value.byteLength;
                if (bytes > 8192) {
                    await reader.cancel();
                    return jsonResponse({ ok: false, error: 'Anfrage zu groß.' }, 413);
                }
                bodyText += decoder.decode(part.value, { stream: true });
            }
            bodyText += decoder.decode();
        }
        let body: Record<string, unknown>;
        try {
            body = JSON.parse(bodyText);
            if (!body || Array.isArray(body) || typeof body !== 'object')
                throw new Error();
        }
        catch {
            return jsonResponse({ ok: false, error: 'Ungültige Anfrage.' }, 400);
        }
        if (body.tenantId && body.tenantId !== tenantId)
            return jsonResponse({ ok: false, error: 'Mandant stimmt nicht überein.' }, 403);
        const service = getServiceClient(), deadline = Date.now() + 12000;
        const request: ProviderRequest = async (url, provider) => {
            const key = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url)))).map(b => b.toString(16).padStart(2, '0')).join('');
            const { data: cached } = await service.from('free_geo_cache').select('payload').eq('tenant_id', tenantId).eq('cache_key', key).gt('expires_at', new Date().toISOString()).maybeSingle();
            if (cached)
                return cached.payload;
            const { data: delay, error: limitError } = await service.rpc('reserve_free_geo_request', { p_provider: provider });
            if (limitError || delay === null || typeof delay !== 'number' || delay < 0 || delay + 1500 > deadline - Date.now())
                throw new Error('Routendienst ausgelastet. Bitte später erneut versuchen.');
            if (delay)
                await new Promise(resolve => setTimeout(resolve, delay));
            const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'CareSuiteHealthOS/1.0 (+https://www.caresuiteplus.app)' }, signal: AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - Date.now()))) });
            if (!response.ok)
                throw new Error('Kartendienst vorübergehend nicht verfügbar. Bitte später erneut versuchen.');
            const payload = await response.json();
            await service.from('free_geo_cache').upsert({ tenant_id: tenantId, cache_key: key, payload, expires_at: new Date(Date.now() + 24 * 60 * 60000).toISOString() }, { onConflict: 'tenant_id,cache_key' });
            return payload;
        };
        const result = await action(body, request);
        return jsonResponse({ ok: true, ...result as object });
    }
    catch (error) {
        const message = error instanceof Error && /^(Bitte |Ungültige |Adresse |Keine |Routendienst |Kartendienst )/.test(error.message) ? error.message : 'Kartendienst vorübergehend nicht verfügbar. Bitte erneut versuchen.';
        return jsonResponse({ ok: false, error: message }, 503);
    }
}
