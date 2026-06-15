import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChatBubble,
  ChatComposer,
  ConversationContextPanel,
  MessageAssignmentPanel,
  MessageAttachmentCard,
  TypingIndicator,
  VoiceMessageBubble,
} from '@/components/communication';
import { PortalRelativeConversationHero } from '@/components/portal/PortalRelativeConversationHero';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { assignThread } from '@/features/communication/communication.assignments';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isDemoMode } from '@/lib/supabase/config';
import {
  useAttachments,
  useCommunicationPermissions,
  useCommunicationRealtime,
  useMessageAssignments,
  useMessageComposer,
  useMessages,
  useSendMessage,
  useThread,
} from '@/hooks/communication';
import { useAuth } from '@/lib/auth/context';
import { resolvePortalScope } from '@/lib/portal/portalVisibility';
import { colors, spacing } from '@/theme';

export function ConversationScreen({
  threadId: threadIdProp,
  embedded = false,
}: {
  threadId?: string;
  embedded?: boolean;
} = {}) {
  const params = useLocalSearchParams<{ threadId?: string; id?: string }>();
  const threadId = threadIdProp ?? params.threadId ?? params.id;
  const showBack = !embedded;
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const portalScope = resolvePortalScope(profile?.roleKey ?? null);
  const perms = useCommunicationPermissions();
  const { thread, loading, error, refresh, notFound } = useThread(threadId);
  const { messages, refresh: refreshMessages } = useMessages(threadId);
  const { attachments } = useAttachments(threadId);
  const { suggestions } = useMessageAssignments(threadId);
  const composer = useMessageComposer();
  const { send, loading: sending } = useSendMessage(threadId);
  const [assigning, setAssigning] = useState(false);
  const { isRealtimeConnected, demoMode } = useCommunicationRealtime(threadId, () => {
    refreshMessages();
  });

  const handleSend = useCallback(async () => {
    if (!composer.canSend) return;
    const result = await send({
      bodyText: composer.text,
      isInternalNote: composer.isInternalNote,
      replyToMessageId: composer.replyToId,
    });
    if (result) {
      composer.reset();
      await refreshMessages();
    }
  }, [composer, send, refreshMessages]);

  const handleAssign = useCallback(
    async (suggestion: (typeof suggestions)[number]) => {
      setAssigning(true);
      if (!tenantId || !threadId) return;
      await assignThread(
        tenantId,
        threadId,
        suggestion.targetType,
        suggestion.targetId,
        profile?.roleKey,
        profile?.id,
      );
      setAssigning(false);
    },
    [threadId, tenantId, profile?.roleKey, profile?.id],
  );

  if (!perms.canViewCenter && !perms.canViewPortal) {
    return (
      <ScreenShell title="Konversation">
        <LockedActionBanner message="Keine Berechtigung." />
      </ScreenShell>
    );
  }

  if (loading) {
    return (
      <ScreenShell title="Konversation">
        <LoadingState message="Konversation wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error || !thread) {
    return (
      <ScreenShell title="Konversation">
        <ErrorState message={error ?? 'Thread nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const voiceAttachments = attachments.filter((a) => a.attachmentType === 'voice');
  const fileAttachments = attachments.filter((a) => a.attachmentType !== 'voice');

  return (
    <ScreenShell
      title={thread.title}
      subtitle={demoMode ? 'Demo · Realtime simuliert' : isRealtimeConnected ? 'Live' : 'Offline'}
      scroll={false}
      showBack={showBack}
      showBreadcrumbs={!embedded}
      rightSlot={
        showBack ? (
          <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
        ) : null
      }
    >
      <View style={styles.container}>
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messages}
          ListHeaderComponent={
            <>
              {portalScope === 'portal_family' ? (
                <PortalRelativeConversationHero thread={thread} messageCount={messages.length} />
              ) : null}
              <ConversationContextPanel thread={thread} />
              {perms.canAssign ? (
                <MessageAssignmentPanel
                  suggestions={suggestions}
                  onAssign={handleAssign}
                  loading={assigning}
                />
              ) : null}
            </>
          }
          renderItem={({ item }) => {
            const isOwn =
              item.senderType === 'business_user' ||
              (item.senderUserId && item.senderUserId === profile?.id);
            return (
              <>
                <ChatBubble message={item} isOwn={!!isOwn} />
                {fileAttachments
                  .filter((a) => a.messageId === item.id)
                  .map((a) => (
                    <MessageAttachmentCard key={a.id} attachment={a} />
                  ))}
                {voiceAttachments
                  .filter((a) => a.messageId === item.id)
                  .map((a) => (
                    <VoiceMessageBubble key={a.id} attachment={a} isOwn={!!isOwn} />
                  ))}
              </>
            );
          }}
        />
        <TypingIndicator visible={isRealtimeConnected && demoMode} />
        <ChatComposer
          text={composer.text}
          onChangeText={composer.setText}
          onSend={handleSend}
          isInternalNote={composer.isInternalNote}
          onToggleInternalNote={() => composer.setIsInternalNote(!composer.isInternalNote)}
          showInternalToggle={perms.canSendInternalNote}
          sending={sending}
          disabled={!perms.canSendMessage && !perms.canReplyPortal}
          quickEmojis={composer.quickEmojis}
          onEmojiPress={composer.appendEmoji}
          voicePreparedOnly={!isDemoMode()}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messages: { gap: spacing.sm, paddingBottom: spacing.md },
});
