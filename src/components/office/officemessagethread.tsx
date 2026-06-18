import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChatBubble } from '@/components/communication/ChatBubble';
import { ChatComposer } from '@/components/communication/ChatComposer';
import { OfficeMessageThreadHeader } from '@/components/office/officemessagethreadheader';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';
import { useOfficeMessageThreadDetail } from '@/hooks/useofficemessagethreaddetail';
import { mapOfficeMessageToChatBubble } from '@/lib/office/officemessagemappers';
import { officeMessengerEmptyStyles } from '@/components/office/officemessengerlayout';

type OfficeMessageThreadProps = {
  threadId: string | null;
  onNewThreadStarted?: (newThreadId: string) => void;
  hideHeader?: boolean;
};

export function OfficeMessageThread({
  threadId,
  onNewThreadStarted,
  hideHeader = false,
}: OfficeMessageThreadProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const [draft, setDraft] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const { detail, loading, error, sending, sendMessage, startNewChat, refresh } =
    useOfficeMessageThreadDetail(threadId);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minWidth: 0 },
        messages: { flex: 1 },
        messagesContent: { paddingVertical: spacing.md },
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
    const result = await sendMessage(draft, { isInternalNote });
    if (result.ok) {
      setDraft('');
      setIsInternalNote(false);
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

      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {detail.messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={mapOfficeMessageToChatBubble(message)}
            isOwn={message.senderType === 'office_profile'}
          />
        ))}
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
        <ChatComposer
          text={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          sending={sending}
          showInternalToggle
          isInternalNote={isInternalNote}
          onToggleInternalNote={() => setIsInternalNote((value) => !value)}
        />
      )}
    </View>
  );
}
