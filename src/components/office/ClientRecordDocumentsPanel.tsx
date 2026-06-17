import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { buildClientDocumentPreviewFallback, resolveOfficeDocumentDisplayFileName } from '@/lib/office/officeDocumentDisplay';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import {
  CLIENT_DOCUMENT_ALL_CATEGORY_KEY,
  buildClientDocumentCategoryOverview,
  filterClientDocumentsByCategory,
  getClientDocumentCategoryLabel,
  resolveClientDocumentCategoryKey,
  type ClientDocumentCategorySummary,
} from '@/lib/clients/clientDocumentCategories';
import { listClientDocuments, uploadClientDocument } from '@/lib/clients/clientDocumentsService';
import {
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

type DocumentsView = 'overview' | 'category' | 'document';

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
  const parts = [getClientDocumentCategoryLabel(resolveClientDocumentCategoryKey(doc))];
  const displayFileName = resolveOfficeDocumentDisplayFileName(doc);
  if (displayFileName) parts.push(displayFileName);
  if (doc.documentSource === 'intake') parts.push('Aufnahme');
  else if (doc.documentSource === 'upload') parts.push('Upload');
  return parts.join(' · ');
}

type DocumentBreadcrumbProps = {
  categoryKey: string | null;
  documentTitle?: string | null;
  onNavigateOverview: () => void;
  onNavigateCategory: () => void;
};

function DocumentBreadcrumb({
  categoryKey,
  documentTitle,
  onNavigateOverview,
  onNavigateCategory,
}: DocumentBreadcrumbProps) {
  const segments: { label: string; onPress?: () => void }[] = [{ label: 'Dokumente', onPress: onNavigateOverview }];
  if (categoryKey) {
    segments.push({
      label: getClientDocumentCategoryLabel(categoryKey),
      onPress: documentTitle ? onNavigateCategory : undefined,
    });
  }
  if (documentTitle) {
    segments.push({ label: documentTitle });
  }

  return (
    <View style={styles.breadcrumbRow}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <View key={`${segment.label}-${index}`} style={styles.breadcrumbSegment}>
            {segment.onPress && !isLast ? (
              <Pressable onPress={segment.onPress} hitSlop={6}>
                <Text style={styles.breadcrumbLink}>{segment.label}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.breadcrumbText, isLast && styles.breadcrumbCurrent]}>{segment.label}</Text>
            )}
            {!isLast ? <Text style={styles.breadcrumbSep}> › </Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function CategoryOverviewCard({
  summary,
  onPress,
}: {
  summary: ClientDocumentCategorySummary;
  onPress: () => void;
}) {
  return (
    <PremiumCard style={styles.categoryCard} onPress={onPress}>
      <Text style={styles.categoryLabel}>{summary.label}</Text>
      <PremiumBadge
        label={String(summary.count)}
        variant={summary.count > 0 ? 'cyan' : 'muted'}
      />
    </PremiumCard>
  );
}

function DocumentListItem({
  doc,
  selected,
  onPress,
}: {
  doc: ClientDocumentRecord;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PremiumCard
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.primary}>{doc.title}</Text>
        <PremiumBadge label={documentStatusLabel(doc)} variant={documentStatusVariant(doc)} dot />
      </View>
      <Text style={styles.secondary}>{documentSecondaryLine(doc)}</Text>
    </PremiumCard>
  );
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

  const [view, setView] = useState<DocumentsView>('overview');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('sonstiges');
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
  const categoryOverview = useMemo(
    () => buildClientDocumentCategoryOverview(documents),
    [documents],
  );
  const visibleDocuments = useMemo(() => {
    if (view === 'overview') return [];
    if (!activeCategory) return documents;
    return filterClientDocumentsByCategory(documents, activeCategory);
  }, [view, activeCategory, documents]);
  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.id === selectedDocId) ?? null,
    [documents, selectedDocId],
  );

  useEffect(() => {
    if (view === 'category' && activeCategory && activeCategory !== CLIENT_DOCUMENT_ALL_CATEGORY_KEY) {
      setCategory(activeCategory);
    }
  }, [view, activeCategory]);

  function openOverview() {
    setView('overview');
    setActiveCategory(null);
    setSelectedDocId(null);
  }

  function openCategory(categoryKey: string) {
    setView('category');
    setActiveCategory(categoryKey);
    setSelectedDocId(null);
  }

  function openDocument(docId: string) {
    setSelectedDocId(docId);
    setView('document');
  }

  function backToCategoryList() {
    setView('category');
    setSelectedDocId(null);
  }

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

  const categoryTitle = activeCategory
    ? getClientDocumentCategoryLabel(activeCategory)
    : 'Dokumente';

  return (
    <View style={styles.panel}>
      {message ? <SuccessState message={message} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}

      {view !== 'overview' ? (
        <DocumentBreadcrumb
          categoryKey={activeCategory}
          documentTitle={view === 'document' ? selectedDoc?.title : null}
          onNavigateOverview={openOverview}
          onNavigateCategory={backToCategoryList}
        />
      ) : null}

      {view === 'overview' ? (
        <SectionPanel title="Dokumente" subtitle="Nach Kategorie filtern — Aufnahme, Uploads und finalisierte Unterlagen">
          {documents.length === 0 ? (
            <EmptyState
              title="Keine Dokumente"
              message="Finalisierte Aufnahme-Dokumente und Uploads erscheinen hier."
            />
          ) : (
            <>
              <CategoryOverviewCard
                summary={{
                  key: CLIENT_DOCUMENT_ALL_CATEGORY_KEY,
                  label: 'Alle Dokumente',
                  count: documents.length,
                }}
                onPress={() => openCategory(CLIENT_DOCUMENT_ALL_CATEGORY_KEY)}
              />
              <View style={styles.categoryGrid}>
                {categoryOverview.map((summary) => (
                  <CategoryOverviewCard
                    key={summary.key}
                    summary={summary}
                    onPress={() => openCategory(summary.key)}
                  />
                ))}
              </View>
            </>
          )}
        </SectionPanel>
      ) : null}

      {view === 'category' ? (
        <SectionPanel
          title={categoryTitle}
          subtitle={
            activeCategory === CLIENT_DOCUMENT_ALL_CATEGORY_KEY
              ? 'Alle Dokumente in der Akte'
              : 'Dokumente in dieser Kategorie'
          }
        >
          {visibleDocuments.length === 0 ? (
            <EmptyState
              title="Keine Dokumente in dieser Kategorie"
              message="Laden Sie ein Dokument hoch oder wählen Sie eine andere Kategorie."
            />
          ) : (
            visibleDocuments.map((doc) => (
              <DocumentListItem
                key={doc.id}
                doc={doc}
                selected={false}
                onPress={() => openDocument(doc.id)}
              />
            ))
          )}
        </SectionPanel>
      ) : null}

      {view === 'document' && selectedDoc ? (
        <SectionPanel title="Vorschau" subtitle={selectedDoc.title}>
          <DocumentHtmlPreview
            title={selectedDoc.title}
            previewHtml={selectedDoc.previewHtml}
            fallbackLabel={buildClientDocumentPreviewFallback(selectedDoc)}
          />
          <PremiumButton title="Zurück zur Liste" variant="secondary" onPress={backToCategoryList} />
        </SectionPanel>
      ) : null}

      {!isReadOnly && view !== 'overview' ? (
        <SectionPanel
          title="Dokument hochladen"
          subtitle={
            activeCategory && activeCategory !== CLIENT_DOCUMENT_ALL_CATEGORY_KEY
              ? `Wird der Kategorie „${getClientDocumentCategoryLabel(activeCategory)}“ zugeordnet`
              : 'PDF, Bild oder Office-Datei'
          }
        >
          <PremiumInput label="Titel *" value={title} onChangeText={setTitle} />
          <CareCatalogSelect
            catalogKey="document_category"
            label="Kategorie"
            value={category}
            onChange={setCategory}
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

      {!isReadOnly && view === 'overview' && documents.length === 0 ? (
        <SectionPanel title="Dokument hochladen" subtitle="PDF, Bild oder Office-Datei">
          <PremiumInput label="Titel *" value={title} onChangeText={setTitle} />
          <CareCatalogSelect
            catalogKey="document_category"
            label="Kategorie"
            value={category}
            onChange={setCategory}
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
  breadcrumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  breadcrumbSegment: { flexDirection: 'row', alignItems: 'center' },
  breadcrumbLink: { ...typography.caption, color: careLightColors.cyan, fontWeight: '600' },
  breadcrumbText: { ...typography.caption, color: careLightColors.muted },
  breadcrumbCurrent: { color: careLightColors.navy, fontWeight: '600' },
  breadcrumbSep: { ...typography.caption, color: careLightColors.muted, opacity: 0.6 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: '47%',
    flexGrow: 1,
    marginBottom: spacing.sm,
  },
  categoryLabel: { ...typography.label, flex: 1, marginRight: careSpacing.sm },
  card: { marginBottom: spacing.sm },
  cardSelected: { borderColor: careLightColors.orange, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: careSpacing.sm },
  primary: { ...typography.label, flex: 1 },
  secondary: { ...typography.caption, color: careLightColors.muted, marginTop: spacing.xs },
});
