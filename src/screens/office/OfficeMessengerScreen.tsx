import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { OfficeBroadcastDetail } from '@/components/office/officebroadcastdetail';
import { OfficeBroadcastModal } from '@/components/office/officebroadcastmodal';
import { OfficeBroadcastsList } from '@/components/office/officebroadcastslist';
import { OfficeMessageContextPanel } from '@/components/office/officemessagecontextpanel';
import { OfficeMessageThread } from '@/components/office/officemessagethread';
import { OfficeMessagesInbox } from '@/components/office/officemessagesinbox';
import { OfficeNewChatModal, type NewChatMode } from '@/components/office/officenewchatmodal';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useOfficeMessageThreadDetail } from '@/hooks/useofficemessagethreaddetail';
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
const CONTEXT_COLUMN_BREAKPOINT = 960;
const CONTEXT_PANEL_WIDTH = 320;
const INBOX_COLUMN_WIDTH = 340;

function parseInboxFilter(value: unknown): OfficeInboxFilter {
  return INBOX_FILTERS.includes(value as OfficeInboxFilter) ? (value as OfficeInboxFilter) : 'inbox';
}

function parseMessengerTab(value: unknown): MessengerTab {
  return value === 'broadcasts' ? 'broadcasts' : 'messages';
}

export function OfficeMessengerScreen() {
  const params = useLocalSearchParams<{ filter?: string; tab?: string; thread?: string }>();
  const { height, width } = useWindowDimensions();
  const { shellVariant } = usePlatformLayout();
  const { c } = useCareLightPalette();
  const { permissions, isReadOnly, roleKey } = usePermissions();
  const canBroadcast = canCreateBroadcast(roleKey, permissions);
  const showContextColumn = shellVariant === 'desktop' || width >= CONTEXT_COLUMN_BREAKPOINT;

  const [tab, setTab] = useState<MessengerTab>(() => parseMessengerTab(params.tab));
  const [filter, setFilter] = useState<OfficeInboxFilter>(() => parseInboxFilter(params.filter));
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newChatMode, setNewChatMode] = useState<NewChatMode | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  const threadDetail = useOfficeMessageThreadDetail(selectedThreadId);
  const { markAsRead, refresh: refreshThreadDetail, detail, updateStatus, assignSelf, updatePriority, updateCategory } =
    threadDetail;

  useEffect(() => {
    if (selectedThreadId) {
      void markAsRead();
    }
  }, [selectedThreadId, markAsRead]);

  useEffect(() => {
    setTab(parseMessengerTab(params.tab));
  }, [params.tab]);

  useEffect(() => {
    setFilter(parseInboxFilter(params.filter));
  }, [params.filter]);

  useEffect(() => {
    const threadParam = params.thread;
    if (typeof threadParam === 'string' && threadParam.trim()) {
      setSelectedThreadId(threadParam);
      setTab('messages');
    }
  }, [params.thread]);

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
          width: INBOX_COLUMN_WIDTH,
          maxWidth: '38%',
          minWidth: 280,
          borderRightWidth: 1,
          borderRightColor: c.borderSoft,
        },
        detailPane: {
          flex: 1,
          minWidth: 0,
        },
        contextPane: {
          width: CONTEXT_PANEL_WIDTH,
          maxWidth: '26%',
          minWidth: 240,
          borderLeftWidth: 1,
          borderLeftColor: c.borderSoft,
        },
      }),
    [c, height],
  );

  const handleThreadUpdated = () => {
    void refreshThreadDetail();
  };

  return (
    <ScreenShell
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
              <PremiumButton
                title="Neuer Klient:innen-Chat"
                onPress={() => setNewChatMode('client')}
                disabled={isReadOnly}
              />
              <PremiumButton
                title="Neuer Mitarbeitenden-Chat"
                onPress={() => setNewChatMode('employee')}
                disabled={isReadOnly}
              />
              <PremiumButton
                title="Neuer interner Chat"
                onPress={() => setNewChatMode('internal')}
                disabled={isReadOnly}
              />
              {canBroadcast ? (
                <PremiumButton
                  title="Broadcast senden"
                  variant="secondary"
                  onPress={() => setShowBroadcastModal(true)}
                />
              ) : null}
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
            {showContextColumn ? (
              <View style={[officeMessengerColumnStyles.columnRoot, styles.contextPane]}>
                <OfficeMessageContextPanel
                  thread={detail ?? null}
                  readOnly={isReadOnly}
                  onThreadUpdated={handleThreadUpdated}
                  onUpdateStatus={async (status) => {
                    const result = await updateStatus(status);
                    handleThreadUpdated();
                    return { ok: result.ok, error: result.ok ? undefined : result.error };
                  }}
                  onAssignSelf={async () => {
                    const result = await assignSelf();
                    handleThreadUpdated();
                    return { ok: result.ok, error: result.ok ? undefined : result.error };
                  }}
                  onUpdatePriority={async (priority) => {
                    const result = await updatePriority(priority);
                    handleThreadUpdated();
                    return { ok: result.ok, error: result.ok ? undefined : result.error };
                  }}
                  onUpdateCategory={async (categoryId) => {
                    const result = await updateCategory(categoryId);
                    handleThreadUpdated();
                    return { ok: result.ok, error: result.ok ? undefined : result.error };
                  }}
                />
              </View>
            ) : null}
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
    </ScreenShell>
  );
}
