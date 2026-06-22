import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { buildDocumentPreviewFallbackLabel } from '@/lib/office/officeDocumentDisplay';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';

type DocumentHtmlPreviewProps = {
  title: string;
  previewHtml?: string | null;
  fallbackLabel?: string | null;
};

export function DocumentHtmlPreview({ title, previewHtml, fallbackLabel }: DocumentHtmlPreviewProps) {
  const content = useAdaptiveContentStyles();
  const { colors } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        previewFrame: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderSoft,
          borderRadius: 8,
          overflow: 'hidden',
        },
        textPreview: {
          maxHeight: 320,
          backgroundColor: colors.bgElevated,
          padding: spacing.sm,
          borderRadius: 8,
        },
        previewText: { ...content.caption, color: colors.textPrimary },
        previewMeta: content.caption,
      }),
    [colors, content],
  );

  if (!previewHtml) {
    return (
      <Text style={styles.previewMeta}>
        {fallbackLabel ?? DOCUMENT_PREVIEW_UNAVAILABLE_LABEL}
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

const DOCUMENT_PREVIEW_UNAVAILABLE_LABEL = 'Keine HTML-Vorschau verfügbar.';
