import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup, InfoBanner, SectionPanel } from '@/components/ui';
import type { DocumentPreviewOutput } from '@/features/documents/templateEngine/documentPreviewRenderer';
import type { PreviewViewMode } from '@/types/documents/documentTemplate';
import { colors, spacing, typography } from '@/theme';

type Props = {
  preview: DocumentPreviewOutput | null;
  viewMode: PreviewViewMode;
  onViewModeChange: (mode: PreviewViewMode) => void;
  pdfPrepared?: boolean;
  pdfEngineAvailable?: boolean;
  loading?: boolean;
};

const VIEW_MODES: { key: PreviewViewMode; label: string }[] = [
  { key: 'mobile', label: 'Mobil' },
  { key: 'desktop', label: 'Desktop' },
  { key: 'print', label: 'Druck' },
];

export function DocumentHtmlPreview({
  preview,
  viewMode,
  onViewModeChange,
  pdfPrepared,
  pdfEngineAvailable,
  loading,
}: Props) {
  return (
    <SectionPanel title="Live-Vorschau" subtitle="Renderer getrennt vom Editor">
      <FilterChipGroup options={VIEW_MODES} value={viewMode} onChange={onViewModeChange} />

      {loading ? <Text style={styles.meta}>Vorschau wird gerendert…</Text> : null}

      {preview?.hasDraftWatermark ? (
        <InfoBanner variant="warning" message="Entwurfswasserzeichen aktiv — nicht finalisieren." />
      ) : null}

      {pdfPrepared && !pdfEngineAvailable ? (
        <InfoBanner variant="info" message="PDF-Vorschau vorbereitet — PDF-Engine folgt." />
      ) : null}

      {preview ? (
        <View style={styles.metaRow}>
          {preview.hasCiColors ? <Text style={styles.badge}>CI-Farben</Text> : null}
          {preview.hasLogo ? <Text style={styles.badge}>Logo</Text> : null}
          {preview.hasFooter ? <Text style={styles.badge}>Footer</Text> : null}
          {preview.hasPageBreaks ? <Text style={styles.badge}>Seitenumbrüche</Text> : null}
        </View>
      ) : null}

      {Platform.OS === 'web' && preview?.html ? (
        <View style={[styles.frame, viewMode === 'mobile' && styles.frameMobile]}>
          {/* eslint-disable-next-line react/no-danger */}
          <iframe
            title="Dokumentvorschau"
            srcDoc={preview.html}
            style={{ width: '100%', height: 480, border: 'none', backgroundColor: '#fff' }}
            sandbox="allow-same-origin"
          />
        </View>
      ) : (
        <ScrollView style={styles.textPreview}>
          <Text style={styles.previewText}>
            {preview?.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000) ??
              'Vorschau starten…'}
          </Text>
        </ScrollView>
      )}

      {preview?.renderResult.unresolvedPlaceholders.length ? (
        <Text style={styles.warning}>
          Fehlende Platzhalter: {preview.renderResult.unresolvedPlaceholders.join(', ')}
        </Text>
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 8, overflow: 'hidden' },
  frameMobile: { maxWidth: 390, alignSelf: 'center', width: '100%' },
  textPreview: { maxHeight: 320, backgroundColor: colors.bgElevated, padding: spacing.sm, borderRadius: 8 },
  previewText: { ...typography.caption, fontFamily: 'monospace' },
  meta: { ...typography.caption, color: colors.textMuted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: {
    ...typography.caption,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    color: colors.primary,
  },
  warning: { ...typography.caption, color: colors.warning },
});
