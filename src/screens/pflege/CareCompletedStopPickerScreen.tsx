import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchCareTours } from '@/lib/pflege/careTourPlanningService';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
export function CareCompletedStopPickerScreen() {
  const tenant = useServiceTenantId(); const { profile } = useAuth(); const router = useRouter(); const { c } = useCareLightPalette(); const [search, setSearch] = useState('');
  const query = useAsyncQuery(() => tenant ? fetchCareTours(tenant, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenant, profile?.roleKey], { enabled: !!tenant });
  const stops = (query.data ?? []).flatMap((tour) => tour.stops.filter((s) => s.status === 'completed' && !s.serviceProofId).map((stop) => ({ tour, stop }))).filter(({ stop }) => `${stop.clientName} ${stop.serviceSummary}`.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')));
  if (query.loading && !query.data) return <ScreenShell title="Leistungsnachweis erstellen"><LoadingState message="Dokumentierte Einsätze werden geladen…" /></ScreenShell>;
  if (query.error && !query.data) return <ScreenShell title="Leistungsnachweis erstellen"><ErrorState message={query.error} onRetry={query.refresh} /></ScreenShell>;
  return <ScreenShell title="Leistungsnachweis erstellen" subtitle="Abgeschlossenen, dokumentierten Einsatz auswählen"><View style={{ gap: 16, paddingBottom: 24 }}><PremiumInput label="Klient:in oder Leistung suchen" value={search} onChangeText={setSearch} />
    {stops.map(({ tour, stop }) => <SectionPanel key={stop.id} title={stop.clientName} subtitle={`${tour.tourDate} · ${tour.name}`}><Text style={{ color: c.text }}>{stop.serviceSummary}</Text><PremiumButton title="Nachweis mit gültigem Tarif erstellen" onPress={() => router.push(`/pflege/leistungsnachweis-new?tourStopId=${stop.id}` as never)} /></SectionPanel>)}
    {!stops.length ? <EmptyState title="Keine offenen Nachweise aus Einsätzen" message="Erst einen Pflegeeinsatz durchführen und dokumentieren. Bereits erstellte Nachweise stehen in der Nachweisliste." /> : null}<PremiumButton title="Tourenplanung öffnen" variant="secondary" onPress={() => router.push('/pflege/tourenplanung' as never)} /><PremiumButton title="Nachweisliste öffnen" variant="secondary" onPress={() => router.push('/pflege/leistungsnachweise' as never)} />
  </View></ScreenShell>;
}
