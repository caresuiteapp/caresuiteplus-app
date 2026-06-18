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
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import type { RoleKey } from '@/types';
import {
  listMessageAttachments,
  resolveMessageAttachmentUrl,
  type MessageAttachment,
} from '@/lib/office/messageattachmentservice';
import { isImageMimeType, isPdfMimeType } from '@/lib/office/messageattachmentvalidation';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { MessageStatusTicks } from '@/components/communication/MessageStatusTicks';

type AttachmentUrlState = {
  url: string | null;
  loading: boolean;
  error: string | null;
};

type PreviewState = {
  attachment: MessageAttachment;
  url: string;
  mode: 'image' | 'pdf';
};

type MessageAttachmentListProps = {
  messageId: string;
  isOwn?: boolean;
  /** Nachricht besteht nur aus Anhängen — Bubble-Chrome hier rendern. */
  attachmentOnly?: boolean;
  senderDisplayName?: string;
  sentAt?: string | null;
  showStatus?: boolean;
  messageStatus?: 'sent' | 'delivered' | 'read' | 'deleted';
};

function resolveAttachmentRoleKey(
  profileRoleKey?: string | null,
  portalRoleKey?: string | null,
): RoleKey | null | undefined {
  return (profileRoleKey ?? portalRoleKey) as RoleKey | null | undefined;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentIcon(mimeType: string | null): string {
  if (isImageMimeType(mimeType)) return '🖼️';
  if (isPdfMimeType(mimeType)) return '📄';
  return '📎';
}

export function MessageAttachmentList({
  messageId,
  isOwn = false,
  attachmentOnly = false,
  senderDisplayName,
  sentAt,
  showStatus = false,
  messageStatus = 'sent',
}: MessageAttachmentListProps) {
  const { c } = useCareLightPalette();
  const { colors, typography } = useLegacyTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { profile, portalSession } = useAuth();
  const tenantId = useServiceTenantId();
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [urlById, setUrlById] = useState<Record<string, AttachmentUrlState>>({});
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const roleKey = resolveAttachmentRoleKey(profile?.roleKey, portalSession?.roleKey);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        rowWrap: {
          marginVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          alignItems: isOwn ? 'flex-end' : 'flex-start',
        },
        bubble: {
          maxWidth: '82%',
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        },
        bubbleOwn: {
          backgroundColor: colors.orange,
          borderBottomRightRadius: radius.sm,
        },
        bubbleOther: {
          backgroundColor: colors.bgElevated,
          borderWidth: 1,
          borderColor: colors.borderCyan,
          borderBottomLeftRadius: radius.sm,
        },
        inlineRoot: {
          gap: spacing.xs,
          maxWidth: '82%',
          alignSelf: isOwn ? 'flex-end' : 'flex-start',
          paddingHorizontal: attachmentOnly ? 0 : spacing.md,
          paddingBottom: attachmentOnly ? 0 : spacing.sm,
        },
        sender: { ...typography.caption, color: colors.cyan, marginBottom: spacing.xs },
        meta: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginTop: spacing.xs,
        },
        time: { ...typography.caption, color: colors.textMuted },
        item: {
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: `${c.violet}08`,
          overflow: 'hidden',
        },
        fileRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
        },
        name: { ...typography.caption, color: c.text, flex: 1, fontWeight: '600' },
        metaText: { ...typography.caption, color: c.muted },
        thumb: {
          width: Math.min(240, screenWidth * 0.55),
          height: 160,
          backgroundColor: `${c.muted}22`,
        },
        thumbLoading: {
          width: Math.min(240, screenWidth * 0.55),
          height: 120,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${c.muted}18`,
        },
        thumbError: {
          padding: spacing.sm,
          gap: spacing.xs,
        },
        errorText: { ...typography.caption, color: '#c0392b' },
        listLoading: {
          padding: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
        },
        previewImage: {
          width: '100%',
          minHeight: 240,
          maxHeight: Math.min(screenWidth * 0.85, 640),
          borderRadius: radius.md,
          backgroundColor: `${c.muted}18`,
        },
        pdfHint: { ...typography.body, color: c.muted, textAlign: 'center' },
      }),
    [attachmentOnly, c, colors, isOwn, screenWidth, typography],
  );

  useEffect(() => {
    if (!tenantId || !messageId) {
      setListLoading(false);
      return;
    }

    let cancelled = false;
    setListLoading(true);
    setListError(null);

    void listMessageAttachments(tenantId, messageId, roleKey).then((result) => {
      if (cancelled) return;
      setListLoading(false);
      if (!result.ok) {
        setListError(result.error);
        setAttachments([]);
        return;
      }
      setAttachments(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [tenantId, messageId, roleKey]);

  const loadUrl = useCallback(
    async (attachment: MessageAttachment, force = false) => {
      if (!tenantId) return;

      let shouldLoad = force;
      setUrlById((prev) => {
        const current = prev[attachment.id];
        if (!force && (current?.loading || current?.url || current?.error)) {
          shouldLoad = false;
          return prev;
        }
        shouldLoad = true;
        return {
          ...prev,
          [attachment.id]: { url: current?.url ?? null, loading: true, error: null },
        };
      });
      if (!shouldLoad) return;

      const resolved = await resolveMessageAttachmentUrl(tenantId, attachment);
      setUrlById((prev) => ({
        ...prev,
        [attachment.id]: {
          url: resolved.ok ? resolved.data : null,
          loading: false,
          error: resolved.ok ? null : resolved.error,
        },
      }));
    },
    [tenantId],
  );

  useEffect(() => {
    if (!tenantId || attachments.length === 0) return;
    for (const attachment of attachments) {
      void loadUrl(attachment);
    }
  }, [attachments, loadUrl, tenantId]);

  const openAttachment = async (attachment: MessageAttachment) => {
    if (!tenantId) return;

    let url = urlById[attachment.id]?.url;
    if (!url) {
      const resolved = await resolveMessageAttachmentUrl(tenantId, attachment);
      if (!resolved.ok) return;
      url = resolved.data;
      setUrlById((prev) => ({
        ...prev,
        [attachment.id]: { url, loading: false, error: null },
      }));
    }

    if (isImageMimeType(attachment.mimeType)) {
      setPreview({ attachment, url, mode: 'image' });
      return;
    }

    if (isPdfMimeType(attachment.mimeType) && Platform.OS === 'web') {
      setPreview({ attachment, url, mode: 'pdf' });
      return;
    }

    await Linking.openURL(url);
  };

  if (listLoading) {
    if (!attachmentOnly) return null;
    return (
      <View style={styles.rowWrap}>
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, styles.listLoading]}>
          <ActivityIndicator size="small" color={c.violet} accessibilityLabel="Anhänge werden geladen" />
        </View>
      </View>
    );
  }

  if (listError) {
    if (!attachmentOnly) return null;
    return (
      <View style={styles.rowWrap}>
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          <Text style={styles.errorText}>Anhänge konnten nicht geladen werden</Text>
        </View>
      </View>
    );
  }

  if (attachments.length === 0) return null;

  const renderAttachment = (attachment: MessageAttachment) => {
    const urlState = urlById[attachment.id];
    const accessibilityLabel = `Anhang öffnen: ${attachment.fileName}`;

    if (isImageMimeType(attachment.mimeType)) {
      if (urlState?.loading) {
        return (
          <View key={attachment.id} style={[styles.item, styles.thumbLoading]}>
            <ActivityIndicator size="small" color={c.violet} />
            <Text style={styles.metaText}>Vorschau wird geladen…</Text>
          </View>
        );
      }

      if (urlState?.error || !urlState?.url) {
        return (
          <Pressable
            key={attachment.id}
            style={[styles.item, styles.thumbError]}
            onPress={() => void loadUrl(attachment, true)}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
          >
            <Text style={styles.errorText}>Anhang nicht verfügbar</Text>
            <Text style={styles.metaText}>Tippen zum erneuten Laden</Text>
          </Pressable>
        );
      }

      return (
        <Pressable
          key={attachment.id}
          style={styles.item}
          onPress={() => void openAttachment(attachment)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Image
            source={{ uri: urlState.url }}
            style={styles.thumb}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.fileRow}>
            <Text style={styles.name}>{attachment.fileName}</Text>
            <Text style={styles.metaText}>{formatSize(attachment.fileSizeBytes)}</Text>
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable
        key={attachment.id}
        style={styles.item}
        onPress={() => void openAttachment(attachment)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={styles.fileRow}>
          <Text style={styles.name}>
            {attachmentIcon(attachment.mimeType)} {attachment.fileName}
          </Text>
          <Text style={styles.metaText}>{formatSize(attachment.fileSizeBytes)}</Text>
        </View>
        {urlState?.loading ? (
          <View style={styles.thumbLoading}>
            <ActivityIndicator size="small" color={c.violet} />
          </View>
        ) : null}
        {urlState?.error ? (
          <View style={styles.thumbError}>
            <Text style={styles.errorText}>Anhang nicht verfügbar</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const content = (
    <View style={attachmentOnly ? undefined : styles.inlineRoot}>
      {attachments.map(renderAttachment)}
    </View>
  );

  const previewModal = (
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
        ...(preview?.mode === 'pdf'
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
        <Text style={styles.pdfHint}>PDF wird in einem neuen Tab geöffnet…</Text>
      ) : null}
    </PlatformModal>
  );

  if (attachmentOnly) {
    return (
      <>
        <View style={styles.rowWrap}>
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
            {!isOwn && senderDisplayName ? (
              <Text style={styles.sender}>{senderDisplayName}</Text>
            ) : null}
            {content}
            <View style={styles.meta}>
              {sentAt ? (
                <Text style={styles.time}>
                  {new Date(sentAt).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              ) : null}
              {showStatus && isOwn ? <MessageStatusTicks status={messageStatus} /> : null}
            </View>
          </View>
        </View>
        {previewModal}
      </>
    );
  }

  return (
    <>
      {content}
      {previewModal}
    </>
  );
}
