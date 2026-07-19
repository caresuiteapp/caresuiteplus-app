import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChatBubble } from '@/components/communication/ChatBubble';
import { MessageAttachmentList } from '@/components/office/messageattachmentlist';
import { OfficeMessageComposer } from '@/components/office/officemessagecomposer';
import { OfficeMessageActionsMenu } from '@/components/office/officemessageactionsmenu';
import { OfficeMessageThreadHeader } from '@/components/office/officemessagethreadheader';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';
import { useOfficeMessageThreadDetail } from '@/hooks/useofficemessagethreaddetail';
import { mapOfficeMessageToChatBubble } from '@/lib/office/officemessagemappers';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { toUserFacingSendError } from '@/lib/office/voicemessageutils';
import { officeMessengerEmptyStyles } from '@/components/office/officemessengerlayout';

type OfficeMessageThreadProps = {
  threadId: string | null;
  onNewThreadStarted?: (newThreadId: string) => void;
  hideHeader?: boolean;
  onDarkSurface?: boolean;
};

export function OfficeMessageThread({
  threadId,
  onNewThreadStarted,
  hideHeader = false,
  onDarkSurface = false,
}: OfficeMessageThreadProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const [draft, setDraft] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingMessageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const messagesRef = useRef<ScrollView>(null);
  const { detail, loading, error, sending, sendMessage, startNewChat, refresh } =
    useOfficeMessageThreadDetail(threadId);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minWidth: 0, minHeight: 0 },
        messages: { flex: 1, minHeight: 0 },
        messagesContent: { paddingVertical: spacing.sm, flexGrow: 1, justifyContent: 'flex-end' },
        closedBanner: {
          margin: spacing.md,
          padding: spacing.md,
          borderRadius: 8,
          backgroundColor: c.surfaceAlt,
          gap: spacing.sm,
        },
        closedText: { ...typography.body, color: c.muted },
      }),
    [c, typography],
  );

  useEffect(() => {
    if (!detail?.messages.length) return;
    const timer = setTimeout(() => messagesRef.current?.scrollToEnd({ animated: false }), 0);
    return () => clearTimeout(timer);
  }, [detail?.messages.length, threadId]);

  if (!threadId) {
    return (
      <View style={styles.root}>
        <View style={officeMessengerEmptyStyles.threadHeader} />
        <View style={officeMessengerEmptyStyles.emptyPane}>
          <EmptyState
            title="Chat auswählen"
            message="Wählen Sie einen Chat aus der Liste, um den Verlauf anzuzeigen."
          />
        </View>
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
    const result = await sendMessage(draft, { isInternalNote, attachments: pendingAttachments });
    if (result.ok) {
      setDraft('');
      setIsInternalNote(false);
      setPendingAttachments([]);
      setAttachmentError(null);
    } else {
      setAttachmentError(toUserFacingSendError(result.error));
    }
  };

  const handleStartNewChat = async () => {
    const result = await startNewChat();
    if (result.ok && result.data) {
      onNewThreadStarted?.(result.data.id);
    }
  };

  return (
    <View style={styles.root}>
      {!hideHeader ? <OfficeMessageThreadHeader detail={detail} /> : null}

      <ScrollView
        ref={messagesRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => messagesRef.current?.scrollToEnd({ animated: false })}
        testID="office-message-history"
      >
        {detail.messages.map((message) => {
          const isVoiceOnly = message.body === '🎤 Sprachnachricht';
          const isOwn = message.senderType === 'office_profile';
          return (
            <OfficeMessageActionsMenu
              key={message.id}
              message={message}
              disabled={detail.isClosed}
              onChanged={refresh}
            >
              <View>
                {!isVoiceOnly ? (
                  <ChatBubble
                    message={mapOfficeMessageToChatBubble(message)}
                    isOwn={isOwn}
                  />
                ) : null}
                <MessageAttachmentList
                  messageId={message.id}
                  attachmentOnly={isVoiceOnly}
                  expectVoiceAttachment={isVoiceOnly}
                  isOwn={isOwn}
                  senderDisplayName={message.senderDisplayName}
                  sentAt={message.sentAt}
                  showStatus
                  messageStatus={message.status === 'read' ? 'read' : 'sent'}
                />
              </View>
            </OfficeMessageActionsMenu>
          );
        })}
      </ScrollView>

      {detail.isClosed ? (
        <View style={styles.closedBanner}>
          <Text style={styles.closedText}>
            Dieser Chat ist abgeschlossen und schreibgeschützt. Bei erneutem Kontakt starten Sie
            einen neuen Chat.
          </Text>
          <PremiumButton title="Neuen Chat starten" onPress={handleStartNewChat} />
        </View>
      ) : (
        <>
          {attachmentError ? (
            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
              <Text style={{ color: '#c0392b' }}>{attachmentError}</Text>
              <PremiumButton title="Erneut senden" size="sm" onPress={() => void handleSend()} />
            </View>
          ) : null}
          <OfficeMessageComposer
          text={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          sending={sending}
          showInternalToggle
          isInternalNote={isInternalNote}
          onToggleInternalNote={() => setIsInternalNote((value) => !value)}
          onDarkSurface={onDarkSurface}
          pendingAttachments={pendingAttachments}
          onPendingAttachmentsChange={setPendingAttachments}
          attachmentError={attachmentError}
          onAttachmentError={setAttachmentError}
        />
        </>
      )}
    </View>
  );
}
