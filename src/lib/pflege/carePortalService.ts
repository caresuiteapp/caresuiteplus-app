import type { PflegeServiceProofItem } from '@/types/modules/pflege';
import type { CareProofSignature } from './careProofPdfService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { ServiceResult } from '@/types';
export type PortalCareProof = { id: string; date: string; startedAt: string; endedAt: string; service: string; employee: string; note: string; amountCents: number; status: string; signer: string; signedAt: string | null; signature: string | null; rejectionReason: string };
export type PortalCareStop = { id: string; client: string; address: string; start: string; end: string; service: string; status: string; note: string };
export type PortalCareTour = { id: string; date: string; name: string; status: string; vehicle: string; stops: PortalCareStop[] };
async function portalRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<ServiceResult<T>> {
 const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
 try {
  const { data, error } = await (client as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: T; error: { code?: string; message?: string } | null }> }).rpc(name, args);
  if (error) return { ok: false, error: error.code === '42501' ? 'PORTAL_CARE_NOT_ELIGIBLE' : error.code === 'PGRST202' ? 'Die Pflegeanbindung ist noch nicht freigeschaltet.' : ['23514','40001','P0001'].includes(error.code ?? '') ? error.message ?? 'Aktion nicht zulässig.' : toGermanSupabaseError(error) };
  return { ok: true, data };
 } catch { return { ok: false, error: 'Verbindung unterbrochen. Bitte erneut laden und den Speicherstand prüfen.' }; }
}
// Scope comes exclusively from the authenticated server-side portal identity.
export async function fetchMyCareProofs(): Promise<ServiceResult<PortalCareProof[]>> {
 const proofs: PortalCareProof[] = [];
 for (let offset = 0; ; offset += 25) {
  const r = await portalRpc<PortalCareProof[]>('get_my_ambulatory_care_proofs', { p_offset: offset });
  if (!r.ok) return r; proofs.push(...r.data);
  if (r.data.length < 25) return { ok: true, data: proofs };
 }
}
export const fetchMyCareSignature = (id: string) => portalRpc<{ pngDataUrl: string; signerName: string; capturedAt: string }>('get_my_ambulatory_care_signature', { p_id: id });
export const fetchMyCareTours = (day: string) => portalRpc<PortalCareTour[]>('get_my_ambulatory_care_tours', { p_day: day });
export const signMyCareProof = (id: string, name: string, png: string) => portalRpc<{ id: string }>('sign_my_ambulatory_care_proof', { p_id: id, p_name: name, p_png: png });

export const advanceMyCareTour = (id: string, status: string, expectedStatus: string) => portalRpc<{ id: string }>('advance_my_ambulatory_care_tour', { p_tour_id: id, p_status: status, p_expected_status: expectedStatus });
export const advanceMyCareStop = (id: string, status: string, expectedStatus: string, note: string) => portalRpc<{ id: string }>('advance_my_ambulatory_care_stop', { p_stop_id: id, p_status: status, p_expected_status: expectedStatus, p_note: note });

export async function downloadMyCareProof(id: string): Promise<ServiceResult<{ id: string }>> {
 const result = await portalRpc<{ proof: PflegeServiceProofItem; signature: CareProofSignature }>('get_my_ambulatory_care_proof_export', { p_id: id });
 if (!result.ok) return result;
 try { const { downloadCareProofPdf } = await import('./careProofPdfService'); await downloadCareProofPdf(result.data.proof, result.data.signature); return { ok: true, data: { id } }; }
 catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden.' }; }
}
