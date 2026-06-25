import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { PlatformModal } from '@/components/layout/platform';
import { EmptyState, ErrorState, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { SYSTEM_DOCUMENT_CATALOG_TEMPLATES } from '@/data/seeds/documentCatalog';
import { buildDocumentPreview } from '@/features/documents/templateEngine';
import { buildDocumentContext } from '@/features/documents/templateEngine/documentContext';
import type { DocumentEntityType } from '@/features/documents/templateEngine/types';
import { useDocumentModuleTemplates } from '@/hooks/documents/useDocumentModuleTemplates';
import { useAuth } from '@/lib/auth/context';
import {
  createGeneratedDocument,
  finalizeGeneratedDocument,
} from '@/lib/documents/documentEngineService';
import { runLivePreview } from '@/lib/documents/documentTemplateService';
import { fetchTenantDocumentSettings, mergeTenantSettingsIntoContext } from '@/lib/documents/tenantDocumentSettingsService';
import { renderHtmlToPdfBytes } from '@/lib/documents/documentPdfService';
import type { DocumentEngineTemplateListItem } from '@/types/documents/documentEngine';
import type { DocumentTemplateTypeKey } from '@/features/documents/templateEngine/types';
import { spacing, typography } from '@/theme';

export type DocumentModuleTemplatesPanelProps = {
  tenantId: string | null | undefined;
  targetModule: string;
  targetArea: string;
  triggerEvent?: string;
  clientId?: string | null;
  employeeId?: string | null;
  assignmentId?: string | null;
  assistOnly?: boolean;
  title?: string;
  subtitle?: string;
};

function resolveEntityContext(props: DocumentModuleTemplatesPanelProps): {
  entityType: DocumentEntityType;
  entityId: string;
} {
  if (props.assignmentId) return { entityType: 'service_record', entityId: props.assignmentId };
  if (props.clientId) return { entityType: 'client', entityId: props.clientId };
  return { entityType: 'client', entityId: 'client-001' };
}

async function buildModuleDocumentHtml(
  tenantId: string,
  template: DocumentEngineTemplateListItem,
  actorRoleKey: string | null | undefined,
  entityType: DocumentEntityType,
  entityId: string,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  if (!template.id.startsWith('catalog-')) {
    const live = await runLivePreview(
      { tenantId, templateId: template.id, sampleId: 'sample-demo' },
      actorRoleKey,
    );
    if (live.ok) return { ok: true, html: live.data.html };
  }

  const catalogEntry = SYSTEM_DOCUMENT_CATALOG_TEMPLATES.find((t) => t.templateKey === template.templateKey);
  if (!catalogEntry) {
    return { ok: false, error: 'Katalogvorlage nicht gefunden.' };
  }

  const contextResult = await buildDocumentContext(entityType, entityId, tenantId);
  if (!contextResult.ok) return { ok: false, error: contextResult.error };

  const settingsResult = await fetchTenantDocumentSettings(tenantId, actorRoleKey);
  const settings = settingsResult.ok ? settingsResult.data : null;
  const context = settings
    ? mergeTenantSettingsIntoContext(contextResult.context, settings)
    : contextResult.context;

  const preview = buildDocumentPreview({
    templateVersion: {
      htmlTemplate: catalogEntry.htmlTemplate,
      cssTemplate: catalogEntry.cssTemplate,
      requiredFields: (catalogEntry.manualFields ?? []).map((f) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        dataPath: `manual.${f.fieldKey}`,
        isRequired: false,
      })),
    },
    context,
    documentType: (catalogEntry.templateType as DocumentTemplateTypeKey) ?? 'generic',
    tenantDocumentSettings: settings,
    showDraftWatermark: true,
  });

  return { ok: true, html: preview.html };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary);
}

export function DocumentModuleTemplatesPanel(props: DocumentModuleTemplatesPanelProps) {
  const { profile } = useAuth();
  const { templates, loading, error } = useDocumentModuleTemplates({
    tenantId: props.tenantId,
    targetModule: props.targetModule,
    targetArea: props.targetArea,
    triggerEvent: props.triggerEvent,
    assistOnly: props.assistOnly,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? templates[0] ?? null,
    [templates, selectedId],
  );

  const entity = useMemo(() => resolveEntityContext(props), [props]);

  const ensureHtml = useCallback(async (): Promise<string | null> => {
    if (!props.tenantId || !selected) return null;
    const built = await buildModuleDocumentHtml(
      props.tenantId,
      selected,
      profile?.roleKey,
      entity.entityType,
      entity.entityId,
    );
    if (!built.ok) {
      setActionError(built.error);
      return null;
    }
    return built.html;
  }, [props.tenantId, selected, profile?.roleKey, entity]);

  const handleLivePreview = useCallback(async () => {
    if (!selected) return;
    setActionLoading(true);
    setActionError(null);
    setStatusMessage(null);
    const html = await ensureHtml();
    setActionLoading(false);
    if (html) {
      setPreviewHtml(html);
      setPreviewVisible(true);
    }
  }, [selected, ensureHtml]);

  const handleCreateDraft = useCallback(
    async (html: string) => {
      if (!props.tenantId || !selected) return null;
      const created = await createGeneratedDocument(
        {
          tenantId: props.tenantId,
          templateId: selected.id,
          title: selected.name,
          htmlOutput: html,
          clientId: props.clientId ?? null,
          employeeId: props.employeeId ?? null,
          assignmentId: props.assignmentId ?? null,
        },
        profile?.roleKey,
      );
      if (!created.ok) {
        setActionError(created.error);
        return null;
      }
      setDraftDocumentId(created.data.id);
      return created.data.id;
    },
    [props, selected, profile?.roleKey],
  );

  const handleGeneratePdf = useCallback(async () => {
    if (!props.tenantId || !selected) return;
    setActionLoading(true);
    setActionError(null);
    setStatusMessage(null);
    const html = await ensureHtml();
    if (!html) {
      setActionLoading(false);
      return;
    }
    const docId = draftDocumentId ?? (await handleCreateDraft(html));
    if (!docId) {
      setActionLoading(false);
      return;
    }
    let pdfBase64: string | undefined;
    try {
      pdfBase64 = bytesToBase64(await renderHtmlToPdfBytes(html));
    } catch {
      /* edge fallback in finalize */
    }
    const finalized = await finalizeGeneratedDocument(
      {
        tenantId: props.tenantId,
        documentId: docId,
        pdfBase64,
        archivedInArea: selected.defaultStorageArea ?? 'allgemein',
        clientId: props.clientId ?? null,
        employeeId: props.employeeId ?? null,
      },
      profile?.roleKey,
    );
    setActionLoading(false);
    if (finalized.ok) {
      setStatusMessage(`PDF erzeugt: ${finalized.data.fileName ?? selected.shortName ?? selected.name}`);
    } else {
      setActionError(finalized.error);
    }
  }, [props, selected, ensureHtml, draftDocumentId, handleCreateDraft, profile?.roleKey]);

  const handleArchive = useCallback(async () => {
    if (!props.tenantId || !selected) return;
    setActionLoading(true);
    setActionError(null);
    setStatusMessage(null);
    const html = await ensureHtml();
    if (!html) {
      setActionLoading(false);
      return;
    }
    const docId = draftDocumentId ?? (await handleCreateDraft(html));
    if (!docId) {
      setActionLoading(false);
      return;
    }
    const finalized = await finalizeGeneratedDocument(
      {
        tenantId: props.tenantId,
        documentId: docId,
        archivedInArea: selected.defaultStorageArea ?? 'allgemein',
        clientId: props.clientId ?? null,
        employeeId: props.employeeId ?? null,
      },
      profile?.roleKey,
    );
    setActionLoading(false);
    if (finalized.ok) {
      setStatusMessage(`In Akte gespeichert (${selected.defaultStorageArea ?? 'allgemein'}).`);
    } else {
      setActionError(finalized.error);
    }
  }, [props, selected, ensureHtml, draftDocumentId, handleCreateDraft, profile?.roleKey]);

  if (!props.tenantId) {
    return <InfoBanner message="Mandant fehlt — Dokumentvorlagen nicht verfügbar." />;
  }

  if (loading) {
    return <LoadingState message="Dokumentvorlagen werden geladen…" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (templates.length === 0) {
    return <EmptyState title="Keine Vorlagen" message="Für diesen Modulkontext sind keine Vorlagen hinterlegt." />;
  }

  return (
    <SectionPanel title={props.title ?? 'Dokumentvorlagen'} subtitle={props.subtitle ?? 'Aus Dokument-Engine'}>
      {statusMessage ? <InfoBanner message={statusMessage} /> : null}
      {actionError ? <InfoBanner message={actionError} variant="error" /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chipRow}>
          {templates.map((tpl) => {
            const active = (selected?.id ?? templates[0]?.id) === tpl.id;
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  setSelectedId(tpl.id);
                  setDraftDocumentId(null);
                  setStatusMessage(null);
                  setActionError(null);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {tpl.shortName ?? tpl.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {selected ? (
        <Text style={styles.templateMeta}>
          {selected.name}
          {selected.layoutFamily ? ` · ${selected.layoutFamily}` : ''}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PremiumButton
          title="Live-Vorschau"
          variant="secondary"
          size="sm"
          loading={actionLoading}
          disabled={!selected}
          onPress={() => void handleLivePreview()}
        />
        <PremiumButton
          title="PDF erzeugen"
          size="sm"
          loading={actionLoading}
          disabled={!selected}
          onPress={() => void handleGeneratePdf()}
        />
        <PremiumButton
          title="In Akte speichern"
          size="sm"
          loading={actionLoading}
          disabled={!selected || !props.clientId}
          onPress={() => void handleArchive()}
        />
      </View>

      <PlatformModal
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        title={selected?.name ?? 'Vorschau'}
        wide
      >
        <DocumentHtmlPreview
          title={selected?.name ?? 'Vorschau'}
          previewHtml={previewHtml}
        />
        <View style={styles.modalFooter}>
          <PremiumButton title="Schließen" variant="secondary" onPress={() => setPreviewVisible(false)} />
        </View>
      </PlatformModal>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  chipScroll: { marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(130,170,255,0.35)',
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37,99,235,0.15)',
  },
  chipText: { ...typography.caption },
  chipTextActive: { fontWeight: '600', color: '#2563eb' },
  templateMeta: { ...typography.caption, marginBottom: spacing.sm, opacity: 0.85 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modalFooter: { marginTop: spacing.md },
});
