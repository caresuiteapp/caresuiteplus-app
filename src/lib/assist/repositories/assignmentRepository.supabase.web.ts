// Web-only hook: native repository and live draft persistence remain unchanged.
// The optional reviewed SQL installation owns personal finalization atomically.
import { assignmentSupabaseRepository as base } from './assignmentRepository.supabase.ts';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ensureAssistOriginal, type AssistOriginalRpc } from '@/lib/gkvExchange/assistOriginal';
export * from './assignmentRepository.supabase.ts';

export const assignmentSupabaseRepository: typeof base = {
  ...base,
  async prepareServiceRecord(tenantId, assignmentId, context) {
    const detail = await this.getById(tenantId, assignmentId);
    if (!detail.ok) return detail;
    if (!detail.data) return { ok: false, error: 'Einsatz nicht gefunden.' };
    if (detail.data.assignmentStatus !== 'abgeschlossen') return { ok: true, data: null };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Die persönliche Abschlussfassung benötigt eine verbundene Datenbank.' };
    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) return { ok: false, error: 'Bitte mit Ihrem persönlichen Zugang anmelden.' };
      await ensureAssistOriginal(client.rpc.bind(client) as unknown as AssistOriginalRpc, {
        tenantId, assignmentId, actorId: data.session.user.id, employeeId: detail.data.employeeId || null,
      }, crypto.randomUUID());
      // The trusted byte worker now resolves the sealed original as the latest
      // signed proof. It still verifies actual signature/PDF bytes independently.
      return await base.prepareServiceRecord.call(this, tenantId, assignmentId, context);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Der persönliche Nachweisabschluss konnte nicht bestätigt werden.' };
    }
  },
};
