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

function OperationsMap({ activeCount }: { activeCount: number }) {
  const nodes = [
    { left: '12%', top: '62%' },
    { left: '24%', top: '34%' },
    { left: '42%', top: '52%' },
    { left: '55%', top: '24%' },
    { left: '69%', top: '58%' },
    { left: '83%', top: '36%' },
  ] as const;
  return (
    <LiquidSurface active style={styles.mapCard} contentStyle={styles.mapContent}>
      <View style={styles.mapHeader}>
        <View>
          <LiquidText variant="kicker">LIVE-LAGE</LiquidText>
          <LiquidText variant="section">Operative Karte</LiquidText>
        </View>
        <LiquidStatus label={`${activeCount} aktiv`} tone="live" />
      </View>
      <View accessible accessibilityLabel={`Operative Karte mit ${activeCount} aktiven Einsätzen`} style={styles.map}>
        <View style={[styles.mapLine, styles.mapLineOne]} />
        <View style={[styles.mapLine, styles.mapLineTwo]} />
        <View style={[styles.mapLine, styles.mapLineThree]} />
        {nodes.map((node, index) => (
          <View
            key={`${node.left}-${node.top}`}
            style={[styles.mapNode, { left: node.left, top: node.top }]}
          >
            <View style={[styles.mapNodeCore, index < activeCount ? styles.mapNodeLive : undefined]} />
          </View>
        ))}
        {!activeCount ? (
          <View style={styles.mapEmpty}>
            <Text style={styles.mapEmptyText}>Keine laufenden Einsätze</Text>
          </View>
        ) : null}
      </View>
    </LiquidSurface>
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
          onPress={() => router.push('/liquid-command/assist?area=assignments' as never)}
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
                onPress={() => router.push(`/liquid-command/assist?area=assignments&record=${visit.id}` as never)}
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
        onPress={() => router.push('/liquid-command/pflege?area=wounds' as never)}
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
  const activeVisits = todaysVisits.filter((visit) =>
    ['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(visit.assignmentStatus ?? ''),
  );
  const completed = todaysVisits.filter((visit) => visit.assignmentStatus === 'abgeschlossen');
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
      title="Versorgung in Bewegung."
      subtitle="Live-Situation, Prioritäten und nächste Handlungen in einer gemeinsamen Arbeitsfläche."
      contextLabel="Unternehmenslage"
      contextDetail={formatSync(state.lastSynchronizedAt)}
      primaryActionLabel="Neue Aktion"
      onPrimaryAction={() => router.push('/liquid-command/assist?area=planning' as never)}
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

      <View style={styles.metricGrid}>
        <LiquidMetric label="Einsätze heute" value={todaysVisits.length} detail={`${activeVisits.length} aktiv`} glyph="◇" tone="live" />
        <LiquidMetric label="Abgeschlossen" value={completed.length} detail="heute" glyph="✓" tone="success" />
        <LiquidMetric label="Klient:innen" value={state.data.clients.length} detail="im Mandantenkontext" glyph="○" />
        <LiquidMetric label="Prüfungen" value={incomplete.length} detail="unvollständig" glyph="!" tone={incomplete.length ? 'warning' : 'success'} />
      </View>

      <OperationsMap activeCount={activeVisits.length} />
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
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mapCard: {
    minHeight: 330,
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
