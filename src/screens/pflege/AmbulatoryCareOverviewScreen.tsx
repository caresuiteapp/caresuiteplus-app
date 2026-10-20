import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/permissions';
import { fetchEligibleCareClients, fetchCareAssessments } from '@/lib/careAssessment';
import { fetchCareOperations } from '@/lib/pflege/ambulatoryOperationsService';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { fetchCareMedicalOrders } from '@/lib/pflege/careClinicalCoreService';
import { fetchPflegeServiceProofs, fetchPflegeBillingCases } from '@/lib/pflege/careBillingLiveService';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { admissionLabels } from '@/lib/pflege/ambulatoryOperationsDomain';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
export function AmbulatoryCareOverviewScreen() {
  const tenant = useServiceTenantId(); const { profile } = useAuth(); const router = useRouter(); const { c } = useCareLightPalette();
  const [search, setSearch] = useState('');
  const query = useAsyncQuery(async () => {
    if (!tenant) return { ok: false as const, error: 'Kein Mandant.' };
    const [clients, operations, plans, assessments, orders, proofs, billing] = await Promise.all([
      fetchEligibleCareClients(tenant, profile?.roleKey), fetchCareOperations(tenant, profile?.roleKey), fetchCarePlanList(tenant, profile?.roleKey), fetchCareAssessments(tenant, 'client', profile?.roleKey), fetchCareMedicalOrders(tenant, profile?.roleKey), fetchPflegeServiceProofs(tenant, profile?.roleKey), fetchPflegeBillingCases(tenant, profile?.roleKey),
    ]);
    if (!clients.ok) return clients;
    return { ok: true as const, data: { clients: clients.data, operations, plans, assessments, orders, proofs, billing } };
  }, [tenant, profile?.roleKey], { enabled: !!tenant, queryKey: `${tenant}:${profile?.id}:care-overview` });
  const data = query.data;
  const rows = useMemo(() => (data?.clients ?? []).filter((v) => `${v.firstName} ${v.lastName}`.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE'))), [data?.clients, search]);
  if (query.loading && !data) return <ScreenShell title="Versorgungsübersicht"><LoadingState message="Pflegefälle und Prozessstände werden geladen…" /></ScreenShell>;
  if (!data) return <ScreenShell title="Versorgungsübersicht"><ErrorState message={query.error ?? 'Pflegefälle konnten nicht geladen werden.'} onRetry={query.refresh} /></ScreenShell>;
  const sources = [data.operations, data.plans, data.assessments, data.orders, data.proofs, data.billing];
  return <ScreenShell title="Versorgungsübersicht" subtitle="Von der Aufnahme bis zur Abrechnung · tatsächlicher Bearbeitungsstand"><View style={{ gap: 16, paddingBottom: 24 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><PremiumButton title="Aktualisieren" variant="secondary" onPress={() => void query.refresh()} /><PremiumButton title="Klient:in aufnehmen" onPress={() => router.push('/office/clients/create' as never)} /><PremiumButton title="Aufgaben & Wiedervorlagen" variant="secondary" onPress={() => router.push('/pflege/aufgaben' as never)} /></View>
    <PremiumInput label="Pflegefall suchen" value={search} onChangeText={setSearch} />
    {query.refreshError ? <ErrorState message={query.refreshError} onRetry={query.refresh} /> : null}
    {sources.filter((v) => !v.ok).map((v, i) => <ErrorState key={i} message={!v.ok ? v.error : ''} />)}
    {rows.map((client) => {
      const admission = data.operations.ok ? data.operations.data.admissions.find((v) => v.clientId === client.id && v.status !== 'closed') : undefined;
      const plans = data.plans.ok ? data.plans.data.filter((v) => v.clientId === client.id) : null;
      const assessments = data.assessments.ok ? data.assessments.data.filter((v) => v.subjectId === client.id) : null;
      const orders = data.orders.ok ? data.orders.data.filter((v) => v.clientId === client.id && ['active', 'paused'].includes(v.status)) : null;
      const proofs = data.proofs.ok ? data.proofs.data.filter((v) => v.clientId === client.id) : null;
      const billing = data.billing.ok ? data.billing.data.filter((v) => v.clientId === client.id) : null;
      const tasks = data.operations.ok ? data.operations.data.tasks.filter((v) => v.clientId === client.id && v.status === 'open') : null;
      const stages = [
        ['Aufnahme & Vertrag', data.operations.ok ? admission ? admissionLabels[admission.status] : 'Aufnahme noch nicht angelegt' : 'Nicht ermittelt', '/pflege/aufnahme', 'pflege.plans.view'],
        ['Pflegeverständnis & SIS', assessments ? `${assessments.length} Assessments` : 'Nicht ermittelt', '/pflege/sis', 'pflege.plans.view'],
        ['Pflegeplanung', plans ? `${plans.filter((v) => v.status === 'aktiv').length} aktive Pflegepläne` : 'Nicht ermittelt', '/pflege/plans', 'pflege.plans.view'],
        ['Verordnungen & Genehmigungen', orders ? `${orders.length} laufende Verordnungen · ${orders.filter((v) => v.insurerApprovalRequired && v.insurerApprovalStatus !== 'approved').length} Genehmigungen offen · ${orders.filter((v) => v.validUntil && v.validUntil < berlinCalendarDate()).length} abgelaufen` : 'Nicht ermittelt', '/pflege/verordnungen', 'pflege.orders.view'],
        ['Durchführung & Dokumentation', 'Touren, Pflegeberichte und klinische Verläufe öffnen', '/pflege/tourenplanung', 'pflege.plans.view'],
        ['Leistungsnachweise', proofs ? `${proofs.filter((v) => v.status !== 'approved' && v.status !== 'cancelled').length} Nachweise ohne vollständige Freigabe` : 'Nicht ermittelt', '/pflege/leistungsnachweise', 'pflege.proofs.view'],
        ['Abrechnung', billing ? `${billing.filter((v) => v.status === 'blocked').length} blockierte Fälle · ${billing.filter((v) => v.status === 'ready').length} freigabebereit` : 'Nicht ermittelt', '/pflege/abrechnung', 'pflege.billing.view'],
        ['Qualität & Evaluation', 'Risiken, Evaluationen und Maßnahmen prüfen', '/pflege/risiken', 'pflege.risks.view'],
        ['Wiedervorlagen', tasks ? `${tasks.length} offene Aufgaben · ${tasks.filter((v) => v.dueOn < berlinCalendarDate()).length} überfällig` : 'Nicht ermittelt', '/pflege/aufgaben', 'pflege.plans.view'],
      ];
      return <SectionPanel key={client.id} title={`${client.lastName}, ${client.firstName}`} subtitle="Prozessstand dieses Pflegefalls">
        {stages.map(([title, state, route, permission]) => <View key={route} style={{ paddingVertical: 8, gap: 6 }}><Text style={{ color: c.text, fontWeight: '600' }}>{title}</Text><Text style={{ color: c.muted }}>{state}</Text>{hasPermission(profile?.roleKey, permission as Parameters<typeof hasPermission>[1]) ? <PremiumButton title={`${title} öffnen`} variant="secondary" onPress={() => router.push((['/pflege/aufnahme', '/pflege/aufgaben'].includes(route) ? `${route}?clientId=${client.id}` : route) as never)} /> : null}</View>)}
        <PremiumButton title="Vollständige Klient:innenakte öffnen" onPress={() => router.push(`/office/clients/${client.id}` as never)} />
      </SectionPanel>;
    })}
    {!rows.length ? <Text style={{ color: c.muted }}>Keine passenden aktiven Pflegefälle. Neue Klient:innen in der Verwaltung anlegen und dem Pflegeprodukt zuordnen.</Text> : null}
  </View></ScreenShell>;
}
