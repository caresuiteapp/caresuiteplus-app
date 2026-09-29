import * as DocumentPicker from 'expo-document-picker';
import { parseEmployeePlanText, type PlanTextOptions } from './localPlanParser';
import { readLocalPlan, type LocalReaderOptions } from './localPlanReader';
import type { PlanImportResult } from './employeePlanImport';
export type { PlanImportResult } from './employeePlanImport';

/** Web only: bytes stay in this browser. No Supabase Edge Function / external analysis call. */
export async function importEmployeePlan(input: PlanTextOptions & LocalReaderOptions & { tenantId: string; employeeId: string }): Promise<PlanImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], multiple: false, copyToCacheDirectory: false });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  if ((asset.size ?? 0) > 10 * 1024 * 1024) throw new Error('Die Datei darf höchstens 10 MB groß sein.');
  if (input.signal?.aborted) throw new DOMException('Analyse abgebrochen.', 'AbortError');
  // Expo web supplies a File. Do not fetch arbitrary document URLs.
  const file = asset.file;
  if (!file) throw new Error('Die Datei konnte nicht lokal gelesen werden. Bitte erneut auswählen.');
  const extracted = await readLocalPlan(file, input).catch((error: unknown) => {
    if (error instanceof Error && error.name === 'InvalidPDFException') throw new Error('Das PDF ist beschädigt oder unvollständig. Bitte eine neue Kopie oder ein Foto verwenden.');
    if (error instanceof Error && error.name === 'InvalidStateError') throw new Error('Das Bild konnte nicht gelesen werden. Bitte als JPG oder PNG speichern und erneut auswählen.');
    throw error;
  });
  const parsed = parseEmployeePlanText(extracted.text, input);
  return {
    ...parsed, filename: asset.name, extractedText: extracted.text,
    rows: parsed.rows.map((r, i) => ({ ...r, id: `import-${Date.now()}-${i}`, uncertain: r.uncertain || extracted.ocrPages > 0 })),
    warnings: [...parsed.warnings, ...(extracted.ocrPages ? ['Foto-/Scanerkennung: Alle Daten und Zeiten mit der Vorlage vergleichen. Handschrift, schräge Fotos und kleine Schrift können fehlerhaft erkannt werden.'] : []), ...(extracted.lowConfidence ? ['Die Bildqualität oder Texterkennung ist unsicher. Bitte den erkannten Text besonders sorgfältig prüfen.'] : [])],
    extraction: extracted.ocrPages ? `${extracted.pages} Seite(n), davon ${extracted.ocrPages} mit lokaler Texterkennung` : `${extracted.pages} Seite(n) direkt aus PDF-Text`,
  };
}
