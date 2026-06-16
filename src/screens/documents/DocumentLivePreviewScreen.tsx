import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { DocumentHtmlPreview, DocumentPreviewValidationPanel } from '@/components/documents';
import { PreparedTemplateBanner } from '@/components/templates';
import { CareLightPageShell } from '@/components/layout';
import {
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  PREVIEW_SAMPLE_OPTIONS,
  getDocumentTemplateDetail,
  listDocumentTemplates,
  runLivePreview,
} from '@/lib/documents';
import type { LivePreviewResult, PreviewViewMode } from '@/types/documents/documentTemplate';
import { spacing } from '@/theme';

export function DocumentLivePreviewScreen() {
  const params = useLocalSearchParams<{ templateId?: string }>();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();

  const [templateId, setTemplateId] = useState(params.templateId ?? '');
  const [sampleId, setSampleId] = useState(PREVIEW_SAMPLE_OPTIONS[0]!.id);
  const [viewMode, setViewMode] = useState<PreviewViewMode>('desktop');
  const [preview, setPreview] = useState<LivePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templatesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listDocumentTemplates(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  useEffect(() => {
    if (!templateId && templatesQuery.data?.[0]) {
      setTemplateId(templatesQuery.data[0].id);
    }
  }, [templatesQuery.data, templateId]);

  if (!can('office.catalogs.view')) {
    return (
      <CareLightPageShell title="Live-Vorschau" subtitle={roleLabel ?? ''}>
        <LockedActionBanner message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'} />
      </CareLightPageShell>
    );
  }

  const templateOptions =
    templatesQuery.data?.map((t) => ({ key: t.id, label: t.title })) ?? [];

  const sampleOptions = PREVIEW_SAMPLE_OPTIONS.map((s) => ({ key: s.id, label: s.label }));

  const handleRender = async () => {
    if (!tenantId || !templateId) return;
    setLoading(true);
    setError(null);
    const result = await runLivePreview(
      { tenantId, templateId, sampleId, viewMode, showDraftWatermark: true },
      profile?.roleKey,
    );
    setLoading(false);
    if (result.ok) setPreview(result.data);
    else setError(result.error);
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
    <CareLightPageShell title="Live-Vorschau" subtitle="Vorlagen & Dokumente">
      <ScrollView contentContainerStyle={styles.content}>
        <PreparedTemplateBanner />

        {templatesQuery.loading ? <LoadingState message="Vorlagen werden geladen…" /> : null}

        <SectionPanel title="Datensatz wählen">
          {templateOptions.length ? (
            <FilterChipGroup options={templateOptions} value={templateId} onChange={setTemplateId} />
          ) : null}
          <FilterChipGroup options={sampleOptions} value={sampleId} onChange={setSampleId} />
        </SectionPanel>

        <PremiumButton title="Vorschau sofort rendern" onPress={handleRender} loading={loading} />

        {error ? <ErrorState message={error} /> : null}

        <DocumentHtmlPreview
          preview={previewOutput}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          pdfPrepared={preview?.pdfPrepared}
          pdfEngineAvailable={preview?.pdfEngineAvailable}
          loading={loading}
        />

        <DocumentPreviewValidationPanel renderResult={preview?.renderResult ?? null} />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
});
