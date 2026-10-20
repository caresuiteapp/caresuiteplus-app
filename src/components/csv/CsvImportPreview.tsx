import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import type { ClientImportRow } from '@/types/clientImport';
import type { EmployeeImportRow } from '@/types/employeeImport';
import type { CsvImportPreview as PreviewType } from '@/types/csv';
import { buildErrorReportCsv } from '@/lib/csv/csvValidation';
import { buildErrorReportFileName, triggerCsvDownload } from '@/lib/csv/csvDownload';
import { CsvErrorTable } from './CsvErrorTable';
import { CsvFieldMappingTable } from './CsvFieldMappingTable';
import { CsvValidationSummaryPanel } from './CsvValidationSummary';
import { typography } from '@/theme';

type Props<T extends ClientImportRow | EmployeeImportRow> = {
  preview: PreviewType<T>;
  importing?: boolean;
  onCancel: () => void;
  onImportAll: () => void;
  onImportValidOnly: () => void;
};

export function CsvImportPreview<T extends ClientImportRow | EmployeeImportRow>({
  preview,
  importing,
  onCancel,
  onImportAll,
  onImportValidOnly,
}: Props<T>) {
  const text = useAuroraAdaptiveText();
  const hasBlockingErrors = preview.summary.invalidRows > 0;
  const previewRows = preview.rows.slice(0, 20);

  return (
    <View style={styles.wrap}>
      <CsvValidationSummaryPanel
        summary={preview.summary}
        fileName={preview.fileName}
        fileSize={preview.fileSize}
        delimiter={preview.delimiter}
        columnCount={preview.columnCount}
      />
      <CsvFieldMappingTable mapping={preview.mapping} />
      <SectionPanel title="Vorschau" subtitle="Erste Zeilen">
        <ScrollView horizontal nestedScrollEnabled>
          <View>
            {previewRows.map((row) => (
              <View key={row.rowNumber} style={[styles.previewRow, { borderBottomColor: text.border }]}>
                <Text style={[styles.previewCell, { color: text.primary }]}>
                  #{row.rowNumber} · {row.isValid ? 'gültig' : 'fehlerhaft'}
                  {row.isDuplicate ? ' · Dublette' : ''}
                </Text>
                <Text style={[styles.previewCell, { color: text.secondary }]}>
                  {row.data.vorname} {row.data.nachname}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SectionPanel>
      <CsvErrorTable issues={preview.allIssues} />
      <View style={styles.actions}>
        <PremiumButton title="Import abbrechen" variant="ghost" onPress={onCancel} disabled={importing} />
        <PremiumButton
          title="Fehlerbericht herunterladen"
          variant="secondary"
          disabled={preview.allIssues.length === 0}
          onPress={() =>
            triggerCsvDownload(buildErrorReportCsv(preview.allIssues), buildErrorReportFileName())
          }
        />
        <PremiumButton
          title="Nur gültige Zeilen importieren"
          variant="secondary"
          disabled={importing || preview.summary.validRows === 0}
          onPress={onImportValidOnly}
        />
        <PremiumButton
          title="Import starten"
          disabled={importing || hasBlockingErrors}
          onPress={onImportAll}
        />
      </View>
      {hasBlockingErrors ? (
        <Text style={[styles.note, { color: text.muted }]}>
          Pflichtfeldfehler blockieren den Vollimport. Nutzen Sie „Nur gültige Zeilen importieren“, um fehlerhafte Zeilen zu überspringen.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: careSpacing.md },
  previewRow: { paddingVertical: careSpacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  previewCell: { ...typography.body, minWidth: 280 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  note: { ...typography.caption },
});
