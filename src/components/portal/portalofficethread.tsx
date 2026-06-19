import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChatBubble } from '@/components/communication/ChatBubble';
import { ChatComposer } from '@/components/communication/ChatComposer';
import { MessageAttachmentList } from '@/components/office/messageattachmentlist';
import { OfficeMessageAttachmentPicker } from '@/components/office/officemessageattachmentpicker';
import { PortalOfficeStatusCard } from '@/components/portal/portalofficestatuscard';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';
import { usePortalOfficeThreadDetail } from '@/hooks/useportalofficethreaddetail';
import { mapOfficeMessageToChatBubble } from '@/lib/office/officemessagemappers';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { getPortalStatusLabel } from '@/lib/office/portalofficemessageservice';

type PortalOfficeThreadProps = {
  threadId: string | null;
  onNewThreadStarted?: (newThreadId: string) => void;
  variant?: 'default' | 'glass';
};

export function PortalOfficeThread({
  threadId,
  onNewThreadStarted,
  variant = 'default',
}: PortalOfficeThreadProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const isGlass = variant === 'glass';
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingMessageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const { detail, loading, error, sending, sendMessage, startNewChat, refresh, markAsRead } =
    usePortalOfficeThreadDetail(threadId);

  useEffect(() => {
    if (threadId && detail) {
      void markAsRead();
    }
  }, [threadId, detail?.id, markAsRead]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minWidth: 0 },
        header: {
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: isGlass ? auroraGlass.border : c.border,
          gap: spacing.xs,
        },
        title: { ...typography.h3, color: isGlass ? text.primary : c.text },
        meta: { ...typography.caption, color: isGlass ? text.muted : c.muted },
        messages: { flex: 1 },
        messagesContent: { paddingVertical: spacing.md },
        closedBanner: {
          margin: spacing.md,
          padding: spacing.md,
          borderRadius: 8,
          gap: spacing.sm,
          backgroundColor: isGlass ? auroraGlass.chip : `${c.muted}18`,
        },
        closedText: { ...typography.body, color: isGlass ? text.secondary : c.muted },
      }),
    [c, isGlass, text.muted, text.primary, text.secondary, typography],
  );

  if (!threadId) {
    return (
      <View style={styles.root}>
        <EmptyState
          title="Chat auswählen"
          message="Wählen Sie einen Chat aus der Liste oder starten Sie einen neuen."
        />
      </View>
    );
  }

  if (loading && !detail) {
    return (
      <View style={styles.root}>
        <LoadingState message="Chat wird geladen…" />
      </View>
    );
  }

  if (error && !detail) {
    return (
      <View style={styles.root}>
        <ErrorState message={error} onRetry={refresh} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.root}>
        <EmptyState title="Chat nicht gefunden" message="Der ausgewählte Chat existiert nicht." />
      </View>
    );
  }

  const handleSend = async () => {
    const result = await sendMessage(draft, pendingAttachments);
    if (result.ok) {
      setDraft('');
      setPendingAttachments([]);
      setAttachmentError(null);
    }
  };

  const handleStartNewChat = async () => {
    const result = await startNewChat();
    if (result.ok && result.data) {
      onNewThreadStarted?.(result.data.id);
    }
  };

  const isOwnMessage = (senderType: string) =>
    senderType === 'client_portal' || senderType === 'employee_portal';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{detail.subject}</Text>
        <Text style={styles.meta}>
          Status: {getPortalStatusLabel(detail.status)}
          {detail.categoryLabel ? ` · ${detail.categoryLabel}` : ''}
        </Text>
      </View>

      <PortalOfficeStatusCard thread={detail} />

      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {detail.messages.map((message) => (
          <View key={message.id}>
            <ChatBubble
              message={mapOfficeMessageToChatBubble(message)}
              isOwn={isOwnMessage(message.senderType)}
              showStatus={isOwnMessage(message.senderType)}
            />
            <MessageAttachmentList messageId={message.id} />
          </View>
        ))}
      </ScrollView>

      {detail.isClosed ? (
        <View style={styles.closedBanner}>
          <Text style={styles.closedText}>
            Dieser Chat ist abgeschlossen und schreibgeschützt. Bei erneutem Kontakt schreiben Sie
            der Verwaltung erneut.
          </Text>
          <PremiumButton title="Verwaltung anschreiben" onPress={handleStartNewChat} />
        </View>
      ) : (
        <ChatComposer
          text={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          sending={sending}
          canSendWithAttachments={pendingAttachments.length > 0}
          attachmentPicker={
            <OfficeMessageAttachmentPicker
              attachments={pendingAttachments}
              onChange={setPendingAttachments}
              disabled={sending}
              error={attachmentError}
              onError={setAttachmentError}
            />
          }
        />
      )}
    </View>
  );
}
