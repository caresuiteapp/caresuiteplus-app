import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient, jsonResponse } from '../_shared/http.ts';
import { hmacSha256, sha256, timingSafeEqual } from '../_shared/zoom.ts';

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  const secret = Deno.env.get('ZOOM_WEBHOOK_SECRET_TOKEN')?.trim();
  if (!secret) return jsonResponse({ ok: false, error: 'Zoom-Webhook ist nicht konfiguriert.' }, 503);

  const rawBody = await req.text();
  let body: Record<string, any>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, error: 'Ungültiger JSON-Body.' }, 400);
  }

  if (body.event === 'endpoint.url_validation') {
    const plainToken = String(body.payload?.plainToken ?? '');
    if (!plainToken) return jsonResponse({ ok: false, error: 'plainToken fehlt.' }, 400);
    return jsonResponse({
      plainToken,
      encryptedToken: hex(await hmacSha256(secret, plainToken)),
    });
  }

  const timestamp = req.headers.get('x-zm-request-timestamp') ?? '';
  const signature = req.headers.get('x-zm-signature') ?? '';
  const timestampMs = Number(timestamp) * 1000;
  if (!timestamp || !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
    return jsonResponse({ ok: false, error: 'Zoom-Webhook-Zeitstempel ungültig.' }, 401);
  }
  const expected = `v0=${hex(await hmacSha256(secret, `v0:${timestamp}:${rawBody}`))}`;
  if (!await timingSafeEqual(signature, expected)) {
    return jsonResponse({ ok: false, error: 'Zoom-Webhook-Signatur ungültig.' }, 401);
  }

  const service = getServiceClient();
  const eventType = String(body.event ?? 'unknown');
  const accountId = String(body.payload?.account_id ?? '') || null;
  const object = body.payload?.object ?? {};
  const zoomMeetingId = String(object.id ?? object.meeting_id ?? '') || null;
  const eventFingerprint = await sha256(
    `${eventType}:${body.event_ts ?? timestamp}:${accountId ?? ''}:${zoomMeetingId ?? ''}:${rawBody}`,
  );

  const { data: connection } = accountId
    ? await service.from('zoom_connections').select('id, tenant_id').eq('zoom_account_id', accountId).maybeSingle()
    : { data: null };
  const { data: meeting } = connection?.tenant_id && zoomMeetingId
    ? await service.from('zoom_meetings')
      .select('id, tenant_id')
      .eq('tenant_id', connection.tenant_id)
      .eq('zoom_meeting_id', zoomMeetingId)
      .maybeSingle()
    : { data: null };

  const { data: stored, error: insertError } = await service.from('zoom_webhook_events').insert({
    event_fingerprint: eventFingerprint,
    zoom_account_id: accountId,
    event_type: eventType,
    event_timestamp: body.event_ts
      ? new Date(Number(body.event_ts) * 1000).toISOString()
      : new Date(timestampMs).toISOString(),
    tenant_id: connection?.tenant_id ?? null,
    meeting_id: meeting?.id ?? null,
    payload: body,
  }).select('id').maybeSingle();
  if (insertError?.code === '23505') return jsonResponse({ ok: true, duplicate: true });
  if (insertError) return jsonResponse({ ok: false, error: insertError.message }, 500);

  try {
    if (meeting?.id && eventType === 'meeting.started') {
      await service.from('zoom_meetings').update({
        status: 'started',
        zoom_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', meeting.id);
    } else if (meeting?.id && eventType === 'meeting.ended') {
      await service.from('zoom_meetings').update({
        status: 'ended',
        zoom_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', meeting.id);
    } else if (meeting?.id && eventType === 'meeting.participant_joined') {
      const participant = object.participant ?? {};
      await service.from('zoom_meeting_attendance').insert({
        tenant_id: meeting.tenant_id,
        meeting_id: meeting.id,
        zoom_participant_id: participant.participant_uuid ?? participant.id ?? null,
        zoom_user_id: participant.user_id ?? null,
        display_name: participant.user_name ?? null,
        email: participant.email ?? null,
        joined_at: participant.join_time ?? new Date().toISOString(),
        source_event_id: stored?.id ?? null,
      });
    } else if (meeting?.id && eventType === 'meeting.participant_left') {
      const participant = object.participant ?? {};
      const participantId = participant.participant_uuid ?? participant.id ?? null;
      if (participantId) {
        const { data: attendance } = await service.from('zoom_meeting_attendance')
          .select('id, joined_at')
          .eq('meeting_id', meeting.id)
          .eq('zoom_participant_id', participantId)
          .is('left_at', null)
          .order('joined_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (attendance) {
          const leftAt = new Date(participant.leave_time ?? Date.now());
          const joinedAt = new Date(attendance.joined_at);
          await service.from('zoom_meeting_attendance').update({
            left_at: leftAt.toISOString(),
            duration_seconds: Math.max(0, Math.round((leftAt.getTime() - joinedAt.getTime()) / 1000)),
            updated_at: new Date().toISOString(),
          }).eq('id', attendance.id);
        }
      }
    }
    await service.from('zoom_webhook_events').update({
      processing_status: meeting?.id ? 'processed' : 'ignored',
      processed_at: new Date().toISOString(),
    }).eq('id', stored?.id);
  } catch (error) {
    await service.from('zoom_webhook_events').update({
      processing_status: 'failed',
      error_message: error instanceof Error ? error.message : 'Verarbeitung fehlgeschlagen.',
      processed_at: new Date().toISOString(),
    }).eq('id', stored?.id);
    return jsonResponse({ ok: false, error: 'Webhook konnte nicht verarbeitet werden.' }, 500);
  }

  return jsonResponse({ ok: true });
});
