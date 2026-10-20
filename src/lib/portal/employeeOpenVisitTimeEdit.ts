import { getSupabaseClient } from '@/lib/supabase/client';
import { resolveAssistVisitIdForPersistence } from '@/lib/assist/assistExecutionVisitResolver';

export function formatEditableVisitTime(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const n = (v: number) => String(v).padStart(2, '0');
  return `${n(d.getDate())}.${n(d.getMonth() + 1)}.${d.getFullYear()} ${n(d.getHours())}:${n(d.getMinutes())}`;
}
export function parseEditableVisitTime(value: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, day, month, year, hour, minute] = m.map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day || d.getHours() !== hour || d.getMinutes() !== minute) return null;
  return d.toISOString();
}
export type OpenVisitTimeEdit = {
  tenantId: string; assignmentId: string; startedAt: string; endedAt: string;
  onTheWayAt: string | null; arrivedAt: string | null; pauseMinutes: number; reason: string;
  confirmOverlap?: boolean;
};
export async function saveEmployeeOpenVisitTimes(input: OpenVisitTimeEdit): Promise<{ overlap: boolean }> {
  const db = getSupabaseClient();
  if (!db) throw new Error('Keine Verbindung zum Server.');
  const visitId = await resolveAssistVisitIdForPersistence(input.tenantId, input.assignmentId);
  if (!visitId) throw new Error('Einsatz konnte nicht eindeutig zugeordnet werden. Bitte erneut laden.');
  const rpc = db as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: { ok?: boolean; overlap?: boolean } | null; error: { message: string } | null }> };
  const { data, error } = await rpc.rpc('employee_portal_correct_open_visit_times', {
    p_visit_id: visitId, p_started_at: input.startedAt, p_ended_at: input.endedAt,
    p_on_the_way_at: input.onTheWayAt, p_arrived_at: input.arrivedAt,
    p_pause_minutes: input.pauseMinutes,
    p_travel_minutes: input.onTheWayAt && input.arrivedAt ? Math.max(0, Math.round((Date.parse(input.arrivedAt) - Date.parse(input.onTheWayAt)) / 60000)) : 0,
    p_reason: input.reason.trim(), p_confirm_overlap: input.confirmOverlap ?? false,
  });
  if (error) throw new Error(error.message.includes('employee_portal_correct_open_visit_times') ? 'Die Freigabe für Zeitkorrekturen fehlt auf dem Server. Bitte die Verwaltung informieren.' : error.message);
  if (data?.overlap && !data.ok) return { overlap: true };
  if (!data?.ok) throw new Error('Zeitkorrektur wurde nicht bestätigt. Bitte erneut laden.');
  return { overlap: false };
}
