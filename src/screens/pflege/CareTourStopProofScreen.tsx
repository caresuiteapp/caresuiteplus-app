import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchCareTours } from '@/lib/pflege/careTourPlanningService';
import { fetchCareOperations, createCatalogCareProof } from '@/lib/pflege/ambulatoryOperationsService';
import { fetchCareMedicalOrders } from '@/lib/pflege/careClinicalCoreService';
import { validTariffs, calculateTariffAmount, basisLabels } from '@/lib/pflege/ambulatoryOperationsDomain';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { formatDate, formatTime } from '@/lib/formatters/dateTimeFormatters';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
export function CareTourStopProofScreen({ stopId }: { stopId: string }) {
  const tenantId = useServiceTenantId(); const { profile } = useAuth(); const router = useRouter(); const { c } = useCareLightPalette();
  const query = useAsyncQuery(async () => {
    if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
    const [tours, operations, orders] = await Promise.all([fetchCareTours(tenantId, profile?.roleKey), fetchCareOperations(tenantId, profile?.roleKey), fetchCareMedicalOrders(tenantId, profile?.roleKey)]);
    if (!tours.ok) return tours; if (!operations.ok) return operations;
    return { ok: true as const, data: { tours: tours.data, operations: operations.data, orders: orders.ok ? orders.data : [], ordersError: orders.ok ? '' : orders.error } };
  }, [tenantId, profile?.roleKey, stopId], { enabled: !!tenantId, queryKey: `${tenantId}:${profile?.id}:${stopId}:catalog-proof` });
  const stop = query.data?.tours.flatMap((tour) => tour.stops).find((s) => s.id === stopId);
  const day = stop?.actualStartedAt ? berlinCalendarDate(new Date(stop.actualStartedAt)) : '';
  const admission = query.data?.operations.admissions.filter((a) => a.clientId === stop?.clientId && ['active', 'closed'].includes(a.status) && a.startsOn <= day && (!a.endsOn || a.endsOn >= day)).sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
  const tariffs = admission ? validTariffs(query.data?.operations.tariffs ?? [], day, admission.basis, admission.payerIk) : [];
  const [tariffId, setTariffId] = useState(''); const [quantity, setQuantity] = useState('1'); const [orderId, setOrderId] = useState('');
  const tariff = tariffs.find((v) => v.id === tariffId); const amount = tariff ? calculateTariffAmount(tariff, quantity) : null;
  const orders = query.data?.orders.filter((v) => v.clientId === stop?.clientId && ['active', 'completed'].includes(v.status) && v.validFrom <= day && (!v.validUntil || v.validUntil >= day) && (!v.insurerApprovalRequired || v.insurerApprovalStatus === 'approved')) ?? [];
  const [search, setSearch] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  async function save() {
    if (!tenantId || !stop || !tariff || !amount || lock.current || (admission?.basis === 'sgb_v' && !orderId)) return;
    lock.current = true; setBusy(true); setError('');
    try { const result = await createCatalogCareProof(tenantId, profile?.roleKey, stop.id, tariff.id, Number(quantity.replace(',', '.')), orderId); if (!result.ok) { setError(result.error); return; } router.replace(`/pflege/leistungsnachweis-workflow?id=${result.data.id}` as never); }
    catch { setError('Verbindung unterbrochen. Bitte erneut laden und den Nachweis prüfen.'); } finally { lock.current = false; setBusy(false); }
  }
  if (query.loading) return <ScreenShell title="Leistungsnachweis"><LoadingState message="Versorgung und gültige Vergütung werden geladen…" /></ScreenShell>;
  if (!stop || stop.status !== 'completed') return <ScreenShell title="Leistungsnachweis"><ErrorState message={query.error ?? 'Kein abgeschlossener Einsatz gefunden.'} onRetry={query.refresh} /></ScreenShell>;
  return <ScreenShell title="Leistungsnachweis aus Einsatz" subtitle={stop.clientName}><View style={styles.stack}>
    <SectionPanel title="Dokumentierte Versorgung"><Text style={{ color: c.text }}>{stop.serviceSummary}</Text><Text style={{ color: c.text }}>{formatDate(stop.actualStartedAt)} · {formatTime(stop.actualStartedAt)}–{formatTime(stop.actualEndedAt)}</Text><Text style={{ color: c.text }}>{stop.notes}</Text></SectionPanel>
    {stop.serviceProofId ? <PremiumButton title="Vorhandenen Leistungsnachweis öffnen" onPress={() => router.replace(`/pflege/leistungsnachweis-workflow?id=${stop.serviceProofId}` as never)} /> : !admission ? <><ErrorState message="Freigegebene Aufnahme für den Leistungstag fehlt." /><PremiumButton title="Aufnahme öffnen" onPress={() => router.push('/pflege/aufnahme' as never)} /></> : <>
      <SectionPanel title="Leistung & Vergütung" subtitle={`${basisLabels[admission.basis]} · ${admission.payerName || 'Privat'}${admission.payerIk ? ` · IK ${admission.payerIk}` : ''}`}>
        <PremiumInput label="Leistung im Katalog suchen" value={search} onChangeText={setSearch} editable={!busy} />
        <View style={styles.options}>{tariffs.filter((v) => `${v.code} ${v.label}`.toLowerCase().includes(search.toLowerCase())).map((v) => <PremiumButton key={v.id} title={`${v.code} · ${v.label} · ${(v.unitPriceCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`} variant={tariffId === v.id ? 'primary' : 'secondary'} disabled={busy} onPress={() => setTariffId(v.id)} />)}</View>
        {!tariffs.length ? <><Text style={{ color: c.muted }}>Kein gültiger Tarif für Leistungstag und Kostenträger hinterlegt.</Text><PremiumButton title="Leistungskatalog öffnen" variant="secondary" onPress={() => router.push('/pflege/leistungskatalog' as never)} /></> : null}
        <PremiumInput label={`Menge${tariff ? ` (${{ visit: 'Besuche', minute: 'Minuten', hour: 'Stunden', unit: 'Einheiten' }[tariff.unit]})` : ''}`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" editable={!busy} />
        <Text style={{ color: c.text }}>Gesamtbetrag: {amount ? (amount / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : 'Leistung und gültige Menge auswählen'}</Text>
        {admission.basis === 'sgb_v' ? <><Text style={{ color: c.text }}>Gültige Verordnung auswählen</Text>{query.data?.ordersError ? <ErrorState message={query.data.ordersError} /> : null}<View style={styles.options}>{orders.map((v) => <PremiumButton key={v.id} title={`${v.title} · ${v.orderingPhysician}`} variant={orderId === v.id ? 'primary' : 'secondary'} disabled={busy} onPress={() => setOrderId(v.id)} />)}</View>{!orders.length ? <PremiumButton title="Verordnungen und Genehmigungen prüfen" onPress={() => router.push('/pflege/verordnungen' as never)} /> : null}</> : null}
        <Text style={{ color: c.muted }}>Klient:in, tatsächliche Zeiten, Dokumentation, Kostenträger und Tarif werden serverseitig geprüft und übernommen.</Text>
      </SectionPanel>
      {error ? <ErrorState message={error} /> : null}<PremiumButton title="Leistungsnachweis erstellen" loading={busy} disabled={busy || !amount || (admission.basis === 'sgb_v' && !orderId)} onPress={() => void save()} />
    </>}
  </View></ScreenShell>;
}
const styles = StyleSheet.create({ stack: { gap: 16, paddingBottom: 32 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
