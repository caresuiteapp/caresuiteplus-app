import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatBubble } from '@/components/communication/ChatBubble';
import { MessageAttachmentList } from '@/components/office/messageattachmentlist';
import { OfficeMessageComposer } from '@/components/office/officemessagecomposer';
import { officeMessengerColumnStyles } from '@/components/office/officemessengerlayout';
import { PortalOfficeStatusCard } from '@/components/portal/portalofficestatuscard';
import { PortalEmptyState } from '@/components/portal/assist/PortalEmptyState';
import {
  CareLightButton,
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
} from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLightLiquidGlassShell, useMessagingGlassSurface } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { webSafeAreaPadding } from '@/lib/platform/webSafeArea';
import { spacing } from '@/theme';
import { usePortalOfficeThreadDetail } from '@/hooks/useportalofficethreaddetail';
import { isEmployeeGroupChatThread } from '@/lib/office/employeeGroupChatService';
import {
  mapOfficeMessageToChatBubble,
  resolveOfficeThreadHeaderSubtitle,
  resolveOfficeThreadParticipantName,
} from '@/lib/office/officemessagemappers';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { getPortalStatusLabel } from '@/lib/office/portalofficemessageservice';
import { toUserFacingSendError } from '@/lib/office/voicemessageutils';

type PortalOfficeThreadProps = {
  threadId: string | null;
  onNewThreadStarted?: (newThreadId: string) => void;
  onThreadTitleResolved?: (title: string) => void;
  variant?: 'default' | 'glass';
  hideHeader?: boolean;
};

export function PortalOfficeThread({
  threadId,
  onNewThreadStarted,
  onThreadTitleResolved,
  variant = 'default',
  hideHeader = false,
}: PortalOfficeThreadProps) {
  const { c } = useCareLightPalette();
  const { typography, isLight } = useLegacyTheme();
  const useLightGlass = useLightLiquidGlassShell();
  const useLightUi = useLightGlass || isLight;
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const isGlass = variant === 'glass';
  const { surfaces, onDarkSurface, ink } = useMessagingGlassSurface(isGlass);
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingMessageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const { detail, loading, error, sending, sendMessage, startNewChat, refresh, markAsRead } =
    usePortalOfficeThreadDetail(threadId);

  const markedThreadRef = useRef<string | null>(null);

  useEffect(() => {
    markedThreadRef.current = null;
  }, [threadId]);

  useEffect(() => {
    if (!threadId || !detail || markedThreadRef.current === threadId) return;
    markedThreadRef.current = threadId;
    void markAsRead();
  }, [threadId, detail?.id, markAsRead]);

  useEffect(() => {
    if (!detail) return;
    onThreadTitleResolved?.(resolveOfficeThreadParticipantName(detail));
  }, [detail, onThreadTitleResolved]);

  useEffect(() => {
    if (!detail?.messages.length) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [detail?.messages.length, detail?.id]);

  const composerBottomInset = webSafeAreaPadding(
    'bottom',
    Math.max(insets.bottom, spacing.sm),
  ) as number;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minWidth: 0, minHeight: 0 },
        header: {
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: isGlass ? surfaces.border : c.border,
          gap: spacing.xs,
          flexShrink: 0,
        },
        title: { ...typography.h3, color: ink?.primary ?? c.text },
        meta: { ...typography.caption, color: ink?.secondary ?? c.muted },
        messagesContent: { paddingVertical: spacing.md, flexGrow: 1 },
        closedBanner: {
          margin: spacing.md,
          padding: spacing.md,
          borderRadius: 8,
          gap: spacing.sm,
          backgroundColor: isGlass ? surfaces.chip : `${c.muted}18`,
          flexShrink: 0,
        },
        closedText: { ...typography.body, color: ink?.secondary ?? c.muted },
        emptyWrap: {
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
        },
        sendErrorWrap: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xs,
          gap: spacing.xs,
          flexShrink: 0,
        },
        sendErrorText: { ...typography.caption, color: '#c0392b' },
        composerWrap: {
          flexShrink: 0,
          paddingBottom: composerBottomInset,
        },
      }),
    [c, composerBottomInset, ink, isGlass, surfaces.border, surfaces.chip, typography],
  );

  if (!threadId) {
    return (
      <View style={styles.root}>
        {isGlass ? (
          <View style={styles.emptyWrap}>
            <PortalEmptyState
              title="Chat auswählen"
              message="Wählen Sie einen Chat aus der Liste oder starten Sie einen neuen."
              onDarkSurface={onDarkSurface}
            />
          </View>
        ) : (
          <EmptyState
            title="Chat auswählen"
            message="Wählen Sie einen Chat aus der Liste oder starten Sie einen neuen."
          />
        )}
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
        {isGlass ? (
          <View style={styles.emptyWrap}>
            <PortalEmptyState
              title="Chat nicht gefunden"
              message="Der ausgewählte Chat existiert nicht."
              onDarkSurface={onDarkSurface}
            />
          </View>
        ) : (
          <EmptyState title="Chat nicht gefunden" message="Der ausgewählte Chat existiert nicht." />
        )}
      </View>
    );
  }

  const handleSend = async () => {
    const result = await sendMessage(draft, pendingAttachments);
    if (result.ok) {
      setDraft('');
      setPendingAttachments([]);
      setAttachmentError(null);
      scrollRef.current?.scrollToEnd({ animated: true });
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

  const isOwnMessage = (senderType: string) =>
    senderType === 'client_portal' || senderType === 'employee_portal';

  const isGroup = isEmployeeGroupChatThread(detail);
  const headerTitle = resolveOfficeThreadParticipantName(detail);
  const headerSubtitle = resolveOfficeThreadHeaderSubtitle(detail, getPortalStatusLabel(detail.status));
  const showStatusCard = !hideHeader;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
    >
      <View style={officeMessengerColumnStyles.columnRoot}>
        {!hideHeader ? (
          <View style={styles.header}>
            <Text style={styles.title}>{headerTitle}</Text>
            <Text style={styles.meta}>{headerSubtitle}</Text>
          </View>
        ) : null}

        {showStatusCard ? <PortalOfficeStatusCard thread={detail} variant={variant} /> : null}

        <ScrollView
          ref={scrollRef}
          style={officeMessengerColumnStyles.scrollRegion}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {detail.messages.map((message) => {
            const isVoiceOnly = message.body === '🎤 Sprachnachricht';
            const isOwn = isOwnMessage(message.senderType);
            return (
              <View key={message.id}>
                {!isVoiceOnly ? (
                  <ChatBubble
                    message={mapOfficeMessageToChatBubble(message)}
                    isOwn={isOwn}
                    showStatus={isOwn}
                  />
                ) : null}
                <MessageAttachmentList
                  messageId={message.id}
                  attachmentOnly={isVoiceOnly}
                  expectVoiceAttachment={isVoiceOnly}
                  isOwn={isOwn}
                  senderDisplayName={message.senderDisplayName}
                  sentAt={message.sentAt}
                  showStatus={isOwn}
                  messageStatus={message.status === 'read' ? 'read' : 'sent'}
                />
              </View>
            );
          })}
        </ScrollView>

        {detail.isClosed ? (
          <View style={styles.closedBanner}>
            <Text style={styles.closedText}>
              {isGroup
                ? 'Dieser Gruppen-Chat ist abgeschlossen und schreibgeschützt.'
                : 'Dieser Chat ist abgeschlossen und schreibgeschützt. Bei erneutem Kontakt schreiben Sie der Verwaltung erneut.'}
            </Text>
            {!isGroup ? (
              useLightUi ? (
                <CareLightButton title="Verwaltung anschreiben" onPress={() => void handleStartNewChat()} />
              ) : (
                <PremiumButton title="Verwaltung anschreiben" onPress={() => void handleStartNewChat()} />
              )
            ) : null}
          </View>
        ) : (
          <>
            {attachmentError ? (
              <View style={styles.sendErrorWrap}>
                <Text style={styles.sendErrorText}>{attachmentError}</Text>
                {useLightUi ? (
                  <CareLightButton title="Erneut senden" variant="secondary" onPress={() => void handleSend()} />
                ) : (
                  <PremiumButton title="Erneut senden" size="sm" onPress={() => void handleSend()} />
                )}
              </View>
            ) : null}
            <View style={styles.composerWrap}>
              <OfficeMessageComposer
                text={draft}
                onChangeText={setDraft}
                onSend={handleSend}
                sending={sending}
                onDarkSurface={onDarkSurface}
                pendingAttachments={pendingAttachments}
                onPendingAttachmentsChange={setPendingAttachments}
                attachmentError={attachmentError}
                onAttachmentError={setAttachmentError}
              />
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
