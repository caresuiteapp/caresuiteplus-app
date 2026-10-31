import { PortalKeyboardAvoidingView as KeyboardAvoidingView } from '@/components/keyboard/PortalKeyboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import {
  AppState,
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
import { usePortalViewport } from '@/lib/portal/portalViewportContext';
import { usePortalOfficeThreadDetail } from '@/hooks/useportalofficethreaddetail';
import { usePortalActor } from '@/hooks/usePortalActor';
import { isEmployeeGroupChatThread } from '@/lib/office/employeeGroupChatService';
import {
  mapOfficeMessageToChatBubble,
  resolveOfficeThreadHeaderSubtitle,
  resolveOfficeThreadParticipantName,
} from '@/lib/office/officemessagemappers';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import type { OfficeMessage } from '@/types/office/messaging';
import { getPortalStatusLabel } from '@/lib/office/portalofficemessageservice';
import { toUserFacingSendError } from '@/lib/office/voicemessageutils';

type PortalOfficeThreadProps = {
  threadId: string | null;
  onNewThreadStarted?: (newThreadId: string) => void;
  onThreadTitleResolved?: (title: string) => void;
  variant?: 'default' | 'glass';
  hideHeader?: boolean;
};

export function PortalOfficeThread(props: PortalOfficeThreadProps) {
  const { tenantId, actorId, roleKey, clientId, employeeId, familyAccess } = usePortalActor();
  // A conversation owns its composer and any pending send. Changing only the
  // hook argument would retain another thread's unsent text and attachments.
  const scope = JSON.stringify([tenantId, actorId, roleKey, clientId, employeeId, props.threadId, familyAccess?.permissions]);
  return <PortalOfficeThreadContent key={scope} {...props} />;
}

function PortalOfficeThreadContent({
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
  const { footerInFlow } = usePortalViewport();
  const scrollRef = useRef<ScrollView>(null);
  const isGlass = variant === 'glass';
  const { surfaces, onDarkSurface, ink } = useMessagingGlassSurface(isGlass);
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingMessageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const restartLock = useRef(false);
  const sendLock = useRef(false);
  const mounted = useRef(true);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const screenFocused = useIsFocused();
  const { detail, loading, error, sending, canSend = true, sendMessage, startNewChat, refresh, markAsRead, actorClientId, actorEmployeeId } =
    usePortalOfficeThreadDetail(threadId);

  const markedReadBatchRef = useRef<string | null>(null);
  const unreadOfficeMessages = detail?.messages
    .filter((message) => message.senderType === 'office_profile' && !message.readAt && message.status === 'sent')
    .map((message) => message.id)
    .join('|') ?? '';

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!appActive || !screenFocused || !threadId || !unreadOfficeMessages || markedReadBatchRef.current === unreadOfficeMessages) return;
    const batch = unreadOfficeMessages;
    markedReadBatchRef.current = batch;
    const allowRetry = () => {
      if (mounted.current && markedReadBatchRef.current === batch) markedReadBatchRef.current = null;
    };
    void markAsRead().then((result) => {
      if (!result.ok) allowRetry();
    }).catch(allowRetry);
  }, [appActive, screenFocused, threadId, detail, unreadOfficeMessages, markAsRead]);

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

  const composerBottomInset = footerInFlow ? spacing.xs : webSafeAreaPadding(
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
    if (sendLock.current) return;
    sendLock.current = true;
    const sentDraft = draft;
    const sentAttachments = pendingAttachments;
    try {
      const result = await sendMessage(sentDraft, sentAttachments);
      if (!mounted.current) return;
      if (result.ok) {
        setDraft((current) => current === sentDraft ? '' : current);
        const sentIds = new Set(sentAttachments.map((attachment) => attachment.id));
        setPendingAttachments((current) => current.filter((attachment) => !sentIds.has(attachment.id)));
        setAttachmentError(null);
        scrollRef.current?.scrollToEnd({ animated: true });
      } else {
        setAttachmentError(toUserFacingSendError(result.error));
      }
    } catch {
      if (mounted.current) setAttachmentError(toUserFacingSendError());
    } finally {
      sendLock.current = false;
    }
  };

  const handleStartNewChat = async () => {
    if (restartLock.current) return;
    restartLock.current = true;
    setRestarting(true);
    setRestartError(null);
    try {
      const result = await startNewChat();
      if (!mounted.current) return;
      if (result.ok && result.data) {
        onNewThreadStarted?.(result.data.id);
      } else {
        setRestartError(toUserFacingSendError(result.error));
      }
    } catch {
      if (mounted.current) setRestartError(toUserFacingSendError());
    } finally {
      restartLock.current = false;
      if (mounted.current) setRestarting(false);
    }
  };

  const isOwnMessage = (message: OfficeMessage) =>
    (message.senderType === 'client_portal' && !!actorClientId && message.senderClientId === actorClientId)
    || (message.senderType === 'employee_portal' && !!actorEmployeeId && message.senderEmployeeId === actorEmployeeId);

  const isGroup = isEmployeeGroupChatThread(detail);
  const headerTitle = resolveOfficeThreadParticipantName(detail);
  const headerSubtitle = resolveOfficeThreadHeaderSubtitle(detail, getPortalStatusLabel(detail.status));
  const showStatusCard = !hideHeader;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      enabled={Platform.OS !== 'web'}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            const isOwn = isOwnMessage(message);
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
            {restartError ? <Text accessibilityRole="alert" style={styles.sendErrorText}>{restartError}</Text> : null}
            {!isGroup && canSend ? (
              useLightUi ? (
                <CareLightButton title="Verwaltung anschreiben" loading={restarting} onPress={() => void handleStartNewChat()} />
              ) : (
                <PremiumButton title="Verwaltung anschreiben" loading={restarting} onPress={() => void handleStartNewChat()} />
              )
            ) : null}
          </View>
        ) : (
          <>
            {attachmentError ? (
              <View style={styles.sendErrorWrap}>
                <Text style={styles.sendErrorText}>{attachmentError}</Text>
                {useLightUi ? (
                  <CareLightButton title="Erneut senden" variant="secondary" disabled={sending} onPress={() => void handleSend()} />
                ) : (
                  <PremiumButton title="Erneut senden" size="sm" disabled={sending} onPress={() => void handleSend()} />
                )}
              </View>
            ) : null}
            <View style={styles.composerWrap}>
                {!canSend ? <Text style={styles.meta}>Dieser Angehörigenzugang erlaubt das Lesen von Nachrichten. Das Senden ist nicht freigegeben.</Text> : null}
                <OfficeMessageComposer
                text={draft}
                onChangeText={setDraft}
                onSend={handleSend}
                sending={sending}
                disabled={sending || !canSend}
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
