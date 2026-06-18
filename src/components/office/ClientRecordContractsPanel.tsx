import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listClientDocuments } from '@/lib/clients/clientDocumentsService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import {
  buildClientDocumentPreviewFallback,
  filterClientContractDocuments,
  resolveOfficeDocumentDisplayFileName,
} from '@/lib/office/officeDocumentDisplay';
import type { ClientFullDetail } from '@/types/modules/client';
import {
  BILLING_TYPE_LABELS,
  CLIENT_DOCUMENT_CATEGORY_LABELS,
  SERVICE_TYPE_LABELS,
  type ClientDocumentRecord,
} from '@/types/modules/client';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { colors, spacing, typography } from '@/theme';

type ClientRecordContractsPanelProps = {
  clientId: string;
  fullClient?: ClientFullDetail | null;
};

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function contractDocumentStatusLabel(doc: ClientDocumentRecord): string {
  if (doc.intakeStatus === 'finalized') return 'Finalisiert';
  if (doc.status === 'abgeschlossen') return 'Finalisiert';
  if (doc.status === 'aktiv') return 'Aktiv';
  return 'In Bearbeitung';
}

function contractDocumentSecondaryLine(doc: ClientDocumentRecord): string {
  const parts = [CLIENT_DOCUMENT_CATEGORY_LABELS[doc.category]];
  const displayFileName = resolveOfficeDocumentDisplayFileName(doc);
  if (displayFileName) parts.push(displayFileName);
  if (doc.documentSource === 'intake') parts.push('Aufnahme');
  return parts.join(' · ');
}

export function ClientRecordContractsPanel({ clientId, fullClient }: ClientRecordContractsPanelProps) {
  const tenantId = useServiceTenantId();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listClientDocuments(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  const contractDocuments = useMemo(
    () => filterClientContractDocuments(query.data ?? fullClient?.documents ?? []),
    [query.data, fullClient?.documents],
  );
  const structuredContracts = fullClient?.contracts ?? [];
  const selectedDoc = useMemo(
    () => contractDocuments.find((doc) => doc.id === selectedDocId) ?? contractDocuments[0] ?? null,
    [contractDocuments, selectedDocId],
  );

  if (query.loading && contractDocuments.length === 0 && structuredContracts.length === 0) {
    return <LoadingState message="Verträge werden geladen…" />;
  }

  if (query.error && contractDocuments.length === 0 && structuredContracts.length === 0) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  return (
    <View style={styles.panel}>
      {fullClient?.billingProfile ? (
        <SectionPanel title="Abrechnungsprofil">
          <DetailInfoRow
            label="Abrechnungsart"
            value={BILLING_TYPE_LABELS[fullClient.billingProfile.billingType]}
          />
          <DetailInfoRow
            label="Leistungsart"
            value={SERVICE_TYPE_LABELS[fullClient.billingProfile.serviceType]}
          />
          <DetailInfoRow label="Stundensatz" value={formatEuro(fullClient.billingProfile.hourlyRateCents)} />
          <DetailInfoRow label="Kostenträger" value={fullClient.billingProfile.costBearerName} />
        </SectionPanel>
      ) : null}

      <SectionPanel title="Verträge & Einwilligungen" subtitle="Aufnahme-Dokumente und Vertragsunterlagen">
        {structuredContracts.length === 0 && contractDocuments.length === 0 ? (
          <EmptyState
            title="Keine Verträge hinterlegt"
            message="Finalisierte Verträge und Einwilligungen aus der Aufnahme erscheinen hier."
          />
        ) : (
          <>
            {structuredContracts.map((contract) => (
              <PremiumCard key={contract.id} style={styles.card}>
                <Text style={styles.primary}>{contract.contractNumber}</Text>
                <Text style={styles.secondary}>
                  {formatDate(contract.contractStart)} · {contract.status}
                  {contract.signedAt ? ' · signiert' : ' · offen'}
                </Text>
              </PremiumCard>
            ))}
            {contractDocuments.map((doc) => (
              <PremiumCard
                key={doc.id}
                style={[styles.card, selectedDoc?.id === doc.id && styles.cardSelected]}
                onPress={() => setSelectedDocId(doc.id)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.primary}>{doc.title}</Text>
                  <PremiumBadge label={contractDocumentStatusLabel(doc)} variant="green" dot />
                </View>
                <Text style={styles.secondary}>{contractDocumentSecondaryLine(doc)}</Text>
              </PremiumCard>
            ))}
          </>
        )}
      </SectionPanel>

      {selectedDoc ? (
        <SectionPanel title="Vorschau" subtitle={selectedDoc.title}>
          <DocumentHtmlPreview
            title={selectedDoc.title}
            previewHtml={selectedDoc.previewHtml}
            fallbackLabel={buildClientDocumentPreviewFallback(selectedDoc)}
          />
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  cardSelected: { borderColor: careLightColors.orange, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: careSpacing.sm },
  primary: { ...typography.label, flex: 1 },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
