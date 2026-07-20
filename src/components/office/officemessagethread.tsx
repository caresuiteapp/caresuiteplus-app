import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { usePermissions } from '@/hooks/usePermissions';
import { confirmAction } from '@/lib/platform/confirmAction';
import { isClosedAppStatus } from '@/lib/office/messagestatuslabels';

type OfficeMessageThreadProps = {
  threadId: string | null;
  onNewThreadStarted?: (newThreadId: string) => void;
  hideHeader?: boolean;
  onDarkSurface?: boolean;
  onThreadChanged?: () => void;
  onThreadDeleted?: () => void;
};

export function OfficeMessageThread({
  threadId,
  onNewThreadStarted,
  hideHeader = false,
  onDarkSurface = false,
  onThreadChanged,
  onThreadDeleted,
}: OfficeMessageThreadProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const [draft, setDraft] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingMessageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const messagesRef = useRef<ScrollView>(null);
  const latestMessageYRef = useRef(0);
  const processedReadKeyRef = useRef<string | null>(null);
  const { can, isReadOnly } = usePermissions();
  const {
    detail,
    loading,
    error,
    sending,
    sendMessage,
    startNewChat,
    refresh,
    markAsRead,
    updateStatus,
    deleteThread,
  } = useOfficeMessageThreadDetail(threadId);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minWidth: 0, minHeight: 0 },
        messages: { flex: 1, minHeight: 0, backgroundColor: c.surfaceAlt },
        messagesContent: { paddingVertical: spacing.lg, flexGrow: 1 },
        dayDivider: { alignItems: 'center', marginVertical: spacing.md },
        dayPill: {
          ...typography.caption,
          color: c.muted,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          paddingHorizontal: spacing.md,
          paddingVertical: 5,
          borderRadius: 999,
          fontWeight: '700',
        },
        closedBanner: {
          margin: spacing.md,
          padding: spacing.md,
          borderRadius: 8,
          backgroundColor: c.surfaceAlt,
          gap: spacing.sm,
        },
        closedText: { ...typography.body, color: c.muted },
        lifecycleBar: {
          minHeight: 42,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: c.surface,
        },
        lifecycleButton: {
          minHeight: 30,
          justifyContent: 'center',
          paddingHorizontal: spacing.sm,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surfaceAlt,
        },
        lifecycleButtonDanger: { borderColor: '#c0392b' },
        lifecycleButtonText: { ...typography.caption, color: c.text, fontWeight: '700' },
        lifecycleButtonDangerText: { color: '#c0392b' },
        lifecycleError: {
          ...typography.caption,
          color: '#c0392b',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          backgroundColor: c.surface,
        },
      }),
    [c, typography],
  );

  const scrollToLatestMessage = () => {
    messagesRef.current?.scrollTo({
      y: Math.max(0, latestMessageYRef.current - spacing.sm),
      animated: false,
    });
  };

  useEffect(() => {
    if (!detail?.messages.length) return;
    const timer = setTimeout(scrollToLatestMessage, 0);
    return () => clearTimeout(timer);
  }, [detail?.messages.length, threadId]);

  useEffect(() => {
    if (!threadId || !detail) return;
    const needsReadTransition =
      detail.unreadCount > 0 || detail.status === 'new' || detail.status === 'received';
    if (!needsReadTransition) return;

    const readKey = `${threadId}:${detail.lastMessageAt ?? detail.updatedAt}`;
    if (processedReadKeyRef.current === readKey) return;
    processedReadKeyRef.current = readKey;

    void (async () => {
      const readResult = await markAsRead();
      if (!readResult.ok) {
        setLifecycleError(readResult.error);
        return;
      }
      if (detail.status === 'new' || detail.status === 'received') {
        const statusResult = await updateStatus('in_progress');
        if (!statusResult.ok) {
          setLifecycleError(statusResult.error);
          return;
        }
      }
      onThreadChanged?.();
    })();
  }, [detail, markAsRead, onThreadChanged, threadId, updateStatus]);

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

  const handleToggleClosed = async () => {
    if (!detail || lifecycleBusy) return;
    setLifecycleBusy(true);
    setLifecycleError(null);
    const result = await updateStatus(isClosedAppStatus(detail.status) ? 'in_progress' : 'closed');
    setLifecycleBusy(false);
    if (!result.ok) {
      setLifecycleError(result.error);
      return;
    }
    onThreadChanged?.();
  };

  const handleDeleteThread = async () => {
    if (lifecycleBusy) return;
    const confirmed = await confirmAction({
      title: 'Chat wirklich löschen?',
      message: 'Der Chat wird aus Neue, Aktuelle und Alte entfernt.',
      confirmLabel: 'Chat löschen',
      cancelLabel: 'Abbrechen',
    });
    if (!confirmed) return;

    setLifecycleBusy(true);
    setLifecycleError(null);
    const result = await deleteThread();
    setLifecycleBusy(false);
    if (!result.ok) {
      setLifecycleError(result.error);
      return;
    }
    onThreadChanged?.();
    onThreadDeleted?.();
  };

  return (
    <View style={styles.root}>
      {!hideHeader ? <OfficeMessageThreadHeader detail={detail} /> : null}

      {!isReadOnly ? (
        <View style={styles.lifecycleBar}>
          <Pressable
            style={styles.lifecycleButton}
            onPress={() => void handleToggleClosed()}
            disabled={lifecycleBusy}
            accessibilityRole="button"
          >
            <Text style={styles.lifecycleButtonText}>
              {isClosedAppStatus(detail.status) ? '↻ Wieder öffnen' : '✓ Abschließen'}
            </Text>
          </Pressable>
          {can('office.messages.delete') ? (
            <Pressable
              style={[styles.lifecycleButton, styles.lifecycleButtonDanger]}
              onPress={() => void handleDeleteThread()}
              disabled={lifecycleBusy}
              accessibilityRole="button"
            >
              <Text style={[styles.lifecycleButtonText, styles.lifecycleButtonDangerText]}>
                🗑 Chat löschen
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {lifecycleError ? <Text style={styles.lifecycleError}>{lifecycleError}</Text> : null}

      <ScrollView
        ref={messagesRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToLatestMessage}
        testID="office-message-history"
      >
        {detail.messages.map((message, index) => {
          const isVoiceOnly = message.body === '🎤 Sprachnachricht';
          const isOwn = message.senderType === 'office_profile';
          const previousMessage = detail.messages[index - 1];
          const messageDate = new Date(message.sentAt ?? message.createdAt);
          const previousDate = previousMessage
            ? new Date(previousMessage.sentAt ?? previousMessage.createdAt)
            : null;
          const showDay = !previousDate || messageDate.toDateString() !== previousDate.toDateString();
          return (
            <View
              key={message.id}
              onLayout={
                index === detail.messages.length - 1
                  ? (event) => {
                      latestMessageYRef.current = event.nativeEvent.layout.y;
                      scrollToLatestMessage();
                    }
                  : undefined
              }
            >
              {showDay ? (
                <View style={styles.dayDivider}>
                  <Text style={styles.dayPill}>
                    {messageDate.toLocaleDateString('de-DE', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                    })}
                  </Text>
                </View>
              ) : null}
              <OfficeMessageActionsMenu
                message={message}
                disabled={detail.isClosed}
                onChanged={() => {
                  void refresh();
                  onThreadChanged?.();
                }}
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
            </View>
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
