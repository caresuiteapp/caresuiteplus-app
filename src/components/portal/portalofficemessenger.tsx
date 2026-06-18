import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { PortalNewChatModal } from '@/components/portal/portalnewchatmodal';
import { PortalOfficeInbox } from '@/components/portal/portalofficeinbox';
import { PortalOfficeThread } from '@/components/portal/portalofficethread';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import type { PortalOfficeAudience, PortalOfficeInboxFilter } from '@/lib/office/portalofficemessageservice';

type PortalOfficeMessengerProps = {
  audience: PortalOfficeAudience;
  title?: string;
};

export function PortalOfficeMessenger({ audience, title = 'Nachrichten ans Büro' }: PortalOfficeMessengerProps) {
  const { width } = useWindowDimensions();
  const { c } = useCareLightPalette();
  const { colors } = useLegacyTheme();
  const [filter, setFilter] = useState<PortalOfficeInboxFilter>('open');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  const isCompact = width < 768;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, gap: spacing.md },
        header: { gap: spacing.sm },
        title: { fontSize: 20, fontWeight: '700', color: c.text },
        messenger: {
          flex: 1,
          minHeight: 420,
          flexDirection: 'row',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          overflow: 'hidden',
        },
        inboxPane: {
          width: isCompact ? '100%' : 300,
          maxWidth: isCompact ? '100%' : 340,
          minWidth: isCompact ? 0 : 260,
          borderRightWidth: isCompact ? 0 : 1,
          borderRightColor: c.border,
          display: selectedThreadId && isCompact ? 'none' : 'flex',
        },
        threadPane: {
          flex: 1,
          minWidth: 0,
          display: !selectedThreadId && isCompact ? 'none' : 'flex',
          backgroundColor: colors.bgBase,
        },
      }),
    [c, colors.bgBase, isCompact, selectedThreadId],
  );

  useEffect(() => {
    if (isCompact && !selectedThreadId) return;
  }, [isCompact, selectedThreadId]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <PremiumButton title="Neuer Chat ans Büro" onPress={() => setShowNewChat(true)} />
      </View>

      <View style={styles.messenger}>
        <View style={styles.inboxPane}>
          <PortalOfficeInbox
            filter={filter}
            onFilterChange={setFilter}
            selectedThreadId={selectedThreadId}
            onThreadSelect={setSelectedThreadId}
            search={search}
            onSearchChange={setSearch}
          />
        </View>
        <View style={styles.threadPane}>
          <PortalOfficeThread
            threadId={selectedThreadId}
            onNewThreadStarted={(newThreadId) => {
              setSelectedThreadId(newThreadId);
              setFilter('open');
            }}
          />
        </View>
      </View>

      {showNewChat ? (
        <PortalNewChatModal
          visible
          audience={audience}
          onClose={() => setShowNewChat(false)}
          onCreated={(threadId) => {
            setSelectedThreadId(threadId);
            setFilter('open');
            setShowNewChat(false);
          }}
        />
      ) : null}
    </View>
  );
}
