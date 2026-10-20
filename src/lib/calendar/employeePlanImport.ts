import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { PlanningDraft } from './employeeMonthPlanning';
import type { LocalReaderOptions } from './localPlanReader';

export type PlanImportResult = { personName: string | null; documentMonth: string | null; warnings: string[]; rows: PlanningDraft[]; filename: string; extractedText?: string; unrecognized?: string[]; extraction?: string };
export async function importEmployeePlan(input: {
  tenantId: string; employeeId: string; employeeName?: string; month: string; employer: string; interpretation: 'availability' | 'external' | 'mixed';
} & LocalReaderOptions): Promise<PlanImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], multiple: false, copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;
  const mime = asset.mimeType || (/\.pdf$/i.test(asset.name) ? 'application/pdf' : /\.png$/i.test(asset.name) ? 'image/png' : /\.webp$/i.test(asset.name) ? 'image/webp' : 'image/jpeg');
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Bitte PDF, JPG, PNG oder WebP auswählen.');
  if ((asset.size ?? 0) > 10 * 1024 * 1024) throw new Error('Die Datei darf höchstens 10 MB groß sein.');
  let base64: string;
  if (Platform.OS === 'web') {
    const blob = asset.file ?? await (await fetch(asset.uri)).blob();
    if (blob.size > 10 * 1024 * 1024) throw new Error('Die Datei darf höchstens 10 MB groß sein.');
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.readAsDataURL(blob);
    });
  } else {
    base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  }
  if (base64.length > Math.ceil(10 * 1024 * 1024 / 3) * 4) throw new Error('Die Datei darf höchstens 10 MB groß sein.');
  const db = getSupabaseClient();
  if (!db) throw new Error('Der Dateiimport benötigt eine aktive Serververbindung.');
  const { data, error } = await db.functions.invoke('employee-plan-analyze', { body: {
    tenant_id: input.tenantId, employee_id: input.employeeId, month: input.month,
    employer: input.employer.trim(), interpretation: input.interpretation,
    filename: asset.name, mime, base64,
  } });
  if (error) {
    const context = (error as { context?: Response }).context;
    let message = error.message;
    if (context && typeof context.json === 'function') {
      try { const body = await context.json(); message = body.error || message; } catch { /* retain transport error */ }
    }
    throw new Error(message);
  }
  if (!data?.ok || !Array.isArray(data.rows) || data.rows.length > 300) throw new Error(data?.error || 'Die Analyse lieferte kein gültiges Ergebnis.');
  return {
    filename: asset.name, personName: data.personName ?? null, documentMonth: data.documentMonth ?? null,
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
    rows: data.rows.map((row: Record<string, unknown>, index: number) => ({
      id: `import-${Date.now()}-${index}`, date: String(row.date ?? ''),
      kind: row.kind === 'available' ? 'available' : 'blocked',
      requiresClassification: row.kind !== 'available' && row.kind !== 'blocked',
      startTime: row.allDay === true ? '00:00' : String(row.startTime ?? ''),
      endTime: row.allDay === true ? '24:00' : String(row.endTime ?? ''),
      label: String(row.label ?? '').slice(0, 160), sourceText: String(row.sourceText ?? ''),
      uncertain: row.confidence !== 'high' || row.kind === 'unclear' || (!row.allDay && (!row.startTime || !row.endTime)),
    })),
  };
}
