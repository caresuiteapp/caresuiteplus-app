import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCurrentSystemAdapter } from '../adapters/currentSystemAdapter';
import {
  LiquidButton,
  LiquidGlyph,
  LiquidMetric,
  LiquidState,
  LiquidStatus,
  LiquidSurface,
  LiquidText,
} from '../components/LiquidPrimitives';
import { liquidColors, liquidRadius } from '../foundation/tokens';
import { useLiquidLayout } from '../foundation/useLiquidLayout';
import { LiquidCommandShell } from '../shell/LiquidCommandShell';
import { ClientNetworkMap } from '../components/ClientNetworkMap';

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatSync(value: string | null): string {
  if (!value) return 'noch nicht synchronisiert';
  const date = new Date(value);
  return `synchronisiert ${new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)}`;
}

function ClientMap({
  clients,
  tenantId,
}: {
  clients: ReturnType<typeof useCurrentSystemAdapter>['data']['clients'];
  tenantId: string | null;
}) {
  const router = useRouter();
  const layout = useLiquidLayout();
  return (
    <LiquidSurface active style={styles.mapCard} contentStyle={styles.mapContent}>
      <ClientNetworkMap
        clients={clients}
        height={layout.isPhone ? 248 : layout.formFactor === 'tablet-portrait' ? 320 : 382}
        tenantId={tenantId}
        onClientSelect={(clientId) =>
          router.push(`/business/office/clients/${clientId}` as never)
        }
      />
    </LiquidSurface>
  );
}

function SummaryRail({
  visits,
  clients,
  employees,
  stacked = false,
}: {
  visits: ReturnType<typeof useCurrentSystemAdapter>['data']['visits'];
  clients: ReturnType<typeof useCurrentSystemAdapter>['data']['clients'];
  employees: ReturnType<typeof useCurrentSystemAdapter>['data']['employees'];
  stacked?: boolean;
}) {
  const router = useRouter();
  const active = visits.filter((visit) =>
    ['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(visit.assignmentStatus ?? ''),
  ).length;
  const completed = visits.filter((visit) => visit.assignmentStatus === 'abgeschlossen').length;
  const open = visits.filter((visit) => visit.assignmentStatus !== 'abgeschlossen').length;
  const critical = clients.filter((client) =>
    client.status === 'gesperrt' || client.status === 'fehlerhaft',
  ).length;
  const stable = clients.filter((client) => client.status === 'aktiv').length;
  const observation = Math.max(0, clients.length - stable - critical);
  const assignedEmployeeIds = new Set(
    visits.map((visit) => visit.employeeId).filter((value): value is string => Boolean(value)),
  );
  const availableEmployees = Math.max(0, employees.length - assignedEmployeeIds.size);
  const availability = employees.length
    ? Math.round((availableEmployees / employees.length) * 100)
    : 0;

  return (
    <View style={[styles.summaryRail, stacked && styles.summaryRailStacked]}>
      <LiquidSurface
        style={[styles.assignmentSummary, stacked && styles.summaryPanelStacked]}
        contentStyle={styles.summaryCard}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/assist/einsaetze' as never)}
          style={({ pressed }) => [styles.summaryHeader, pressed && styles.pressed]}
        >
          <LiquidText variant="section">Einsätze</LiquidText>
          <LiquidGlyph glyph="→" size={18} />
        </Pressable>
        <View style={styles.summaryMetricGrid}>
          <LiquidMetric label="Geplant" value={visits.length} glyph="▧" tone="live" />
          <LiquidMetric label="Aktiv" value={active} glyph="▷" tone="live" />
          <LiquidMetric label="Fertig" value={completed} glyph="✓" tone="success" />
          <LiquidMetric label="Offen" value={open} glyph="◷" tone={open ? 'warning' : 'success'} />
        </View>
      </LiquidSurface>
      <LiquidSurface
        style={[styles.clientSummary, stacked && styles.summaryPanelStacked]}
        contentStyle={styles.summaryCard}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/business/office/clients' as never)}
          style={({ pressed }) => [styles.summaryHeader, pressed && styles.pressed]}
        >
          <LiquidText variant="section">Klient:innen</LiquidText>
          <LiquidGlyph glyph="→" size={18} />
        </Pressable>
        <View style={styles.clientDonutRow}>
          <View style={styles.clientDonut}>
            <Text style={styles.clientDonutValue}>{clients.length}</Text>
            <Text style={styles.clientDonutLabel}>Aktiv</Text>
          </View>
          <View style={styles.clientLegend}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: liquidColors.blue400 }]} />
              <Text style={styles.legendLabel}>Stabil</Text>
              <Text style={styles.legendValue}>{stable}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: liquidColors.blue600 }]} />
              <Text style={styles.legendLabel}>Beobachtung</Text>
              <Text style={styles.legendValue}>{observation}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: liquidColors.warning }]} />
              <Text style={styles.legendLabel}>Kritisch</Text>
              <Text style={styles.legendValue}>{critical}</Text>
            </View>
          </View>
        </View>
      </LiquidSurface>
      <LiquidSurface
        style={[styles.personnelSummary, stacked && styles.summaryPanelStacked]}
        contentStyle={styles.summaryCard}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/business/office/employees' as never)}
          style={({ pressed }) => [styles.summaryHeader, pressed && styles.pressed]}
        >
          <LiquidText variant="section">Personal</LiquidText>
          <LiquidGlyph glyph="→" size={18} />
        </Pressable>
        <Text style={styles.staffMeta}>Verfügbar</Text>
        <View style={styles.availabilityRow}>
          <Text style={styles.staffValue}>{availability}</Text>
          <Text style={styles.staffPercent}>%</Text>
        </View>
        <View style={styles.staffDots}>
          {employees.slice(0, 12).map((employee) => (
            <View key={employee.id} style={styles.staffDot}>
              <Text style={styles.staffDotLabel}>
                {(employee.firstName || employee.lastName || 'M').slice(0, 1)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.staffStats}>
          <View style={styles.staffStat}>
            <Text style={styles.staffStatLabel}>Eingesetzt</Text>
            <Text style={styles.staffStatValue}>{assignedEmployeeIds.size}</Text>
          </View>
          <View style={styles.staffStatDivider} />
          <View style={styles.staffStat}>
            <Text style={styles.staffStatLabel}>Geplant</Text>
            <Text style={styles.staffStatValue}>{visits.length}</Text>
          </View>
        </View>
      </LiquidSurface>
    </View>
  );
}

function TodayTimeline({
  visits,
}: {
  visits: ReturnType<typeof useCurrentSystemAdapter>['data']['visits'];
}) {
  const router = useRouter();
  const items = visits.slice(0, 7);
  return (
    <LiquidSurface contentStyle={styles.timelineCard}>
      <View style={styles.sectionHeader}>
        <View>
          <LiquidText variant="kicker">EINSÄTZE · HEUTE</LiquidText>
          <LiquidText variant="section">Operativer Verlauf</LiquidText>
        </View>
        <LiquidButton
          compact
          label="Alle Einsätze"
          variant="ghost"
          onPress={() => router.push('/assist/einsaetze' as never)}
        />
      </View>
      <View style={styles.timelineScale}>
        {['07', '09', '11', '13', '15', '17', '19'].map((hour) => (
          <Text key={hour} style={styles.timelineHour}>{hour}:00</Text>
        ))}
      </View>
      {items.length ? (
        <View style={styles.timelineRows}>
          {items.map((visit, index) => {
            const active =
              visit.assignmentStatus === 'unterwegs' ||
              visit.assignmentStatus === 'angekommen' ||
              visit.assignmentStatus === 'gestartet';
            return (
              <Pressable
                key={visit.id}
                accessibilityRole="button"
                accessibilityLabel={`${visit.clientName}, ${formatTime(visit.scheduledStart)}, ${visit.title}`}
                onPress={() => router.push(`/assist/einsaetze/${visit.id}` as never)}
                style={({ pressed }) => [
                  styles.timelineRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.timelinePerson}>
                  <View style={[styles.personDot, active && styles.personDotActive]}>
                    <Text style={styles.personDotLabel}>{index + 1}</Text>
                  </View>
                  <View style={styles.timelineNames}>
                    <Text numberOfLines={1} style={styles.timelineName}>{visit.clientName}</Text>
                    <Text numberOfLines={1} style={styles.timelineMeta}>{visit.employeeName}</Text>
                  </View>
                </View>
                <View style={styles.timelineBarWrap}>
                  <View style={[styles.timelineBar, active && styles.timelineBarActive]} />
                </View>
                <Text style={styles.timelineTime}>{formatTime(visit.scheduledStart)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.compactEmpty}>
          <LiquidText variant="meta">
            Für den aktuellen Kontext sind keine Einsätze vorhanden.
          </LiquidText>
        </View>
      )}
    </LiquidSurface>
  );
}

function AlertsPanel({
  errors,
  incomplete,
  documents,
}: {
  errors: string[];
  incomplete: number;
  documents: number;
}) {
  const router = useRouter();
  const entries = [
    ...(errors.length ? [{
      glyph: '!',
      tone: 'danger' as const,
      title: 'Datenquelle nicht erreichbar',
      detail: `${errors.length} Bereich(e) prüfen`,
      route: '/business/office/admin/operations-monitoring',
    }] : []),
    ...(incomplete ? [{
      glyph: '▤',
      tone: 'warning' as const,
      title: 'Dokumentation unvollständig',
      detail: `${incomplete} Einsatz/Einsätze`,
      route: '/assist/nachweise/review',
    }] : []),
    ...(!documents ? [{
      glyph: '□',
      tone: 'neutral' as const,
      title: 'Keine Dokumente im Kontext',
      detail: 'Ablage prüfen',
      route: '/business/office/documents',
    }] : []),
  ];
  return (
    <LiquidSurface style={styles.alertsPanel} contentStyle={styles.asideCard}>
      <View style={styles.sectionHeader}>
        <View>
          <LiquidText variant="kicker">PRIORITÄTEN</LiquidText>
          <LiquidText variant="section">Handlungsbedarf</LiquidText>
        </View>
        <LiquidStatus label={`${entries.length}`} tone={entries.length ? 'warning' : 'success'} />
      </View>
      {entries.length ? entries.map((entry) => (
        <Pressable
          key={entry.title}
          accessibilityRole="button"
          accessibilityLabel={`${entry.title}: ${entry.detail}`}
          onPress={() => router.push(entry.route as never)}
          style={({ pressed }) => [styles.alertRow, pressed && styles.actionRowPressed]}
        >
          <View style={styles.alertIcon}>
            <LiquidGlyph glyph={entry.glyph} size={20} />
          </View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>{entry.title}</Text>
            <Text style={styles.alertDetail}>{entry.detail}</Text>
          </View>
          <LiquidGlyph glyph="→" size={16} />
        </Pressable>
      )) : (
        <View style={styles.alertsClear}>
          <View style={styles.clearIcon}><LiquidGlyph glyph="✓" size={22} /></View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>Keine kritischen Hinweise</Text>
            <Text style={styles.alertDetail}>Alle überwachten Bereiche sind aktuell unauffällig.</Text>
          </View>
        </View>
      )}
    </LiquidSurface>
  );
}

function DailyOperationsPanel({
  visits,
  employees,
  incomplete,
}: {
  visits: ReturnType<typeof useCurrentSystemAdapter>['data']['visits'];
  employees: ReturnType<typeof useCurrentSystemAdapter>['data']['employees'];
  incomplete: number;
}) {
  const router = useRouter();
  const active = visits.filter((visit) =>
    ['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(visit.assignmentStatus ?? ''),
  ).length;
  const completed = visits.filter((visit) => visit.assignmentStatus === 'abgeschlossen').length;
  const open = Math.max(0, visits.length - completed);
  const assignedEmployeeIds = new Set(
    visits.map((visit) => visit.employeeId).filter((value): value is string => Boolean(value)),
  );
  const available = Math.max(0, employees.length - assignedEmployeeIds.size);
  const actions = [
    {
      glyph: '＋',
      title: 'Einsatz planen',
      detail: 'Neue Versorgung strukturiert anlegen',
      route: '/assist/einsaetze/new',
    },
    {
      glyph: '✓',
      title: 'Nachweise prüfen',
      detail: incomplete ? `${incomplete} Dokumentation(en) offen` : 'Aktuell keine offenen Dokumentationen',
      route: '/assist/nachweise/review',
    },
    {
      glyph: '↗',
      title: 'Personal disponieren',
      detail: `${available} Mitarbeitende verfügbar`,
      route: '/business/office/employees',
    },
  ] as const;

  return (
    <LiquidSurface style={styles.operationsPanel} contentStyle={styles.operationsCard}>
      <View style={styles.sectionHeader}>
        <View>
          <LiquidText variant="kicker">HEUTE · OPERATIVE STEUERUNG</LiquidText>
          <LiquidText variant="section">Tageslage</LiquidText>
        </View>
        <LiquidStatus label={active ? `${active} live` : 'Ruhig'} tone={active ? 'live' : 'success'} />
      </View>

      <View style={styles.operationsMetrics}>
        <View style={styles.operationMetric}>
          <Text style={styles.operationMetricLabel}>Offene Einsätze</Text>
          <Text style={styles.operationMetricValue}>{open}</Text>
        </View>
        <View style={styles.operationMetric}>
          <Text style={styles.operationMetricLabel}>Aktiv</Text>
          <Text style={styles.operationMetricValue}>{active}</Text>
        </View>
        <View style={styles.operationMetric}>
          <Text style={styles.operationMetricLabel}>Dokumentation</Text>
          <Text style={styles.operationMetricValue}>{incomplete}</Text>
        </View>
        <View style={styles.operationMetric}>
          <Text style={styles.operationMetricLabel}>Verfügbar</Text>
          <Text style={styles.operationMetricValue}>{available}</Text>
        </View>
      </View>

      <View style={styles.quickActionsHeader}>
        <Text style={styles.quickActionsTitle}>Schnellaktionen</Text>
        <Text style={styles.quickActionsHint}>Direkt ausführen</Text>
      </View>
      <View style={styles.quickActions}>
        {actions.map((action) => (
          <Pressable
            key={action.title}
            accessibilityRole="button"
            accessibilityLabel={`${action.title}: ${action.detail}`}
            onPress={() => router.push(action.route as never)}
            style={({ pressed }) => [styles.quickActionRow, pressed && styles.actionRowPressed]}
          >
            <View style={styles.quickActionIcon}>
              <LiquidGlyph glyph={action.glyph} size={18} />
            </View>
            <View style={styles.alertCopy}>
              <Text style={styles.quickActionTitle}>{action.title}</Text>
              <Text numberOfLines={1} style={styles.quickActionDetail}>{action.detail}</Text>
            </View>
            <LiquidGlyph glyph="→" size={16} />
          </Pressable>
        ))}
      </View>
    </LiquidSurface>
  );
}

export function CommandCenterScreen() {
  const router = useRouter();
  const layout = useLiquidLayout();
  const state = useCurrentSystemAdapter();
  const today = new Date().toDateString();
  const activeClients = useMemo(
    () => state.data.clients.filter((client) => client.status === 'aktiv'),
    [state.data.clients],
  );
  const todaysVisits = useMemo(
    () => state.data.visits.filter((visit) => new Date(visit.scheduledStart).toDateString() === today),
    [state.data.visits, today],
  );
  const incomplete = todaysVisits.filter((visit) => visit.isIncomplete);
  const errorMessages = Object.values(state.errors).filter((value): value is string => Boolean(value));

  const aside = (
    <>
      <AlertsPanel
        errors={errorMessages}
        incomplete={incomplete.length}
        documents={state.data.documents.length}
      />
      <DailyOperationsPanel
        employees={state.data.employees}
        incomplete={incomplete.length}
        visits={todaysVisits}
      />
    </>
  );

  return (
    <LiquidCommandShell
      activeModule="home"
      title="Versorgung heute."
      subtitle="Alle Klient:innen, Einsätze, Prioritäten und nächsten Handlungen in einer gemeinsamen Arbeitsfläche."
      contextLabel="Unternehmenslage"
      contextDetail={formatSync(state.lastSynchronizedAt)}
      primaryActionLabel="Neue Aktion"
      onPrimaryAction={() => router.push('/assist/einsaetze/new' as never)}
      showContextBar={false}
      showPageHeader={false}
    >
      {state.loading && !state.initialized ? (
        <LiquidState
          kind="loading"
          title="Unternehmenslage wird aufgebaut"
          message="Produktive Daten werden mandantengetrennt geladen. Der Arbeitskontext bleibt erhalten."
        />
      ) : null}

      {state.errors.session ? (
        <LiquidState
          kind="locked"
          title="Mandantenkontext fehlt"
          message={state.errors.session}
          actionLabel="Erneut laden"
          onAction={() => void state.reload()}
        />
      ) : null}

      <View style={[styles.dashboardLayout, !layout.isDesktop && styles.dashboardLayoutCompact]}>
        <SummaryRail
          clients={activeClients}
          employees={state.data.employees}
          stacked={!layout.isDesktop}
          visits={todaysVisits}
        />
        <View style={[styles.centerColumn, !layout.isDesktop && styles.compactFullWidth]}>
          <ClientMap clients={activeClients} tenantId={state.tenantId} />
          <TodayTimeline visits={todaysVisits} />
        </View>
        <View style={[styles.rightRail, !layout.isDesktop && styles.compactFullWidth]}>{aside}</View>
      </View>

      {errorMessages.length && !state.errors.session ? (
        <LiquidState
          kind="error"
          title="Einzelne Datenquellen konnten nicht geladen werden"
          message={`${errorMessages.join(' · ')} Bereits geladene Bereiche bleiben verfügbar.`}
          reference={`LC-${Date.now().toString(36).toUpperCase()}`}
          actionLabel="Erneut versuchen"
          onAction={() => void state.reload()}
        />
      ) : null}
    </LiquidCommandShell>
  );
}

const styles = StyleSheet.create({
  dashboardLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
  },
  dashboardLayoutCompact: {
    flexDirection: 'column',
  },
  summaryRail: {
    width: 310,
    gap: 12,
  },
  summaryRailStacked: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryPanelStacked: {
    minWidth: 240,
    flex: 1,
  },
  assignmentSummary: {
    minHeight: 238,
  },
  clientSummary: {
    minHeight: 206,
  },
  personnelSummary: {
    minHeight: 274,
  },
  summaryCard: {
    padding: 14,
    gap: 10,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  clientDonutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  clientDonut: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 10,
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(20,120,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: liquidColors.blue500,
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  clientDonutValue: {
    color: liquidColors.white,
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '800',
  },
  clientDonutLabel: {
    color: liquidColors.white56,
    fontSize: 10,
    lineHeight: 13,
  },
  clientLegend: {
    minWidth: 0,
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    minWidth: 0,
    flex: 1,
    color: liquidColors.white64,
    fontSize: 11,
    lineHeight: 15,
  },
  legendValue: {
    color: liquidColors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  staffValue: {
    color: liquidColors.white,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  staffPercent: {
    color: liquidColors.white72,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  staffMeta: {
    color: liquidColors.white56,
    fontSize: 11,
    lineHeight: 15,
  },
  staffDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  staffDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(20,120,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffDotLabel: {
    color: liquidColors.white,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  staffStats: {
    marginTop: 'auto',
    minHeight: 60,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffStat: {
    flex: 1,
    gap: 2,
  },
  staffStatDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 14,
    backgroundColor: liquidColors.white12,
  },
  staffStatLabel: {
    color: liquidColors.white56,
    fontSize: 10,
    lineHeight: 14,
  },
  staffStatValue: {
    color: liquidColors.white,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  centerColumn: {
    minWidth: 0,
    flex: 1,
    gap: 14,
  },
  rightRail: {
    width: 336,
    gap: 14,
    alignSelf: 'stretch',
  },
  compactFullWidth: {
    width: '100%',
  },
  mapCard: {
    minHeight: 384,
  },
  mapContent: {
    padding: 0,
  },
  map: {
    position: 'relative',
    minHeight: 230,
    overflow: 'hidden',
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: '#EEF6FF',
  },
  mapLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: 'rgba(20,120,255,0.44)',
    shadowColor: liquidColors.blue500,
    shadowOpacity: 0.8,
    shadowRadius: 7,
  },
  mapLineOne: {
    width: '76%',
    left: '10%',
    top: '50%',
    transform: [{ rotate: '-12deg' }],
  },
  mapLineTwo: {
    width: '50%',
    left: '21%',
    top: '40%',
    transform: [{ rotate: '18deg' }],
  },
  mapLineThree: {
    width: '36%',
    left: '52%',
    top: '48%',
    transform: [{ rotate: '-28deg' }],
  },
  mapNode: {
    position: 'absolute',
    width: 30,
    height: 30,
    marginLeft: -15,
    marginTop: -15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: liquidColors.blue500,
    backgroundColor: 'rgba(20,120,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapNodeCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: liquidColors.white32,
  },
  mapNodeLive: {
    backgroundColor: liquidColors.blue200,
    shadowColor: liquidColors.blue400,
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  mapEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapEmptyText: {
    color: liquidColors.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  timelineCard: {
    padding: 16,
    gap: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  timelineScale: {
    paddingLeft: 190,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineHour: {
    color: liquidColors.white32,
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  timelineRows: {
    gap: 6,
  },
  timelineRow: {
    minHeight: 52,
    borderRadius: liquidRadius.control,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
  },
  timelinePerson: {
    width: 168,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  personDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: liquidColors.white22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personDotActive: {
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(20,120,255,0.17)',
  },
  personDotLabel: {
    color: liquidColors.white72,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  timelineNames: {
    minWidth: 0,
    flex: 1,
  },
  timelineName: {
    color: liquidColors.white,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  timelineMeta: {
    color: liquidColors.white56,
    fontSize: 11,
    lineHeight: 15,
  },
  timelineBarWrap: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  timelineBar: {
    width: '38%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(139,193,255,0.36)',
  },
  timelineBarActive: {
    width: '62%',
    backgroundColor: liquidColors.blue500,
  },
  timelineTime: {
    width: 48,
    color: liquidColors.white72,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  asideCard: {
    padding: 14,
    gap: 12,
  },
  alertsPanel: {
    minHeight: 238,
  },
  alertRow: {
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    borderRadius: liquidRadius.small,
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: 'rgba(20,120,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    color: liquidColors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  alertDetail: {
    color: liquidColors.white56,
    fontSize: 12,
    lineHeight: 17,
  },
  compactEmpty: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  alertsClear: {
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(44,190,151,0.24)',
    borderRadius: liquidRadius.small,
    backgroundColor: 'rgba(44,190,151,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(44,190,151,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operationsPanel: {
    flex: 1,
    minHeight: 424,
  },
  operationsCard: {
    flex: 1,
    padding: 14,
    gap: 14,
  },
  operationsMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  operationMetric: {
    width: '48%',
    minHeight: 76,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    borderRadius: liquidRadius.small,
    backgroundColor: 'rgba(20,120,255,0.055)',
    justifyContent: 'space-between',
  },
  operationMetricLabel: {
    color: liquidColors.white56,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  operationMetricValue: {
    color: liquidColors.white,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  quickActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickActionsTitle: {
    color: liquidColors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  quickActionsHint: {
    color: liquidColors.white32,
    fontSize: 10,
    lineHeight: 14,
  },
  quickActions: {
    gap: 7,
  },
  quickActionRow: {
    minHeight: 61,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    borderRadius: liquidRadius.control,
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(79,183,255,0.25)',
    backgroundColor: 'rgba(20,120,255,0.11)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTitle: {
    color: liquidColors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  quickActionDetail: {
    color: liquidColors.white56,
    fontSize: 10,
    lineHeight: 14,
  },
  actionRowPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  pressed: {
    opacity: 0.8,
  },
  focused: {
    borderWidth: 2,
    borderColor: liquidColors.blue200,
  },
});
