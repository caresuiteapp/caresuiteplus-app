import { StyleSheet, Text, View } from 'react-native';
import { PremiumKpiCard, SectionPanel } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import type { CsvValidationSummary } from '@/types/csv';
import { typography } from '@/theme';

type Props = {
  summary: CsvValidationSummary;
  fileName?: string;
  fileSize?: number;
  delimiter?: string;
  columnCount?: number;
};

export function CsvValidationSummaryPanel({
  summary,
  fileName,
  fileSize,
  delimiter,
  columnCount,
}: Props) {
  return (
    <SectionPanel title="Validierungsübersicht" subtitle="Ergebnis der Datenprüfung">
      {fileName ? (
        <Text style={styles.meta}>
          {fileName}
          {fileSize != null ? ` · ${Math.round(fileSize / 1024)} KB` : ''}
          {delimiter ? ` · Trennzeichen: ${delimiter}` : ''}
          {columnCount != null ? ` · ${columnCount} Spalten` : ''}
        </Text>
      ) : null}
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Zeilen gesamt" value={String(summary.totalRows)} icon="📄" />
        <PremiumKpiCard label="Gültig" value={String(summary.validRows)} icon="✓" />
        <PremiumKpiCard label="Fehlerhaft" value={String(summary.invalidRows)} icon="!" />
        <PremiumKpiCard label="Dubletten" value={String(summary.duplicateRows)} icon="↺" />
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.caption, marginBottom: careSpacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
});
