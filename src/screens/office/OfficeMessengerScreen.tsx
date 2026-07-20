import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AuroraSegmentedControl } from '@/components/aurora';
import { ScreenShell } from '@/components/layout';
import { MessengerShell, messengerScreenRootStyle } from '@/components/messaging';
import { OfficeBroadcastDetailModal } from '@/components/office/officebroadcastdetailmodal';
import { OfficeBroadcastModal } from '@/components/office/officebroadcastmodal';
import { OfficeBroadcastsList } from '@/components/office/officebroadcastslist';
import { OfficeMessageThread } from '@/components/office/officemessagethread';
import { OfficeMessagesInbox } from '@/components/office/officemessagesinbox';
import { OfficeNewChatModal, type NewChatMode } from '@/components/office/officenewchatmodal';
import { OfficeNewGroupChatModal } from '@/components/office/officenewgroupchatmodal';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
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
import { officeMessengerColumnStyles } from '@/components/office/officemessengerlayout';
import type {
  OfficeChatAgeFilter,
  OfficeMessageAudience,
  OfficeMessengerView,
} from '@/types/office/messaging';
import { spacing } from '@/theme';

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
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const stackTopChrome = workspaceWidth > 0 && workspaceWidth < 1240;
  const { useMasterDetail } = usePlatformLayout();
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
  const [selectedThreadTitle, setSelectedThreadTitle] = useState('Chat');
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [broadcastDetailOpen, setBroadcastDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newChatMode, setNewChatMode] = useState<NewChatMode | null>(null);
  const [showGroupChatModal, setShowGroupChatModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [inboxRefreshToken, setInboxRefreshToken] = useState(0);

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
    }
  }, [params.thread]);

  useEffect(() => {
    setOfficeMessageNavBadgeMessengerView({ audience, view });
    return () => setOfficeMessageNavBadgeMessengerView(null);
  }, [audience, view]);

  const openThread = (threadId: string, subject?: string) => {
    setSelectedThreadId(threadId);
    if (subject) setSelectedThreadTitle(subject);
  };

  const closeThread = () => {
    setSelectedThreadId(null);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: messengerScreenRootStyle(height),
        topChrome: {
          flexDirection: stackTopChrome ? 'column' : 'row',
          alignItems: stackTopChrome ? 'stretch' : 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.sm,
          padding: spacing.sm,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          flexShrink: 0,
        },
        controls: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: spacing.sm,
          flex: stackTopChrome ? undefined : 1,
          minWidth: 0,
        },
        audienceHint: {
          ...typography.caption,
          color: c.muted,
          paddingHorizontal: spacing.xs,
          maxWidth: 280,
        },
        actions: {
          flexDirection: 'row',
          justifyContent: stackTopChrome ? 'flex-end' : 'flex-start',
          flexWrap: 'wrap',
          gap: spacing.sm,
          flexShrink: 0,
        },
        messengerBody: {
          flex: 1,
          minHeight: 0,
        },
        broadcastPane: {
          flex: 1,
          minHeight: 0,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
          backgroundColor: c.surface,
        },
      }),
    [c, height, stackTopChrome, typography],
  );

  const screenTitle =
    view === 'broadcasts'
      ? `Broadcast · ${OFFICE_AUDIENCE_LABELS[audience]}`
      : `Nachrichten · ${OFFICE_AUDIENCE_LABELS[audience]}`;

  const chatThread = selectedThreadId ? (
    <OfficeMessageThread
      threadId={selectedThreadId}
      hideHeader={!useMasterDetail}
      onThreadChanged={() => setInboxRefreshToken((value) => value + 1)}
      onThreadDeleted={closeThread}
      onNewThreadStarted={(newThreadId) => {
        openThread(newThreadId);
        setChatAge('new');
      }}
    />
  ) : null;

  const mobileChatActive = !useMasterDetail && !!selectedThreadId && view === 'chats';

  return (
    <ScreenShell
      title={mobileChatActive ? selectedThreadTitle : screenTitle}
      subtitle={mobileChatActive ? undefined : 'Office Kommunikation'}
      scroll={false}
      showBack={mobileChatActive}
      onBack={mobileChatActive ? closeThread : undefined}
    >
      <View
        style={styles.root}
        onLayout={(event) => setWorkspaceWidth(Math.round(event.nativeEvent.layout.width))}
      >
        {!mobileChatActive ? (
          <View style={styles.topChrome}>
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
              {!stackTopChrome ? (
                <Text style={styles.audienceHint} numberOfLines={1}>
                  {view === 'broadcasts' ? 'Mitteilungen und Ankündigungen' : 'Direkte Unterhaltungen'}
                </Text>
              ) : null}
            </View>

            {!isReadOnly ? (
              <View style={styles.actions}>
                {view === 'chats' ? (
                  <>
                    <PremiumButton
                      title={NEW_CHAT_LABELS[audience]}
                      size="sm"
                      onPress={() => setNewChatMode(newChatModeForAudience(audience))}
                    />
                    {audience === 'employees' ? (
                      <PremiumButton
                        title="Neuer Gruppen-Chat"
                        size="sm"
                        variant="secondary"
                        onPress={() => setShowGroupChatModal(true)}
                      />
                    ) : null}
                  </>
                ) : null}
                {canBroadcast ? (
                  <PremiumButton
                    title={BROADCAST_LABELS[audience]}
                    size="sm"
                    variant={view === 'broadcasts' ? 'primary' : 'secondary'}
                    onPress={() => setShowBroadcastModal(true)}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.messengerBody}>
          {view === 'broadcasts' ? (
            <View style={styles.broadcastPane}>
              <View style={officeMessengerColumnStyles.columnRoot}>
                <OfficeBroadcastsList
                  audience={audience}
                  selectedId={selectedBroadcastId}
                  onSelect={(id) => {
                    setSelectedBroadcastId(id);
                    setBroadcastDetailOpen(true);
                  }}
                />
              </View>
            </View>
          ) : mobileChatActive ? (
            chatThread
          ) : (
            <MessengerShell
              inbox={
                <OfficeMessagesInbox
                  audience={audience}
                  chatAge={chatAge}
                  onChatAgeChange={setChatAge}
                  selectedThreadId={selectedThreadId}
                  onThreadSelect={openThread}
                  search={search}
                  onSearchChange={setSearch}
                  refreshToken={inboxRefreshToken}
                />
              }
              thread={chatThread}
              selectedThreadId={selectedThreadId}
              onCloseThread={closeThread}
              threadTitle={selectedThreadTitle}
            />
          )}
        </View>
      </View>

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

      {showGroupChatModal ? (
        <OfficeNewGroupChatModal
          visible
          onClose={() => setShowGroupChatModal(false)}
          onCreated={(threadId) => {
            setShowGroupChatModal(false);
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
