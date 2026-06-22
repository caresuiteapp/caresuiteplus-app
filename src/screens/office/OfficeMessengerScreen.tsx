import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { OfficeBroadcastDetailModal } from '@/components/office/officebroadcastdetailmodal';
import { OfficeBroadcastModal } from '@/components/office/officebroadcastmodal';
import { OfficeBroadcastsList } from '@/components/office/officebroadcastslist';
import { OfficeMessageThreadModal } from '@/components/office/officemessagethreadmodal';
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

const INBOX_FILTERS: OfficeInboxFilter[] = ['inbox', 'clients', 'employees', 'internal', 'closed'];

function parseInboxFilter(value: unknown): OfficeInboxFilter {
  return INBOX_FILTERS.includes(value as OfficeInboxFilter) ? (value as OfficeInboxFilter) : 'inbox';
}

function isBroadcastView(value: unknown): boolean {
  return value === 'broadcasts';
}

export function OfficeMessengerScreen() {
  const params = useLocalSearchParams<{ filter?: string; tab?: string; thread?: string }>();
  const { height } = useWindowDimensions();
  const { c } = useCareLightPalette();
  const { permissions, isReadOnly, roleKey } = usePermissions();
  const canBroadcast = canCreateBroadcast(roleKey, permissions);
  const showBroadcastList = isBroadcastView(params.tab);

  const [filter, setFilter] = useState<OfficeInboxFilter>(() => parseInboxFilter(params.filter));
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadModalOpen, setThreadModalOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [broadcastDetailOpen, setBroadcastDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newChatMode, setNewChatMode] = useState<NewChatMode | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  useEffect(() => {
    setFilter(parseInboxFilter(params.filter));
  }, [params.filter]);

  useEffect(() => {
    const threadParam = params.thread;
    if (typeof threadParam === 'string' && threadParam.trim()) {
      setSelectedThreadId(threadParam);
      setThreadModalOpen(true);
    }
  }, [params.thread]);

  const openThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setThreadModalOpen(true);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: officeMessengerContainerHeight(height),
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        messenger: {
          flex: 1,
          minHeight: 0,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.borderSoft,
          overflow: 'hidden',
          backgroundColor: c.bgPanel,
        },
        listPane: {
          flex: 1,
          minWidth: 0,
        },
      }),
    [c, height],
  );

  return (
    <ScreenShell
      title={showBroadcastList ? 'Broadcast' : 'Nachrichten'}
      subtitle="Office Kommunikation"
      scroll={false}
    >
      <View style={styles.root}>
        {!showBroadcastList ? (
          <View style={styles.actions}>
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
          </View>
        ) : canBroadcast ? (
          <View style={styles.actions}>
            <PremiumButton title="Broadcast senden" onPress={() => setShowBroadcastModal(true)} />
          </View>
        ) : null}

        <View style={styles.messenger}>
          <View style={[officeMessengerColumnStyles.columnRoot, styles.listPane]}>
            {showBroadcastList ? (
              <OfficeBroadcastsList
                selectedId={selectedBroadcastId}
                onSelect={(id) => {
                  setSelectedBroadcastId(id);
                  setBroadcastDetailOpen(true);
                }}
              />
            ) : (
              <OfficeMessagesInbox
                filter={filter}
                onFilterChange={setFilter}
                selectedThreadId={selectedThreadId}
                onThreadSelect={openThread}
                search={search}
                onSearchChange={setSearch}
              />
            )}
          </View>
        </View>
      </View>

      <OfficeMessageThreadModal
        visible={threadModalOpen}
        threadId={selectedThreadId}
        readOnly={isReadOnly}
        onClose={() => setThreadModalOpen(false)}
        onNewThreadStarted={(threadId) => {
          openThread(threadId);
          setFilter('inbox');
        }}
      />

      <OfficeBroadcastDetailModal
        visible={broadcastDetailOpen}
        broadcastId={selectedBroadcastId}
        onClose={() => setBroadcastDetailOpen(false)}
        onArchived={() => {
          setSelectedBroadcastId(null);
        }}
        onOpenThread={(threadId) => {
          setBroadcastDetailOpen(false);
          openThread(threadId);
        }}
      />

      {newChatMode ? (
        <OfficeNewChatModal
          visible
          mode={newChatMode}
          onClose={() => setNewChatMode(null)}
          onCreated={(threadId) => {
            setNewChatMode(null);
            setFilter('inbox');
            openThread(threadId);
          }}
        />
      ) : null}

      {showBroadcastModal ? (
        <OfficeBroadcastModal
          visible
          onClose={() => setShowBroadcastModal(false)}
          onSent={() => {
            setShowBroadcastModal(false);
          }}
        />
      ) : null}
    </ScreenShell>
  );
}
