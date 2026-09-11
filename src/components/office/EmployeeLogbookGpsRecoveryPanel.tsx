import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { InfoBanner, PremiumBadge, PremiumButton, SectionPanel } from '@/components/ui';
import type { EmployeeLogbookGpsRecoveryCandidate } from '@/lib/employeeLogbook/employeeLogbookAssistGpsRecovery';
import { buildLogbookRecoveryView, canImportRecoveryLeg } from '@/lib/employeeLogbook/employeeLogbookRecoveryView';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';
import { TRAVEL_ROUTE_TYPE_LABELS } from '@/types/modules/travelCompensation';
import { typography } from '@/theme';

type Props = {
  candidates: EmployeeLogbookGpsRecoveryCandidate[];
  trips: LogbookTrip[];
  from: string;
  to: string;
  canEdit: boolean;
  busy: boolean;
  hasVehicle: boolean;
  message: string | null;
  onRecheck: () => void;
  onImport: (sessionId: string, legId: string) => void;
  onEdit: (trip: LogbookTrip) => void;
  onDelete: (trip: LogbookTrip) => void;
  onManual: (candidate: EmployeeLogbookGpsRecoveryCandidate) => void;
};
const PAGE_SIZE = 5;
const date = (value: string) => new Date(value).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
const time = (value: string) => new Date(value).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });

export function EmployeeLogbookGpsRecoveryPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const sessions = useMemo(() => buildLogbookRecoveryView(props.candidates, props.trips, props.from, props.to), [props.candidates, props.trips, props.from, props.to]);
  const pending = sessions.filter((session) => session.needsAction);
  const filtered = showAll ? sessions : pending;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  useEffect(() => { setPage(0); setExpanded(null); }, [props.from, props.to, showAll]);
  const disabled = !props.canEdit || props.busy;
  const tripActions = (trip: LogbookTrip) => trip.status === 'cancelled' ? <Text style={styles.meta}>Fahrt gelöscht · keine erneute Übernahme</Text> : (
    <View style={styles.actions}>
      <PremiumButton title="Fahrt bearbeiten" size="sm" variant="secondary" disabled={disabled || trip.status === 'recording'} onPress={() => props.onEdit(trip)} />
      <PremiumButton title="Fahrt löschen" size="sm" variant="ghost" disabled={disabled || trip.status === 'recording'} onPress={() => props.onDelete(trip)} />
    </View>
  );
  return (
    <SectionPanel title="Automatische GPS-Aufzeichnungen" subtitle="Aufzeichnungen im gewählten Zeitraum prüfen und bearbeiten">
      <Pressable testID="logbook-gps-toggle" accessibilityRole="button" accessibilityLabel={open ? 'GPS-Übersicht zuklappen' : 'GPS-Übersicht aufklappen'} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.header}>
        <View style={styles.grow}>
          <Text style={styles.title}>{sessions.length} Aufzeichnungen · {pending.length} mit Handlungsbedarf</Text>
          <Text style={styles.meta}>{props.from} – {props.to} · {open ? 'Übersicht schließen' : 'Prüfen und bearbeiten'}</Text>
        </View>
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open ? <View style={styles.stack} testID="logbook-gps-content">
        <View style={styles.actions}>
          <PremiumButton title={`Handlungsbedarf (${pending.length})`} size="sm" variant={showAll ? 'secondary' : 'primary'} onPress={() => setShowAll(false)} />
          <PremiumButton title={`Alle Aufzeichnungen (${sessions.length})`} size="sm" variant={showAll ? 'primary' : 'secondary'} onPress={() => setShowAll(true)} />
          <PremiumButton title="GPS erneut prüfen" size="sm" variant="secondary" disabled={props.busy} loading={props.busy} onPress={props.onRecheck} />
        </View>
        {props.message ? <InfoBanner message={props.message} variant="info" /> : null}
        {!filtered.length ? <Text style={styles.meta}>{showAll ? 'Keine GPS-Aufzeichnungen in diesem Zeitraum.' : 'Keine offenen Fahrtprüfungen. Aufzeichnungen ohne erkannte Fahrt finden Sie unter „Alle Aufzeichnungen“.'}</Text> : null}
        {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((candidate) => {
          const isExpanded = expanded === candidate.sessionId;
          const activeLegs = candidate.legs.filter((leg) => !leg.deleted);
          const legacy = candidate.legacyTrip;
          const deletedOnly = candidate.legs.length > 0 && activeLegs.length === 0 || legacy?.status === 'cancelled' && !activeLegs.length;
          return <View key={candidate.sessionId} style={styles.session} testID="logbook-gps-session">
            <Pressable accessibilityRole="button" accessibilityLabel={`${date(candidate.startedAt)} · ${candidate.title}`} accessibilityState={{ expanded: isExpanded }} onPress={() => setExpanded(isExpanded ? null : candidate.sessionId)} style={styles.header}>
              <View style={styles.grow}>
                <Text style={styles.title}>{date(candidate.startedAt)} · {candidate.title}</Text>
                <Text style={styles.meta}>{time(candidate.startedAt)} – {candidate.endedAt ? time(candidate.endedAt) : 'läuft'} · {candidate.pointCount} GPS-Punkte</Text>
              </View>
              <PremiumBadge label={deletedOnly ? 'ENTFERNT' : candidate.active ? 'LIVE' : candidate.needsAction ? 'PRÜFEN' : activeLegs.length ? 'BEARBEITET' : 'KEINE FAHRT'} variant={candidate.needsAction ? 'orange' : 'muted'} />
              <Text style={styles.chevron}>{isExpanded ? '−' : '+'}</Text>
            </Pressable>
            {isExpanded ? <View style={styles.details}>
              {legacy && legacy.status !== 'cancelled' ? <View style={styles.leg}><Text style={styles.title}>Frühere GPS-Gesamtfahrt · {legacy.purpose}</Text>{tripActions(legacy)}</View> : null}
              {deletedOnly ? <Text style={styles.meta}>Die zugehörige Fahrt wurde entfernt und wird nicht erneut übernommen.</Text> : null}
              {!candidate.legs.length && !deletedOnly ? <Text style={styles.meta}>Keine belastbare PKW-Fahrt erkannt. Falls tatsächlich eine Fahrt stattgefunden hat, können Sie diese mit den richtigen Zeiten und Kilometern nachtragen.</Text> : null}
              {activeLegs.map((leg) => <View key={leg.id} style={styles.leg}>
                <Text style={styles.title}>{TRAVEL_ROUTE_TYPE_LABELS[leg.routeType]} · {leg.purpose}</Text>
                <Text style={styles.meta}>{time(leg.startedAt)} – {time(leg.endedAt)} · {leg.unresolvedGapCount ? 'Kilometer noch ungeklärt' : `${leg.finalDistanceKm.toFixed(2).replace('.', ',')} km`}</Text>
                {leg.trip ? tripActions(leg.trip) : leg.imported ? <Text style={styles.meta}>Bereits übernommen. Den aktuellen Fahrtstatus bei Bedarf erneut laden.</Text> : canImportRecoveryLeg(candidate, leg) ? <PremiumButton title="Fahrt übernehmen" size="sm" disabled={disabled || !props.hasVehicle} onPress={() => props.onImport(candidate.sessionId, leg.id)} /> : <Text style={styles.meta}>{candidate.active ? 'Die Aufzeichnung läuft noch.' : !candidate.carSelectionProven ? 'Für diesen Einsatz ist keine PKW-Auswahl bestätigt.' : 'Die GPS-Daten reichen für eine automatische Übernahme nicht aus.'}</Text>}
              </View>)}
              {!props.hasVehicle && !deletedOnly ? <Text style={styles.meta}>Zum Erfassen oder Übernehmen zuerst unten ein aktives Fahrzeug hinterlegen.</Text> : null}
              {!candidate.active && !deletedOnly && !activeLegs.some((leg) => leg.trip && leg.trip.status !== 'cancelled') && !legacy ? <PremiumButton title="Fehlende Fahrt nachtragen" size="sm" variant="secondary" disabled={disabled || !props.hasVehicle} onPress={() => props.onManual(candidate)} /> : null}
            </View> : null}
          </View>;
        })}
        {pages > 1 ? <View style={styles.actions}>
          <PremiumButton title="Zurück" size="sm" variant="secondary" disabled={currentPage === 0} onPress={() => { setPage(currentPage - 1); setExpanded(null); }} />
          <Text style={styles.meta}>Seite {currentPage + 1} von {pages}</Text>
          <PremiumButton title="Weiter" size="sm" variant="secondary" disabled={currentPage === pages - 1} onPress={() => { setPage(currentPage + 1); setExpanded(null); }} />
        </View> : null}
      </View> : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 12 },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 },
  title: { ...typography.bodyStrong, color: '#0B2342' },
  meta: { ...typography.caption, color: '#31597F', flexShrink: 1 },
  chevron: { ...typography.h3, color: '#0878C7' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  session: { borderWidth: 1, borderColor: '#B7D8F7', borderRadius: 14, backgroundColor: '#F6FBFF', overflow: 'hidden' },
  details: { gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: '#D8E8F5' },
  leg: { gap: 8, padding: 10, borderRadius: 10, backgroundColor: '#FFFFFF' },
});
