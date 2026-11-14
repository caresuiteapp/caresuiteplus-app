import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import type { RoleKey, ServiceResult } from '@/types';
import { countVisitProofsPendingReview } from '@/lib/assist/assistVisitProofPersistenceService';
import { buildOfficeCalendarConfig } from '@/lib/calendar/calendarEventService';
import { getWorkspaceCalendarEvents } from '@/lib/calendar/calendarWorkspaceService';
import { startOfDay, addDays } from '@/lib/office/calendarDateUtils';
import { getEmployeeAssignedVisitsProjection } from '@/lib/portal/employeePortalProjectionService';

const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const officeCalendar = buildOfficeCalendarConfig();
const excludedStatuses = new Set(['abgesagt', 'storniert', 'cancelled', 'canceled', 'archiviert', 'abgeschlossen', 'completed', 'done', 'signed']);

type TodayItem = { label: string; text: string; route?: string };
type TodayAccess = {
  tenantId: string;
  roleKey: RoleKey | null;
  canReview: boolean;
  canReadCalendar: boolean;
  calendarRoute?: string;
  employeeId?: string;
  canOpenAssignments: boolean;
};

async function loadDesktopToday(access: TodayAccess, dayStart: string, dayEnd: string) {
  const { tenantId, roleKey, canReview, canReadCalendar, employeeId } = access;
  const [proofs, calendar, visits] = await Promise.allSettled([
    canReview ? countVisitProofsPendingReview(tenantId, roleKey) : null,
    canReadCalendar ? getWorkspaceCalendarEvents({ tenantId, actorRoleKey: roleKey, rangeStart: dayStart, rangeEnd: dayEnd, config: officeCalendar }) : null,
    employeeId ? getEmployeeAssignedVisitsProjection(tenantId, employeeId, roleKey) : null,
  ]);
  return {
    proofs: proofs.status === 'fulfilled' ? proofs.value : null,
    calendar: calendar.status === 'fulfilled' ? calendar.value : null,
    visits: visits.status === 'fulfilled' ? visits.value : null,
  };
}

type DayData = Awaited<ReturnType<typeof loadDesktopToday>>;

function todayItems(access: TodayAccess, data: DayData, now: Date, end: string): TodayItem[] {
  const { canReview, canReadCalendar, calendarRoute, employeeId, canOpenAssignments } = access;
  const items: TodayItem[] = [];
  const nowTime = now.getTime();
  const endTime = Date.parse(end);

  if (canReview) {
    const result = data.proofs;
    items.push({ label: 'Leistungsnachweise', route: '/assist/nachweise/review', text: result?.ok
      ? result.data === 0 ? 'Keine Nachweise zur Prüfung' : `${result.data} ${result.data === 1 ? 'Nachweis' : 'Nachweise'} zur Prüfung`
      : 'Nachweise konnten nicht geladen werden' });
  }

  if (canReadCalendar) {
    const result = data.calendar;
    const event = result?.ok ? result.data
      .filter(event => (event.type === 'team_meeting' || event.type === 'termin') && !event.allDay && !excludedStatuses.has(event.status ?? ''))
      .filter(event => Date.parse(event.start) >= nowTime && Date.parse(event.start) < endTime)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] : undefined;
    const text = event ? `${event.type === 'team_meeting' ? 'Teamtermin' : 'Nächster Termin'} um ${time.format(new Date(event.start))} Uhr`
      : result?.ok && !result.refreshError ? 'Heute kein weiterer Termin' : 'Termine konnten nicht vollständig geladen werden';
    items.push({ label: 'Kalender', text, route: calendarRoute });
  }

  if (employeeId) {
    const result = data.visits;
    const visit = result?.ok ? result.data.flatMap(visit => {
      const start = Date.parse(visit.scheduledStart ?? '');
      return start >= nowTime && start < endTime && !excludedStatuses.has(visit.status) ? [{ visit, start }] : [];
    }).sort((a, b) => a.start - b.start)[0] : undefined;
    const text = visit ? `Nächster Einsatz um ${time.format(new Date(visit.start))} Uhr`
      : result?.ok ? 'Heute kein weiterer Einsatz' : 'Einsätze konnten nicht geladen werden';
    const route = !canOpenAssignments ? undefined : visit ? `/assist/assignments/${encodeURIComponent(visit.visit.assignmentId)}` : '/assist/assignments';
    items.unshift({ label: 'Meine Einsätze', text, route });
  }
  return items;
}

export function DesktopToday({ now, owner, onOpenRoute, fontScale = 1, ...access }: TodayAccess & {
  now: Date;
  owner: string;
  onOpenRoute: (route: string) => void;
  fontScale?: number;
}) {
  const [visible, setVisible] = useState(false);
  const day = startOfDay(now);
  const start = day.toISOString();
  const end = addDays(day, 1).toISOString();
  const { tenantId, roleKey, canReview, canReadCalendar, calendarRoute, employeeId, canOpenAssignments } = access;
  const identity = JSON.stringify(['desktop-today', tenantId, owner, roleKey, canReview, canReadCalendar, calendarRoute, employeeId, canOpenAssignments, start]);
  const query = useAsyncQuery(async (): Promise<ServiceResult<DayData>> => ({ ok: true, data: await loadDesktopToday(access, start, end) }),
    [identity], { queryKey: identity, retryCount: 0 });
  useLiveRefresh({ enabled: true, onRefresh: query.silentRefresh, pollMs: 5 * 60_000, refreshOnFocus: false });
  const items = query.data ? todayItems(access, query.data, now, end) : [];
  const summary = query.error ? 'Übersicht nicht verfügbar' : items[0]?.text;
  const bodySize = { fontSize: 14 * fontScale, lineHeight: 19 * fontScale };

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Tagesübersicht öffnen" accessibilityHint={summary}
      accessibilityState={{ expanded: visible }} onPress={() => { setVisible(true); void query.silentRefresh(); }} style={styles.trigger}>
      <Text style={[styles.title, styles.triggerTitle, bodySize]}>Heute</Text>
      {summary ? <Text numberOfLines={2} style={[styles.summary, { fontSize: 12 * fontScale, lineHeight: 16 * fontScale }]}>{summary}</Text> : null}
    </Pressable>
    {visible ? <PlatformModal visible title="Heute" onClose={() => setVisible(false)} maxWidth={430}>
      <View style={styles.panel}>
        {query.loading && !query.data ? <Text accessibilityLiveRegion="polite" style={[styles.copy, bodySize]}>Tagesübersicht wird geladen.</Text> : null}
        {query.error ? <Text accessibilityRole="alert" style={[styles.copy, bodySize]}>Die Tagesübersicht konnte nicht geladen werden.</Text> : null}
        {items.map(({ label, text, route }) => <View key={label} style={styles.item}>
          <Text style={[styles.title, bodySize]}>{label}</Text>
          <Text style={[styles.copy, bodySize]}>{text}</Text>
          {route ? <Pressable accessibilityRole="button" style={styles.link}
            onPress={() => { setVisible(false); onOpenRoute(route); }}>
            <Text style={[styles.linkText, bodySize]}>{label} öffnen</Text>
          </Pressable> : null}
        </View>)}
      </View>
    </PlatformModal> : null}
  </>;
}

const styles = StyleSheet.create({
  trigger: { minHeight: 44, minWidth: 0, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 3 },
  panel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#102540' },
  title: { color: '#F4F8FF', fontFamily: careSuiteAppFontFamily, fontWeight: '700' },
  triggerTitle: { textDecorationLine: 'underline' },
  summary: { color: '#BCD4EC', fontFamily: careSuiteAppFontFamily, marginTop: 2 },
  copy: { color: '#CFE2F3', fontFamily: careSuiteAppFontFamily },
  item: { paddingVertical: 8, gap: 3 },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { color: '#8FE4FF', fontFamily: careSuiteAppFontFamily, fontWeight: '700', textDecorationLine: 'underline' },
});
