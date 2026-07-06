import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PortalNewChatModal } from '@/components/portal/portalnewchatmodal';
import { PortalOfficeInbox } from '@/components/portal/portalofficeinbox';
import { PortalOfficeThread } from '@/components/portal/portalofficethread';
import { MessengerShell } from '@/components/messaging';
import { PremiumButton } from '@/components/ui';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing } from '@/theme';
import type { PortalOfficeAudience, PortalOfficeInboxFilter } from '@/lib/office/portalofficemessageservice';

type PortalOfficeMessengerProps = {
  audience: PortalOfficeAudience;
  title?: string;
  variant?: 'default' | 'glass';
  composeLabel?: string;
  /** Open compose modal on mount (e.g. from overview KPI deep link). */
  initialComposeOpen?: boolean;
};

export function PortalOfficeMessenger({
  audience,
  variant = 'default',
  composeLabel = 'Verwaltung anschreiben',
  initialComposeOpen = false,
}: PortalOfficeMessengerProps) {
  const { useMasterDetail } = usePlatformLayout();
  const [filter, setFilter] = useState<PortalOfficeInboxFilter>('open');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThreadTitle, setSelectedThreadTitle] = useState('Chat');
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(initialComposeOpen);

  useEffect(() => {
    if (initialComposeOpen) setShowNewChat(true);
  }, [initialComposeOpen]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          minHeight: 0,
          gap: variant === 'glass' ? careSpacing.md : spacing.md,
          width: '100%',
        },
        header: {
          flexShrink: 0,
        },
        body: {
          flex: 1,
          minHeight: 0,
        },
      }),
    [variant],
  );

  const openThread = (threadId: string, subject?: string) => {
    setSelectedThreadId(threadId);
    if (subject) setSelectedThreadTitle(subject);
  };

  const closeThread = () => setSelectedThreadId(null);

  const threadPane = selectedThreadId ? (
    <PortalOfficeThread
      threadId={selectedThreadId}
      variant={variant}
      hideHeader={!useMasterDetail}
      onNewThreadStarted={(newThreadId) => {
        openThread(newThreadId);
        setFilter('open');
      }}
    />
  ) : null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <PremiumButton title={composeLabel} onPress={() => setShowNewChat(true)} />
      </View>

      <View style={styles.body}>
        <MessengerShell
          variant={variant}
          inbox={
            <PortalOfficeInbox
              filter={filter}
              onFilterChange={setFilter}
              selectedThreadId={selectedThreadId}
              onThreadSelect={openThread}
              search={search}
              onSearchChange={setSearch}
              variant={variant}
              onCompose={() => setShowNewChat(true)}
              composeLabel={composeLabel}
            />
          }
          thread={threadPane}
          selectedThreadId={selectedThreadId}
          onCloseThread={closeThread}
          threadTitle={selectedThreadTitle}
        />
      </View>

      {showNewChat ? (
        <PortalNewChatModal
          visible
          audience={audience}
          variant={variant}
          onClose={() => setShowNewChat(false)}
          onCreated={(threadId) => {
            openThread(threadId);
            setFilter('open');
            setShowNewChat(false);
          }}
        />
      ) : null}
    </View>
  );
}
