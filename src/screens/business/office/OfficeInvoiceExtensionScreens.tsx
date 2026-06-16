import { useState } from 'react';
import type { RoleKey, ServiceResult } from '@/types';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchInvoiceDunningCases,
  fetchInvoicePayments,
  fetchInvoiceRuns,
  formatCurrency,
  type InvoiceDunningItem,
  type InvoicePaymentItem,
  type InvoiceRunItem,
} from '@/lib/office/invoiceExtensionService';
import {
  executeFinalizeRun,
  executeGenerateDrafts,
  executePrepareBillingRun,
  fetchMonthEndClosingSummary,
} from '@/lib/careBilling/monthEndClosingFacade';
import { BILLING_RUN_STATUS_LABELS } from '@/types/careBilling';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { colors, spacing, typography } from '@/theme';

type ExtensionListProps<T> = {
  title: string;
  eyebrow: string;
  emptyTitle: string;
  queryFn: (tenantId: string, roleKey?: RoleKey | null) => Promise<ServiceResult<T[]>>;
  renderItem: (item: T) => { primary: string; secondary: string; badge?: string };
  getItemId: (item: T) => string;
  onOpen?: (item: T) => void;
};

function InvoiceExtensionListScreen<T extends { id: string }>({
  title,
  eyebrow,
  emptyTitle,
  queryFn,
  renderItem,
  getItemId,
  onOpen,
}: ExtensionListProps<T>) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const [search, setSearch] = useState('');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return queryFn(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = (query.data ?? []).filter((item) => {
    const meta = renderItem(item);
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${meta.primary} ${meta.secondary}`.toLowerCase().includes(q);
  });

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title={title} subtitle="Wird geladen…">
        <LoadingState message={`${title} werden geladen…`} />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title={title} subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title={title} subtitle={roleLabel ?? 'Demo'}>
      <SectionPanel title={eyebrow}>
        <PremiumInput label="Suche" value={search} onChangeText={setSearch} placeholder="Filtern…" />
        {items.length === 0 ? (
          <EmptyState title={emptyTitle} message={isReadOnly ? 'Lesemodus aktiv.' : 'Keine Einträge im Demo-Mandanten.'} />
        ) : (
          items.map((item) => {
            const meta = renderItem(item);
            return (
              <PremiumCard key={getItemId(item)} style={styles.card} onPress={onOpen ? () => onOpen(item) : undefined}>
                <View style={styles.row}>
                  <Text style={styles.primary}>{meta.primary}</Text>
                  {meta.badge ? <Text style={styles.badge}>{meta.badge}</Text> : null}
                </View>
                <Text style={styles.secondary}>{meta.secondary}</Text>
              </PremiumCard>
            );
          })
        )}
        <PremiumButton title="Aktualisieren" variant="secondary" onPress={query.refresh} />
      </SectionPanel>
    </CareLightPageShell>
  );
}

export function InvoiceRunsScreen() {
  return (
    <InvoiceExtensionListScreen<InvoiceRunItem>
      title="Abrechnungsläufe"
      eyebrow="OFFICE · RECHNUNGSLÄUFE"
      emptyTitle="Keine Läufe"
      queryFn={fetchInvoiceRuns}
      getItemId={(item) => item.id}
      renderItem={(item) => ({
        primary: item.label,
        secondary: `${item.invoiceCount} Rechnungen · ${formatCurrency(item.totalCents)} · ${formatDate(item.runAt)}`,
        badge: item.status,
      })}
    />
  );
}

export function InvoicePaymentsScreen() {
  const router = useRouter();
  return (
    <InvoiceExtensionListScreen<InvoicePaymentItem>
      title="Zahlungseingänge"
      eyebrow="OFFICE · ZAHLUNGEN"
      emptyTitle="Keine Zahlungen"
      queryFn={fetchInvoicePayments}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/business/office/invoices/${item.invoiceId}` as never)}
      renderItem={(item) => ({
        primary: `${item.invoiceNumber} · ${item.clientName}`,
        secondary: `${formatCurrency(item.amountCents)} · ${item.method} · ${formatDate(item.paidAt)}`,
        badge: item.status,
      })}
    />
  );
}

export function InvoiceDunningScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { isReadOnly } = usePermissions();
  const [level, setLevel] = useState('all');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInvoiceDunningCases(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Mahnwesen" subtitle="Wird geladen…">
        <LoadingState message="Mahnfälle werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Mahnwesen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const items = (query.data ?? []).filter((item) =>
    level === 'all' ? true : String(item.dunningLevel) === level,
  );

  return (
    <CareLightPageShell title="Mahnwesen" subtitle="Office Abrechnung">
      {saved ? <SuccessState message="Mahnnotiz gespeichert (Demo)." /> : null}
      <SectionPanel title="Mahnstufen filtern">
        <FilterChipGroup
          options={[
            { key: 'all', label: 'Alle' },
            { key: '1', label: 'Stufe 1' },
            { key: '2', label: 'Stufe 2' },
            { key: '3', label: 'Stufe 3' },
          ]}
          value={level}
          onChange={setLevel}
        />
      </SectionPanel>
      <SectionPanel title="Offene Mahnfälle">
        {items.length === 0 ? (
          <EmptyState title="Keine Mahnfälle" />
        ) : (
          items.map((item) => (
            <PremiumCard
              key={item.id}
              style={styles.card}
              onPress={() => router.push(`/business/office/invoices/${item.invoiceId}` as never)}
            >
              <Text style={styles.primary}>{item.invoiceNumber} · {item.clientName}</Text>
              <Text style={styles.secondary}>
                Stufe {item.dunningLevel} · offen {formatCurrency(item.openCents)} · fällig {formatDate(item.dueDate)}
              </Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
      {!isReadOnly ? (
        <SectionPanel title="Mahnnotiz">
          <PremiumInput label="Interne Notiz" value={note} onChangeText={setNote} multiline />
          <PremiumButton title="Notiz speichern" onPress={() => setSaved(!!note.trim())} />
        </SectionPanel>
      ) : null}
    </CareLightPageShell>
  );
}

export function MonthEndClosingScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();
  const [billingMonth, setBillingMonth] = useState('2026-06');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);

  const summaryQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchMonthEndClosingSummary(tenantId, billingMonth, profile?.roleKey);
    },
    [tenantId, billingMonth, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const summary = summaryQuery.data;

  async function handlePrepare() {
    if (!tenantId) return;
    setMessage(null);
    const result = await executePrepareBillingRun(tenantId, billingMonth, profile?.roleKey);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setActiveRunId(result.data.billingRunId);
    setMessage(`${result.data.itemCount} Position(en) in Rechnungslauf übernommen.`);
    summaryQuery.refresh();
  }

  async function handleGenerateDrafts() {
    if (!tenantId || !activeRunId) return;
    setMessage(null);
    const result = await executeGenerateDrafts(tenantId, activeRunId, profile?.roleKey);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(`${result.data.draftsCreated} Entwurf/entwürfe erstellt (${result.data.blockedCount} blockiert).`);
    summaryQuery.refresh();
  }

  async function handleFinalize() {
    if (!tenantId || !activeRunId) return;
    setMessage(null);
    const result = await executeFinalizeRun(tenantId, activeRunId, previewConfirmed, profile?.roleKey);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(
      `${result.data.invoicesFinalized} Rechnung(en) finalisiert, ${result.data.receivablesCreated} Forderung(en) angelegt.`,
    );
    summaryQuery.refresh();
  }

  if (summaryQuery.loading && !summary) {
    return (
      <CareLightPageShell title="Monatsabschluss" subtitle="Wird geladen…">
        <LoadingState message="Monatsabschluss wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (summaryQuery.error && !summary) {
    return (
      <CareLightPageShell title="Monatsabschluss" subtitle="Fehler">
        <ErrorState message={summaryQuery.error} onRetry={summaryQuery.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="Monatsabschluss" subtitle="Rechnungslauf & Forderungen">
      {message ? <SuccessState message={message} /> : null}
      <SectionPanel title="Abrechnungsmonat">
        <PremiumInput
          label="Monat (YYYY-MM)"
          value={billingMonth}
          onChangeText={setBillingMonth}
          placeholder="2026-06"
        />
        <Text style={styles.secondary}>
          Abrechnungsbereit: {summary?.readyItemCount ?? 0} Position(en)
        </Text>
      </SectionPanel>

      {!isReadOnly ? (
        <SectionPanel title="Rechnungslauf">
          <PremiumButton title="1. Lauf vorbereiten" onPress={handlePrepare} />
          <PremiumButton
            title="2. Rechnungsentwürfe erzeugen"
            variant="secondary"
            onPress={handleGenerateDrafts}
            disabled={!activeRunId}
          />
          <PremiumButton
            title="PDF-Vorschau bestätigen"
            variant="secondary"
            onPress={() => setPreviewConfirmed(true)}
          />
          <PremiumButton
            title="3. Finalisieren & Forderungen anlegen"
            onPress={handleFinalize}
            disabled={!activeRunId || !previewConfirmed}
          />
        </SectionPanel>
      ) : null}

      <SectionPanel title="Läufe">
        {(summary?.runs ?? []).length === 0 ? (
          <EmptyState title="Keine Läufe" message="Starten Sie einen Monatsabschluss." />
        ) : (
          summary?.runs.map((run) => (
            <PremiumCard key={run.id} style={styles.card} onPress={() => setActiveRunId(run.id)}>
              <View style={styles.row}>
                <Text style={styles.primary}>{run.title}</Text>
                <Text style={styles.badge}>{BILLING_RUN_STATUS_LABELS[run.status]}</Text>
              </View>
              <Text style={styles.secondary}>
                {run.serviceRecordsCount} Position(en) · {run.invoicesCount} Rechnung(en) ·{' '}
                {formatCurrency(run.totalAmountCents)} · {formatDate(run.preparedAt ?? run.createdAt)}
              </Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>

      {summary?.recentAudit.length ? (
        <SectionPanel title="Audit (letzte Ereignisse)">
          {summary.recentAudit.map((e, idx) => (
            <Text key={`${e.action}-${idx}`} style={styles.secondary}>
              {formatDate(e.createdAt)} — {e.summary}
            </Text>
          ))}
        </SectionPanel>
      ) : null}

      <PremiumButton title="Aktualisieren" variant="secondary" onPress={summaryQuery.refresh} />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  primary: { ...typography.label, flex: 1 },
  badge: { ...typography.caption, color: colors.orange },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
