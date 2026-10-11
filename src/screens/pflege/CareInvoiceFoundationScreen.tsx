import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/permissions';
import { fetchCareFoundationDetail, downloadCareFoundationCsv } from '@/lib/pflege/careInvoiceFoundationService';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
export function CareInvoiceFoundationScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>(); const tenant = useServiceTenantId(); const { profile } = useAuth(); const router = useRouter(); const { c } = useCareLightPalette();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const query = useAsyncQuery(() => tenant ? fetchCareFoundationDetail(tenant, profile?.roleKey, id) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenant, profile?.roleKey, id], { enabled: !!tenant });
  const money = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  if (query.loading && !query.data) return <ScreenShell title="Rechnungsgrundlage"><LoadingState message="Positionen und Summen werden geprüft…" /></ScreenShell>;
  const value = query.data; if (!value) return <ScreenShell title="Rechnungsgrundlage"><ErrorState message={query.error ?? 'Nicht gefunden.'} onRetry={query.refresh} /></ScreenShell>;
  return <ScreenShell title={value.number} subtitle="Rechnungsgrundlage · freigegebene Leistungspositionen"><View style={{ gap: 16, paddingBottom: 24 }}>
    <SectionPanel title={value.recipient} subtitle={`${value.from} bis ${value.to} · ${value.lines.length} Positionen`}><Text style={{ color: c.text }}>{value.recipientIk ? `IK ${value.recipientIk} · ` : ''}Gesamtsumme: {money(value.totalCents)}</Text><Text style={{ color: c.muted }}>Diese Grundlage ist keine versandte Rechnung und kein validierter DTA-Datensatz. Der Export dient der kontrollierten Weiterverarbeitung.</Text></SectionPanel>
    {value.lines.map((line) => <SectionPanel key={line.id} title={line.serviceCode} subtitle={`${line.date} · ${money(line.amountCents)}`}><Text style={{ color: c.muted }}>Nachweis-ID: {line.proofId}</Text>{hasPermission(profile?.roleKey, 'pflege.proofs.view') ? <PremiumButton title="Leistungsnachweis öffnen" variant="secondary" onPress={() => router.push(`/pflege/leistungsnachweis-workflow?id=${line.proofId}` as never)} /> : null}</SectionPanel>)}
    {error ? <ErrorState message={error} /> : null}<PremiumButton title="Geprüfte Positionen als CSV herunterladen" loading={busy} disabled={busy} onPress={() => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); void downloadCareFoundationCsv(value).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Export fehlgeschlagen.')).finally(() => { lock.current = false; setBusy(false); }); }} />
  </View></ScreenShell>;
}
