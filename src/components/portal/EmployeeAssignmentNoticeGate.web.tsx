import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { subscribeToTenantTables } from '@/lib/realtime/subscribeToTenantTables';
import { CarePopupShell } from '@/components/layout/platform/CarePopupShell';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { isEmployeeVisitExecutionRoute } from '@/lib/portal/portalResponsiveLayout';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import {
  acknowledgeEmployeeAssignmentNotices, fetchEmployeeAssignmentNotices,
  resolveEmployeeAssignmentNoticeRoute, type EmployeeAssignmentNotice,
} from '@/lib/portal/employeeAssignmentNoticeService.web';

const NOTICE_ACTION_TIMEOUT_MS = 15_000;

/** Unread changes survive logout; "Später" only postpones this session's popup. */
export function EmployeeAssignmentNoticeGate() {
  const actor = usePortalActor();
  const { user, portalSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { c } = useCareLightPalette();
  const enabled = Boolean(actor.isLinkedReady && !actor.employeeLinkReadOnly && actor.tenantId && actor.employeeId && user?.id);
  const scope = useMemo(() => ({ tenantId: actor.tenantId ?? '', employeeId: actor.employeeId ?? '', authUserId: user?.id ?? '' }),
    [actor.tenantId, actor.employeeId, user?.id]);
  const lifecycle = useMemo(() => ({ active: true }), [scope, portalSession?.accountId, portalSession?.sessionToken, enabled]);
  const currentLifecycle = useRef(lifecycle);
  currentLifecycle.current = lifecycle;
  useEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  const [deferred, setDeferred] = useState<{ lifecycle: object; ids: Set<string> }>(() => ({ lifecycle, ids: new Set() }));
  const [manualOpen, setManualOpen] = useState<object | null>(null);
  const [operation, setOperation] = useState<{ lifecycle: object; kind: string } | null>(null);
  const [actionError, setActionError] = useState<{ lifecycle: object; message: string } | null>(null);
  const subscribe = useCallback((_tenantId: string, refresh: () => void) => subscribeToTenantTables({
    subscriptionKey: `employee-assignment-notices:${scope.tenantId}:${scope.employeeId}:${scope.authUserId}`,
    channelName: `portal:assignment-notices:${scope.employeeId}`,
    specs: [{ table: 'office_notifications', filter: `recipient_employee_id=eq.${scope.employeeId}` }],
  }, refresh), [scope]);
  const query = useAsyncQuery(() => fetchEmployeeAssignmentNotices(scope), [scope, lifecycle], {
    enabled, queryKey: JSON.stringify(['employee-assignment-notices', scope]),
    live: { tenantId: scope.tenantId, subscribe, pollMs: 30_000, refreshOnFocus: true },
  });
  const notices = enabled ? query.data?.notices ?? [] : [];
  const busy = operation?.lifecycle === lifecycle;
  const error = actionError?.lifecycle === lifecycle ? actionError.message : query.error ?? query.refreshError;
  const dismissedIds = deferred.lifecycle === lifecycle ? deferred.ids : new Set<string>();
  const newNotices = notices.filter(item => !dismissedIds.has(item.id));
  const visible = enabled && notices.length > 0 && !isEmployeeVisitExecutionRoute(pathname)
    && (manualOpen === lifecycle || newNotices.length > 0);
  // Once reopened manually, include all unread items, not just newly arrived ones.
  const shown = manualOpen === lifecycle ? notices : newNotices;
  const isCurrent = () => lifecycle.active && currentLifecycle.current === lifecycle;

  const dismiss = () => {
    if (busy) return;
    setDeferred({ lifecycle, ids: new Set([...dismissedIds, ...shown.map(item => item.id)]) });
    setManualOpen(null);
    setActionError(null);
  };
  const acknowledge = async () => {
    if (busy || !shown.length) return;
    const ids = shown.map(item => item.id);
    setOperation({ lifecycle, kind: 'read' });
    setActionError(null);
    try {
      const result = await withServiceQueryTimeout(
        acknowledgeEmployeeAssignmentNotices(scope, ids), 'Lesebestätigung', NOTICE_ACTION_TIMEOUT_MS,
      );
      if (!isCurrent()) return;
      if (!result.ok) { setActionError({ lifecycle, message: result.error }); return; }
      // Only remove rows after the server returned those exact read receipts.
      query.setData(previous => previous ? { notices: previous.notices.filter(item => !ids.includes(item.id)),
        total: Math.max(0, previous.total - ids.length) } : previous);
      setManualOpen(null);
      void query.refresh();
    } catch {
      if (isCurrent()) setActionError({ lifecycle, message: 'Die Lesebestätigung konnte nicht rechtzeitig bestätigt werden. Bitte erneut versuchen oder die Information später lesen.' });
    } finally { if (isCurrent()) setOperation(null); }
  };
  const openVisit = async (notice: EmployeeAssignmentNotice) => {
    if (busy) return;
    setOperation({ lifecycle, kind: notice.id });
    setActionError(null);
    try {
      const result = await withServiceQueryTimeout(
        resolveEmployeeAssignmentNoticeRoute(scope, notice), 'Einsatzprüfung', NOTICE_ACTION_TIMEOUT_MS,
      );
      if (!isCurrent()) return;
      if (!result.ok) { setActionError({ lifecycle, message: result.error }); return; }
      // Opening does not acknowledge either the notice or the assignment.
      setDeferred({ lifecycle, ids: new Set([...dismissedIds, notice.id]) });
      setManualOpen(null);
      router.push(result.data as never);
    } catch {
      if (isCurrent()) setActionError({ lifecycle, message: 'Der Einsatz konnte nicht rechtzeitig geprüft werden. Bitte erneut versuchen oder den Kalender später öffnen.' });
    } finally { if (isCurrent()) setOperation(null); }
  };

  if (!enabled || (!notices.length && !error)) return null;
  return <>
    {!visible ? <Pressable accessibilityRole="button" onPress={() => {
      setManualOpen(lifecycle); void query.refresh();
    }} style={[styles.banner, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Text style={[styles.bannerText, { color: c.text }]}>{notices.length
        ? `${query.data?.total ?? notices.length} ungelesene Einsatzinfo${(query.data?.total ?? notices.length) === 1 ? '' : 's'} · Anzeigen`
        : 'Einsatzinfos konnten nicht geladen werden · Erneut versuchen'}</Text>
    </Pressable> : null}
    <CarePopupShell visible={visible} title="Neuigkeiten zu Ihren Einsätzen"
      subtitle="Neue Einsätze und Änderungen im Überblick" maxWidth={620} minWidth={0} maxHeightRatio={0.84}
      onClose={dismiss} dismissOnBackdrop={false} footerActions={[
        { title: 'Später', onPress: dismiss, disabled: busy, variant: 'secondary' },
        { title: busy && operation?.kind === 'read' ? 'Wird gespeichert…' : 'Angezeigte Infos gelesen',
          onPress: () => void acknowledge(), disabled: busy, loading: busy && operation?.kind === 'read', variant: 'primary' },
      ]}>
      <View style={styles.body}>
        <Text style={[styles.explanation, { color: c.muted }]}>Hier bestätigen Sie nur, dass Sie die Information gelesen haben. Einen Einsatz nehmen Sie weiterhin im Einsatz selbst an.</Text>
        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
        {shown.map(item => <View key={item.id} style={[styles.card, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Text style={[styles.title, { color: c.text }]}>{item.title}</Text>
          {item.body ? <Text style={[styles.description, { color: c.text }]}>{item.body}</Text> : null}
          {(item.visitId && ['created', 'changed'].includes(item.changeKind)) || item.changeKind === 'current_plan' ? <Pressable
            accessibilityRole="button" disabled={busy} onPress={() => void openVisit(item)}
            style={[styles.openButton, { borderColor: c.border, opacity: busy ? 0.6 : 1 }]}>
            <Text style={[styles.openText, { color: c.violet }]}>{operation?.kind === item.id ? 'Wird geprüft…'
              : item.changeKind === 'current_plan' ? 'Aktuellen Kalender öffnen' : 'Aktuellen Einsatz öffnen'}</Text>
          </Pressable> : null}
        </View>)}
        {(query.data?.total ?? 0) > notices.length ? <Text style={[styles.explanation, { color: c.muted }]}>Weitere Einsatzinfos folgen, sobald Sie diese gelesen haben.</Text> : null}
      </View>
    </CarePopupShell>
  </>;
}

const styles = StyleSheet.create({
  body: { gap: 12, minWidth: 0 },
  explanation: { fontSize: 14, lineHeight: 21 },
  error: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  card: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 8, minWidth: 0 },
  title: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 23 },
  openButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 4 },
  openText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  banner: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderRadius: 12, margin: 8 },
  bannerText: { fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
});
