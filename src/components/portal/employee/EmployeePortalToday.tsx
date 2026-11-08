import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { HealthOSStatusBadge } from '@/components/healthos/HealthOSStatusBadge';
import { resolveHealthOSStatusDisplay } from '@/components/healthos/status/healthosStatusMapping';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';
import { buildEmployeePortalTodayModel } from '@/lib/portal/employee/employeePortalTodayModel';
import { employeePortalDailyNote } from '@/lib/portal/employee/employeePortalDailyNote';
import { employeePortalNavigation } from '@/lib/portal/employee/employeePortalNavigation';
import { employeePortalWorkspaceLabels, type EmployeePortalWorkspace } from '@/lib/portal/employee/employeePortalWorkspaces';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import { useLocalMinute } from '@/hooks/useLocalMinute';
import { getTimeOfDayGreeting, HYDRATION_SAFE_GREETING } from '@/lib/dashboard/timeOfDayGreeting';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useWebFontScaleValue } from '@/design/web/WebFontScaleProvider';
import type { LiquidPortalNavigationItem } from '@/liquid-command/navigation/portalCatalog';
import { EmployeePortalArtwork } from './EmployeePortalArtwork';
import { useEmployeePortalMenu } from './EmployeePortalMenuContext';
import { useEmployeePortalWorkspaceContext } from './EmployeePortalWorkspaceContext';
import { employeePortalDesign as c, employeePortalGroups, employeePortalHeaderLayout, employeePortalLayout } from './employeePortalDesign';

export type EmployeePortalTodayProps = {
  dashboard: EmployeePortalDashboardProjection | null; loading: boolean; error: string | null;
  displayName: string; onRefresh: () => void; fromCache?: boolean; cachedAt?: string | null;
  refreshing?: boolean; refreshError?: string | null; showSuccess?: boolean;
};

function Action({ label, onPress, primary = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={({ pressed }) => [styles.action, primary && styles.primary, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={[styles.actionText, primary && styles.primaryText]}>{label}</Text>
  </Pressable>;
}
function Panel({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  return <View style={styles.panel} testID={testID}><Text accessibilityRole="header" style={styles.panelTitle}>{title}</Text>{children}</View>;
}
function Notice({ message, error = false, onRetry }: { message: string; error?: boolean; onRetry?: () => void }) {
  return <View style={styles.notice} accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite">
    <Text style={[styles.bodyText, error && styles.warning]}>{message}</Text>
    {onRetry ? <Action label="Erneut versuchen" onPress={onRetry} /> : null}
  </View>;
}

function EmployeeWelcome({ displayName, section, phone, shortLandscape, action }: {
  displayName: string; section: string; phone: boolean; shortLandscape: boolean; action?: ReactNode;
}) {
  const now = useLocalMinute();
  const greeting = now ? getTimeOfDayGreeting(now) : HYDRATION_SAFE_GREETING;
  const firstName = displayName.trim().split(/\s+/)[0];
  const note = now ? employeePortalDailyNote(now) : null;
  return (
    <View style={[styles.greeting, shortLandscape && styles.greetingLandscape, phone && styles.greetingPhone]} testID="employee-portal-premium-home-hero">
      <View style={styles.greetingCopy}>
        <Text style={styles.eyebrow}>{section}</Text>
        <Text accessibilityRole="header" style={[styles.title, shortLandscape && styles.titleLandscape, phone && styles.titlePhone]}>
          {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
        </Text>
        {note ? <View style={styles.dailyNote} testID="employee-portal-daily-note">
          <View style={styles.dailyIcon}><Ionicons name={note.kind === 'joke' ? 'happy-outline' : 'sparkles-outline'} size={20} color={c.accent} /></View>
          <View style={styles.dailyCopy}>
            <Text style={styles.dailyLabel}>{note.kind === 'joke' ? 'Witz des Tages' : 'Tagesimpuls'}</Text>
            <Text style={styles.dailyText}>{note.text}</Text>
          </View>
        </View> : null}
      </View>
      {action}
    </View>
  );
}

function ArtworkSummary({ id, label, message, size }: { id: string; label: string; message: string; size: number }) {
  return <View style={styles.artworkSummary}>
    <Text style={[styles.bodyText, styles.artworkSummaryText]}>{message}</Text>
    <EmployeePortalArtwork id={id} label={label} size={size} />
  </View>;
}

function WorkspaceShortcut({ item, size, tile = false, onPress }: {
  item: LiquidPortalNavigationItem;
  size: number;
  tile?: boolean;
  onPress: () => void;
}) {
  const label = item.id === 'assignments' ? 'Meine Einsätze' : item.label;
  const title = <Text style={[styles.shortcutLabel, tile && styles.shortcutTileLabel]}>{label}</Text>;
  const artwork = <EmployeePortalArtwork id={item.id} label={item.label} size={size} />;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [tile ? styles.shortcutTile : styles.shortcut, pressed && styles.pressed]}>
    {tile ? title : artwork}
    {tile ? artwork : title}
    <Ionicons name="chevron-forward" size={16} color={c.accent} />
  </Pressable>;
}

/** The approved Tagesfokus/Kompakt home uses the existing read-only projection. */
export function EmployeePortalToday({ dashboard, loading, error, displayName, onRefresh, fromCache = false, cachedAt, refreshing = false, refreshError, showSuccess }: EmployeePortalTodayProps) {
  const router = useRouter();
  const { width, height } = useHydrationSafeWindowDimensions();
  const { fontScale } = useWindowDimensions();
  const webFontScale = useWebFontScaleValue();
  const layout = employeePortalLayout(width, Math.max(fontScale, webFontScale));
  const { shortLandscape } = employeePortalHeaderLayout(width, height, Math.max(fontScale, webFontScale));
  const openMenu = useEmployeePortalMenu();
  const workspace = useEmployeePortalWorkspaceContext();
  const navigation = workspace?.navigation ?? employeePortalNavigation();
  const groups = useMemo(() => employeePortalGroups(navigation), [navigation]);
  const model = useMemo(() => dashboard ? buildEmployeePortalTodayModel({ dashboard, displayName }) : null, [dashboard, displayName]);
  const navigate = (route?: string) => { if (route) router.push((fromCache && route.endsWith('/execute') ? route.slice(0, -'/execute'.length) : route) as never); };
  if (loading && !dashboard) return <View style={styles.root}><Notice message="Mitarbeitendenportal wird geladen…" /></View>;
  if (!dashboard || !model) return <View style={styles.root}><Notice message={error || 'Für Ihren Zugang sind aktuell keine Portaldaten verfügbar.'} error={Boolean(error)} onRetry={onRefresh} /></View>;
  const taskStatusUnknown = Boolean(dashboard.signatureDocumentsError);
  const messageStatusUnknown = Boolean(dashboard.messageCountUnavailable || dashboard.messagesError);
  const personalItems = navigation.filter(item => ['leave', 'absence', 'profile'].includes(item.id));

  return <View style={[styles.root, { padding: layout.padding }]} testID="healthos-employee-portal-today">
    <EmployeeWelcome displayName={displayName} section="Mein Arbeitstag" phone={layout.phone} shortLandscape={shortLandscape}
      action={<Action label={refreshing ? 'Wird aktualisiert…' : 'Aktualisieren'} onPress={onRefresh} disabled={refreshing} />} />
    {(refreshError || error) ? <Notice message={refreshError || error!} error onRetry={onRefresh} /> : null}
    {showSuccess && !refreshError ? <Notice message="Übersicht aktualisiert." /> : null}
    {fromCache ? <Notice message={`Gespeicherter Stand${cachedAt ? ` vom ${new Date(cachedAt).toLocaleString('de-DE')}` : ''}. Einsatzaktionen stehen nach dem Aktualisieren wieder zur Verfügung.`} onRetry={onRefresh} /> : null}
    {dashboard.signatureDocumentsError ? <Notice message={`Dokumentunterschriften nicht verfügbar: ${dashboard.signatureDocumentsError}`} error onRetry={onRefresh} /> : null}
    {dashboard.messagesError ? <Notice message={`Nachrichtenstatus nicht verfügbar: ${dashboard.messagesError}`} error onRetry={onRefresh} /> : null}

    <View style={styles.metrics} accessibilityLabel="Tagesübersicht">
      {model.tagesübersicht.map(metric => <View key={metric.id} style={{ width: layout.metricColumns === 4 ? '25%' : layout.metricColumns === 2 ? '50%' : '100%', padding: 5, minWidth: 0 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${metric.label}: ${metric.value}`} onPress={() => navigate(metric.route)} style={styles.metric} testID={`healthos-employee-metric-${metric.id}`}>
          <Text style={styles.metricValue}>{metric.value}</Text><Text style={styles.metricLabel}>{metric.label}</Text>
        </Pressable>
      </View>)}
    </View>

    <View style={[styles.focus, !layout.splitFocus && styles.stacked]}>
      <View style={[styles.day, !layout.splitFocus && styles.fullWidth]}>
        <Panel title="Mein Tag" testID="employee-portal-day">
          {model.meineEinsaetze.length ? model.meineEinsaetze.map(item => {
            const statusLabel = resolveHealthOSStatusDisplay('assignment', item.statusTechnical).label;
            const actionLabel = item.isActive ? 'Aktiv' : item.hasOpenDocumentation ? 'Dok. offen' : item.signaturePending ? 'Unterschr. offen' : null;
            const projection = [...dashboard.todayAssignments, ...dashboard.upcomingAssignments].find(assignment => assignment.assignmentId === item.assignmentId);
            const day = projection ? new Date(projection.plannedStartAt).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '';
            return <Pressable key={item.assignmentId} testID={`employee-home-assignment-${item.assignmentId}`} accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.clientName}, ${item.timeRange}, ${statusLabel}${actionLabel ? `, ${actionLabel}` : ''}`}
              onPress={() => navigate(item.navigationRoute)} style={({ pressed }) => [styles.assignment, item.isActive && styles.activeAssignment, pressed && styles.pressed]}>
              <View style={styles.assignmentStatus}><HealthOSStatusBadge domain="assignment" technicalValue={item.statusTechnical} dot style={{ backgroundColor: '#F7FBFF' }} />{actionLabel ? <Text style={styles.assignmentAction}>{actionLabel}</Text> : null}<Ionicons name="chevron-forward" color={c.accent} size={16} /></View>
              <Text style={styles.assignmentTitle}>{item.title}</Text>
              <Text style={styles.bodyText}>{item.clientName} · {day} · {item.timeRange}</Text>
            </Pressable>;
          }) : <View style={styles.empty}><EmployeePortalArtwork id="assignments" label="Einsätze" size={layout.phone ? 112 : 136} /><Text style={styles.emptyTitle}>Heute ist nichts eingeplant.</Text><Text style={styles.emptyText}>Sobald Einsätze für Sie hinterlegt sind, erscheinen sie direkt in Ihrer Tagesübersicht.</Text><Action label="Kalender öffnen" onPress={() => navigate('/portal/employee/calendar')} primary /></View>}
        </Panel>
      </View>
      <View style={[styles.side, !layout.splitFocus && styles.fullWidth]}>
        <Panel title="Dokumentation">
          {model.offeneAufgaben.length ? model.offeneAufgaben.filter(task => task.id !== 'task-document-signatures' || !model.openSignatures).map(task => <Pressable key={task.id} accessibilityRole="button" onPress={() => navigate(task.route)} style={styles.task} accessibilityLabel={`${task.label}: ${task.count}`}><Text style={styles.taskText}>{task.label}</Text><Text style={styles.taskCount}>{task.count}</Text></Pressable>) : <ArtworkSummary id="documentation" label="Dokumentation" size={layout.phone ? 60 : 76}
            message={taskStatusUnknown ? 'Unterschriftenstatus derzeit nicht verfügbar.' : 'Alles erledigt. Es ist keine Dokumentation oder Unterschrift offen.'} />}
          {model.openSignatures ? <Pressable accessibilityRole="button" testID="healthos-employee-open-signatures" onPress={() => navigate(model.openSignatures?.route)} style={styles.task}><Text style={[styles.taskText, styles.warning]}>{model.openSignatures.label}: {model.openSignatures.value}{model.openSignatures.subValue ? ` · ${model.openSignatures.subValue}` : ''}</Text></Pressable> : null}
          <Action label="Dokumentation öffnen" onPress={() => navigate('/portal/employee/dokumentation')} />
        </Panel>
        <Panel title="Nachrichten">
          <ArtworkSummary id="messages" label="Nachrichten" size={layout.phone ? 60 : 76}
            message={messageStatusUnknown ? 'Der aktuelle Nachrichtenstatus ist nicht verfügbar.' : dashboard.messageCount > 0 ? `${dashboard.messageCount} ungelesene Nachrichten warten auf Sie.` : 'Sie sind auf dem neuesten Stand. Keine neuen Nachrichten.'} />
          <Action label="Postfach öffnen" onPress={() => navigate('/portal/employee/messages')} />
        </Panel>
      </View>
    </View>

    <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>Meine Arbeitsbereiche</Text>{openMenu ? <Action label="Alle Bereiche" onPress={openMenu} /> : null}</View>
    <View style={styles.groups} testID="employee-portal-premium-quick-actions">
      {groups.map(group => {
        const tiles = layout.shortcutTiles && group.items.length <= 3;
        return <View key={group.title} style={{ width: layout.groupColumns === 3 ? '33.333333%' : layout.groupColumns === 2 ? '50%' : '100%', padding: 5, minWidth: 0 }}>
          <Panel title={group.title}>
            <View style={tiles && styles.shortcutTiles}>
              {group.items.map(item => <WorkspaceShortcut key={item.id} item={item} tile={tiles}
                size={tiles ? 92 : layout.shortcutArtworkSize} onPress={() => navigate(item.route)} />)}
            </View>
          </Panel>
        </View>;
      })}
    </View>
    <View style={styles.personal}><Text style={styles.bodyText}>Für mich</Text><View style={styles.personalActions}>{personalItems.map(item => <Action key={item.id} label={item.label} onPress={() => navigate(item.route)} />)}</View></View>
    <View style={styles.footer}><Ionicons name="shield-checkmark-outline" color={c.muted} size={15} /><Text style={styles.caption}>Persönlicher Arbeitsbereich</Text></View>
  </View>;
}

const workspaceDetails: Record<Exclude<EmployeePortalWorkspace, 'assist'>, { title: string; description: string; item: string }> = {
  pflege: { title: 'Meine Pflegetouren', description: 'Hier finden Sie Ihre freigegebenen Touren mit den geplanten Einsatzorten und Zeiten.', item: 'care-tours' },
  beratung: { title: 'Beratung & Schulungen', description: 'Öffnen Sie Ihre zugeteilten Beratungen und häuslichen Schulungen.', item: 'consultation' },
  akademie: { title: 'Meine Akademie', description: 'Öffnen Sie Ihre zugewiesenen Kurse und sehen Sie Ihren Lernfortschritt.', item: 'academy' },
  office: { title: 'Meine Unterlagen', description: 'Öffnen Sie Ihre persönlichen Dokumente und Unterlagen zur Unterschrift.', item: 'documents' },
};

export function EmployeePortalWorkspaceHome({ displayName }: { displayName: string }) {
  const workspace = useEmployeePortalWorkspaceContext();
  const openMenu = useEmployeePortalMenu();
  const router = useRouter();
  const { width, height } = useHydrationSafeWindowDimensions();
  const { fontScale } = useWindowDimensions();
  const webFontScale = useWebFontScaleValue();
  const layout = employeePortalLayout(width, Math.max(fontScale, webFontScale));
  const { shortLandscape } = employeePortalHeaderLayout(width, height, Math.max(fontScale, webFontScale));
  const selected = workspace?.selected;
  const details = selected && selected !== 'assist' ? workspaceDetails[selected] : null;
  const primary = workspace?.navigation.find(item => item.id === details?.item);
  const personal = workspace?.navigation.filter(item => ['messages', 'time', 'documents', 'leave', 'profile'].includes(item.id) && item !== primary);
  return (
    <View style={[styles.root, { padding: layout.padding }]} testID="employee-portal-workspace-home">
      <EmployeeWelcome displayName={displayName} section={selected ? employeePortalWorkspaceLabels[selected] : 'Persönlicher Bereich'}
        phone={layout.phone} shortLandscape={shortLandscape} />
      {workspace?.loading ? <Notice message="Ihre Modulfreigaben werden geprüft…" /> : null}
      {workspace?.error ? <Notice message={workspace.error} error onRetry={workspace.retry} /> : null}
      {!selected && !workspace?.loading && !workspace?.error ? <Notice message="Für Ihr Konto ist derzeit kein Arbeitsmodul verfügbar." /> : null}
      {details && primary ? (
        <Panel title={details.title}>
          <ArtworkSummary id={primary.id} label={primary.label} message={details.description} size={layout.phone ? 72 : 96} />
          <Action label={`${primary.label} öffnen`} onPress={() => router.push(primary.route as never)} primary />
        </Panel>
      ) : null}
      <Panel title="Für mich">
        {personal?.map(item => <WorkspaceShortcut key={item.id} item={item}
          size={layout.shortcutArtworkSize} onPress={() => router.push(item.route as never)} />)}
        {openMenu ? <Action label="Alle Bereiche" onPress={openMenu} /> : null}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  root: { width: '100%', minWidth: 0, padding: 16, gap: 18 },
  greeting: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 18, padding: 22, borderWidth: 1,
    borderColor: c.line, borderRadius: 20, backgroundColor: c.panel,
  },
  greetingPhone: { flexDirection: 'column', alignItems: 'stretch', padding: 14, gap: 12 },
  greetingLandscape: { padding: 14, gap: 12 },
  greetingCopy: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 7 },
  eyebrow: { color: c.accent, fontSize: font(12), lineHeight: font(18), letterSpacing: 1, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: c.text, fontSize: font(40), lineHeight: font(48), fontWeight: '700' },
  titleLandscape: { fontSize: font(32), lineHeight: font(38) },
  titlePhone: { fontSize: font(28), lineHeight: font(35) },
  dailyNote: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'flex-start', gap: 10, padding: 10, marginTop: 5, maxWidth: 760, backgroundColor: c.control, borderRadius: 13 },
  dailyIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.selected },
  dailyCopy: { flexShrink: 1, minWidth: 0, gap: 2 },
  dailyLabel: { color: c.accent, fontSize: font(12), lineHeight: font(17), fontWeight: '700' },
  dailyText: { color: c.text, fontSize: font(15), lineHeight: font(22) },
  bodyText: { color: c.muted, fontSize: font(13), lineHeight: font(21), flexShrink: 1 },
  action: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.control, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%' },
  actionText: { color: c.accent, fontSize: font(12), lineHeight: font(19), textAlign: 'center', flexShrink: 1 }, primary: { backgroundColor: c.accent, borderColor: c.accent, alignSelf: 'center' }, primaryText: { color: '#082239', fontWeight: '700' },
  notice: { padding: 14, gap: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.raised, borderRadius: 13 }, warning: { color: c.warning },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', margin: -5 }, metric: { minHeight: 80, minWidth: 0, padding: 14, gap: 5, backgroundColor: c.raised, borderRadius: 15, borderWidth: 1, borderColor: c.line, height: '100%' }, metricValue: { color: c.text, fontSize: font(24), lineHeight: font(32) }, metricLabel: { color: c.muted, fontSize: font(12), lineHeight: font(18) },
  focus: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 }, stacked: { flexDirection: 'column' }, day: { flex: 1.5, minWidth: 0 }, side: { flex: 1, minWidth: 0, gap: 14 }, fullWidth: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  artworkSummary: { flexDirection: 'row', alignItems: 'center', gap: 14 }, artworkSummaryText: { flex: 1, minWidth: 0 },
  panel: { minWidth: 0, borderWidth: 1, borderColor: c.line, borderRadius: 18, padding: 18, gap: 12, backgroundColor: c.panel }, panelTitle: { color: c.text, fontSize: font(17), lineHeight: font(24), fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 12, gap: 12, minWidth: 0 }, emptyTitle: { color: c.text, fontSize: font(15), lineHeight: font(23), textAlign: 'center', fontWeight: '700' }, emptyText: { color: c.muted, fontSize: font(13), lineHeight: font(21), textAlign: 'center', maxWidth: 340 },
  assignment: { width: '100%', minWidth: 0, paddingVertical: 15, gap: 7, borderTopWidth: 1, borderTopColor: c.line }, activeAssignment: { borderTopColor: c.accent }, assignmentStatus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, assignmentAction: { color: c.accent, fontSize: font(12), lineHeight: font(18) }, assignmentTitle: { width: '100%', color: c.text, fontSize: font(16), lineHeight: font(24), fontWeight: '700' },
  task: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 44, borderTopWidth: 1, borderColor: c.line, paddingVertical: 9 }, taskText: { flex: 1, minWidth: 0, color: c.text, fontSize: font(13), lineHeight: font(21) }, taskCount: { color: c.accent, fontSize: font(18), lineHeight: font(24) },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }, sectionTitle: { color: c.text, fontSize: font(19), lineHeight: font(27), fontWeight: '700', flexShrink: 1 },
  groups: { flexDirection: 'row', flexWrap: 'wrap', margin: -5 },
  shortcut: { minWidth: 0, minHeight: 72, paddingVertical: 8, borderTopWidth: 1, borderColor: c.line, flexDirection: 'row', alignItems: 'center', gap: 12 },
  shortcutLabel: { flex: 1, minWidth: 0, color: c.text, fontSize: font(14), lineHeight: font(22) },
  shortcutTiles: { flexDirection: 'row', gap: 8 },
  shortcutTile: {
    flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'space-between', gap: 7,
    paddingHorizontal: 4, paddingVertical: 10, borderWidth: 1, borderColor: c.line,
    borderRadius: 13, backgroundColor: c.raised,
  },
  shortcutTileLabel: { flex: 0, minHeight: font(44), fontSize: font(13), textAlign: 'center', fontWeight: '600', alignSelf: 'stretch' },
  personal: { gap: 11 }, personalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, footer: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 10 }, caption: { color: c.muted, fontSize: font(11), lineHeight: font(17), flexShrink: 1 }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.5 },
}));
