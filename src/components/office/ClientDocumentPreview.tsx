import { View, StyleSheet } from 'react-native';
import { DocumentHtmlPreview } from './DocumentHtmlPreview';
import { DocumentDeliveryActions } from './DocumentDeliveryActions';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { loadClientDocumentContent } from '@/lib/clients/clientDocumentContentService';
import { isIntakeDocumentContentMissing } from '@/lib/documents/documentPdfLogic';
import { getServiceMode } from '@/lib/services/mode';
import { buildClientDocumentPreviewFallback, buildDocumentPreviewStatusSubtitle } from '@/lib/office/officeDocumentDisplay';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { spacing } from '@/theme';

type Props = {
  document: ClientDocumentRecord;
  tenantId: string | null;
  clientId: string;
  clientLastName?: string | null;
  actorName?: string | null;
  onDeliveryComplete?: () => void;
  onBack?: () => void;
};

export function ClientDocumentPreview(props: Props) {
  const { document, tenantId, clientId } = props;
  const needsContent = isIntakeDocumentContentMissing(document) && getServiceMode() === 'supabase';
  const query = useAsyncQuery(
    () => loadClientDocumentContent({ doc: document, tenantId: tenantId ?? '', clientId }),
    [document, tenantId, clientId],
    { enabled: needsContent && Boolean(tenantId), queryKey: `document-content:${tenantId}:${clientId}:${document.id}:${document.updatedAt}` },
  );
  const resolved = needsContent ? query.data ?? document : document;
  const loading = needsContent && Boolean(tenantId) && query.loading;
  const loadError = needsContent ? query.error : null;

  return (
    <SectionPanel title="Vorschau" subtitle={buildDocumentPreviewStatusSubtitle(resolved)}>
      <View style={styles.content}>
        {loading ? <LoadingState message="Dokumentinhalt wird geladen…" /> : loadError ? (
          <ErrorState message={loadError} onRetry={query.refresh} />
        ) : (
          <DocumentHtmlPreview
            title={resolved.title}
            previewHtml={resolved.previewHtml}
            fallbackLabel={buildClientDocumentPreviewFallback(resolved)}
          />
        )}
        {!loading && !loadError && tenantId ? (
          <DocumentDeliveryActions
            tenantId={tenantId}
            clientId={clientId}
            document={resolved}
            clientLastName={props.clientLastName}
            actorName={props.actorName}
            onDeliveryComplete={props.onDeliveryComplete}
          />
        ) : null}
        {props.onBack ? <PremiumButton title="Zurück zur Liste" variant="secondary" onPress={props.onBack} /> : null}
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.sm, minWidth: 0 } });
