import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumBadge, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing, radius, typography } from '@/theme';
import {
  parseVisitInternalAttachments,
  resolveVisitInternalAttachmentUrl,
  visitInternalAttachmentIcon,
  visitInternalAttachmentPreviewMode,
  type VisitInternalAttachment,
} from '@/lib/assist/visitInternalAttachmentService';

type AttachmentUrlState = {
  url: string | null;
  loading: boolean;
  error: string | null;
};

type PreviewState = {
  attachment: VisitInternalAttachment;
  url: string;
  mode: 'image' | 'pdf' | 'download';
};

type VisitInternalAttachmentsPanelProps = {
  storagePaths: string[];
};

const FORM_CTX = { viewContext: 'form' as const };

export function VisitInternalAttachmentsPanel({ storagePaths }: VisitInternalAttachmentsPanelProps) {
  const text = useAuroraAdaptiveText();
  const assistAccent = moduleColor('assist');
  const { width: screenWidth } = useWindowDimensions();
  const attachments = useMemo(() => parseVisitInternalAttachments(storagePaths), [storagePaths]);
  const [urlByPath, setUrlByPath] = useState<Record<string, AttachmentUrlState>>({});
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: spacing.xs,
          marginBottom: spacing.sm,
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        tile: {
          width: 112,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: 'rgba(15,23,42,0.12)',
          overflow: 'hidden',
          backgroundColor: 'rgba(15,23,42,0.04)',
        },
        thumb: {
          width: '100%',
          height: 84,
          backgroundColor: 'rgba(15,23,42,0.06)',
        },
        tileMeta: {
          paddingHorizontal: spacing.xs,
          paddingVertical: 6,
          gap: 2,
        },
        tileName: {
          ...typography.caption,
          color: text.primary,
        },
        tileHint: {
          ...typography.caption,
          color: text.muted,
          fontSize: 11,
        },
        docRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: 'rgba(15,23,42,0.12)',
          backgroundColor: 'rgba(15,23,42,0.03)',
        },
        docName: {
          ...typography.body,
          color: text.primary,
          flex: 1,
        },
        loadingBox: {
          width: '100%',
          height: 84,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
        },
        errorText: {
          ...typography.caption,
          color: '#DC2626',
        },
        previewImage: {
          width: '100%',
          minHeight: 240,
          maxHeight: Math.min(screenWidth * 0.75, 640),
        },
        pdfHint: {
          ...typography.body,
          color: text.secondary,
        },
      }),
    [screenWidth, text],
  );

  const loadUrl = useCallback(async (attachment: VisitInternalAttachment, force = false) => {
    const key = attachment.storagePath;
    let shouldLoad = force;
    setUrlByPath((prev) => {
      const current = prev[key];
      if (!force && (current?.loading || current?.url || current?.error)) {
        shouldLoad = false;
        return prev;
      }
      shouldLoad = true;
      return {
        ...prev,
        [key]: { url: null, loading: true, error: null },
      };
    });
    if (!shouldLoad) return;

    const url = await resolveVisitInternalAttachmentUrl(attachment.storagePath);
    setUrlByPath((prev) => ({
      ...prev,
      [key]: {
        url,
        loading: false,
        error: url ? null : 'Anhang nicht verfügbar',
      },
    }));
  }, []);

  useEffect(() => {
    for (const attachment of attachments) {
      void loadUrl(attachment);
    }
  }, [attachments, loadUrl]);

  const openAttachment = useCallback(
    async (attachment: VisitInternalAttachment) => {
      const state = urlByPath[attachment.storagePath];
      let url = state?.url;
      if (!url) {
        url = await resolveVisitInternalAttachmentUrl(attachment.storagePath);
        setUrlByPath((prev) => ({
          ...prev,
          [attachment.storagePath]: {
            url,
            loading: false,
            error: url ? null : 'Anhang nicht verfügbar',
          },
        }));
      }
      if (!url) return;

      const mode = visitInternalAttachmentPreviewMode(attachment.mimeType);
      if (mode === 'download') {
        void Linking.openURL(url);
        return;
      }
      setPreview({ attachment, url, mode });
    },
    [urlByPath],
  );

  if (attachments.length === 0) return null;

  const imageAttachments = attachments.filter((item) => visitInternalAttachmentPreviewMode(item.mimeType) === 'image');
  const otherAttachments = attachments.filter((item) => visitInternalAttachmentPreviewMode(item.mimeType) !== 'image');

  return (
    <>
      <SectionPanel
        {...FORM_CTX}
        title="Interne Anhänge"
        subtitle="Fotos und Dokumente aus der Durchführung — nicht im Klientenportal"
        accentColor={assistAccent}
      >
        <View style={styles.headerRow}>
          <PremiumBadge label="Intern" variant="purple" dot />
          <PremiumBadge
            label={attachments.length === 1 ? '1 Datei' : `${attachments.length} Dateien`}
            variant="cyan"
          />
        </View>

        {imageAttachments.length > 0 ? (
          <View style={styles.grid}>
            {imageAttachments.map((attachment) => {
              const urlState = urlByPath[attachment.storagePath];
              return (
                <Pressable
                  key={attachment.storagePath}
                  style={styles.tile}
                  onPress={() => void openAttachment(attachment)}
                  accessibilityRole="button"
                  accessibilityLabel={`Anhang öffnen: ${attachment.fileName}`}
                >
                  {urlState?.loading ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="small" color={assistAccent} />
                      <Text style={styles.tileHint}>Lädt…</Text>
                    </View>
                  ) : urlState?.url ? (
                    <Image
                      source={{ uri: urlState.url }}
                      style={styles.thumb}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={styles.loadingBox}>
                      <Text style={styles.errorText}>{urlState?.error ?? 'Nicht verfügbar'}</Text>
                    </View>
                  )}
                  <View style={styles.tileMeta}>
                    <Text style={styles.tileName} numberOfLines={1}>
                      {attachment.fileName}
                    </Text>
                    <Text style={styles.tileHint}>Tippen zum Öffnen</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {otherAttachments.length > 0 ? (
          <View style={{ gap: careSpacing.sm, marginTop: imageAttachments.length > 0 ? careSpacing.sm : 0 }}>
            {otherAttachments.map((attachment) => {
              const urlState = urlByPath[attachment.storagePath];
              return (
                <Pressable
                  key={attachment.storagePath}
                  style={styles.docRow}
                  onPress={() => void openAttachment(attachment)}
                  accessibilityRole="button"
                  accessibilityLabel={`Anhang öffnen: ${attachment.fileName}`}
                >
                  <Text style={styles.docName} numberOfLines={2}>
                    {visitInternalAttachmentIcon(attachment.mimeType)} {attachment.fileName}
                  </Text>
                  {urlState?.loading ? <ActivityIndicator size="small" color={assistAccent} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </SectionPanel>

      <PlatformModal
        visible={!!preview}
        title={preview?.attachment.fileName ?? 'Anhang'}
        onClose={() => setPreview(null)}
        maxWidth={preview?.mode === 'image' ? 960 : 720}
        footerActions={[
          {
            title: 'Schließen',
            onPress: () => setPreview(null),
          },
          ...(preview?.mode === 'pdf' || preview?.mode === 'download'
            ? [
                {
                  title: 'Anhang öffnen',
                  onPress: () => {
                    if (preview?.url) void Linking.openURL(preview.url);
                  },
                },
              ]
            : []),
        ]}
      >
        {preview?.mode === 'image' ? (
          <Image
            source={{ uri: preview.url }}
            style={styles.previewImage}
            resizeMode="contain"
            accessibilityLabel={`Vorschau: ${preview.attachment.fileName}`}
          />
        ) : preview?.mode === 'pdf' && Platform.OS === 'web' ? (
          <iframe
            title={preview.attachment.fileName}
            src={preview.url}
            style={{
              width: '100%',
              height: Math.min(screenWidth * 0.75, 560),
              border: 'none',
              borderRadius: radius.md,
              backgroundColor: '#fff',
            }}
          />
        ) : preview ? (
          <Text style={styles.pdfHint}>Datei wird in einem neuen Tab geöffnet…</Text>
        ) : null}
      </PlatformModal>
    </>
  );
}
