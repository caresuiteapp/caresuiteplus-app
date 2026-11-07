import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { isCalendarDate } from '@/lib/pflege/ambulatoryOperationsDomain';
import { loadEmployeePortalCareTours } from '@/lib/portal/employee/employeePortalCareTours';
import { employeePortalWorkspace as c } from '@/components/portal/employee/employeePortalDesign';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

const tourStatus: Record<string, string> = {
  published: 'Freigegeben', in_progress: 'In Arbeit', completed: 'Abgeschlossen', cancelled: 'Abgesagt',
};
const stopStatus: Record<string, string> = { ...tourStatus, planned: 'Geplant', arrived: 'Angekommen' };

export function EmployeePortalCareToursScreen() {
  const actor = usePortalActor();
  const [day, setDay] = useState(berlinCalendarDate);
  const [input, setInput] = useState(day);
  const tours = useAsyncQuery(() => loadEmployeePortalCareTours(day), [day], {
    enabled: actor.isLinkedReady && !actor.employeeLinkReadOnly,
    queryKey: JSON.stringify([actor.tenantId, actor.actorId, actor.employeeId, day]),
  });
  const error = tours.error ?? tours.refreshError;
  return (
    <PortalTabScreen title="Meine Pflegetouren" subtitle="Freigegebene Touren und Einsatzorte nach Datum">
      <View style={styles.root}>
        <View style={styles.controls}>
          <TextInput accessibilityLabel="Tourdatum (JJJJ-MM-TT)" value={input} onChangeText={setInput}
            autoCorrect={false} autoCapitalize="none" maxLength={10} placeholder="JJJJ-MM-TT" placeholderTextColor={c.secondary} style={styles.input} />
          <Pressable accessibilityRole="button" disabled={!isCalendarDate(input)} accessibilityState={{ disabled: !isCalendarDate(input) }}
            style={[styles.button, !isCalendarDate(input) && styles.disabled]}
            onPress={() => input === day ? void tours.refresh() : setDay(input)}>
            <Text style={styles.buttonText}>Tag anzeigen</Text>
          </Pressable>
        </View>
        {tours.loading ? <Text accessibilityLiveRegion="polite" style={styles.body}>Pflegetouren werden geladen…</Text> : null}
        {error ? <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void tours.refresh()}>
            <Text style={styles.buttonText}>Erneut laden</Text>
          </Pressable></View> : null}
        {!tours.loading && !error && !tours.data?.length ? <Text style={styles.body}>Für diesen Tag ist keine Pflegetour für Sie freigegeben.</Text> : null}
        {tours.data?.map(tour => (
          <View key={tour.id} style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>{tour.name}</Text>
            <Text style={styles.body}>{tourStatus[tour.status] ?? tour.status}{tour.vehicle ? ` · ${tour.vehicle}` : ''}</Text>
            {tour.stops.map(stop => (
              <View key={stop.id} style={styles.stop}>
                <Text style={styles.cardTitle}>{stop.start.slice(0, 5)}–{stop.end.slice(0, 5)} · {stop.client}</Text>
                {stop.address ? <Text style={styles.body}>{stop.address}</Text> : null}
                <Text style={styles.body}>{stop.service ? `${stop.service} · ` : ''}{stopStatus[stop.status] ?? stop.status}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  root: { width: '100%', minWidth: 0, gap: 12 },
  cardTitle: { color: c.text, fontSize: font(16), lineHeight: font(23), fontWeight: '700' },
  body: { color: c.secondary, fontSize: font(14), lineHeight: font(22) },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: { width: 150, maxWidth: '100%', minHeight: 44, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, color: c.text, fontSize: font(14) },
  button: { minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.accentSoft, justifyContent: 'center' },
  buttonText: { color: c.accent, fontSize: font(14), lineHeight: font(21) },
  disabled: { opacity: 0.5 },
  card: { gap: 8, padding: 16, backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: c.radius },
  stop: { gap: 5, paddingVertical: 10, borderTopWidth: 1, borderColor: c.line },
  error: { color: c.danger, fontSize: font(14), lineHeight: font(21) },
}));
