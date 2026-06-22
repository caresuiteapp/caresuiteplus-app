import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import type { CsvRowIssue } from '@/types/csv';
import { typography } from '@/theme';

type Props = {
  issues: CsvRowIssue[];
  maxRows?: number;
};

export function CsvErrorTable({ issues, maxRows = 50 }: Props) {
  const text = useAuroraAdaptiveText();
  const visible = issues.slice(0, maxRows);

  if (issues.length === 0) {
    return (
      <SectionPanel title="Fehlerliste" subtitle="Keine Fehler oder Warnungen">
        <Text style={{ color: text.muted }}>Alle Zeilen sind gültig.</Text>
      </SectionPanel>
    );
  }

  return (
    <SectionPanel title="Fehlerliste" subtitle={`${issues.length} Hinweise`}>
      <ScrollView horizontal nestedScrollEnabled>
        <View>
          <View style={[styles.headerRow, { borderBottomColor: text.border }]}>
            <Text style={[styles.cell, styles.head, { color: text.muted }]}>Zeile</Text>
            <Text style={[styles.cellWide, styles.head, { color: text.muted }]}>Feld</Text>
            <Text style={[styles.cellWide, styles.head, { color: text.muted }]}>Problem</Text>
            <Text style={[styles.cellHint, styles.head, { color: text.muted }]}>Korrekturhinweis</Text>
            <Text style={[styles.cell, styles.head, { color: text.muted }]}>Schwere</Text>
          </View>
          {visible.map((issue, index) => (
            <View key={`${issue.rowNumber}-${issue.errorCode}-${index}`} style={[styles.row, { borderBottomColor: text.border }]}>
              <Text style={[styles.cell, { color: text.primary }]}>{issue.rowNumber}</Text>
              <Text style={[styles.cellWide, { color: text.primary }]}>{issue.fieldName ?? '—'}</Text>
              <Text style={[styles.cellWide, { color: text.secondary }]}>{issue.errorMessage}</Text>
              <Text style={[styles.cellHint, { color: text.secondary }]}>{issue.hint ?? '—'}</Text>
              <Text style={[styles.cell, { color: text.secondary }]}>{issue.severity}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: careSpacing.xs },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: careSpacing.xs },
  cell: { width: 64, ...typography.caption },
  cellWide: { width: 220, ...typography.caption, paddingRight: careSpacing.sm },
  cellHint: { width: 320, ...typography.caption, paddingRight: careSpacing.sm },
  head: { fontWeight: '600' },
});
