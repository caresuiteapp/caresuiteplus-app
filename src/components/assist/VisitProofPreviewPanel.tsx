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
      }),
    [text],
  );

  return (
    <SectionPanel title="Leistungsnachweis-Vorschau" subtitle={preview.serviceName}>
      {!preview.readyForExport ? (
        <InfoBanner variant="warning" title="Unvollständig" message={preview.storageGapMessage} />
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
    </SectionPanel>
  );
}
