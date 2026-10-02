import { Platform } from 'react-native';
import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
export type CareFoundationDetail = {
  id: string; number: string; clientId: string; from: string; to: string; recipient: string; recipientIk: string; totalCents: number;
  lines: { id: string; proofId: string; date: string; serviceCode: string; amountCents: number; status: string }[];
};
export async function fetchCareFoundationDetail(tenant: string, role: RoleKey | null | undefined, id: string): Promise<ServiceResult<CareFoundationDetail>> {
  const denied = enforcePermission<CareFoundationDetail>(role, 'pflege.billing.view'); if (denied) return denied;
  const blocked = guardServiceTenant(tenant); if (blocked) return blocked;
  const client = getSupabaseClient(); if (!client || getServiceMode() !== 'supabase') return { ok: false, error: 'Live-Datenbank nicht verfügbar.' };
  const result = await fromUnknownTable(client, 'pfleger_invoice_foundations').select('*').eq('tenant_id', tenant).eq('id', id).maybeSingle();
  if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
  if (!result.data) return { ok: false, error: 'Rechnungsgrundlage nicht gefunden.' };
  const row = result.data as Record<string, unknown>; const lines: CareFoundationDetail['lines'] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await fromUnknownTable(client, 'pfleger_billing_cases').select('id,service_proof_id,service_date,service_code,amount_cents,status').eq('tenant_id', tenant).eq('invoice_foundation_id', id).order('service_date').order('id').range(offset, offset + 499);
    if (page.error) return { ok: false, error: toGermanSupabaseError(page.error) };
    for (const r of (page.data ?? []) as Record<string, unknown>[]) lines.push({ id: String(r.id), proofId: String(r.service_proof_id), date: String(r.service_date), serviceCode: String(r.service_code), amountCents: Number(r.amount_cents), status: String(r.status) });
    if (!page.data || page.data.length < 500) break;
  }
  if (lines.length !== Number(row.proof_count) || lines.reduce((sum, line) => sum + line.amountCents, 0) !== Number(row.total_amount_cents)) return { ok: false, error: 'Positionen und gespeicherte Gesamtsumme stimmen nicht überein. Export ist gesperrt.' };
  return { ok: true, data: { id, number: String(row.foundation_number), clientId: String(row.client_id), from: String(row.period_from), to: String(row.period_to), recipient: String(row.recipient_name), recipientIk: String(row.recipient_ik), totalCents: Number(row.total_amount_cents), lines } };
}
export function buildCareFoundationCsv(value: CareFoundationDetail): string {
  const cell = (raw: unknown) => { let text = String(raw ?? ''); if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  const rows: unknown[][] = [['Rechnungsgrundlage', 'Leistungsdatum', 'Leistungscode', 'Betrag EUR', 'Kostenträger', 'IK', 'Nachweis-ID', 'Fall-ID']];
  for (const line of value.lines) rows.push([value.number, line.date, line.serviceCode, (line.amountCents / 100).toFixed(2).replace('.', ','), value.recipient, value.recipientIk, line.proofId, line.id]);
  return rows.map((row) => row.map(cell).join(';')).join('\r\n');
}
export async function downloadCareFoundationCsv(value: CareFoundationDetail): Promise<void> {
  const csv = '\uFEFF' + buildCareFoundationCsv(value); const name = `CareSuite_Pflege_Abrechnungsgrundlage_${value.id}.csv`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const files = await import('expo-file-system/legacy'); const sharing = await import('expo-sharing');
    if (!files.cacheDirectory || !(await sharing.isAvailableAsync())) throw new Error('Dateiweitergabe ist auf diesem Gerät nicht verfügbar.');
    const path = files.cacheDirectory + name; try { await files.writeAsStringAsync(path, csv, { encoding: files.EncodingType.UTF8 }); await sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Pflege-Abrechnungsgrundlage' }); } finally { await files.deleteAsync(path, { idempotent: true }); }
  }
}
