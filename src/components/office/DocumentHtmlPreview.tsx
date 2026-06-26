import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import { buildDocumentPreviewFallbackLabel } from '@/lib/office/officeDocumentDisplay';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { breakpoints } from '@/design/tokens/breakpoints';
import { spacing } from '@/theme';

function resolvePreviewHeight(viewportHeight: number, isCompact: boolean): number {
  const vhRatio = isCompact ? 0.6 : 0.7;
  const minPx = isCompact ? 480 : 560;
  return Math.max(minPx, Math.round(viewportHeight * vhRatio));
}

type DocumentHtmlPreviewProps = {
  title: string;
  previewHtml?: string | null;
  fallbackLabel?: string | null;
};

export function DocumentHtmlPreview({ title, previewHtml, fallbackLabel }: DocumentHtmlPreviewProps) {
  const content = useAdaptiveContentStyles();
  const { colors } = useLegacyTheme();
  const { width, height } = useWindowDimensions();
  const isCompact = width < breakpoints.tablet;
  const previewHeight = resolvePreviewHeight(height, isCompact);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        previewFrame: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderSoft,
          borderRadius: 8,
          overflow: 'hidden',
          width: '100%',
          maxWidth: '100%',
          alignSelf: 'stretch',
          flex: 1,
          minHeight: previewHeight,
        },
        textPreview: {
          minHeight: previewHeight,
          flex: 1,
          backgroundColor: colors.bgElevated,
          padding: spacing.sm,
          borderRadius: 8,
          width: '100%',
          maxWidth: '100%',
        },
        previewText: { ...content.caption, color: colors.textPrimary },
        previewMeta: content.caption,
      }),
    [colors, content, previewHeight],
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
          style={{
            width: '100%',
            maxWidth: '100%',
            height: previewHeight,
            minHeight: previewHeight,
            border: 'none',
            backgroundColor: '#fff',
            display: 'block',
            boxSizing: 'border-box',
          }}
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
