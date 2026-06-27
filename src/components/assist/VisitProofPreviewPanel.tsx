import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { InfoBanner, PremiumBadge, SectionPanel } from '@/components/ui';
import type { VisitProofPreview } from '@/lib/assist/visitProofPreviewService';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type VisitProofPreviewPanelProps = {
  preview: VisitProofPreview;
};

export function VisitProofPreviewPanel({ preview }: VisitProofPreviewPanelProps) {
  const text = useAuroraAdaptiveText();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: { gap: spacing.xs, marginBottom: spacing.sm },
        title: { ...typography.h3, color: text.primary },
        row: { gap: spacing.xs },
        tasksBlock: { gap: spacing.xs, paddingVertical: spacing.sm },
        tasksTitle: { ...typography.caption, color: text.muted, fontWeight: '600' },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        taskChip: {
          borderWidth: 1,
          borderColor: 'rgba(15,23,42,0.12)',
          borderRadius: 16,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          maxWidth: '100%',
        },
        taskChipText: { ...typography.caption, color: text.primary },
        taskChipMeta: { ...typography.caption, color: text.muted, fontSize: 11 },
      }),
    [text],
  );

  return (
    <SectionPanel title="Leistungsnachweis-Vorschau" subtitle={preview.serviceName}>
      {!preview.readyForExport ? (
        <InfoBanner variant="warning" title="Unvollständig" message={preview.incompleteHint} />
      ) : null}

      <View style={styles.header}>
        <Text style={styles.title}>{preview.title}</Text>
        <PremiumBadge
          label={preview.readyForExport ? 'Exportbereit (Vorschau)' : 'Unvollständig'}
          variant={preview.readyForExport ? 'green' : 'orange'}
          dot
        />
      </View>

      <View style={styles.row}>
        {preview.fields.map((field) => (
          <DetailInfoRow
            key={field.label}
            label={`${field.label}${field.required ? ' *' : ''}`}
            value={field.missing ? `${field.value} (fehlt)` : field.value}
          />
        ))}
      </View>

      <View style={styles.tasksBlock}>
        <Text style={styles.tasksTitle}>Aufgaben</Text>
        {preview.tasks.length === 0 ? (
          <Text style={styles.taskChipMeta}>Keine Aufgaben hinterlegt</Text>
        ) : (
          <View style={styles.chipRow}>
            {preview.tasks.map((task) => (
              <View key={task.id} style={styles.taskChip}>
                <Text style={styles.taskChipText}>{task.title}</Text>
                <Text style={styles.taskChipMeta}>{task.statusLabel}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </SectionPanel>
  );
}
