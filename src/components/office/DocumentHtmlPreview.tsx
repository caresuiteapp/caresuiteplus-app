import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildDocumentPreviewFallbackLabel } from '@/lib/office/officeDocumentDisplay';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { careLightColors } from '@/design/tokens/lightTheme';
import { spacing, typography } from '@/theme';

type DocumentHtmlPreviewProps = {
  title: string;
  previewHtml?: string | null;
  fallbackLabel?: string | null;
};

export function DocumentHtmlPreview({ title, previewHtml, fallbackLabel }: DocumentHtmlPreviewProps) {
  if (!previewHtml) {
    return (
      <Text style={styles.previewMeta}>
        {fallbackLabel ?? 'Keine Vorschau verfügbar.'}
      </Text>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.previewFrame}>
        {/* eslint-disable-next-line react/no-danger */}
        <iframe
          title={title}
          srcDoc={previewHtml}
          style={{ width: '100%', height: 360, border: 'none', backgroundColor: '#fff' }}
          sandbox="allow-same-origin"
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.textPreview}>
      <Text style={styles.previewText}>
        {previewHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2500)}
      </Text>
    </ScrollView>
  );
}

export function documentPreviewFallback(document: PortalDocumentListItem): string {
  return buildDocumentPreviewFallbackLabel(document);
}

const styles = StyleSheet.create({
  previewFrame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: careLightColors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  textPreview: {
    maxHeight: 320,
    backgroundColor: careLightColors.page,
    padding: spacing.sm,
    borderRadius: 8,
  },
  previewText: { ...typography.caption, color: careLightColors.text },
  previewMeta: { ...typography.caption, color: careLightColors.muted },
});
