import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PlatformAuditLink,
  PlatformConfirmModal,
  PlatformDataTable,
  PlatformDeferredNote,
  PlatformEmptyState,
  PlatformFilterChip,
  PlatformFilterChipRow,
  PlatformReadOnlyBanner,
  PlatformShellLayout,
  PlatformStatusBadge,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import {
  assignPlatformDiscount,
  endPlatformSupportSession,
  listPlatformDiscountCatalog,
  listPlatformFeatureFlags,
  listPlatformInvoices,
  listPlatformPayments,
  listPlatformSupportSessions,
  listPlatformTenantDiscounts,
  platformRoleHasCapability,
  recordPlatformManualPayment,
  removePlatformDiscount,
  setPlatformFeatureFlag,
  startPlatformSupportSession,
  updatePlatformInvoiceStatus,
} from '@/lib/platformConsole';
import { formatPlatformCents, formatPlatformDate, maskPlatformProviderId } from '@/lib/platformConsole/platformFormat';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import type {
  PlatformDiscountRow,
  PlatformFeatureFlagRow,
  PlatformInvoiceRow,
  PlatformPaymentRow,
  PlatformSupportSessionRow,
  PlatformTenantDiscountRow,
} from '@/types/platformConsole';
import { spacing } from '@/theme';

const INVOICE_STATUSES = [
  'draft',
  'open',
  'paid',
  'past_due',
  'failed',
  'cancelled',
  'refunded',
  'partially_paid',
] as const;

const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'chargeback'] as const;

type ConfirmState = {
  title: string;
  description: string;
  action: (reason: string) => Promise<void>;
  danger?: boolean;
};

function useOperatorConfirm(onSuccess: () => Promise<void>) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [loading, setLoading] = useState(false);

  async function runConfirm(reason: string) {
    if (!confirm) return;
    setLoading(true);
    await confirm.action(reason);
    setLoading(false);
    setConfirm(null);
    await onSuccess();
  }

  const modal = (
    <PlatformConfirmModal
      visible={Boolean(confirm)}
      title={confirm?.title ?? ''}
      description={confirm?.description ?? ''}
      danger={confirm?.danger}
      loading={loading}
      onCancel={() => setConfirm(null)}
      onConfirm={(reason) => void runConfirm(reason)}
    />
  );

  return { setConfirm, modal };
}

export function PlatformDiscountsScreen() {
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'discounts.write');
  const [catalog, setCatalog] = useState<PlatformDiscountRow[]>([]);
  const [assignments, setAssignments] = useState<PlatformTenantDiscountRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignTenantId, setAssignTenantId] = useState('');
  const [assignKey, setAssignKey] = useState('');
  const [assignStart, setAssignStart] = useState('');
  const [assignEnd, setAssignEnd] = useState('');
  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [cat, asg] = await Promise.all([
      listPlatformDiscountCatalog(),
      listPlatformTenantDiscounts(),
    ]);
    if (!cat.ok) {
      setError(cat.error);
      setLoading(false);
      return;
    }
    if (!asg.ok) {
      setError(asg.error);
      setLoading(false);
      return;
    }
    setCatalog(cat.data);
    setAssignments(asg.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { setConfirm, modal } = useOperatorConfirm(load);

  const filteredCatalog = useMemo(() => {
    let rows = catalog;
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (typeFilter) rows = rows.filter((r) => r.discount_type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) => r.discount_key.toLowerCase().includes(q) || r.discount_name.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [catalog, search, statusFilter, typeFilter]);

  const discountTypes = useMemo(
    () => [...new Set(catalog.map((r) => r.discount_type))],
    [catalog],
  );

  return (
    <PlatformShellLayout title="Rabatte" subtitle="Katalog, Zuweisungen und Sonderkonditionen">
      {!canWrite ? (
        <PlatformReadOnlyBanner message="Lesemodus — Rabattzuweisungen erfordern discounts.write." />
      ) : null}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Rabatt suchen…"
          placeholderTextColor={PLATFORM_COLORS.muted}
        />
      </View>
      <PlatformFilterChipRow>
        <PlatformFilterChip label="Alle Status" active={!statusFilter} onPress={() => setStatusFilter('')} />
        {['active', 'scheduled', 'expired', 'revoked'].map((s) => (
          <PlatformFilterChip key={s} label={s} active={statusFilter === s} onPress={() => setStatusFilter(s)} />
        ))}
      </PlatformFilterChipRow>
      <PlatformFilterChipRow>
        <PlatformFilterChip label="Alle Typen" active={!typeFilter} onPress={() => setTypeFilter('')} />
        {discountTypes.map((t) => (
          <PlatformFilterChip key={t} label={t} active={typeFilter === t} onPress={() => setTypeFilter(t)} />
        ))}
      </PlatformFilterChipRow>

      {loading ? (
        <LoadingState message="Rabatte werden geladen…" />
      ) : error ? (
        <ErrorState title="Rabatte nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <>
          <Text style={styles.sectionTitle}>Rabattkatalog</Text>
          <PlatformDataTable
              columns={[
                { key: 'key', label: 'Key', render: (r: PlatformDiscountRow) => r.discount_key },
                { key: 'name', label: 'Name', render: (r: PlatformDiscountRow) => r.discount_name },
                { key: 'type', label: 'Typ', render: (r: PlatformDiscountRow) => r.discount_type },
                {
                  key: 'value',
                  label: 'Wert',
                  render: (r: PlatformDiscountRow) =>
                    r.discount_type === 'percentage' ? `${r.value ?? 0}%` : formatPlatformCents(r.value),
                },
                { key: 'status', label: 'Status', render: (r: PlatformDiscountRow) => <PlatformStatusBadge status={r.status} /> },
              ]}
              data={filteredCatalog}
              keyExtractor={(r) => r.id}
          />

          <Text style={styles.sectionTitle}>Mandantenzuweisungen</Text>
          <PlatformDataTable
              columns={[
                { key: 'tenant', label: 'Mandant', render: (r: PlatformTenantDiscountRow) => r.tenant_id.slice(0, 8) },
                { key: 'key', label: 'Rabatt', render: (r: PlatformTenantDiscountRow) => r.discount_key },
                { key: 'status', label: 'Status', render: (r: PlatformTenantDiscountRow) => <PlatformStatusBadge status={r.status} /> },
                { key: 'start', label: 'Start', render: (r: PlatformTenantDiscountRow) => formatPlatformDate(r.starts_at) },
                { key: 'end', label: 'Ende', render: (r: PlatformTenantDiscountRow) => formatPlatformDate(r.ends_at) },
                {
                  key: 'actions',
                  label: '',
                  render: (r: PlatformTenantDiscountRow) =>
                    canWrite && r.status === 'active' ? (
                      <Pressable
                        onPress={() =>
                          setConfirm({
                            title: 'Rabatt entfernen',
                            description: `Rabatt „${r.discount_key}" für Mandant ${r.tenant_id} widerrufen.`,
                            danger: true,
                            action: async (reason) => {
                              const res = await removePlatformDiscount(r.tenant_id, r.discount_key, reason);
                              if (!res.ok) throw new Error(res.error);
                              setLastAuditAction('discount.removed');
                            },
                          })
                        }
                      >
                        <Text style={styles.link}>Entfernen</Text>
                      </Pressable>
                    ) : null,
                },
              ]}
              data={assignments}
              keyExtractor={(r) => r.id}
          />

          {canWrite ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>Rabatt zuweisen</Text>
              <Text style={styles.label}>Mandant-ID</Text>
              <TextInput style={styles.input} value={assignTenantId} onChangeText={setAssignTenantId} placeholder="Tenant-UUID" placeholderTextColor={PLATFORM_COLORS.muted} />
              <Text style={styles.label}>Rabatt-Key</Text>
              <TextInput style={styles.input} value={assignKey} onChangeText={setAssignKey} placeholder="discount_key" placeholderTextColor={PLATFORM_COLORS.muted} />
              <Text style={styles.label}>Start (ISO, optional)</Text>
              <TextInput style={styles.input} value={assignStart} onChangeText={setAssignStart} placeholder="2026-01-01T00:00:00Z" placeholderTextColor={PLATFORM_COLORS.muted} />
              <Text style={styles.label}>Ende (ISO, optional)</Text>
              <TextInput style={styles.input} value={assignEnd} onChangeText={setAssignEnd} placeholder="2026-12-31T23:59:59Z" placeholderTextColor={PLATFORM_COLORS.muted} />
              <Pressable
                style={styles.primaryBtn}
                onPress={() =>
                  setConfirm({
                    title: 'Rabatt zuweisen',
                    description: `Rabatt „${assignKey}" wird Mandant ${assignTenantId} zugewiesen.`,
                    action: async (reason) => {
                      const res = await assignPlatformDiscount(assignTenantId.trim(), assignKey.trim(), reason, {
                        startsAt: assignStart.trim() || undefined,
                        endsAt: assignEnd.trim() || undefined,
                      });
                      if (!res.ok) throw new Error(res.error);
                      setLastAuditAction('discount.assigned');
                    },
                  })
                }
              >
                <Text style={styles.primaryBtnText}>Zuweisen (Grund erforderlich)</Text>
              </Pressable>
              <PlatformDeferredNote phase="PLATFORM.1.3" feature="Rabattkatalog erstellen/aktivieren" />
            </View>
          ) : null}

          {lastAuditAction ? (
            <View style={styles.auditRow}>
              <Text style={styles.hint}>Aktion protokolliert.</Text>
              <PlatformAuditLink action={lastAuditAction} label="Audit-Einträge anzeigen" />
            </View>
          ) : null}
        </>
      )}
      {modal}
    </PlatformShellLayout>
  );
}

export function PlatformBillingScreen() {
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'billing.write');
  const [items, setItems] = useState<PlatformInvoiceRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlatformInvoiceRow | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPlatformInvoices({ status: statusFilter || undefined, search: search.trim() || undefined });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setItems(result.data);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const { setConfirm, modal } = useOperatorConfirm(load);

  return (
    <PlatformShellLayout title="Rechnungen" subtitle="Rechnungsübersicht, Statusverwaltung und Billing Preview">
      {!canWrite ? <PlatformReadOnlyBanner message="Lesemodus — Statusänderungen erfordern billing.write." /> : null}
      <Text style={styles.sectionTitle}>Billing Preview (mandantenübergreifend)</Text>
      <Text style={styles.hint}>Tenant-ID eingeben und Preview auf dem Mandanten-Detail unter „Billing Preview" erzeugen.</Text>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechnungsnummer…"
          placeholderTextColor={PLATFORM_COLORS.muted}
          onSubmitEditing={() => void load()}
        />
        <Pressable style={styles.searchBtn} onPress={() => void load()}>
          <Text style={styles.link}>Suchen</Text>
        </Pressable>
      </View>
      <PlatformFilterChipRow>
        <PlatformFilterChip label="Alle" active={!statusFilter} onPress={() => setStatusFilter('')} />
        {INVOICE_STATUSES.map((s) => (
          <PlatformFilterChip key={s} label={s} active={statusFilter === s} onPress={() => setStatusFilter(s)} />
        ))}
      </PlatformFilterChipRow>

      {loading ? (
        <LoadingState message="Rechnungen werden geladen…" />
      ) : error ? (
        <ErrorState title="Rechnungen nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <>
          <PlatformDataTable
              columns={[
                { key: 'num', label: 'Nr.', render: (r: PlatformInvoiceRow) => r.invoice_number },
                { key: 'tenant', label: 'Mandant', render: (r: PlatformInvoiceRow) => r.tenant_id.slice(0, 8) },
                { key: 'status', label: 'Status', render: (r: PlatformInvoiceRow) => <PlatformStatusBadge status={r.status} /> },
                { key: 'gross', label: 'Brutto', render: (r: PlatformInvoiceRow) => formatPlatformCents(r.amount_cents, r.currency) },
                { key: 'net', label: 'Netto', render: (r: PlatformInvoiceRow) => formatPlatformCents(r.net_cents, r.currency) },
                { key: 'tax', label: 'Steuer', render: (r: PlatformInvoiceRow) => formatPlatformCents(r.tax_cents, r.currency) },
                { key: 'due', label: 'Fällig', render: (r: PlatformInvoiceRow) => formatPlatformDate(r.due_at) },
                {
                  key: 'open',
                  label: '',
                  render: (r: PlatformInvoiceRow) => (
                    <Pressable onPress={() => setSelected(r)}>
                      <Text style={styles.link}>Details</Text>
                    </Pressable>
                  ),
                },
              ]}
              data={items}
              keyExtractor={(r) => r.id}
          />

          {selected ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>Rechnung {selected.invoice_number}</Text>
              <Text style={styles.hint}>ID: {selected.id}</Text>
              {canWrite ? (
                <>
                  <Text style={styles.label}>Neuer Status</Text>
                  <PlatformFilterChipRow>
                    {INVOICE_STATUSES.map((s) => (
                      <PlatformFilterChip key={s} label={s} active={newStatus === s} onPress={() => setNewStatus(s)} />
                    ))}
                  </PlatformFilterChipRow>
                  <Pressable
                    style={styles.primaryBtn}
                    disabled={!newStatus}
                    onPress={() =>
                      setConfirm({
                        title: 'Rechnungsstatus ändern',
                        description: `Rechnung ${selected.invoice_number} → ${newStatus}. Grund ist Pflicht.`,
                        action: async (reason) => {
                          const res = await updatePlatformInvoiceStatus(selected.id, newStatus, reason);
                          if (!res.ok) throw new Error(res.error);
                          setLastAuditAction('invoice.status_changed');
                        },
                      })
                    }
                  >
                    <Text style={styles.primaryBtnText}>Status ändern</Text>
                  </Pressable>
                </>
              ) : null}
              <PlatformAuditLink tenantId={selected.tenant_id} action="invoice" />
            </View>
          ) : null}

          {lastAuditAction ? (
            <View style={styles.auditRow}>
              <PlatformAuditLink action={lastAuditAction} label="Letzte Änderung im Audit" />
            </View>
          ) : null}

          <PlatformDeferredNote phase="PLATFORM.1.3" feature="Manuelle Rechnungserfassung" />
        </>
      )}
      {modal}
    </PlatformShellLayout>
  );
}

export function PlatformPaymentsScreen() {
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'payments.write');
  const [items, setItems] = useState<PlatformPaymentRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualTenant, setManualTenant] = useState('');
  const [manualInvoice, setManualInvoice] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualStatus, setManualStatus] = useState('succeeded');
  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPlatformPayments({
      status: statusFilter || undefined,
      provider: providerFilter || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setItems(result.data);
    setLoading(false);
  }, [providerFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const { setConfirm, modal } = useOperatorConfirm(load);

  const providers = useMemo(
    () => [...new Set(items.map((r) => r.provider).filter(Boolean))] as string[],
    [items],
  );

  return (
    <PlatformShellLayout title="Zahlungen" subtitle="Zahlungsübersicht — keine Provider-Secrets">
      {!canWrite ? <PlatformReadOnlyBanner message="Lesemodus — manuelle Zahlungen erfordern payments.write." /> : null}
      <PlatformFilterChipRow>
        <PlatformFilterChip label="Alle Status" active={!statusFilter} onPress={() => setStatusFilter('')} />
        {PAYMENT_STATUSES.map((s) => (
          <PlatformFilterChip key={s} label={s} active={statusFilter === s} onPress={() => setStatusFilter(s)} />
        ))}
      </PlatformFilterChipRow>
      <PlatformFilterChipRow>
        <PlatformFilterChip label="Alle Provider" active={!providerFilter} onPress={() => setProviderFilter('')} />
        {providers.map((p) => (
          <PlatformFilterChip key={p} label={p} active={providerFilter === p} onPress={() => setProviderFilter(p)} />
        ))}
      </PlatformFilterChipRow>

      {loading ? (
        <LoadingState message="Zahlungen werden geladen…" />
      ) : error ? (
        <ErrorState title="Zahlungen nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <>
          <PlatformDataTable
              columns={[
                { key: 'tenant', label: 'Mandant', render: (r: PlatformPaymentRow) => r.tenant_id.slice(0, 8) },
                { key: 'status', label: 'Status', render: (r: PlatformPaymentRow) => <PlatformStatusBadge status={r.status} /> },
                { key: 'amount', label: 'Betrag', render: (r: PlatformPaymentRow) => formatPlatformCents(r.amount_cents) },
                { key: 'provider', label: 'Provider', render: (r: PlatformPaymentRow) => r.provider ?? '—' },
                {
                  key: 'providerId',
                  label: 'Provider-ID',
                  render: (r: PlatformPaymentRow) => maskPlatformProviderId(r.provider_payment_id),
                },
                { key: 'fail', label: 'Fehler', render: (r: PlatformPaymentRow) => r.failure_reason ?? '—' },
                { key: 'created', label: 'Erstellt', render: (r: PlatformPaymentRow) => formatPlatformDate(r.created_at) },
              ]}
              data={items}
              keyExtractor={(r) => r.id}
          />

          {canWrite ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>Manuelle Zahlung erfassen</Text>
              <TextInput style={styles.input} value={manualTenant} onChangeText={setManualTenant} placeholder="Tenant-ID" placeholderTextColor={PLATFORM_COLORS.muted} />
              <TextInput style={styles.input} value={manualInvoice} onChangeText={setManualInvoice} placeholder="Rechnungs-ID (optional)" placeholderTextColor={PLATFORM_COLORS.muted} />
              <TextInput style={styles.input} value={manualAmount} onChangeText={setManualAmount} placeholder="Betrag in Cent" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" />
              <PlatformFilterChipRow>
                {PAYMENT_STATUSES.map((s) => (
                  <PlatformFilterChip key={s} label={s} active={manualStatus === s} onPress={() => setManualStatus(s)} />
                ))}
              </PlatformFilterChipRow>
              <Pressable
                style={styles.primaryBtn}
                onPress={() =>
                  setConfirm({
                    title: 'Manuelle Zahlung',
                    description: `Zahlung ${manualAmount} Cent für Mandant ${manualTenant} als ${manualStatus}.`,
                    action: async (reason) => {
                      const cents = Number(manualAmount);
                      if (!Number.isFinite(cents) || cents < 0) throw new Error('Betrag muss ≥ 0 sein.');
                      const res = await recordPlatformManualPayment(
                        manualTenant.trim(),
                        manualInvoice.trim() || null,
                        cents,
                        manualStatus,
                        reason,
                      );
                      if (!res.ok) throw new Error(res.error);
                      setLastAuditAction('payment.recorded');
                    },
                  })
                }
              >
                <Text style={styles.primaryBtnText}>Erfassen (Grund erforderlich)</Text>
              </Pressable>
            </View>
          ) : null}

          <PlatformDeferredNote phase="PLATFORM.1.3" feature="Bestehende Zahlungen nachträglich markieren (kein RPC)" />

          {lastAuditAction ? (
            <View style={styles.auditRow}>
              <PlatformAuditLink action={lastAuditAction} />
            </View>
          ) : null}
        </>
      )}
      {modal}
    </PlatformShellLayout>
  );
}

export function PlatformSupportScreen() {
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'support.write');
  const [sessions, setSessions] = useState<PlatformSupportSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [durationMin, setDurationMin] = useState('60');
  const [readonly, setReadonly] = useState(true);
  const [scopes, setScopes] = useState('tenants.read,modules.read');
  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPlatformSupportSessions();
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSessions(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { setConfirm, modal } = useOperatorConfirm(load);

  const active = sessions.filter((s) => s.status === 'active');
  const historical = sessions.filter((s) => s.status !== 'active');

  return (
    <PlatformShellLayout title="Support-Sessions" subtitle="Sichtbare Mandantenübernahme — jede Session auditierbar">
      {!canWrite ? <PlatformReadOnlyBanner message="Lesemodus — Sessions starten/beenden erfordert support.write." /> : null}

      {loading ? (
        <LoadingState message="Support-Sessions werden geladen…" />
      ) : error ? (
        <ErrorState title="Support nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <>
          <Text style={styles.sectionTitle}>Aktive Sessions ({active.length})</Text>
          <SessionTable
            sessions={active}
            canWrite={canWrite}
            onEnd={(s) =>
              setConfirm({
                title: 'Support-Session beenden',
                description: `Session ${s.id} für Mandant ${s.tenant_id} wird beendet.`,
                action: async (reason) => {
                  const res = await endPlatformSupportSession(s.id, reason);
                  if (!res.ok) throw new Error(res.error);
                  setLastAuditAction('support.session.ended');
                },
              })
            }
          />

          <Text style={styles.sectionTitle}>Historie</Text>
          <SessionTable sessions={historical} canWrite={false} />

          {canWrite ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>Session starten</Text>
              <TextInput style={styles.input} value={tenantId} onChangeText={setTenantId} placeholder="Tenant-ID" placeholderTextColor={PLATFORM_COLORS.muted} />
              <TextInput style={styles.input} value={durationMin} onChangeText={setDurationMin} placeholder="Dauer in Minuten" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" />
              <TextInput style={styles.input} value={scopes} onChangeText={setScopes} placeholder="allowed_scopes (kommagetrennt)" placeholderTextColor={PLATFORM_COLORS.muted} />
              <PlatformFilterChipRow>
                <PlatformFilterChip label="Readonly" active={readonly} onPress={() => setReadonly(true)} />
                <PlatformFilterChip label="Schreibzugriff" active={!readonly} onPress={() => setReadonly(false)} />
              </PlatformFilterChipRow>
              {!readonly ? (
                <Text style={styles.warn}>Schreibzugriff — nur für Owner/Admin. Aktion wird auditierbar protokolliert.</Text>
              ) : null}
              <Pressable
                style={styles.primaryBtn}
                onPress={() =>
                  setConfirm({
                    title: 'Support-Session starten',
                    description: `Readonly=${readonly}, Dauer ${durationMin} Min. Grund ist Pflicht.`,
                    action: async (reason) => {
                      const mins = Number(durationMin);
                      if (!Number.isFinite(mins) || mins <= 0) throw new Error('Dauer muss > 0 sein.');
                      const expiresAt = new Date(Date.now() + mins * 60000).toISOString();
                      const res = await startPlatformSupportSession(
                        tenantId.trim(),
                        reason,
                        expiresAt,
                        readonly,
                        scopes.split(',').map((s) => s.trim()).filter(Boolean),
                      );
                      if (!res.ok) throw new Error(res.error);
                      setLastAuditAction('support.session.started');
                    },
                  })
                }
              >
                <Text style={styles.primaryBtnText}>Session starten</Text>
              </Pressable>
            </View>
          ) : null}

          {lastAuditAction ? (
            <View style={styles.auditRow}>
              <PlatformAuditLink action={lastAuditAction} />
            </View>
          ) : null}
        </>
      )}
      {modal}
    </PlatformShellLayout>
  );
}

function SessionTable({
  sessions,
  canWrite,
  onEnd,
}: {
  sessions: PlatformSupportSessionRow[];
  canWrite: boolean;
  onEnd?: (s: PlatformSupportSessionRow) => void;
}) {
  if (sessions.length === 0) {
    return <PlatformEmptyState title="Keine Sessions" message="Aktuell keine Einträge in dieser Liste." />;
  }
  return (
    <PlatformDataTable
      columns={[
        { key: 'tenant', label: 'Mandant', minWidth: 100, render: (r: PlatformSupportSessionRow) => r.tenant_id.slice(0, 8) },
        { key: 'status', label: 'Status', minWidth: 100, render: (r: PlatformSupportSessionRow) => <PlatformStatusBadge status={r.status} /> },
        {
          key: 'mode',
          label: 'Modus',
          minWidth: 90,
          render: (r: PlatformSupportSessionRow) => (r.readonly ? 'readonly' : 'WRITE'),
        },
        { key: 'expires', label: 'Ablauf', minWidth: 140, render: (r: PlatformSupportSessionRow) => formatPlatformDate(r.expires_at) },
        { key: 'reason', label: 'Grund', minWidth: 160, render: (r: PlatformSupportSessionRow) => r.reason ?? '—' },
        {
          key: 'actions',
          label: '',
          minWidth: 88,
          render: (r: PlatformSupportSessionRow) =>
            canWrite && onEnd && r.status === 'active' ? (
              <Pressable onPress={() => onEnd(r)}>
                <Text style={styles.link}>Beenden</Text>
              </Pressable>
            ) : null,
        },
      ]}
      data={sessions}
      keyExtractor={(r) => r.id}
      emptyTitle="Keine Sessions"
    />
  );
}

export function PlatformFeatureFlagsScreen() {
  const { platformUser } = usePlatformAuth();
  const canWriteGlobal = platformRoleHasCapability(platformUser?.role, 'flags.write');
  const isOwnerOrDev =
    platformUser?.role === 'platform_owner' || platformUser?.role === 'platform_developer';
  const [flags, setFlags] = useState<PlatformFeatureFlagRow[]>([]);
  const [scopeFilter, setScopeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editRollout, setEditRollout] = useState('');
  const [editTenant, setEditTenant] = useState('');
  const [editScope, setEditScope] = useState('global');
  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPlatformFeatureFlags({ scope: scopeFilter || undefined });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setFlags(result.data);
    setLoading(false);
  }, [scopeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const { setConfirm, modal } = useOperatorConfirm(load);

  return (
    <PlatformShellLayout title="Feature Flags" subtitle="Globale und mandantenspezifische Schalter">
      {!canWriteGlobal ? (
        <PlatformReadOnlyBanner message="Lesemodus — Flag-Änderungen erfordern flags.write (Owner/Developer)." />
      ) : null}

      <PlatformFilterChipRow>
        {['', 'global', 'tenant', 'module', 'user', 'beta_group'].map((s) => (
          <PlatformFilterChip
            key={s || 'all'}
            label={s || 'Alle Scopes'}
            active={scopeFilter === s}
            onPress={() => setScopeFilter(s)}
          />
        ))}
      </PlatformFilterChipRow>

      {loading ? (
        <LoadingState message="Feature Flags werden geladen…" />
      ) : error ? (
        <ErrorState title="Flags nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <>
          <PlatformDataTable
              columns={[
                { key: 'key', label: 'Key', render: (r: PlatformFeatureFlagRow) => r.flag_key },
                { key: 'name', label: 'Name', render: (r: PlatformFeatureFlagRow) => r.flag_name },
                { key: 'scope', label: 'Scope', render: (r: PlatformFeatureFlagRow) => r.scope },
                {
                  key: 'enabled',
                  label: 'Aktiv',
                  render: (r: PlatformFeatureFlagRow) => (r.enabled ? 'ja' : 'nein'),
                },
                {
                  key: 'rollout',
                  label: 'Rollout %',
                  render: (r: PlatformFeatureFlagRow) => String(r.rollout_percentage ?? '—'),
                },
                { key: 'start', label: 'Start', render: (r: PlatformFeatureFlagRow) => formatPlatformDate(r.starts_at) },
                { key: 'end', label: 'Ende', render: (r: PlatformFeatureFlagRow) => formatPlatformDate(r.ends_at) },
                {
                  key: 'toggle',
                  label: '',
                  render: (r: PlatformFeatureFlagRow) =>
                    canWriteGlobal && (r.scope !== 'global' || isOwnerOrDev) ? (
                      <Pressable
                        onPress={() =>
                          setConfirm({
                            title: r.enabled ? 'Flag deaktivieren' : 'Flag aktivieren',
                            description: `${r.flag_key} → ${r.enabled ? 'aus' : 'an'}. Grund ist Pflicht.`,
                            action: async (reason) => {
                              const res = await setPlatformFeatureFlag(r.flag_key, !r.enabled, reason, {
                                scope: r.scope,
                                tenantId: r.tenant_id ?? undefined,
                                rolloutPercentage: r.rollout_percentage ?? undefined,
                              });
                              if (!res.ok) throw new Error(res.error);
                              setLastAuditAction('feature_flag.changed');
                            },
                          })
                        }
                      >
                        <Text style={styles.link}>{r.enabled ? 'Deaktivieren' : 'Aktivieren'}</Text>
                      </Pressable>
                    ) : null,
                },
              ]}
              data={flags}
              keyExtractor={(r) => r.id}
          />

          {canWriteGlobal && isOwnerOrDev ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>Flag setzen</Text>
              <TextInput style={styles.input} value={editKey} onChangeText={setEditKey} placeholder="flag_key" placeholderTextColor={PLATFORM_COLORS.muted} />
              <TextInput style={styles.input} value={editRollout} onChangeText={setEditRollout} placeholder="Rollout 0-100" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" />
              <TextInput style={styles.input} value={editTenant} onChangeText={setEditTenant} placeholder="Tenant-ID (tenant scope)" placeholderTextColor={PLATFORM_COLORS.muted} />
              <PlatformFilterChipRow>
                {['global', 'tenant', 'module', 'user', 'beta_group'].map((s) => (
                  <PlatformFilterChip key={s} label={s} active={editScope === s} onPress={() => setEditScope(s)} />
                ))}
              </PlatformFilterChipRow>
              <Pressable
                style={styles.primaryBtn}
                onPress={() =>
                  setConfirm({
                    title: 'Feature Flag aktivieren',
                    description: `${editKey} (${editScope}) mit Rollout ${editRollout || '100'}%.`,
                    action: async (reason) => {
                      const rollout = editRollout.trim() ? Number(editRollout) : 100;
                      if (rollout < 0 || rollout > 100) throw new Error('Rollout muss 0–100 sein.');
                      const res = await setPlatformFeatureFlag(editKey.trim(), true, reason, {
                        scope: editScope,
                        tenantId: editTenant.trim() || undefined,
                        rolloutPercentage: rollout,
                      });
                      if (!res.ok) throw new Error(res.error);
                      setLastAuditAction('feature_flag.changed');
                    },
                  })
                }
              >
                <Text style={styles.primaryBtnText}>Aktivieren (Grund erforderlich)</Text>
              </Pressable>
            </View>
          ) : null}

          {lastAuditAction ? (
            <View style={styles.auditRow}>
              <PlatformAuditLink action={lastAuditAction} />
            </View>
          ) : null}
        </>
      )}
      {modal}
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: PLATFORM_COLORS.text,
    backgroundColor: PLATFORM_COLORS.panel,
  },
  searchBtn: { justifyContent: 'center', paddingHorizontal: spacing.md },
  sectionTitle: { color: PLATFORM_COLORS.text, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  formPanel: {
    marginTop: spacing.md,
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: PLATFORM_COLORS.text,
    backgroundColor: PLATFORM_COLORS.bg,
  },
  primaryBtn: {
    backgroundColor: '#132036',
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.accent,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  primaryBtnText: { color: PLATFORM_COLORS.accent, fontWeight: '700' },
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600' },
  hint: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  warn: { color: PLATFORM_COLORS.danger, fontSize: 12 },
  auditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
});
