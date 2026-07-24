import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import {
  assertZoomMeetingAccess,
  createMeetingSdkSignature,
  decryptZoomSecret,
  encryptZoomSecret,
  resolveZoomActor,
  sha256,
  zoomApi,
  type ZoomConnectionRow,
} from '../_shared/zoom.ts';

type JsonObject = Record<string, unknown>;

function nullableUuid(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function dateIso(value: unknown): string {
  const date = new Date(String(value ?? ''));
  if (!Number.isFinite(date.getTime())) throw new Error('Ungültiger Meeting-Zeitpunkt.');
  return date.toISOString();
}

function duration(value: unknown): number {
  const parsed = Math.round(Number(value ?? 30));
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1440) {
    throw new Error('Die Dauer muss zwischen 1 und 1.440 Minuten liegen.');
  }
  return parsed;
}

function publicMeeting(row: JsonObject) {
  return {
    id: row.id,
    topic: row.topic,
    agenda: row.agenda,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    status: row.status,
    clientId: row.client_id,
    employeeId: row.employee_id,
    assignmentId: row.assignment_id,
    calendarEventId: row.calendar_event_id,
    consultationId: row.consultation_id,
    externalReference: row.external_reference,
    portalReleased: row.portal_released,
    portalJoinFrom: row.portal_join_from,
    portalJoinUntil: row.portal_join_until,
    recordingAllowed: row.recording_allowed,
    consentRequired: row.consent_required,
    consentStatus: row.consent_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function audit(payload: JsonObject): Promise<void> {
  await getServiceClient().from('zoom_audit_events').insert(payload);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);

  let auditContext: JsonObject = {};
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ ok: false, error: 'Nicht autorisiert.' }, 401);
    const service = getServiceClient();
    const actor = await resolveZoomActor(authHeader, service);
    assertZoomMeetingAccess(actor);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'list');
    auditContext = {
      tenant_id: actor.tenantId,
      actor_user_id: actor.profileId,
      action_key: action,
    };
    const { data: rawConnection } = await service.from('zoom_connections')
      .select('*')
      .eq('tenant_id', actor.tenantId)
      .eq('connection_status', 'connected')
      .maybeSingle();
    const connection = rawConnection as ZoomConnectionRow | null;
    if (!connection) throw new Error('Zoom ist für diesen Mandanten nicht verbunden.');

    if (action === 'list') {
      let query = service.from('zoom_meetings')
        .select('*')
        .eq('tenant_id', actor.tenantId)
        .order('start_time', { ascending: true })
        .limit(Math.min(Math.max(Number(body.limit ?? 100), 1), 250));
      if (body.from) query = query.gte('start_time', dateIso(body.from));
      if (body.until) query = query.lte('start_time', dateIso(body.until));
      if (body.status) query = query.eq('status', String(body.status));
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ ok: true, meetings: (data ?? []).map(publicMeeting) });
    }

    if (action === 'create') {
      const topic = String(body.topic ?? '').trim();
      if (!topic) throw new Error('Der interne Terminname fehlt.');
      const startTime = dateIso(body.startTime);
      const durationMinutes = duration(body.durationMinutes);
      const timezone = String(body.timezone ?? 'Europe/Berlin');
      const settings = {
        host_video: body.hostVideo !== false,
        participant_video: body.participantVideo === true,
        join_before_host: body.joinBeforeHost === true,
        mute_upon_entry: body.muteUponEntry !== false,
        waiting_room: body.waitingRoom !== false,
        auto_recording: body.recordingAllowed === true ? String(body.recordingMode ?? 'none') : 'none',
      };
      const zoomMeeting = await zoomApi<JsonObject>(
        service,
        connection,
        `/users/${encodeURIComponent(connection.zoom_user_id ?? 'me')}/meetings`,
        {
          method: 'POST',
          body: JSON.stringify({
            topic: 'CareSuite Videotermin',
            type: 2,
            start_time: startTime,
            duration: durationMinutes,
            timezone,
            agenda: body.externalReference
              ? `CareSuite-Referenz ${String(body.externalReference).slice(0, 80)}`
              : 'Über CareSuite HealthOS geplanter Videotermin',
            password: typeof body.passcode === 'string' && body.passcode.trim()
              ? body.passcode.trim()
              : undefined,
            settings,
          }),
        },
      );
      if (!zoomMeeting.id || !zoomMeeting.join_url) throw new Error('Zoom hat kein vollständiges Meeting geliefert.');
      const { data: stored, error } = await service.from('zoom_meetings').insert({
        tenant_id: actor.tenantId,
        connection_id: connection.id,
        created_by: actor.profileId,
        host_profile_id: nullableUuid(body.hostProfileId) ?? actor.profileId,
        zoom_meeting_id: String(zoomMeeting.id),
        zoom_uuid: zoomMeeting.uuid ?? null,
        topic,
        agenda: String(body.agenda ?? '').trim() || null,
        start_time: startTime,
        duration_minutes: durationMinutes,
        timezone,
        status: 'scheduled',
        join_url_cipher: await encryptZoomSecret(String(zoomMeeting.join_url)),
        start_url_cipher: zoomMeeting.start_url ? await encryptZoomSecret(String(zoomMeeting.start_url)) : null,
        passcode_cipher: zoomMeeting.password ? await encryptZoomSecret(String(zoomMeeting.password)) : null,
        settings,
        client_id: nullableUuid(body.clientId),
        employee_id: nullableUuid(body.employeeId),
        assignment_id: nullableUuid(body.assignmentId),
        calendar_event_id: nullableUuid(body.calendarEventId),
        consultation_id: nullableUuid(body.consultationId),
        external_reference: String(body.externalReference ?? '').trim() || null,
        portal_released: body.portalReleased === true,
        portal_join_from: body.portalJoinFrom ? dateIso(body.portalJoinFrom) : null,
        portal_join_until: body.portalJoinUntil ? dateIso(body.portalJoinUntil) : null,
        recording_allowed: body.recordingAllowed === true,
        consent_required: body.consentRequired !== false,
        consent_status: body.consentRequired === false ? 'not_required' : 'not_requested',
        zoom_created_at: zoomMeeting.created_at ?? new Date().toISOString(),
        zoom_updated_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;
      await audit({
        ...auditContext,
        connection_id: connection.id,
        meeting_id: stored.id,
        resource_external_id: String(zoomMeeting.id),
        result_status: 'success',
        http_status: 201,
        request_fingerprint: await sha256(`${actor.tenantId}:${zoomMeeting.id}:create`),
      });
      return jsonResponse({ ok: true, meeting: publicMeeting(stored) }, 201);
    }

    const meetingId = nullableUuid(body.meetingId);
    if (!meetingId) throw new Error('CareSuite-Meeting-ID fehlt.');
    const { data: meeting, error: meetingError } = await service.from('zoom_meetings')
      .select('*')
      .eq('id', meetingId)
      .eq('tenant_id', actor.tenantId)
      .maybeSingle();
    if (meetingError) throw meetingError;
    if (!meeting) throw new Error('Meeting wurde nicht gefunden.');
    auditContext.meeting_id = meeting.id;
    auditContext.connection_id = connection.id;
    auditContext.resource_external_id = meeting.zoom_meeting_id;

    if (action === 'join-context') {
      const host = body.host === true;
      const joinUrl = host && meeting.start_url_cipher
        ? await decryptZoomSecret(meeting.start_url_cipher)
        : meeting.join_url_cipher
          ? await decryptZoomSecret(meeting.join_url_cipher)
          : null;
      if (!joinUrl) throw new Error('Für dieses Meeting ist keine sichere Beitrittsadresse vorhanden.');
      const sdk = await createMeetingSdkSignature(String(meeting.zoom_meeting_id), host ? 1 : 0);
      const zakResponse = host
        ? await zoomApi<{ token?: string }>(
          service,
          connection,
          `/users/${encodeURIComponent(connection.zoom_user_id ?? 'me')}/token?type=zak`,
        )
        : null;
      await audit({ ...auditContext, action_key: host ? 'meeting.start' : 'meeting.join', result_status: 'success' });
      return jsonResponse({
        ok: true,
        join: {
          meetingId: meeting.id,
          meetingNumber: meeting.zoom_meeting_id,
          topic: meeting.topic,
          userName: String(body.userName ?? '').trim() || 'CareSuite Teilnehmer',
          userEmail: String(body.userEmail ?? '').trim() || undefined,
          passcode: meeting.passcode_cipher ? await decryptZoomSecret(meeting.passcode_cipher) : '',
          joinUrl,
          sdkKey: sdk.sdkKey,
          signature: sdk.signature,
          role: host ? 1 : 0,
          zak: zakResponse?.token,
        },
      });
    }

    if (action === 'update') {
      const nextStart = body.startTime ? dateIso(body.startTime) : meeting.start_time;
      const nextDuration = body.durationMinutes ? duration(body.durationMinutes) : meeting.duration_minutes;
      const patch: JsonObject = {
        start_time: nextStart,
        duration_minutes: nextDuration,
        updated_at: new Date().toISOString(),
        zoom_updated_at: new Date().toISOString(),
      };
      if (typeof body.topic === 'string' && body.topic.trim()) patch.topic = body.topic.trim();
      if (typeof body.agenda === 'string') patch.agenda = body.agenda.trim() || null;
      if (typeof body.portalReleased === 'boolean') patch.portal_released = body.portalReleased;
      if (typeof body.recordingAllowed === 'boolean') patch.recording_allowed = body.recordingAllowed;
      await zoomApi<void>(service, connection, `/meetings/${encodeURIComponent(meeting.zoom_meeting_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          start_time: nextStart,
          duration: nextDuration,
          timezone: body.timezone ?? meeting.timezone,
        }),
      });
      const { data: updated, error } = await service.from('zoom_meetings')
        .update(patch)
        .eq('id', meeting.id)
        .eq('tenant_id', actor.tenantId)
        .select('*')
        .single();
      if (error) throw error;
      await audit({ ...auditContext, result_status: 'success', http_status: 204 });
      return jsonResponse({ ok: true, meeting: publicMeeting(updated) });
    }

    if (action === 'cancel') {
      await zoomApi<void>(service, connection, `/meetings/${encodeURIComponent(meeting.zoom_meeting_id)}`, {
        method: 'DELETE',
      });
      const { data: cancelled, error } = await service.from('zoom_meetings')
        .update({
          status: 'cancelled',
          join_url_cipher: null,
          start_url_cipher: null,
          passcode_cipher: null,
          updated_at: new Date().toISOString(),
          zoom_updated_at: new Date().toISOString(),
        })
        .eq('id', meeting.id)
        .eq('tenant_id', actor.tenantId)
        .select('*')
        .single();
      if (error) throw error;
      await audit({ ...auditContext, result_status: 'success', http_status: 204 });
      return jsonResponse({ ok: true, meeting: publicMeeting(cancelled) });
    }

    return jsonResponse({ ok: false, error: 'Unbekannte Zoom-Aktion.' }, 400);
  } catch (error) {
    if (auditContext.tenant_id) {
      await audit({
        ...auditContext,
        result_status: 'failed',
        http_status: 500,
        error_message: error instanceof Error ? error.message : 'Zoom-Aktion fehlgeschlagen.',
      }).catch(() => undefined);
    }
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Zoom-Aktion fehlgeschlagen.',
    }, 500);
  }
});
