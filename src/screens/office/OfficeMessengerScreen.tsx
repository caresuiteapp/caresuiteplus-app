import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AuroraSegmentedControl } from '@/components/aurora';
import { ScreenShell } from '@/components/layout';
import { OfficeBroadcastDetailModal } from '@/components/office/officebroadcastdetailmodal';
import { OfficeBroadcastModal } from '@/components/office/officebroadcastmodal';
import { OfficeBroadcastsList } from '@/components/office/officebroadcastslist';
import { OfficeMessageThreadModal } from '@/components/office/officemessagethreadmodal';
import { OfficeMessagesInbox } from '@/components/office/officemessagesinbox';
import { OfficeNewChatModal, type NewChatMode } from '@/components/office/officenewchatmodal';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePermissions } from '@/hooks/usePermissions';
import { canViewOfficeInternalMessages } from '@/lib/communication/officeComposeRouting';
import { canCreateBroadcast } from '@/lib/office/broadcastpermissions';
import {
  OFFICE_AUDIENCE_LABELS,
  OFFICE_MESSAGE_AUDIENCES,
  OFFICE_MESSENGER_VIEWS,
  newChatModeForAudience,
  parseOfficeChatAgeFilter,
  parseOfficeMessageAudience,
  parseOfficeMessengerView,
} from '@/lib/office/officemessengerfilters';
import { setOfficeMessageNavBadgeMessengerView } from '@/lib/office/officeMessageNavBadgeSeenStore';
import {
  officeMessengerColumnStyles,
  officeMessengerContainerHeight,
} from '@/components/office/officemessengerlayout';
import type {
  OfficeChatAgeFilter,
  OfficeMessageAudience,
  OfficeMessengerView,
} from '@/types/office/messaging';
import { spacing, radius } from '@/theme';

const NEW_CHAT_LABELS: Record<OfficeMessageAudience, string> = {
  clients: 'Neuer Klient:innen-Chat',
  employees: 'Neuer Mitarbeitenden-Chat',
  internal: 'Neuer interner Chat',
};

const BROADCAST_LABELS: Record<OfficeMessageAudience, string> = {
  clients: 'Broadcast an Klient:innen',
  employees: 'Broadcast an Mitarbeitende',
  internal: 'Broadcast an Leitung/Verwaltung',
};

export function OfficeMessengerScreen() {
  const params = useLocalSearchParams<{
    audience?: string;
    filter?: string;
    chatAge?: string;
    view?: string;
    tab?: string;
    thread?: string;
  }>();
  const { height } = useWindowDimensions();
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { permissions, isReadOnly, roleKey } = usePermissions();
  const canBroadcast = canCreateBroadcast(roleKey, permissions);
  const canViewInternal = canViewOfficeInternalMessages(roleKey);

  const audienceOptions = useMemo(
    () =>
      canViewInternal
        ? OFFICE_MESSAGE_AUDIENCES
        : OFFICE_MESSAGE_AUDIENCES.filter((item) => item.key !== 'internal'),
    [canViewInternal],
  );

  const [audience, setAudience] = useState<OfficeMessageAudience>(() =>
    parseOfficeMessageAudience(params.audience ?? params.filter),
  );
  const [view, setView] = useState<OfficeMessengerView>(() =>
    parseOfficeMessengerView(params.view, params.tab),
  );
  const [chatAge, setChatAge] = useState<OfficeChatAgeFilter>(() => parseOfficeChatAgeFilter(params.chatAge));
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadModalOpen, setThreadModalOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [broadcastDetailOpen, setBroadcastDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newChatMode, setNewChatMode] = useState<NewChatMode | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  useEffect(() => {
    setAudience(parseOfficeMessageAudience(params.audience ?? params.filter));
  }, [params.audience, params.filter]);

  useEffect(() => {
    setView(parseOfficeMessengerView(params.view, params.tab));
  }, [params.view, params.tab]);

  useEffect(() => {
    setChatAge(parseOfficeChatAgeFilter(params.chatAge));
  }, [params.chatAge]);

  useEffect(() => {
    if (!canViewInternal && audience === 'internal') {
      setAudience('employees');
    }
  }, [audience, canViewInternal]);

  useEffect(() => {
    const threadParam = params.thread;
    if (typeof threadParam === 'string' && threadParam.trim()) {
      setSelectedThreadId(threadParam);
      setThreadModalOpen(true);
    }
  }, [params.thread]);

  useEffect(() => {
    setOfficeMessageNavBadgeMessengerView({ audience, view });
    return () => setOfficeMessageNavBadgeMessengerView(null);
  }, [audience, view]);

  const openThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setThreadModalOpen(true);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: officeMessengerContainerHeight(height),
        controls: { gap: spacing.sm, marginBottom: spacing.sm },
        audienceHint: {
          ...typography.caption,
          color: c.muted,
          paddingHorizontal: spacing.xs,
        },
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        messenger: {
          flex: 1,
          minHeight: 0,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
          backgroundColor: c.surface,
        },
        listPane: {
          flex: 1,
          minWidth: 0,
        },
      }),
    [c, height, typography],
  );

  const screenTitle =
    view === 'broadcasts'
      ? `Broadcast · ${OFFICE_AUDIENCE_LABELS[audience]}`
      : `Nachrichten · ${OFFICE_AUDIENCE_LABELS[audience]}`;

  return (
    <ScreenShell title={screenTitle} subtitle="Office Kommunikation" scroll={false}>
      <View style={styles.root}>
        <View style={styles.controls}>
          <AuroraSegmentedControl
            options={audienceOptions}
            value={audience}
            onChange={(key) => setAudience(key as OfficeMessageAudience)}
          />
          <AuroraSegmentedControl
            options={OFFICE_MESSENGER_VIEWS}
            value={view}
            onChange={(key) => setView(key as OfficeMessengerView)}
          />
          <Text style={styles.audienceHint}>
            {view === 'broadcasts'
              ? `Mitteilungen an ${audience === 'internal' ? 'Verwaltung, Leitung und Geschäftsführung' : audience === 'clients' ? 'alle Klient:innen' : 'alle Mitarbeitenden'}`
              : `Chats mit ${OFFICE_AUDIENCE_LABELS[audience]} — sortiert nach Neue, Aktuelle und Alte`}
          </Text>
        </View>

        {!isReadOnly ? (
          <View style={styles.actions}>
            {view === 'chats' ? (
              <PremiumButton
                title={NEW_CHAT_LABELS[audience]}
                onPress={() => setNewChatMode(newChatModeForAudience(audience))}
              />
            ) : null}
            {canBroadcast ? (
              <PremiumButton
                title={BROADCAST_LABELS[audience]}
                variant={view === 'broadcasts' ? 'primary' : 'secondary'}
                onPress={() => setShowBroadcastModal(true)}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.messenger}>
          <View style={[officeMessengerColumnStyles.columnRoot, styles.listPane]}>
            {view === 'broadcasts' ? (
              <OfficeBroadcastsList
                audience={audience}
                selectedId={selectedBroadcastId}
                onSelect={(id) => {
                  setSelectedBroadcastId(id);
                  setBroadcastDetailOpen(true);
                }}
              />
            ) : (
              <OfficeMessagesInbox
                audience={audience}
                chatAge={chatAge}
                onChatAgeChange={setChatAge}
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
          setChatAge('new');
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
            setChatAge('new');
            openThread(threadId);
          }}
        />
      ) : null}

      {showBroadcastModal ? (
        <OfficeBroadcastModal
          visible
          audience={audience}
          onClose={() => setShowBroadcastModal(false)}
          onSent={() => {
            setShowBroadcastModal(false);
          }}
        />
      ) : null}
    </ScreenShell>
  );
}
