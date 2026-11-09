import { useEffect, useMemo, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { BackHandler, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { PortalNewChatModal } from '@/components/portal/PortalNewChatModal';
import { PortalOfficeThread } from '@/components/portal/portalofficethread';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';
import { usePortalMessengerFocus } from '@/lib/portal/portalMessengerFocusContext';
import { getPortalStatusLabel, type PortalOfficeInboxFilter } from '@/lib/office/portalofficemessageservice';
import { isEmployeeGroupChatThread } from '@/lib/office/employeeGroupChatService';
import type { OfficeMessageThread } from '@/types/office/messaging';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { EmployeePortalAgendaAction, agendaFocusRing } from './EmployeePortalAgendaAction';
import { EmployeePortalAgendaStatus } from './EmployeePortalAgendaCard';
import { useEmployeePortalAgendaLayout } from './EmployeePortalAgendaLayout';
import { EmployeePortalArtwork } from './EmployeePortalArtwork';
import { ClientRecordLoading, clientRecordTextWrap } from './EmployeePortalClientRecordLayout';
import { employeePortalDesign as c } from './employeePortalDesign';

type InboxFocus = 'all' | 'unread' | 'reply';

const folders = [
  { key: 'open', label: 'Offen', icon: 'mail-open-outline' },
  { key: 'closed', label: 'Abgeschlossen', icon: 'archive-outline' },
] as const;

const today = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const earlier = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' });

function messageTime(thread: OfficeMessageThread) {
  const time = new Date(thread.lastMessageAt ?? thread.createdAt);
  if (!Number.isFinite(time.getTime())) return '';
  const now = new Date();
  return time.toDateString() === now.toDateString() ? today.format(time)
    : time.getFullYear() === now.getFullYear() ? earlier.format(time) : time.toLocaleDateString('de-DE');
}

function needsReply(thread: OfficeMessageThread) {
  return thread.status === 'waiting_for_reply' || thread.status === 'waiting';
}

function previewText(thread: OfficeMessageThread) {
  const preview = thread.lastMessagePreview?.trim();
  if (preview === '🎤 Sprachnachricht') return 'Sprachnachricht';
  if (preview === '🖼️' || preview === '🖼') return 'Bild';
  return preview || 'Noch keine Nachricht';
}

function MessageRow({ thread, selected, onPress }: { thread: OfficeMessageThread; selected: boolean; onPress: () => void }) {
  const unread = thread.unreadCount > 0;
  const isGroup = isEmployeeGroupChatThread(thread);
  const name = thread.subject.trim() || 'Gespräch';
  const status = getPortalStatusLabel(thread.status);
  const timestamp = messageTime(thread);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }}
      accessibilityLabel={`Chat ${name}, ${status}${unread ? `, ${thread.unreadCount} ungelesen` : ''}`}
      testID={`portal-thread-open-${thread.id}`} onPress={onPress}
      style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
        s.message, unread && s.messageUnread, selected && s.messageSelected,
        hovered && s.messageHover, focused && agendaFocusRing, pressed && s.pressed,
      ]}>
      <View style={[s.messageIcon, isGroup && s.groupIcon]}>
        <Ionicons name={isGroup ? 'people-outline' : 'chatbubble-ellipses-outline'} size={18} color={c.accent} accessible={false} />
      </View>
      <View style={s.messageContent}>
        <View style={s.messageHeading}>
          <Text numberOfLines={2} style={s.subject}>{name}</Text>
          {timestamp ? <Text style={s.time}>{timestamp}</Text> : null}
        </View>
        <Text numberOfLines={2} style={s.small}>{previewText(thread)}</Text>
        <View style={s.labels}>
          <EmployeePortalAgendaStatus label={status} tone={needsReply(thread) ? 'orange' : unread ? 'cyan' : 'muted'} />
          {isGroup ? <Text style={s.category}>Teamchat</Text> : null}
          {thread.categoryLabel ? <Text numberOfLines={1} style={s.category}>{thread.categoryLabel}</Text> : null}
        </View>
      </View>
      {unread ? <View style={s.unread}><Text style={s.unreadText}>{thread.unreadCount > 99 ? '99+' : thread.unreadCount}</Text></View> : null}
    </Pressable>
  );
}

function InboxOverview({ folder, scope, total, unread, reply, highlight, onScope, onOpen }: {
  folder: PortalOfficeInboxFilter; scope: InboxFocus; total: number | null; unread: number | null; reply: number | null;
  highlight: OfficeMessageThread | null; onScope: (focus: InboxFocus) => void; onOpen: (thread: OfficeMessageThread) => void;
}) {
  const isOpen = folder === 'open';
  return (
    <ScrollView style={s.overview} contentContainerStyle={s.overviewContent} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
      <View style={s.overviewIntro}>
        <LinearGradient pointerEvents="none" colors={['#193953', '#21465D', '#1D5259']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.overviewCopy}>
          <Text style={s.eyebrow}>{isOpen ? 'POSTFACH' : 'ARCHIV'}</Text>
          <Text accessibilityRole="header" aria-level={2} style={s.overviewTitle}>
            {isOpen ? 'Ihre Gespräche im Blick' : 'Abgeschlossene Gespräche'}
          </Text>
          <Text style={s.copy}>
            {isOpen ? 'Öffnen Sie einen Chat aus dem Postfach, um den Verlauf zu lesen oder zu antworten.'
              : 'Hier finden Sie die Verläufe Ihrer abgeschlossenen Chats.'}
          </Text>
        </View>
        <View style={s.overviewArt} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={s.artHalo} />
          <EmployeePortalArtwork id="messages" label="" size={126} />
        </View>
      </View>

      <View style={s.metrics}>
        {([
          { key: 'all', label: isOpen ? 'Offene Chats' : 'Abgeschlossene Chats', value: total, icon: isOpen ? 'chatbubbles-outline' : 'archive-outline' },
          { key: 'unread', label: 'Chats mit ungelesenen Nachrichten', value: unread, icon: 'mail-unread-outline' },
          ...(isOpen ? [{ key: 'reply', label: 'Rückmeldung erforderlich', value: reply, icon: 'return-down-back-outline' } as const] : []),
        ] as const).map(({ key, label, value, icon }) => (
          <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'ausstehend'}`}
            accessibilityState={{ selected: scope === key }} onPress={() => onScope(key)}
            style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
              s.metric, scope === key && s.chipActive, hovered && s.messageHover, focused && agendaFocusRing, pressed && s.pressed,
            ]}>
            <Ionicons name={icon} size={17} color={key === 'reply' ? c.warning : c.accent} accessible={false} />
            <Text style={s.metricValue}>{value ?? '—'}</Text>
            <Text style={s.small}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {highlight ? (
        <View style={s.highlight}>
          <Text style={s.eyebrow}>{needsReply(highlight) ? 'RÜCKMELDUNG ERFORDERLICH'
            : highlight.unreadCount > 0 ? 'UNGELESENES GESPRÄCH' : 'LETZTES GESPRÄCH'}</Text>
          <MessageRow thread={highlight} selected={false} onPress={() => onOpen(highlight)} />
        </View>
      ) : null}
    </ScrollView>
  );
}

export function EmployeePortalMessenger({ initialComposeOpen, canCompose }: { initialComposeOpen: boolean; canCompose: boolean }) {
  const layout = useEmployeePortalAgendaLayout();
  const split = layout.readableWidth >= 740 && !layout.shortLandscape;
  const screenFocused = useIsFocused();
  const { selectedThreadId, openThread, closeThread, setActive } = usePortalMessengerFocus();
  const [folder, setFolder] = useState<PortalOfficeInboxFilter>('open');
  const [focus, setFocus] = useState<InboxFocus>('all');
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(initialComposeOpen);
  const { threads, loading, refreshing, error, refreshError, refresh } = usePortalOfficeMessages(folder);
  const composing = canCompose && composeOpen;
  const hideWorkspace = composing && !split;
  const compactFocus = screenFocused && !split && (composing || Boolean(selectedThreadId));

  useEffect(() => { if (initialComposeOpen) setComposeOpen(true); }, [initialComposeOpen]);
  useEffect(() => {
    setActive(compactFocus);
    return () => setActive(false);
  }, [compactFocus, setActive]);
  useEffect(() => {
    if (Platform.OS === 'web' || !compactFocus || composing || !selectedThreadId) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      closeThread();
      return true;
    });
    return () => listener.remove();
  }, [closeThread, compactFocus, composing, selectedThreadId]);

  const unreadCount = threads.filter(thread => thread.unreadCount > 0).length;
  const replyCount = threads.filter(needsReply).length;
  const results = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('de-DE');
    return threads.filter(thread => {
      if (focus === 'unread' && thread.unreadCount === 0) return false;
      if (focus === 'reply' && !needsReply(thread)) return false;
      return !term || [thread.subject, thread.lastMessagePreview, thread.categoryLabel, thread.participantName,
        ...(thread.employeeParticipantNames ?? [])].some(value => value?.toLocaleLowerCase('de-DE').includes(term));
    });
  }, [threads, focus, search]);

  const dataReady = !error && (!loading || threads.length > 0);
  const highlight = results.find(needsReply) ?? results.find(thread => thread.unreadCount > 0) ?? results[0] ?? null;
  const open = (thread: OfficeMessageThread) => openThread(thread.id, thread.subject);
  const openNewThread = (id: string) => {
    openThread(id);
    setFolder('open');
    setFocus('all');
    setSearch('');
    if (folder === 'open') void refresh();
  };

  const masthead = (
    <View style={[s.masthead, !split && s.mastheadCompact]} testID="employee-messages-hero">
      <LinearGradient pointerEvents="none" colors={['rgba(130,191,223,0.21)', 'rgba(20,51,78,0.52)', 'rgba(61,142,151,0.22)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.mastheadCopy}>
        <Text style={s.eyebrow}>KOMMUNIKATION</Text>
        <Text accessibilityRole="header" aria-level={1} style={[s.title, !split && s.titleCompact]}>Nachrichten</Text>
        {split ? <Text style={s.copy}>Gespräche mit der Verwaltung und dem Team.</Text> : null}
      </View>
      {canCompose ? <EmployeePortalAgendaAction label="Neue Nachricht" icon="create-outline" primary onPress={() => setComposeOpen(true)} /> : null}
    </View>
  );

  const inboxControls = (
    <View style={s.inboxControls}>
      <View style={s.inboxHeading}>
        <Text accessibilityRole="header" aria-level={2} style={s.inboxTitle}>Postfach</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Postfach aktualisieren"
          accessibilityState={{ busy: refreshing, disabled: refreshing }} disabled={refreshing}
          onPress={() => void refresh()} style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
            s.tool, focused && agendaFocusRing, pressed && s.pressed,
          ]}>
          <Ionicons name={refreshing ? 'time-outline' : 'refresh-outline'} size={19} color={c.accent} accessible={false} />
        </Pressable>
      </View>
      <View style={s.folderRow} accessibilityRole="tablist" accessibilityLabel="Ordner">
        {folders.map(item => (
          <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: folder === item.key }}
            onPress={() => { setFolder(item.key); setFocus('all'); }}
            style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
              s.folder, folder === item.key && s.chipActive, focused && agendaFocusRing, pressed && s.pressed,
            ]}>
            <Ionicons name={item.icon} size={16} color={c.accent} accessible={false} />
            <Text style={s.folderLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={18} color={c.accent} accessible={false} />
        <TextInput value={search} onChangeText={setSearch} accessibilityLabel="Chats durchsuchen" placeholder="Chats durchsuchen…"
          placeholderTextColor={c.muted} autoCorrect={false} returnKeyType="search" style={s.search} />
        {search ? <Pressable accessibilityRole="button" accessibilityLabel="Suche löschen" onPress={() => setSearch('')}
          style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [s.clear, focused && agendaFocusRing, pressed && s.pressed]}>
          <Ionicons name="close-outline" size={18} color={c.accent} accessible={false} />
        </Pressable> : null}
      </View>
      <View style={s.refinements}>
        {(['unread', ...(folder === 'open' ? ['reply'] : [])] as ('unread' | 'reply')[]).map(key => (
          <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: focus === key }}
            onPress={() => setFocus(focus === key ? 'all' : key)}
            style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
              s.refine, focus === key && s.chipActive, focused && agendaFocusRing, pressed && s.pressed,
            ]}>
            <Text style={s.small}>{key === 'unread' ? 'Ungelesen' : 'Rückmeldung'}</Text>
            {dataReady ? <Text style={s.filterCount}>{key === 'unread' ? unreadCount : replyCount}</Text> : null}
          </Pressable>
        ))}
      </View>
      <View style={s.resultLine}>
        <Text style={s.small}>{dataReady ? `${results.length} ${results.length === 1 ? 'Gespräch' : 'Gespräche'}` : 'Gespräche'}</Text>
      </View>
      {refreshError ? <Text accessibilityRole="alert" style={s.error}>{refreshError}</Text> : null}
    </View>
  );

  return (
    <View style={[s.outer, { paddingHorizontal: layout.padding }, !split && Boolean(selectedThreadId) && s.threadOuter]}>
      <View onLayout={layout.onLayout} style={s.container} testID="employee-messages-workspace">
        <View style={[s.container, hideWorkspace && s.hidden]} aria-hidden={hideWorkspace || undefined}
          importantForAccessibility={hideWorkspace ? 'no-hide-descendants' : 'auto'}>
          {split ? masthead : null}
          <View style={[s.board, split && s.boardSplit]}>
            <View style={[s.inbox, split ? { width: Math.min(430, Math.max(292, layout.readableWidth * 0.34)), flexShrink: 0 } : s.inboxCompact,
              !split && Boolean(selectedThreadId) && s.hidden]}>
              {split ? inboxControls : null}
              <FlatList style={s.list} data={results} keyExtractor={item => item.id}
                contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled"
                refreshing={refreshing} onRefresh={() => void refresh()}
                ListHeaderComponent={split ? null : <>{masthead}{inboxControls}</>}
                ListEmptyComponent={loading ? <ClientRecordLoading message="Gespräche werden geladen…" /> : (
                  <View style={s.listEmpty}>
                    <Ionicons name={error ? 'alert-circle-outline' : search ? 'search-outline' : 'mail-open-outline'}
                      color={error ? c.danger : c.accent} size={25} accessible={false} />
                    <Text style={s.subject}>{error ? 'Postfach nicht verfügbar' : search || focus !== 'all' ? 'Keine Treffer'
                      : folder === 'closed' ? 'Noch keine abgeschlossenen Chats' : 'Ihr Postfach ist leer'}</Text>
                    <Text style={s.small}>{error ?? (search || focus !== 'all' ? 'Ändern Sie die Suche oder den Filter.'
                      : folder === 'closed' ? 'Abgeschlossene Gespräche erscheinen hier.'
                        : 'Neue Gespräche mit Verwaltung und Team erscheinen hier.')}</Text>
                    {error ? <EmployeePortalAgendaAction label="Erneut laden" icon="refresh-outline" busy={refreshing} onPress={() => void refresh()} /> : null}
                  </View>
                )}
                renderItem={({ item }) => <MessageRow thread={item} selected={item.id === selectedThreadId} onPress={() => open(item)} />}
              />
            </View>
            <View style={[s.thread, split && s.threadSplit, !split && !selectedThreadId && s.hidden]}>
              {selectedThreadId ? (
                <PortalOfficeThread threadId={selectedThreadId} variant="employee" onBack={closeThread}
                  allowReply={canCompose} active={!composing} onNewThreadStarted={openNewThread} />
              ) : split ? (
                <InboxOverview folder={folder} scope={focus} total={dataReady ? threads.length : null}
                  unread={dataReady ? unreadCount : null} reply={dataReady ? replyCount : null}
                  highlight={highlight} onScope={setFocus} onOpen={open} />
              ) : null}
            </View>
          </View>
        </View>
        {composing ? <PortalNewChatModal visible audience="employee" variant="employee" presentation={split ? 'dialog' : 'screen'}
          onClose={() => setComposeOpen(false)} onCreated={openNewThread} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create(withCareSuiteTypography({
  outer: { flex: 1, minWidth: 0, minHeight: 0, paddingVertical: 10 },
  threadOuter: { paddingVertical: 6 },
  container: { flex: 1, minHeight: 0, minWidth: 0, gap: 12 },
  hidden: { display: 'none' },
  masthead: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderWidth: 1, borderColor: c.line, borderRadius: 18, overflow: 'hidden' },
  mastheadCompact: { margin: 8, gap: 8, padding: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  mastheadCopy: { flexShrink: 1, minWidth: 0, gap: 3 },
  eyebrow: { color: c.accent, letterSpacing: 1.3, fontSize: font(10), lineHeight: font(15), fontWeight: '700' },
  title: { color: c.text, fontSize: font(32), lineHeight: font(39), fontWeight: '700', ...clientRecordTextWrap },
  titleCompact: { fontSize: font(23), lineHeight: font(29) },
  copy: { color: c.muted, fontSize: font(14), lineHeight: font(21), ...clientRecordTextWrap },
  board: { flex: 1, minHeight: 0, minWidth: 0, borderWidth: 1, borderColor: c.line, borderRadius: 18,
    backgroundColor: c.panel, overflow: 'hidden' },
  boardSplit: { flexDirection: 'row' },
  inbox: { minWidth: 0, minHeight: 0, backgroundColor: 'rgba(12,30,48,0.32)' },
  inboxCompact: { flex: 1 },
  inboxControls: { gap: 8, paddingHorizontal: 10, paddingTop: 5, paddingBottom: 7 },
  inboxHeading: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  inboxTitle: { color: c.text, fontSize: font(17), lineHeight: font(22), fontWeight: '700', flexShrink: 1 },
  tool: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: c.control, borderWidth: 1, borderColor: c.line },
  folderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, padding: 4, backgroundColor: c.control, borderRadius: 12 },
  folder: { flexGrow: 1, flexShrink: 1, minHeight: 42, minWidth: 0, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 5, gap: 6, borderWidth: 1, borderColor: 'transparent', borderRadius: 9 },
  folderLabel: { color: c.text, fontWeight: '700', fontSize: font(12), lineHeight: font(17), flexShrink: 1, ...clientRecordTextWrap },
  chipActive: { backgroundColor: c.selected, borderColor: c.accent },
  searchBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1,
    borderColor: c.line, borderRadius: 11, backgroundColor: c.control, paddingLeft: 10 },
  search: { flex: 1, minWidth: 0, minHeight: 42, color: c.text, paddingRight: 4, fontSize: font(14), lineHeight: font(20) },
  clear: { width: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  refinements: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  refine: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
    borderColor: c.line, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  filterCount: { color: c.accent, fontSize: font(11), fontWeight: '700' },
  resultLine: { paddingTop: 2 },
  list: { flex: 1, minHeight: 0, minWidth: 0 },
  listContent: { gap: 7, paddingBottom: 12 },
  listEmpty: { margin: 9, borderRadius: 13, borderWidth: 1, borderColor: c.line,
    backgroundColor: c.control, gap: 8, padding: 12, alignItems: 'flex-start' },
  message: { marginHorizontal: 8, padding: 10, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    borderRadius: 13, borderWidth: 1, borderColor: c.line, backgroundColor: c.control },
  messageUnread: { borderLeftWidth: 3, borderLeftColor: c.accent },
  messageSelected: { backgroundColor: c.selected, borderColor: c.accent },
  messageHover: { borderColor: c.accent },
  pressed: { opacity: 0.78 },
  messageIcon: { width: 31, height: 31, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: c.selected },
  groupIcon: { backgroundColor: 'rgba(149,140,238,0.21)' },
  messageContent: { flex: 1, minWidth: 0, gap: 4 },
  messageHeading: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 6 },
  subject: { color: c.text, fontSize: font(14), lineHeight: font(20), fontWeight: '700', flexShrink: 1, ...clientRecordTextWrap },
  time: { color: c.muted, fontSize: font(10), lineHeight: font(15), fontVariant: ['tabular-nums'] },
  small: { color: c.muted, fontSize: font(12), lineHeight: font(18), flexShrink: 1, ...clientRecordTextWrap },
  error: { color: c.danger, fontSize: font(12), lineHeight: font(18), ...clientRecordTextWrap },
  labels: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  category: { color: c.muted, fontSize: font(10), lineHeight: font(15), flexShrink: 1 },
  unread: { backgroundColor: c.accent, borderRadius: 11, minWidth: 21, minHeight: 21,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadText: { color: c.canvas, fontWeight: '700', fontSize: font(11) },
  thread: { flex: 1, minWidth: 0, minHeight: 0 },
  threadSplit: { borderLeftWidth: 1, borderLeftColor: c.line, backgroundColor: 'rgba(12,29,49,0.18)' },
  overview: { flex: 1, minHeight: 0 },
  overviewContent: { width: '100%', maxWidth: 1100, alignSelf: 'center', gap: 14, padding: 16 },
  overviewIntro: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: 17, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' },
  overviewCopy: { flexGrow: 1, flexBasis: 174, minWidth: 0, gap: 6 },
  overviewTitle: { color: c.text, fontSize: font(24), lineHeight: font(31), fontWeight: '700', ...clientRecordTextWrap },
  overviewArt: { width: 138, height: 138, alignItems: 'center', justifyContent: 'center' },
  artHalo: { ...StyleSheet.absoluteFill, borderRadius: 70, borderWidth: 1, borderColor: 'rgba(177,229,246,0.29)', backgroundColor: 'rgba(160,234,244,0.10)' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flexGrow: 1, flexBasis: 104, minHeight: 99, minWidth: 0, alignItems: 'flex-start', gap: 4, borderWidth: 1, borderColor: c.line,
    backgroundColor: c.control, borderRadius: 13, padding: 10 },
  metricValue: { color: c.text, fontSize: font(24), lineHeight: font(28), fontVariant: ['tabular-nums'], fontWeight: '700' },
  highlight: { gap: 7, paddingTop: 2 },
}));
