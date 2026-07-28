import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCurrentSystemAdapter } from '../adapters/currentSystemAdapter';
import {
  LiquidButton,
  LiquidMetric,
  LiquidState,
  LiquidStatus,
  LiquidSurface,
  LiquidText,
} from '../components/LiquidPrimitives';
import { liquidColors, liquidRadius, liquidSpace } from '../foundation/tokens';
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
  return (
    <LiquidSurface active style={styles.mapCard} contentStyle={styles.mapContent}>
      <View style={styles.mapHeader}>
        <View>
          <LiquidText variant="kicker">VERSORGUNGSNETZ · DAUERHAFT</LiquidText>
          <LiquidText variant="section">Alle Klient:innen auf der Karte</LiquidText>
        </View>
        <View style={styles.mapActions}>
          <LiquidStatus label={`${clients.length} Klient:innen`} tone="live" />
          <LiquidButton
            compact
            label="Live-Status"
            variant="ghost"
            onPress={() => router.push('/assist?area=live' as never)}
          />
        </View>
      </View>
      <ClientNetworkMap
        clients={clients}
        height={330}
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

  return (
    <View style={[styles.summaryRail, stacked && styles.summaryRailStacked]}>
      <LiquidSurface style={stacked ? styles.summaryPanelStacked : undefined} contentStyle={styles.summaryCard}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/assist?area=assignments' as never)}
          style={({ pressed }) => [styles.summaryHeader, pressed && styles.pressed]}
        >
          <LiquidText variant="section">Einsätze</LiquidText>
          <Text style={styles.summaryArrow}>→</Text>
        </Pressable>
        <View style={styles.summaryMetricGrid}>
          <LiquidMetric label="Geplant" value={visits.length} glyph="□" tone="live" />
          <LiquidMetric label="Aktiv" value={active} glyph="▷" tone="live" />
          <LiquidMetric label="Fertig" value={completed} glyph="✓" tone="success" />
          <LiquidMetric label="Offen" value={open} glyph="◷" tone={open ? 'warning' : 'success'} />
        </View>
      </LiquidSurface>
      <LiquidSurface style={stacked ? styles.summaryPanelStacked : undefined} contentStyle={styles.summaryCard}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/assist?area=clients' as never)}
          style={({ pressed }) => [styles.summaryHeader, pressed && styles.pressed]}
        >
          <LiquidText variant="section">Klient:innen</LiquidText>
          <Text style={styles.summaryArrow}>→</Text>
        </Pressable>
        <View style={styles.clientDonutRow}>
          <View style={styles.clientDonut}>
            <Text style={styles.clientDonutValue}>{clients.length}</Text>
            <Text style={styles.clientDonutLabel}>Gesamt</Text>
          </View>
          <View style={styles.clientLegend}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: liquidColors.success }]} />
              <Text style={styles.legendLabel}>Aktiv</Text>
              <Text style={styles.legendValue}>{Math.max(0, clients.length - critical)}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: liquidColors.warning }]} />
              <Text style={styles.legendLabel}>Prüfen</Text>
              <Text style={styles.legendValue}>{critical}</Text>
            </View>
          </View>
        </View>
      </LiquidSurface>
      <LiquidSurface style={stacked ? styles.summaryPanelStacked : undefined} contentStyle={styles.summaryCard}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/office?area=people' as never)}
          style={({ pressed }) => [styles.summaryHeader, pressed && styles.pressed]}
        >
          <LiquidText variant="section">Personal</LiquidText>
          <Text style={styles.summaryArrow}>→</Text>
        </Pressable>
        <Text style={styles.staffValue}>{employees.length}</Text>
        <Text style={styles.staffMeta}>Mitarbeitende im Mandantenkontext</Text>
        <View style={styles.staffDots}>
          {employees.slice(0, 12).map((employee) => (
            <View key={employee.id} style={styles.staffDot}>
              <Text style={styles.staffDotLabel}>
                {(employee.firstName || employee.lastName || 'M').slice(0, 1)}
              </Text>
            </View>
          ))}
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
          onPress={() => router.push('/assist?area=assignments' as never)}
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
                onPress={() => router.push(`/assist?area=assignments&record=${visit.id}` as never)}
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
  const entries = [
    ...(errors.length ? [{ tone: 'danger' as const, title: 'Datenquelle nicht erreichbar', detail: `${errors.length} Bereich(e)` }] : []),
    ...(incomplete ? [{ tone: 'warning' as const, title: 'Dokumentation unvollständig', detail: `${incomplete} Einsatz/Einsätze` }] : []),
    ...(!documents ? [{ tone: 'neutral' as const, title: 'Keine Dokumente im Kontext', detail: 'Ablage prüfen' }] : []),
  ];
  return (
    <LiquidSurface contentStyle={styles.asideCard}>
      <View style={styles.sectionHeader}>
        <LiquidText variant="section">Hinweise</LiquidText>
        <LiquidStatus label={`${entries.length}`} tone={entries.length ? 'warning' : 'success'} />
      </View>
      {entries.length ? entries.map((entry) => (
        <View key={entry.title} style={styles.alertRow}>
          <LiquidStatus label={entry.title} tone={entry.tone} />
          <Text style={styles.alertDetail}>{entry.detail}</Text>
        </View>
      )) : (
        <View style={styles.compactEmpty}>
          <LiquidStatus label="Keine kritischen Hinweise" tone="success" />
        </View>
      )}
    </LiquidSurface>
  );
}

function BodyMapPanel() {
  const router = useRouter();
  return (
    <LiquidSurface contentStyle={styles.asideCard}>
      <View style={styles.sectionHeader}>
        <View>
          <LiquidText variant="kicker">KLINISCH</LiquidText>
          <LiquidText variant="section">BodyMap</LiquidText>
        </View>
        <Text style={styles.bodyMapGlyph}>⌾</Text>
      </View>
      <View style={styles.bodyMapStage}>
        <View style={styles.bodyHead} />
        <View style={styles.bodyTorso} />
        <View style={[styles.bodyLimb, styles.bodyArmLeft]} />
        <View style={[styles.bodyLimb, styles.bodyArmRight]} />
        <View style={[styles.bodyLimb, styles.bodyLegLeft]} />
        <View style={[styles.bodyLimb, styles.bodyLegRight]} />
        <View style={[styles.bodyMarker, { top: '39%', left: '56%' }]} />
        <View style={[styles.bodyMarker, { top: '67%', left: '43%' }]} />
      </View>
      <LiquidButton
        fullWidth
        label="BodyMap öffnen"
        variant="secondary"
        onPress={() => router.push('/pflege?area=wounds' as never)}
      />
    </LiquidSurface>
  );
}

export function CommandCenterScreen() {
  const router = useRouter();
  const layout = useLiquidLayout();
  const state = useCurrentSystemAdapter();
  const today = new Date().toDateString();
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
      <BodyMapPanel />
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
      onPrimaryAction={() => router.push('/assist?area=planning' as never)}
      aside={layout.formFactor === 'tablet-portrait' ? undefined : aside}
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

      <View style={[styles.overviewRow, !layout.isDesktop && styles.overviewRowStacked]}>
        <SummaryRail
          clients={state.data.clients}
          employees={state.data.employees}
          stacked={!layout.isDesktop}
          visits={todaysVisits}
        />
        <View style={styles.mapColumn}>
          <ClientMap clients={state.data.clients} tenantId={state.tenantId} />
        </View>
      </View>
      <TodayTimeline visits={todaysVisits} />

      {layout.formFactor === 'tablet-portrait' || layout.isPhone ? (
        <View style={styles.mobileAside}>
          {aside}
        </View>
      ) : null}

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
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
  },
  overviewRowStacked: {
    flexDirection: 'column',
  },
  summaryRail: {
    width: 276,
    gap: 14,
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
  summaryCard: {
    padding: 15,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryArrow: {
    color: liquidColors.blue200,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
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
  mapColumn: {
    minWidth: 0,
    flex: 1,
  },
  mapCard: {
    minHeight: 454,
  },
  mapContent: {
    padding: liquidSpace[5],
    gap: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  map: {
    position: 'relative',
    minHeight: 230,
    overflow: 'hidden',
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: 'rgba(2,14,32,0.72)',
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
    color: liquidColors.white56,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  timelineCard: {
    padding: liquidSpace[5],
    gap: 14,
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
    padding: 16,
    gap: 14,
  },
  alertRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white08,
    gap: 7,
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
  bodyMapGlyph: {
    color: liquidColors.blue200,
    fontSize: 24,
    lineHeight: 28,
  },
  bodyMapStage: {
    position: 'relative',
    height: 210,
    alignItems: 'center',
  },
  bodyHead: {
    position: 'absolute',
    top: 9,
    width: 38,
    height: 45,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: liquidColors.blue200,
    backgroundColor: 'rgba(20,120,255,0.13)',
  },
  bodyTorso: {
    position: 'absolute',
    top: 56,
    width: 68,
    height: 88,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: liquidColors.blue200,
    backgroundColor: 'rgba(20,120,255,0.11)',
  },
  bodyLimb: {
    position: 'absolute',
    width: 18,
    height: 92,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: liquidColors.blue200,
    backgroundColor: 'rgba(20,120,255,0.09)',
  },
  bodyArmLeft: {
    top: 61,
    marginLeft: -88,
    transform: [{ rotate: '8deg' }],
  },
  bodyArmRight: {
    top: 61,
    marginLeft: 88,
    transform: [{ rotate: '-8deg' }],
  },
  bodyLegLeft: {
    top: 138,
    marginLeft: -22,
    height: 70,
  },
  bodyLegRight: {
    top: 138,
    marginLeft: 22,
    height: 70,
  },
  bodyMarker: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: liquidColors.white,
    backgroundColor: liquidColors.blue500,
    shadowColor: liquidColors.blue500,
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  mobileAside: {
    gap: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  focused: {
    borderWidth: 2,
    borderColor: liquidColors.blue200,
  },
});
