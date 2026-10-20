import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { DocumentHtmlPreview, documentPreviewFallback } from '@/components/office/DocumentHtmlPreview';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useOfficeDocuments } from '@/hooks/useOfficeDocuments';
import { buildOfficeDocumentSubtitle, formatOfficeDocumentSizeDisplay } from '@/lib/office/officeDocumentDisplay';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import { VISIBILITY_LABELS } from '@/types/portal/visibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type OfficeDocumentDetailSummaryPanelProps = {
  documentId: string;
};

export function OfficeDocumentDetailSummaryPanel({ documentId }: OfficeDocumentDetailSummaryPanelProps) {
  const router = useRouter();
  const { allItems, loading, error, refresh } = useOfficeDocuments();
  const document = allItems.find((item) => item.id === documentId) ?? null;

  if (loading && allItems.length === 0) {
    return <LoadingState message="Dokument wird geladen…" />;
  }

  if (error && !document) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  if (!document) {
    return (
      <View style={styles.panel}>
        <ErrorState title="Nicht gefunden" message="Das Dokument existiert nicht oder wurde entfernt." onRetry={refresh} />
      </View>
    );
  }

  const categoryLabel = PORTAL_DOCUMENT_CATEGORY_LABELS[document.category];
  const subtitle = buildOfficeDocumentSubtitle(document);
  const sizeLabel = formatOfficeDocumentSizeDisplay(document.sizeLabel, document.fileSizeBytes);
  const metaParts = [categoryLabel, sizeLabel, WORKFLOW_STATUS_LABELS[document.status]].filter(Boolean);

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.orange}>
        <Text style={styles.title}>{document.title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
        <View style={styles.badges}>
          <PremiumBadge label={categoryLabel} variant="muted" />
          <PremiumBadge label={VISIBILITY_LABELS[document.visibility]} variant="cyan" />
        </View>
      </PremiumCard>

      <SectionPanel title="Vorschau" subtitle={document.title}>
        <DocumentHtmlPreview
          title={document.title}
          previewHtml={document.previewHtml}
          fallbackLabel={documentPreviewFallback(document)}
        />
      </SectionPanel>

      {document.clientId ? (
        <PremiumButton
          title="Zur Klient:innen-Akte"
          variant="secondary"
          onPress={() =>
            router.push(`/business/office/clients/${document.clientId}/documents` as never)
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
