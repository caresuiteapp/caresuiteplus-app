import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { NativeAction, NativeField, nativeWorkspaceStyles as ui } from '@/components/ui/NativeWorkspaceUi';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchInvoiceRuns, fetchInvoicePayments, fetchInvoiceDunningCases, formatCurrency } from '@/lib/office/invoiceExtensionService';
import { fetchMonthEndInvoiceOverview } from '@/lib/office/monthEndInvoiceOverview';
import type { RoleKey, ServiceResult } from '@/types';

const STATUS_LABELS: Record<string, string> = { draft: 'Entwurf', prepared: 'Vorbereitet', checked: 'Geprüft', completed: 'Abgeschlossen',
  received: 'Eingegangen', matched: 'Zugeordnet', unmatched: 'Nicht zugeordnet', pending: 'Ausstehend', cancelled: 'Storniert',
  open: 'Offen', sent: 'Versendet', paid: 'Bezahlt', closed: 'Erledigt', aktiv: 'Aktiv', abgeschlossen: 'Abgeschlossen', in_bearbeitung: 'In Bearbeitung' };
type FinanceRow = { id: string; label: string; detail: string; amount: number; status: string; invoiceId?: string };
type Loader<T> = (tenantId: string, roleKey?: RoleKey | null) => Promise<ServiceResult<T[]>>;

function FinanceList<T>({ title, load, map }: { title: string; load: Loader<T>; map: (row: T) => FinanceRow }) {
  const tenantId = useServiceTenantId(); const { profile, user } = useAuth(); const router = useRouter();
  const [query, setQuery] = useState('');
  const result = useAsyncQuery(() => tenantId ? load(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant am Profil hinterlegt.' }),
    [tenantId, profile?.roleKey, load], { queryKey: JSON.stringify([tenantId, user?.id, profile?.roleKey, title]) });
  const rows = (result.data ?? []).map(map).filter(row => (row.label + ' ' + row.detail + ' ' + (STATUS_LABELS[row.status] ?? row.status)).toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE')));
  return <ScreenShell title={title} subtitle="Abrechnung"><ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
    <View style={ui.row}><NativeAction label="Aktualisieren" disabled={result.loading || result.refreshing} onPress={() => void result.refresh()} />
      <NativeAction label="Rechnungen öffnen" onPress={() => router.push('/office/invoices')} /></View>
    <NativeField label={title + ' durchsuchen'} value={query} onChangeText={setQuery} autoCorrect={false} />
    {result.loading ? <LoadingState message={title + ' werden geladen…'} /> : result.error ? <ErrorState message={result.error} onRetry={() => void result.refresh()} /> : null}
    {result.refreshError ? <ErrorState message={result.refreshError} onRetry={() => void result.refresh()} /> : null}
    {!result.loading && !result.error && rows.length === 0 ? <EmptyState title={query ? 'Keine Treffer' : 'Keine Vorgänge vorhanden'} message={query ? 'Bitte den Suchbegriff ändern.' : 'Für diesen Mandanten sind noch keine Vorgänge erfasst.'} /> : null}
    {rows.map(row => <View key={row.id} style={[ui.surface, ui.stack]}>
      <Text accessibilityRole="header" style={ui.title}>{row.label}</Text><Text style={ui.body}>{row.detail}</Text>
      <Text style={ui.body}>{formatCurrency(row.amount)} · {STATUS_LABELS[row.status] ?? row.status}</Text>
      {row.invoiceId ? <NativeAction label="Rechnung ansehen" onPress={() => router.push(('/office/invoices/' + row.invoiceId) as never)} /> : null}
    </View>)}
  </ScrollView></ScreenShell>;
}

export function InvoiceRunsScreen() {
  return <FinanceList title="Rechnungsläufe" load={fetchInvoiceRuns} map={row => ({ id: row.id, label: row.label,
    detail: row.runAt.slice(0, 10) + ' · ' + row.invoiceCount + ' Rechnungen', amount: row.totalCents, status: row.status })} />;
}
export function InvoicePaymentsScreen() {
  return <FinanceList title="Zahlungseingänge" load={fetchInvoicePayments} map={row => ({ id: row.id, label: row.invoiceNumber,
    detail: row.clientName + ' · ' + row.paidAt.slice(0, 10) + ' · ' + row.method, amount: row.amountCents, status: row.status, invoiceId: row.invoiceId })} />;
}
export function InvoiceDunningScreen() {
  return <FinanceList title="Mahnwesen" load={fetchInvoiceDunningCases} map={row => ({ id: row.id, label: row.invoiceNumber,
    detail: row.clientName + ' · Mahnstufe ' + row.dunningLevel + ' · Fällig ' + row.dueDate, amount: row.openCents, status: row.status, invoiceId: row.invoiceId })} />;
}
export function MonthEndClosingScreen() {
  const tenantId = useServiceTenantId(); const { profile, user } = useAuth(); const router = useRouter();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const result = useAsyncQuery(() => tenantId ? fetchMonthEndInvoiceOverview(tenantId, month, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant am Profil hinterlegt.' }),
    [tenantId, month, profile?.roleKey], { queryKey: JSON.stringify([tenantId, user?.id, profile?.roleKey, month]) });
  return <ScreenShell title="Monatsabschluss" subtitle="Abrechnung"><ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
    <NativeField label="Abrechnungsmonat (JJJJ-MM)" value={month} onChangeText={setMonth} autoCorrect={false} />
    <NativeAction label="Aktualisieren" disabled={result.loading || result.refreshing} onPress={() => void result.refresh()} />
    {result.loading ? <LoadingState message="Monatsübersicht wird geladen…" /> : result.error ? <ErrorState message={result.error} onRetry={() => void result.refresh()} /> : null}
    {result.data ? <View style={[ui.surface, ui.stack]}>
      <Text accessibilityRole="header" style={ui.title}>{month}</Text>
      <Text style={ui.body}>{result.data.invoiceCount} Rechnungen · {formatCurrency(result.data.totalCents)}</Text>
      <Text style={ui.body}>{result.data.draftCount} offene Entwürfe</Text>
      <Text style={ui.body}>{result.data.runs.length} Rechnungsläufe</Text>
      {result.data.runs.map(run => <Text key={run.id} style={ui.body}>{run.label} · {STATUS_LABELS[run.status] ?? run.status}</Text>)}
      <NativeAction label="Rechnungen prüfen" onPress={() => router.push('/office/invoices')} />
      <NativeAction label="Rechnungsläufe öffnen" onPress={() => router.push('/office/invoices/runs')} />
    </View> : null}
    {result.refreshError ? <ErrorState message={result.refreshError} onRetry={() => void result.refresh()} /> : null}
  </ScrollView></ScreenShell>;
}
