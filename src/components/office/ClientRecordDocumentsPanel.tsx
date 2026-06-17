import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { buildClientDocumentPreviewFallback, resolveOfficeDocumentDisplayFileName } from '@/lib/office/officeDocumentDisplay';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CareCatalogSelect } from '@/components/inputs';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { listClientDocuments, uploadClientDocument } from '@/lib/clients/clientDocumentsService';
import {
  CLIENT_DOCUMENT_CATEGORY_LABELS,
  CLIENT_DOCUMENT_STATUS_LABELS,
  type ClientDocumentRecord,
} from '@/types/modules/client';
import { getServiceMode } from '@/lib/services/mode';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing, typography } from '@/theme';

type PickedFile = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64: string;
};

type ClientRecordDocumentsPanelProps = {
  clientId: string;
  initialDocuments?: ClientDocumentRecord[];
  onRecordRefresh?: () => void;
};

function documentStatusLabel(doc: ClientDocumentRecord): string {
  if (doc.intakeStatus === 'finalized') return 'Finalisiert';
  return CLIENT_DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status;
}

function documentStatusVariant(doc: ClientDocumentRecord): 'green' | 'cyan' | 'muted' | 'amber' {
  if (doc.intakeStatus === 'finalized' || doc.status === 'abgeschlossen') return 'green';
  if (doc.status === 'aktiv') return 'cyan';
  if (doc.status === 'entwurf') return 'amber';
  return 'muted';
}

function documentSecondaryLine(doc: ClientDocumentRecord): string {
  const parts = [CLIENT_DOCUMENT_CATEGORY_LABELS[doc.category]];
  const displayFileName = resolveOfficeDocumentDisplayFileName(doc);
  if (displayFileName) parts.push(displayFileName);
  if (doc.documentSource === 'intake') parts.push('Aufnahme');
  else if (doc.documentSource === 'upload') parts.push('Upload');
  return parts.join(' · ');
}

export function ClientRecordDocumentsPanel({
  clientId,
  initialDocuments,
  onRecordRefresh,
}: ClientRecordDocumentsPanelProps) {
  const { profile } = useAuth();
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const isLive = getServiceMode() === 'supabase';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ClientDocumentRecord['category']>('sonstige');
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listClientDocuments(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  const documents = query.data ?? initialDocuments ?? [];
  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.id === selectedDocId) ?? documents[0] ?? null,
    [documents, selectedDocId],
  );

  async function handlePickFile() {
    setActionError(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const fileName = asset.name ?? 'dokument';
    const mimeType = asset.mimeType ?? 'application/octet-stream';

    if (!isLive) {
      setTitle(fileName.replace(/\.[^.]+$/, ''));
      setPickedFile({ name: fileName, mimeType, sizeBytes: asset.size ?? 0, contentBase64: 'demo' });
      return;
    }

    try {
      const response = await fetch(asset.uri);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i] ?? 0);
      }
      setTitle(fileName.replace(/\.[^.]+$/, ''));
      setPickedFile({
        name: fileName,
        mimeType,
        sizeBytes: asset.size ?? bytes.length,
        contentBase64: btoa(binary),
      });
    } catch {
      setActionError('Datei konnte nicht gelesen werden.');
    }
  }

  async function handleUpload() {
    if (!tenantId || isReadOnly || !title.trim() || !pickedFile) return;
    setWorking(true);
    setMessage(null);
    setActionError(null);

    const result = await uploadClientDocument(tenantId, clientId, {
      title: title.trim(),
      category,
      fileName: pickedFile.name,
      mimeType: pickedFile.mimeType,
      sizeBytes: pickedFile.sizeBytes,
      contentBase64: isLive ? pickedFile.contentBase64 : undefined,
      uploadedBy: profile?.id ?? null,
    });

    setWorking(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setTitle('');
    setPickedFile(null);
    setMessage('Dokument hochgeladen.');
    await query.refresh();
    onRecordRefresh?.();
  }

  if (query.loading && documents.length === 0) {
    return <LoadingState message="Dokumente werden geladen…" />;
  }

  if (query.error && documents.length === 0) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  return (
    <View style={styles.panel}>
      {message ? <SuccessState message={message} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}

      <SectionPanel title="Dokumente in Akte" subtitle="Aufnahme, Uploads und finalisierte Unterlagen">
        {documents.length === 0 ? (
          <EmptyState
            title="Keine Dokumente"
            message="Finalisierte Aufnahme-Dokumente und Uploads erscheinen hier."
          />
        ) : (
          documents.map((doc) => (
            <PremiumCard
              key={doc.id}
              style={[styles.card, selectedDoc?.id === doc.id && styles.cardSelected]}
              onPress={() => setSelectedDocId(doc.id)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.primary}>{doc.title}</Text>
                <PremiumBadge label={documentStatusLabel(doc)} variant={documentStatusVariant(doc)} dot />
              </View>
              <Text style={styles.secondary}>{documentSecondaryLine(doc)}</Text>
            </PremiumCard>
          ))
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

      {!isReadOnly ? (
        <SectionPanel title="Dokument hochladen" subtitle="PDF, Bild oder Office-Datei">
          <PremiumInput label="Titel *" value={title} onChangeText={setTitle} />
          <CareCatalogSelect
            catalogKey="document_category"
            label="Kategorie"
            value={category}
            onChange={(value) => setCategory(value as ClientDocumentRecord['category'])}
          />
          <PremiumButton
            title={pickedFile ? `Datei: ${pickedFile.name}` : 'Datei auswählen'}
            variant="secondary"
            onPress={handlePickFile}
          />
          <PremiumButton
            title={working ? 'Speichern…' : 'In Akte speichern'}
            onPress={handleUpload}
            disabled={working || !pickedFile || !title.trim()}
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
  secondary: { ...typography.caption, color: careLightColors.muted, marginTop: spacing.xs },
});
