import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import {
  DocumentHtmlPreview,
  DocumentPreviewValidationPanel,
  DocumentTemplateEditorPanel,
} from '@/components/documents';
import { PreparedTemplateBanner } from '@/components/templates';
import { CareLightPageShell } from '@/components/layout';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  activateDocumentTemplateVersion,
  archiveDocumentTemplate,
  createDocumentTemplateVersion,
  getDocumentTemplateDetail,
  runLivePreview,
  updateDocumentTemplateVersion,
} from '@/lib/documents';
import type { LivePreviewResult, PreviewViewMode } from '@/types/documents/documentTemplate';
import { spacing, typography } from '@/theme';

export function DocumentTemplateEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();

  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [viewMode, setViewMode] = useState<PreviewViewMode>('desktop');
  const [preview, setPreview] = useState<LivePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !id) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return getDocumentTemplateDetail(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  const detail = query.data;
  const version = detail?.draftVersion ?? detail?.activeVersion ?? detail?.versions[0];
  const isArchived = detail?.templateStatus === 'archived' || version?.versionStatus === 'archived';
  const readOnly = isArchived || !can('office.catalogs.edit');

  useEffect(() => {
    if (!detail || !version) return;
    setTitle(detail.title);
    setHtml(version.htmlTemplate);
    setCss(version.cssTemplate);
  }, [detail?.id, version?.id, version?.updatedAt]);

  if (!can('office.catalogs.view')) {
    return (
      <CareLightPageShell title="Vorlageneditor" subtitle={roleLabel ?? ''}>
        <LockedActionBanner message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'} />
      </CareLightPageShell>
    );
  }

  if (query.loading && !detail) {
    return (
      <CareLightPageShell title="Vorlageneditor" subtitle="Wird geladen…">
        <LoadingState message="Vorlage wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !detail) {
    return (
      <CareLightPageShell title="Vorlageneditor" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  if (!detail || !version) {
    return (
      <CareLightPageShell title="Vorlageneditor" subtitle="Nicht gefunden">
        <ErrorState message="Dokumentvorlage nicht gefunden." onRetry={() => router.back()} />
      </CareLightPageShell>
    );
  }

  const handleSave = async () => {
    if (!tenantId || readOnly) return;
    setError(null);
    const result = await updateDocumentTemplateVersion(
      tenantId,
      version.id,
      { htmlTemplate: html, cssTemplate: css, requiredFields: version.requiredFields },
      profile?.roleKey,
    );
    if (result.ok) {
      setMessage('Entwurf gespeichert.');
      setPreview(null);
      await query.refresh();
    } else {
      setError(result.error);
    }
  };

  const handlePreview = async () => {
    if (!tenantId) return;
    setPreviewLoading(true);
    setError(null);
    const result = await runLivePreview(
      {
        tenantId,
        templateId: detail.id,
        versionId: version.id,
        sampleId: 'sample-demo',
        viewMode,
        showDraftWatermark: version.versionStatus === 'draft',
      },
      profile?.roleKey,
    );
    setPreviewLoading(false);
    if (result.ok) {
      setPreview(result.data);
    } else {
      setError(result.error);
    }
  };

  const handleActivate = async () => {
    if (!tenantId) return;
    const result = await activateDocumentTemplateVersion(tenantId, version.id, profile?.roleKey);
    if (result.ok) {
      setMessage('Vorlage aktiviert.');
      await query.refresh();
    } else {
      setError(result.error);
    }
  };

  const handleNewVersion = async () => {
    if (!tenantId) return;
    const result = await createDocumentTemplateVersion(tenantId, detail.id, profile?.roleKey);
    if (result.ok) {
      setMessage(`Version ${result.data.versionNumber} erstellt.`);
      await query.refresh();
    } else {
      setError(result.error);
    }
  };

  const handleArchive = async () => {
    if (!tenantId) return;
    const result = await archiveDocumentTemplate(tenantId, detail.id, profile?.roleKey);
    if (result.ok) {
      setMessage('Vorlage archiviert.');
      await query.refresh();
    } else {
      setError(result.error);
    }
  };

  const previewOutput = preview
    ? {
        html: preview.html,
        renderResult: preview.renderResult,
        viewMode: preview.viewMode,
        hasDraftWatermark: preview.html.includes('cs-draft-watermark'),
        hasPageBreaks: preview.html.includes('page-break'),
        hasCiColors: preview.html.includes('--cs-primary'),
        hasLogo: preview.html.includes('cs-logo'),
        hasFooter: preview.html.includes('cs-footer'),
      }
    : null;

  return (
    <CareLightPageShell title="Vorlageneditor" subtitle={detail.title}>
      <ScrollView contentContainerStyle={styles.content}>
        <PreparedTemplateBanner />
        {isArchived ? (
          <InfoBanner
            variant="warning"
            message="Archivierte Vorlage — nur Lesen, Kopieren/Versionieren möglich."
          />
        ) : null}
        <Text style={styles.meta}>
          Version {version.versionNumber} · {version.versionStatus}
          {version.lastPreviewValid ? ' · Vorschau OK' : ' · Vorschau ausstehend'}
        </Text>

        <DocumentTemplateEditorPanel
          title={title}
          htmlTemplate={html}
          cssTemplate={css}
          onTitleChange={setTitle}
          onHtmlChange={setHtml}
          onCssChange={setCss}
          readOnly={readOnly}
        />

        <PremiumButton title="Live-Vorschau rendern" onPress={handlePreview} loading={previewLoading} />

        <DocumentHtmlPreview
          preview={previewOutput}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          pdfPrepared={preview?.pdfPrepared}
          pdfEngineAvailable={preview?.pdfEngineAvailable}
          loading={previewLoading}
        />

        <DocumentPreviewValidationPanel
          renderResult={preview?.renderResult ?? null}
          finalizeBlocked={!version.lastPreviewValid}
          onFinalize={handleActivate}
          finalizeLabel="Version aktiv setzen"
        />

        {message ? <SuccessState message={message} /> : null}
        {error ? <ErrorState message={error} /> : null}

        {!readOnly ? (
          <>
            <PremiumButton title="Entwurf speichern" variant="secondary" onPress={handleSave} />
            <PremiumButton title="Neue Version erstellen" variant="secondary" onPress={handleNewVersion} />
          </>
        ) : (
          <PremiumButton title="Neue Version aus Archiv" onPress={handleNewVersion} />
        )}
        {can('office.catalogs.edit') && !isArchived ? (
          <PremiumButton title="Archivieren" variant="secondary" onPress={handleArchive} />
        ) : null}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  meta: { ...typography.caption, color: '#64748b' },
});
