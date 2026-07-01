import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { VisitProofPreviewPanel } from '@/components/assist/VisitProofPreviewPanel';
import { InfoBanner, SectionPanel } from '@/components/ui';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import type { VisitProofPreview } from '@/lib/assist/visitProofPreviewService';
import type { VisitProofSnapshotEnrichment } from '@/lib/assist/visitProofSnapshotPreviewService';
import type { VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';
import { useVisitProofPdfPreview } from '@/hooks/useVisitProofPdfPreview';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type VisitProofPdfPreviewPanelProps = {
  tenantId: string;
  proof: AssistVisitProofRow;
  enrichment?: VisitProofSnapshotEnrichment;
  htmlPreview: VisitProofPreview & {
    visitTimes?: VisitTimesSummary | null;
    signatureImageUrl?: string | null;
  };
  htmlPreviewLoading?: boolean;
};

export function VisitProofPdfPreviewPanel({
  tenantId,
  proof,
  enrichment,
  htmlPreview,
  htmlPreviewLoading,
}: VisitProofPdfPreviewPanelProps) {
  const text = useAuroraAdaptiveText();
  const { preview, loading, error } = useVisitProofPdfPreview(tenantId, proof, enrichment);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        frame: {
          borderWidth: 1,
          borderColor: 'rgba(15,23,42,0.12)',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          minHeight: 480,
        },
        meta: {
          ...typography.caption,
          color: text.muted,
          marginBottom: spacing.sm,
        },
        fallback: {
          marginTop: spacing.md,
        },
      }),
    [text],
  );

  const showPdf = Platform.OS === 'web' && preview?.url && !error;
  const showHtmlFallback = Boolean(error) || Platform.OS !== 'web';

  return (
    <SectionPanel
      title="Leistungsnachweis-Vorschau"
      subtitle={preview?.fileName ?? htmlPreview.serviceName}
    >
      {(loading || htmlPreviewLoading) && !preview?.url ? (
        <Text style={styles.meta}>PDF wird aus Nachweisdaten erzeugt…</Text>
      ) : null}

      {error ? (
        <InfoBanner
          variant="warning"
          title="PDF-Vorschau nicht verfügbar"
          message={`${error} — Feldliste wird angezeigt.`}
        />
      ) : null}

      {showPdf ? (
        <View style={styles.frame}>
          {/* eslint-disable-next-line react/no-unknown-property */}
          <iframe
            title="Leistungsnachweis PDF"
            src={preview.url}
            style={{ width: '100%', height: 560, border: 'none', backgroundColor: '#fff' }}
          />
        </View>
      ) : null}

      {showHtmlFallback ? (
        <View style={styles.fallback}>
          <VisitProofPreviewPanel preview={htmlPreview} loading={htmlPreviewLoading} />
        </View>
      ) : null}
    </SectionPanel>
  );
}
