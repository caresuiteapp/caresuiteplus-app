// Generated native presentation from src/components/office/ClientRecordContractsPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { DocumentRecommendations } from "../documents/DocumentRecommendations.native.tsx";
import { ClientDocumentPreview } from '@/components/office/ClientDocumentPreview';
import { isIntakeDocumentContentMissing } from '@/lib/documents/documentPdfLogic';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel, } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { resolveClientInsuranceDisplay } from "../../lib/clients/clientInsurancePresentation.native.ts";
import { useAuth } from '@/lib/auth/context';
import { listClientDocuments } from '@/lib/clients/clientDocumentsService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { filterClientContractDocuments, resolveOfficeDocumentDisplayFileName, } from '@/lib/office/officeDocumentDisplay';
import type { ClientFullDetail } from '@/types/modules/client';
import { BILLING_TYPE_LABELS, CLIENT_DOCUMENT_CATEGORY_LABELS, SERVICE_TYPE_LABELS, type ClientDocumentRecord, } from '@/types/modules/client';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { spacing, typography } from '@/theme';
type ClientRecordContractsPanelProps = {
    clientId: string;
    fullClient?: ClientFullDetail | null;
};
function formatEuro(cents: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
function contractDocumentStatusLabel(doc: ClientDocumentRecord): string {
    if (isIntakeDocumentContentMissing(doc))
        return 'Inhalt fehlt';
    if (doc.intakeStatus === 'finalized')
        return 'Finalisiert';
    if (doc.status === 'abgeschlossen')
        return 'Finalisiert';
    if (doc.status === 'aktiv')
        return 'Aktiv';
    return 'In Bearbeitung';
}
function contractDocumentSecondaryLine(doc: ClientDocumentRecord): string {
    const parts = [CLIENT_DOCUMENT_CATEGORY_LABELS[doc.category]];
    const displayFileName = resolveOfficeDocumentDisplayFileName(doc);
    if (displayFileName)
        parts.push(displayFileName);
    if (doc.documentSource === 'intake')
        parts.push('Aufnahme');
    return parts.join(' · ');
}
export function ClientRecordContractsPanel({ clientId, fullClient }: ClientRecordContractsPanelProps) {
    const { profile } = useAuth();
    const { can } = usePermissions();
    const tenantId = useServiceTenantId();
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const query = useAsyncQuery(() => {
        if (!tenantId || !clientId)
            return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
        return listClientDocuments(tenantId, clientId);
    }, [tenantId, clientId], { enabled: !!tenantId && !!clientId, queryKey: `client-contracts:${tenantId}:${clientId}:${profile?.id}:${profile?.roleKey}` });
    const contractDocuments = useMemo(() => filterClientContractDocuments(query.data ?? fullClient?.documents ?? []), [query.data, fullClient?.documents]);
    const structuredContracts = fullClient?.contracts ?? [];
    const selectedDoc = useMemo(() => contractDocuments.find((doc) => doc.id === selectedDocId) ?? contractDocuments[0] ?? null, [contractDocuments, selectedDocId]);
    if (query.loading && contractDocuments.length === 0 && structuredContracts.length === 0) {
        return <LoadingState message="Verträge werden geladen…"/>;
    }
    if (query.error && contractDocuments.length === 0 && structuredContracts.length === 0) {
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    }
    return (<View style={styles.panel}>
      <DocumentRecommendations module="office" workflow="client_contracts" clientId={clientId} compact/>
      {fullClient?.billingProfile ? (<SectionPanel title="Abrechnungsprofil">
          <DetailInfoRow label="Abrechnungsart" value={BILLING_TYPE_LABELS[fullClient.billingProfile.billingType]}/>
          <DetailInfoRow label="Leistungsart" value={SERVICE_TYPE_LABELS[fullClient.billingProfile.serviceType]}/>
          <DetailInfoRow label="Stundensatz" value={formatEuro(fullClient.billingProfile.hourlyRateCents)}/>
          <DetailInfoRow label="Kostenträger" value={fullClient.billingProfile.costBearerName}/>
          <DetailInfoRow label="Versichertennummer" value={resolveClientInsuranceDisplay(fullClient, can('office.clients.view_sensitive'))}/>
        </SectionPanel>) : null}

      <SectionPanel title="Verträge & Einwilligungen" subtitle="Aufnahme-Dokumente und Vertragsunterlagen">
        {structuredContracts.length === 0 && contractDocuments.length === 0 ? (<EmptyState title="Keine Verträge hinterlegt" message="Finalisierte Verträge und Einwilligungen aus der Aufnahme erscheinen hier."/>) : (<>
            {structuredContracts.map((contract) => (<PremiumCard key={contract.id} style={styles.card}>
                <Text style={styles.primary}>{contract.contractNumber}</Text>
                <Text style={styles.secondary}>
                  {formatDate(contract.contractStart)} · {contract.status}
                  {contract.signedAt ? ' · signiert' : ' · offen'}
                </Text>
              </PremiumCard>))}
            {contractDocuments.map((doc) => (<PremiumCard key={doc.id} style={[styles.card, selectedDoc?.id === doc.id && styles.cardSelected]} onPress={() => setSelectedDocId(doc.id)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.primary}>{doc.title}</Text>
                  <PremiumBadge label={contractDocumentStatusLabel(doc)} variant={isIntakeDocumentContentMissing(doc) ? 'orange' : 'green'} dot/>
                </View>
                <Text style={styles.secondary}>{contractDocumentSecondaryLine(doc)}</Text>
              </PremiumCard>))}
          </>)}
      </SectionPanel>

      {selectedDoc ? (<ClientDocumentPreview key={`${tenantId}:${clientId}:${selectedDoc.id}`} tenantId={tenantId} clientId={clientId} document={selectedDoc} clientLastName={fullClient?.lastName ?? null} actorName={profile?.displayName ?? profile?.email ?? null}/>) : null}
    </View>);
}
const styles = StyleSheet.create({
    panel: { gap: spacing.md, paddingBottom: spacing.lg },
    card: { marginBottom: spacing.sm },
    cardSelected: { borderColor: careSuiteAuroraTheme.accent.cyan, borderWidth: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: careSpacing.sm },
    primary: { ...typography.label, color: careSuiteAuroraTheme.text.primary, flex: 1 },
    secondary: { ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs },
});
