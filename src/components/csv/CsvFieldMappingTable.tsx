import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import type { CsvFieldMapping } from '@/types/csv';
import { typography } from '@/theme';

type Props = {
  mapping: CsvFieldMapping[];
};

export function CsvFieldMappingTable({ mapping }: Props) {
  const text = useAuroraAdaptiveText();

  return (
    <SectionPanel title="Spalten-Mapping" subtitle="Erkannte Zuordnung zwischen CSV und Systemfeldern">
      {mapping.map((row) => (
        <View key={row.csvColumn} style={[styles.row, { borderBottomColor: text.border }]}>
          <View style={styles.col}>
            <Text style={[styles.label, { color: text.muted }]}>CSV-Spalte</Text>
            <Text style={[styles.value, { color: text.primary }]}>{row.csvColumn}</Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: text.muted }]}>Systemfeld</Text>
            <Text style={[styles.value, { color: text.primary }]}>{row.systemField ?? '—'}</Text>
          </View>
          <PremiumBadge
            label={row.confidence === 'recognized' ? 'erkannt' : row.confidence === 'uncertain' ? 'unsicher' : 'offen'}
            variant={row.confidence === 'recognized' ? 'green' : row.confidence === 'uncertain' ? 'orange' : 'muted'}
          />
        </View>
      ))}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.md,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  col: { flex: 1 },
  label: { ...typography.caption },
  value: { ...typography.bodyStrong },
});
