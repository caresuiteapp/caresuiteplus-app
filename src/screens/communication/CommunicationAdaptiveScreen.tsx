import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { CommunicationCenterListView } from '@/components/communication/CommunicationCenterListView';
import { MessengerShell, messengerScreenRootStyle } from '@/components/messaging';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { ErrorState, LoadingState } from '@/components/ui';
import { useCommunicationCenter, useCommunicationPermissions } from '@/hooks/communication';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { ConversationScreen } from './ConversationScreen';

export function CommunicationAdaptiveScreen() {
  const { height } = useWindowDimensions();
  const { useMasterDetail } = usePlatformLayout();
  const perms = useCommunicationPermissions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState('Konversation');
  const mobileChatActive = !useMasterDetail && !!selectedId;

  const { threads, loading, error, refresh } = useCommunicationCenter();

  const handleThreadPress = (threadId: string) => {
    const thread = threads.find((item) => item.id === threadId);
    setSelectedId(threadId);
    if (thread?.title) setSelectedTitle(thread.title);
  };

  if (!perms.canViewCenter) {
    return (
      <ScreenShell title="Nachrichten" showBack={false} scroll={false}>
        <LockedActionBanner message="Keine Berechtigung für das Kommunikationszentrum." />
      </ScreenShell>
    );
  }

  if (loading && threads.length === 0) {
    return (
      <ScreenShell title="Nachrichten" subtitle="Wird geladen…" showBack={false} scroll={false}>
        <LoadingState message="Nachrichten werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && threads.length === 0) {
    return (
      <ScreenShell title="Nachrichten" subtitle="Fehler" showBack={false} scroll={false}>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const chatThread = selectedId ? <ConversationScreen threadId={selectedId} embedded /> : null;

  return (
    <ScreenShell
      title={mobileChatActive ? selectedTitle : 'Nachrichten'}
      subtitle={mobileChatActive ? undefined : 'Kommunikationszentrum'}
      showBack={mobileChatActive}
      onBack={mobileChatActive ? () => setSelectedId(null) : undefined}
      scroll={false}
    >
      <View style={[styles.root, messengerScreenRootStyle(height)]}>
        {mobileChatActive ? (
          chatThread
        ) : (
          <MessengerShell
            inbox={
              <CommunicationCenterListView
                embedded
                selectedId={selectedId}
                onThreadPress={handleThreadPress}
              />
            }
            thread={chatThread}
            selectedThreadId={selectedId}
            onCloseThread={() => setSelectedId(null)}
            threadTitle={selectedTitle}
          />
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
});
