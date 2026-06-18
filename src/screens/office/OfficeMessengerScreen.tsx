import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { OfficeBroadcastDetail } from '@/components/office/officebroadcastdetail';
import { OfficeBroadcastModal } from '@/components/office/officebroadcastmodal';
import { OfficeBroadcastsList } from '@/components/office/officebroadcastslist';
import { OfficeMessageThread } from '@/components/office/officemessagethread';
import { OfficeMessagesInbox } from '@/components/office/officemessagesinbox';
import { OfficeNewChatModal, type NewChatMode } from '@/components/office/officenewchatmodal';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { usePermissions } from '@/hooks/usePermissions';
import { canCreateBroadcast } from '@/lib/office/broadcastpermissions';
import {
  officeMessengerColumnStyles,
  officeMessengerContainerHeight,
} from '@/components/office/officemessengerlayout';
import type { OfficeInboxFilter } from '@/types/office/messaging';
import { spacing, radius } from '@/theme';

type MessengerTab = 'messages' | 'broadcasts';

const INBOX_FILTERS: OfficeInboxFilter[] = ['inbox', 'clients', 'employees', 'internal', 'closed'];

function parseInboxFilter(value: unknown): OfficeInboxFilter {
  return INBOX_FILTERS.includes(value as OfficeInboxFilter) ? (value as OfficeInboxFilter) : 'inbox';
}

function parseMessengerTab(value: unknown): MessengerTab {
  return value === 'broadcasts' ? 'broadcasts' : 'messages';
}

export function OfficeMessengerScreen() {
  const params = useLocalSearchParams<{ filter?: string; tab?: string }>();
  const { height } = useWindowDimensions();
  const { c } = useCareLightPalette();
  const { permissions, isReadOnly, roleKey } = usePermissions();
  const canBroadcast = canCreateBroadcast(roleKey, permissions);

  const [tab, setTab] = useState<MessengerTab>(() => parseMessengerTab(params.tab));
  const [filter, setFilter] = useState<OfficeInboxFilter>(() => parseInboxFilter(params.filter));
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newChatMode, setNewChatMode] = useState<NewChatMode | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  useEffect(() => {
    setTab(parseMessengerTab(params.tab));
  }, [params.tab]);

  useEffect(() => {
    setFilter(parseInboxFilter(params.filter));
  }, [params.filter]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: officeMessengerContainerHeight(height),
        tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        tabChip: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: c.borderSoft,
        },
        tabChipActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
        tabText: { color: c.textSecondary, fontWeight: '600' },
        tabTextActive: { color: c.accent, fontWeight: '700' },
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        messenger: {
          flex: 1,
          minHeight: 0,
          flexDirection: 'row',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.borderSoft,
          overflow: 'hidden',
          backgroundColor: c.bgPanel,
        },
        listPane: {
          width: 340,
          maxWidth: '38%',
          minWidth: 280,
          borderRightWidth: 1,
          borderRightColor: c.borderSoft,
        },
        detailPane: {
          flex: 1,
          minWidth: 0,
        },
      }),
    [c, height],
  );

  return (
    <CareLightPageShell
      title={tab === 'broadcasts' ? 'Broadcast' : 'Nachrichten'}
      subtitle="Office Kommunikation"
      scroll={false}
    >
      <View style={styles.root}>
        <View style={styles.tabs}>
          <Pressable
            onPress={() => setTab('messages')}
            style={[styles.tabChip, tab === 'messages' && styles.tabChipActive]}
          >
            <Text style={[styles.tabText, tab === 'messages' && styles.tabTextActive]}>Chats</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('broadcasts')}
            style={[styles.tabChip, tab === 'broadcasts' && styles.tabChipActive]}
          >
            <Text style={[styles.tabText, tab === 'broadcasts' && styles.tabTextActive]}>Broadcast</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          {tab === 'messages' ? (
            <>
              <PremiumButton title="Klient:innen-Chat" onPress={() => setNewChatMode('client')} disabled={isReadOnly} />
              <PremiumButton title="Mitarbeitenden-Chat" onPress={() => setNewChatMode('employee')} disabled={isReadOnly} />
              <PremiumButton title="Interner Chat" onPress={() => setNewChatMode('internal')} disabled={isReadOnly} />
            </>
          ) : canBroadcast ? (
            <PremiumButton title="Broadcast senden" onPress={() => setShowBroadcastModal(true)} />
          ) : null}
        </View>

        {tab === 'messages' ? (
          <View style={styles.messenger}>
            <View style={[officeMessengerColumnStyles.columnRoot, styles.listPane]}>
              <OfficeMessagesInbox
                filter={filter}
                onFilterChange={setFilter}
                selectedThreadId={selectedThreadId}
                onThreadSelect={setSelectedThreadId}
                search={search}
                onSearchChange={setSearch}
              />
            </View>
            <View style={[officeMessengerColumnStyles.columnRoot, styles.detailPane]}>
              <OfficeMessageThread
                threadId={selectedThreadId}
                onNewThreadStarted={(threadId) => {
                  setSelectedThreadId(threadId);
                  setFilter('inbox');
                }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.messenger}>
            <View style={[officeMessengerColumnStyles.columnRoot, styles.listPane]}>
              <OfficeBroadcastsList
                selectedId={selectedBroadcastId}
                onSelect={setSelectedBroadcastId}
              />
            </View>
            <View style={[officeMessengerColumnStyles.columnRoot, styles.detailPane]}>
              <OfficeBroadcastDetail
                broadcastId={selectedBroadcastId}
                onArchived={() => {
                  setSelectedBroadcastId(null);
                }}
              />
            </View>
          </View>
        )}
      </View>

      {newChatMode ? (
        <OfficeNewChatModal
          visible
          mode={newChatMode}
          onClose={() => setNewChatMode(null)}
          onCreated={(threadId) => {
            setSelectedThreadId(threadId);
            setFilter('inbox');
            setNewChatMode(null);
          }}
        />
      ) : null}

      {showBroadcastModal ? (
        <OfficeBroadcastModal
          visible
          onClose={() => setShowBroadcastModal(false)}
          onSent={() => {
            setShowBroadcastModal(false);
            setTab('broadcasts');
          }}
        />
      ) : null}
    </CareLightPageShell>
  );
}
