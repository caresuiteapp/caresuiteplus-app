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
  Pressable,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { EmployeePortalAgendaAction, agendaFocusRing } from './employee/EmployeePortalAgendaAction';
import { EmployeePortalAgendaStatus } from './employee/EmployeePortalAgendaCard';
import { ClientRecordLoading, clientRecordTextWrap } from './employee/EmployeePortalClientRecordLayout';
import { employeePortalDesign as employeeInk } from './employee/employeePortalDesign';

type PortalOfficeThreadProps = {
  threadId: string | null;
  onNewThreadStarted?: (newThreadId: string) => void;
  onThreadTitleResolved?: (title: string) => void;
  variant?: 'default' | 'glass' | 'employee';
  hideHeader?: boolean;
  onBack?: () => void;
  allowReply?: boolean;
  active?: boolean;
};

const threadDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

function messageDay(iso: string) {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? threadDate.format(date) : null;
}

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
  onBack,
  allowReply = true,
  active = true,
}: PortalOfficeThreadProps) {
  const { c } = useCareLightPalette();
  const { typography, isLight } = useLegacyTheme();
  const { width, height } = useWindowDimensions();
  const useLightGlass = useLightLiquidGlassShell();
  const useLightUi = useLightGlass || isLight;
  const insets = useSafeAreaInsets();
  const { footerInFlow } = usePortalViewport();
  const scrollRef = useRef<ScrollView>(null);
  const isGlass = variant === 'glass';
  const employee = variant === 'employee';
  const compactEmployeeHeader = employee && height <= 500 && width >= 600;
  const { surfaces, onDarkSurface, ink } = useMessagingGlassSurface(isGlass);
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingMessageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const restartLock = useRef(false);
  const sendLock = useRef(false);
  const mounted = useRef(true);
  const followsLatest = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const screenFocused = useIsFocused();
  const { detail, loading, error, refreshing, sending, canSend = true, sendMessage, startNewChat, refresh, markAsRead, actorClientId, actorEmployeeId } =
    usePortalOfficeThreadDetail(threadId);
  const mayReply = canSend && allowReply;

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
    if (!active || !appActive || !screenFocused || !threadId || !unreadOfficeMessages || markedReadBatchRef.current === unreadOfficeMessages) return;
    const batch = unreadOfficeMessages;
    markedReadBatchRef.current = batch;
    const allowRetry = () => {
      if (mounted.current && markedReadBatchRef.current === batch) markedReadBatchRef.current = null;
    };
    void markAsRead().then((result) => {
      if (!result.ok) allowRetry();
    }).catch(allowRetry);
  }, [active, appActive, screenFocused, threadId, detail, unreadOfficeMessages, markAsRead]);

  useEffect(() => {
    if (!detail) return;
    onThreadTitleResolved?.(resolveOfficeThreadParticipantName(detail));
  }, [detail, onThreadTitleResolved]);

  useEffect(() => {
    if (!detail?.messages.length || (employee && (!active || !followsLatest.current))) return;
    const timer = setTimeout(() => {
      if (!employee || followsLatest.current) scrollRef.current?.scrollToEnd({ animated: !employee });
    }, 80);
    return () => clearTimeout(timer);
  }, [active, detail?.messages.length, detail?.id, employee]);

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

  const employeeGroup = detail ? isEmployeeGroupChatThread(detail) : false;
  const employeeHeader = employee ? (
    <View style={[employeeStyles.header, compactEmployeeHeader && employeeStyles.compactHeader]}>
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Zurück zur Liste" testID="messenger-back-to-list"
        onPress={onBack} style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
          employeeStyles.headerButton, focused && agendaFocusRing, pressed && employeeStyles.pressed,
        ]}>
        <Ionicons name="arrow-back-outline" size={21} color={employeeInk.accent} accessible={false} />
      </Pressable> : null}
      <View style={[employeeStyles.headerCopy, compactEmployeeHeader && employeeStyles.compactHeaderCopy]}>
        <View style={[employeeStyles.headerText, compactEmployeeHeader && employeeStyles.compactHeaderText]}>
          <Text style={employeeStyles.kicker}>{employeeGroup ? 'TEAMCHAT' : 'VERWALTUNG'}</Text>
          <Text accessibilityRole="header" aria-level={2} numberOfLines={compactEmployeeHeader ? 2 : 3} style={employeeStyles.title}>
            {detail?.subject?.trim() || 'Gespräch'}
          </Text>
        </View>
        {detail ? <View style={employeeStyles.labels}>
          <EmployeePortalAgendaStatus label={getPortalStatusLabel(detail.status)}
            tone={detail.isClosed ? 'muted' : detail.status === 'waiting_for_reply' || detail.status === 'waiting' ? 'orange' : 'cyan'} />
          {detail.categoryLabel ? <Text style={employeeStyles.small}>{detail.categoryLabel}</Text> : null}
          {employeeGroup && detail.memberCount ? <Text style={employeeStyles.small}>{detail.memberCount} Mitglieder</Text> : null}
        </View> : null}
      </View>
    </View>
  ) : null;

  if (employee && !detail) {
    return (
      <View style={styles.root}>
        {employeeHeader}
        <View style={employeeStyles.empty}>
          {loading ? <ClientRecordLoading message="Gespräch wird geladen…" /> : (
            <>
              <Text style={employeeStyles.title}>{error ? 'Gespräch nicht verfügbar' : 'Gespräch nicht gefunden'}</Text>
              <Text style={employeeStyles.small}>{error ?? 'Öffnen Sie ein Gespräch aus dem Postfach.'}</Text>
              {error ? <EmployeePortalAgendaAction label="Erneut laden" icon="refresh-outline" busy={refreshing} onPress={() => void refresh()} /> : null}
            </>
          )}
        </View>
      </View>
    );
  }

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
    if (sendLock.current || !mayReply) return;
    sendLock.current = true;
    setSendError(null);
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
        followsLatest.current = true;
        setShowLatest(false);
        scrollRef.current?.scrollToEnd({ animated: !employee });
      } else {
        setSendError(toUserFacingSendError(result.error));
      }
    } catch {
      if (mounted.current) setSendError(toUserFacingSendError());
    } finally {
      sendLock.current = false;
    }
  };

  const handleStartNewChat = async () => {
    if (restartLock.current || !mayReply) return;
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
  const showStatusCard = !employee && !hideHeader;
  const trackScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const nearBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 85;
    if (nearBottom === followsLatest.current) return;
    followsLatest.current = nearBottom;
    setShowLatest(!nearBottom);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      enabled={Platform.OS !== 'web'}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
    >
      <View style={officeMessengerColumnStyles.columnRoot}>
        {employeeHeader}
        {!employee && !hideHeader ? (
          <View style={styles.header}>
            <Text style={styles.title}>{headerTitle}</Text>
            <Text style={styles.meta}>{headerSubtitle}</Text>
          </View>
        ) : null}

        {showStatusCard ? <PortalOfficeStatusCard thread={detail} variant={variant} /> : null}

        <ScrollView
          ref={scrollRef}
          style={[officeMessengerColumnStyles.scrollRegion, employee && employeeHistoryScrollbar]}
          contentContainerStyle={[styles.messagesContent, employee && employeeStyles.timeline]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScroll={employee ? trackScroll : undefined}
          scrollEventThrottle={employee ? 32 : undefined}
          onContentSizeChange={() => {
            if (!employee || (active && followsLatest.current)) scrollRef.current?.scrollToEnd({ animated: false });
          }}
        >
          {employee && detail.messages.length === 0 ? <Text style={employeeStyles.noMessages}>Dieses Gespräch enthält noch keine Nachrichten.</Text> : null}
          {detail.messages.map((message, index) => {
            const isVoiceOnly = message.body === '🎤 Sprachnachricht';
            const isOwn = isOwnMessage(message);
            const day = employee ? messageDay(message.sentAt) : null;
            const dayStarts = day && (index === 0 || day !== messageDay(detail.messages[index - 1]!.sentAt));
            return (
              <View key={message.id}>
                {dayStarts ? <View style={employeeStyles.dayDivider}>
                  <View style={employeeStyles.dayLine} />
                  <Text style={employeeStyles.dayLabel}>{day}</Text>
                  <View style={employeeStyles.dayLine} />
                </View> : null}
                {!isVoiceOnly ? (
                  <ChatBubble
                    message={mapOfficeMessageToChatBubble(message)}
                    isOwn={isOwn}
                    showStatus={isOwn}
                    appearance={employee ? 'employee' : undefined}
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
                  onDarkSurface={employee}
                />
              </View>
            );
          })}
        </ScrollView>

        {employee && showLatest ? <View style={employeeStyles.jump}>
          <EmployeePortalAgendaAction label="Neueste Nachrichten" icon="arrow-down-outline" onPress={() => {
            followsLatest.current = true;
            setShowLatest(false);
            scrollRef.current?.scrollToEnd({ animated: false });
          }} />
        </View> : null}

        {detail.isClosed ? (
          <View style={[styles.closedBanner, employee && employeeStyles.closed]}>
            <Text style={employee ? employeeStyles.small : styles.closedText}>
              {isGroup
                ? 'Dieser Gruppen-Chat ist abgeschlossen und schreibgeschützt.'
                : 'Dieser Chat ist abgeschlossen und schreibgeschützt. Bei erneutem Kontakt schreiben Sie der Verwaltung erneut.'}
            </Text>
            {restartError ? <Text accessibilityRole="alert" style={employee ? employeeStyles.error : styles.sendErrorText}>{restartError}</Text> : null}
            {!isGroup && mayReply ? (
              employee ? <EmployeePortalAgendaAction label="Verwaltung anschreiben" icon="create-outline" primary
                busy={restarting} onPress={() => void handleStartNewChat()} /> : useLightUi ? (
                <CareLightButton title="Verwaltung anschreiben" loading={restarting} onPress={() => void handleStartNewChat()} />
              ) : (
                <PremiumButton title="Verwaltung anschreiben" loading={restarting} onPress={() => void handleStartNewChat()} />
              )
            ) : null}
          </View>
        ) : (
          <>
            {sendError ? (
              <View style={styles.sendErrorWrap}>
                <Text accessibilityRole="alert" style={employee ? employeeStyles.error : styles.sendErrorText}>{sendError}</Text>
                {employee ? <EmployeePortalAgendaAction label="Erneut senden" icon="refresh-outline" busy={sending}
                  onPress={() => void handleSend()} /> : useLightUi ? (
                  <CareLightButton title="Erneut senden" variant="secondary" disabled={sending} onPress={() => void handleSend()} />
                ) : (
                  <PremiumButton title="Erneut senden" size="sm" disabled={sending} onPress={() => void handleSend()} />
                )}
              </View>
            ) : null}
            <View style={[styles.composerWrap, employee && employeeStyles.composer]}>
              {employee && !mayReply ? <Text style={employeeStyles.readOnly}>Antworten sind für dieses Konto derzeit nicht freigegeben.</Text> : (
                <>
                {!mayReply ? <Text style={styles.meta}>Dieser Angehörigenzugang erlaubt das Lesen von Nachrichten. Das Senden ist nicht freigegeben.</Text> : null}
                <OfficeMessageComposer
                text={draft}
                onChangeText={setDraft}
                onSend={handleSend}
                sending={sending}
                disabled={sending || !mayReply}
                onDarkSurface={employee || onDarkSurface}
                appearance={employee ? 'employee' : undefined}
                pendingAttachments={pendingAttachments}
                onPendingAttachmentsChange={setPendingAttachments}
                attachmentError={attachmentError}
                onAttachmentError={setAttachmentError}
              />
                </>
              )}
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const employeeHistoryScrollbar = Platform.OS === 'web' ? ({
  scrollbarWidth: 'thin', scrollbarColor: 'rgba(188,238,255,0.48) transparent', overscrollBehaviorY: 'contain',
} as ViewStyle) : null;

const employeeStyles = StyleSheet.create(withCareSuiteTypography({
  header: { flexShrink: 0, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 11, backgroundColor: employeeInk.control, borderBottomWidth: 1, borderBottomColor: employeeInk.line },
  compactHeader: { alignItems: 'center', paddingVertical: 7 },
  headerButton: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    backgroundColor: employeeInk.raised, borderWidth: 1, borderColor: employeeInk.line, borderRadius: 11 },
  pressed: { opacity: 0.76 },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  compactHeaderCopy: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  headerText: { minWidth: 0, gap: 4 },
  compactHeaderText: { flexGrow: 1, flexBasis: '48%', maxWidth: '100%', gap: 1 },
  kicker: { color: employeeInk.accent, letterSpacing: 1.1, fontSize: font(10), lineHeight: font(15), fontWeight: '700' },
  title: { color: employeeInk.text, fontSize: font(20), lineHeight: font(26), fontWeight: '700', ...clientRecordTextWrap },
  labels: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', maxWidth: '100%', gap: 7 },
  small: { color: employeeInk.muted, fontSize: font(13), lineHeight: font(19), ...clientRecordTextWrap },
  empty: { flex: 1, minHeight: 0, justifyContent: 'center', alignItems: 'flex-start', gap: 10, padding: 16 },
  timeline: { width: '100%', maxWidth: 880, alignSelf: 'center' },
  dayDivider: { marginHorizontal: 12, marginVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayLine: { flex: 1, height: 1, backgroundColor: employeeInk.line },
  dayLabel: { color: employeeInk.muted, flexShrink: 1, textAlign: 'center', fontSize: font(12), lineHeight: font(18) },
  noMessages: { color: employeeInk.muted, padding: 15, fontSize: font(13), lineHeight: font(19) },
  jump: { alignSelf: 'center', paddingVertical: 4 },
  closed: { margin: 10, padding: 11, backgroundColor: employeeInk.control, borderRadius: 12, borderWidth: 1, borderColor: employeeInk.line },
  error: { color: employeeInk.danger, fontSize: font(12), lineHeight: font(18), ...clientRecordTextWrap },
  composer: { backgroundColor: employeeInk.canvas },
  readOnly: { color: employeeInk.muted, padding: 11, fontSize: font(13), lineHeight: font(19) },
}));
