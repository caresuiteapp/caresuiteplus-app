import { usePlatformOperation, requirePlatformResult } from '@/hooks/usePlatformOperation.web';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PlatformAuditLink,
  PlatformFilterChip,
  PlatformFilterChipRow,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { PlatformConfirmModal } from '@/components/platformConsole/PlatformConfirmModal.web';
import { LoadingState } from '@/components/ui';
import type { PlatformTenantDetail } from '@/lib/platformConsole';
import {
  assignPlatformDiscount,
  getPlatformPlanLimits,
  listPlatformAuditLog,
  listPlatformFeatureFlags,
  listPlatformDiscountCatalog,
  platformRoleHasCapability,
  removePlatformDiscount,
  setPlatformFeatureFlag,
  updatePlatformPaymentStatus,
  updatePlatformInvoiceStatus,
} from '@/lib/platformConsole';
import {
  getPlatformTenantCredits,
} from '@/lib/platformConsole/platformOperatorDataService';
import { ConsoleStyle } from '@/components/platformConsole/ConsoleWorkspaceUi.web';
import { PlatformBillingPreviewPanel } from '@/components/platformConsole/PlatformBillingPreviewPanel.web';
import { formatPlatformCents, formatPlatformDate } from '@/lib/platformConsole/platformFormat';
import type { PlatformDiscountRow, PlatformRoleKey, PlatformTenantModuleRow } from '@/types/platformConsole';
import { spacing } from '@/theme';
import { platformRpc } from '@/lib/platformConsole/platformSupabaseClient';
import { consoleEuros, consoleLabel } from '@/lib/platformConsole/consoleWorkspaceModel';
import { platformName, platformActionLabel } from '@/lib/platformConsole/platformLanguage';

type TabProps = {
  tenantId: string;
  detail: PlatformTenantDetail;
  role: PlatformRoleKey | null | undefined;
  onReload: () => Promise<void>;
};

function mapRecordRows(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items ?? [];
}

export function TenantEntitlementsTab({ detail }: Pick<TabProps, 'tenantId' | 'role' | 'detail'>) {
  return <View style={styles.panel}><Text style={styles.section}>Wirksame Funktionsfreigaben</Text>
    {detail.modules.length ? detail.modules.map(module => <View key={module.moduleKey} style={styles.row}>
      <Text style={styles.primary}>{platformName(module.moduleKey, module.moduleName)}</Text>
      <Text style={styles.meta}>{consoleLabel(module.status)}{module.isTrial ? ` · Testphase bis ${formatPlatformDate(module.trialEndsAt)}` : ''}{module.manualOverride ? ' · Individuelle Vereinbarung' : ''}</Text>
    </View>) : <Text style={styles.hint}>Für dieses Unternehmen sind keine Funktionsfreigaben hinterlegt.</Text>}
    <Text style={styles.hint}>Diese Übersicht zeigt die tatsächlich gespeicherten Freigaben. Die kostenlosen Grundfunktionen bleiben Bestandteil der Plattform.</Text>
  </View>;
}

export function TenantCreditsTab({ tenantId, role, onReload }: Pick<TabProps, 'tenantId' | 'role' | 'onReload'>) {
  const operation = usePlatformOperation();
  const report = operation.report;
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const nonce = useRef(crypto.randomUUID());
  const revision = useRef(0);
  const canWrite = platformRoleHasCapability(role, 'billing.write');
  const load = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true); const result = await getPlatformTenantCredits(tenantId);
    if (request !== revision.current) return;
    if (result.ok) setBalance(Number(result.data?.balance_cents ?? 0));
    else { setBalance(null); report(result.error); }
    setLoading(false);
  }, [tenantId, report]);
  useEffect(() => { const counter = revision; void load(); return () => { counter.current++; }; }, [load]);
  return <View style={styles.panel}>
    {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
    <Text style={styles.primary}>{loading ? 'Guthaben wird geladen…' : balance == null ? 'Guthaben konnte nicht ermittelt werden.' : `Aktuelles Guthaben: ${formatPlatformCents(balance)}`}</Text>
    {canWrite ? <View style={styles.subPanel}>
      <Text style={styles.label}>Gutschrift in Euro</Text><TextInput accessibilityLabel="Gutschrift in Euro" style={styles.input} value={amount} onChangeText={setAmount} placeholder="Zum Beispiel 25,00" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="decimal-pad" />
      <Pressable accessibilityRole="button" style={styles.btn} disabled={operation.busy || loading || balance == null || !amount.trim()} onPress={() => setConfirm(true)}><Text style={styles.btnText}>Guthaben buchen</Text></Pressable>
    </View> : <Text style={styles.hint}>Ihre Rolle hat für Guthaben Lesezugriff.</Text>}
    <PlatformConfirmModal visible={confirm} title="Guthaben buchen" description={`Gutschrift: ${amount} Euro. Die Buchung wird dauerhaft im Verlauf dokumentiert.`} error={operation.error} loading={operation.busy}
      onCancel={() => { setConfirm(false); operation.clear(); }} onConfirm={reason => { void operation.run(async () => {
        const cents = consoleEuros(amount); if (!cents) throw new Error('Bitte einen Betrag größer als null eingeben.');
        const result = await platformRpc('platform_record_tenant_credit', { p_nonce: nonce.current, p_tenant_id: tenantId, p_amount_cents: cents, p_reason: reason, p_entry_type: 'credit' });
        if (result.error) throw new Error(result.error.message);
        nonce.current = crypto.randomUUID(); setAmount(''); setConfirm(false); await load(); await onReload();
      }); }} />
    <PlatformAuditLink tenantId={tenantId} action="credit.booked" />
  </View>;
}

export function TenantBillingPreviewTab({ tenantId, role }: Pick<TabProps, 'tenantId' | 'role'>) {
  const canWrite = platformRoleHasCapability(role, 'billing.write');
  return (
    <PlatformBillingPreviewPanel tenantId={tenantId} canWrite={canWrite} compact />
  );
}

export function TenantInvoicesTab({ tenantId, detail, role, onReload }: TabProps) {
  const operation = usePlatformOperation();
  const canWrite = platformRoleHasCapability(role, 'billing.write');
  const invoices = mapRecordRows(detail.invoices);
  const [selectedId, setSelectedId] = useState('');
  const [newStatus, setNewStatus] = useState('open');
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);
  const [auditAction, setAuditAction] = useState<string | null>(null);

  const selected = invoices.find((i) => String(i.id) === selectedId);

  return (
    <View style={styles.panel}>
      {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
      {invoices.length === 0 ? <Text style={styles.hint}>Keine Rechnungen.</Text> : null}
      {invoices.map((inv) => (
        <View key={String(inv.id)} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.primary}>{String(inv.invoice_number ?? inv.id)}</Text>
            <Text style={styles.meta}>
              {consoleLabel(inv.status)} · {formatPlatformCents(inv.total_cents ?? inv.amount_cents)} · Fällig:{' '}
              {formatPlatformDate(inv.due_date ?? inv.due_at)}
            </Text>
          </View>
          <Pressable onPress={() => setSelectedId(String(inv.id))}>
            <Text style={styles.link}>Status</Text>
          </Pressable>
        </View>
      ))}
      {selected && canWrite ? (
        <View style={styles.subPanel}>
          <Text style={styles.label}>Status für {String(selected.invoice_number)}</Text>
          <PlatformFilterChipRow>{[["open","Offen"],["past_due","Überfällig"],["cancelled","Storniert"]].map(([value,label])=><PlatformFilterChip key={value} label={label} active={newStatus===value} onPress={()=>setNewStatus(value)}/>)}</PlatformFilterChipRow>
          <Pressable
            style={styles.btn}
            onPress={() =>
              setConfirm({
                title: 'Rechnungsstatus ändern',
                desc: `Status: ${consoleLabel(newStatus)}. Grund Pflicht.`,
                action: async (reason) => {
                  const res = await updatePlatformInvoiceStatus(String(selected.id), newStatus, reason);
                  if (!res.ok) throw new Error(res.error);
                  setAuditAction('invoice.status_changed');
                  await onReload();
                },
              })
            }
          >
            <Text style={styles.btnText}>Ändern</Text>
          </Pressable>
        </View>
      ) : null}
      {!canWrite ? <Text style={styles.hint}>Ihr Konto hat für Rechnungen Leserechte.</Text> : null}
      {auditAction ? <PlatformAuditLink tenantId={tenantId} action={auditAction} /> : null}
      <PlatformConfirmModal
        error={operation.error}
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.desc ?? ''}
        loading={operation.busy}
        onCancel={() => { setConfirm(null); operation.clear(); }}
        onConfirm={(reason) => {
          if (!confirm) return;
          void operation.run(() => confirm.action(reason)).then(saved => { if (saved) setConfirm(null); });
        }}
      />
    </View>
  );
}

export function TenantPaymentsTab({ tenantId, detail, role, onReload }: TabProps) {
  const operation = usePlatformOperation();
  const canRead = platformRoleHasCapability(role, 'payments.read');
  const canWrite = platformRoleHasCapability(role, 'payments.write');
  const [confirm, setConfirm] = useState<{ paymentId: string; status: string } | null>(null);
  if (!canRead) return <Text style={styles.hint}>Keine Berechtigung für Zahlungen.</Text>;
  const payments = mapRecordRows(detail.payments);
  return (
    <View style={styles.panel}>
      {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
      {payments.length === 0 ? <Text style={styles.hint}>Keine Zahlungen.</Text> : null}
      {payments.map((p) => (
        <View key={String(p.id)} style={styles.row}>
          <Text style={styles.primary}>{formatPlatformCents(p.amount_cents)} · {String(p.status)}</Text>
          <Text style={styles.meta}>Provider: {String(p.provider ?? '—')}</Text>
          {canWrite ? <View style={styles.rowActions}>{['succeeded','failed','refunded'].map((status) => <Pressable key={status} onPress={() => setConfirm({ paymentId: String(p.id), status })}><Text style={styles.link}>{status === 'succeeded' ? 'Erfolgreich' : status === 'failed' ? 'Fehlgeschlagen' : 'Erstattet'}</Text></Pressable>)}</View> : null}
        </View>
      ))}
      <PlatformAuditLink tenantId={tenantId} action="payment" />
      <PlatformConfirmModal error={operation.error} visible={Boolean(confirm)} title="Zahlungsstatus berichtigen" description={`Zahlung als ${consoleLabel(confirm?.status)} markieren.`} loading={operation.busy} onCancel={() => { setConfirm(null); operation.clear(); }} onConfirm={(reason) => {
        if (!confirm) return; void operation.run(async () => { await requirePlatformResult(updatePlatformPaymentStatus(confirm.paymentId, confirm.status, reason)); await onReload(); }).then(saved => { if (saved) setConfirm(null); });
      }} />
    </View>
  );
}

export function TenantDiscountsTab({ tenantId, detail, role, onReload }: TabProps) {
  const operation = usePlatformOperation();
  const report = operation.report;
  const canWrite = platformRoleHasCapability(role, 'discounts.write');
  const discounts = mapRecordRows(detail.discounts);
  const [key, setKey] = useState('');
  const [catalog, setCatalog] = useState<PlatformDiscountRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  useEffect(() => {
    let active = true; setCatalogLoading(true);
    void listPlatformDiscountCatalog().then(result => {
      if (!active) return;
      if (result.ok) setCatalog(result.data); else report(result.error);
    }).catch(report).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [tenantId, report]);
  const discountName = (value: unknown) => catalog.find(row => row.discount_key === value)?.discount_name || platformName(value, 'Individuelle Sonderkondition');
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);

  return (
    <div className="cs-console"><ConsoleStyle/><View style={styles.panel}>
      {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
      {!discounts.length ? <Text style={styles.hint}>Noch keine Sonderkonditionen zugewiesen.</Text> : null}
      {discounts.map((d) => (
        <View key={String(d.id ?? d.discount_key)} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.primary}>{discountName(d.discount_key)}</Text>
            <Text style={styles.meta}>
              {consoleLabel(d.status)} · {formatPlatformDate(d.starts_at)} – {formatPlatformDate(d.ends_at)}
            </Text>
          </View>
          {canWrite && d.status === 'active' ? (
            <Pressable
              onPress={() =>
                setConfirm({
                  title: 'Rabatt entfernen',
                  desc: `Rabatt „${discountName(d.discount_key)}“ widerrufen.`,
                  action: async (reason) => {
                    await requirePlatformResult(removePlatformDiscount(tenantId, String(d.discount_key), reason));
                    await onReload();
                  },
                })
              }
            >
              <Text style={styles.link}>Entfernen</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {canWrite ? (
        <View style={styles.subPanel}>
          <label className="cs-field">Sonderkondition auswählen
            <select value={key} disabled={catalogLoading || operation.busy} onChange={event => setKey(event.target.value)}>
              <option value="">Bitte auswählen</option>
              {catalog.filter(row => row.status === 'active').map(row => <option key={row.discount_key} value={row.discount_key}>{row.discount_name}</option>)}
            </select>
          </label>
          {!catalogLoading && !catalog.some(row => row.status === 'active') ? <Text style={styles.hint}>Keine aktive Sonderkondition im Katalog hinterlegt.</Text> : null}
          <Pressable
            accessibilityRole="button"
            style={styles.btn}
            disabled={catalogLoading || operation.busy || !key}
            onPress={() =>
              setConfirm({
                title: 'Rabatt zuweisen',
                desc: `Rabatt „${discountName(key)}“ zuweisen.`,
                action: async (reason) => {
                  await requirePlatformResult(assignPlatformDiscount(tenantId, key.trim(), reason));
                  await onReload();
                },
              })
            }
          >
            <Text style={styles.btnText}>Zuweisen</Text>
          </Pressable>
          <PlatformAuditLink tenantId={tenantId} action="discount" />
        </View>
      ) : null}
      <PlatformConfirmModal
        error={operation.error}
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.desc ?? ''}
        loading={operation.busy}
        onCancel={() => { setConfirm(null); operation.clear(); }}
        onConfirm={(reason) => {
          if (!confirm) return;
          void operation.run(() => confirm.action(reason)).then(saved => { if (saved) setConfirm(null); });
        }}
      />
    </View></div>
  );
}

export function TenantSupportTab({ tenantId }: Omit<TabProps, 'detail'>) {
  const router = useRouter();
  return <View style={styles.panel}><Text style={styles.section}>Support & Freigaben</Text><Text style={styles.hint}>Support-Nachrichten und zeitlich begrenzte Datenfreigaben werden gemeinsam am Ticket verwaltet.</Text><Pressable accessibilityRole="button" style={styles.btn} onPress={() => router.push('/platform/support' as never)}><Text style={styles.btnText}>Support-Zentrale öffnen</Text></Pressable><PlatformAuditLink tenantId={tenantId} action="support" /></View>;
}

export function TenantFeatureFlagsTab({ tenantId, role }: Omit<TabProps, 'detail' | 'onReload'>) {
  const operation = usePlatformOperation();
  const report = operation.report;
  const canWrite = platformRoleHasCapability(role, 'flags.write');
  const [flags, setFlags] = useState<Record<string, unknown>[]>([]);
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await listPlatformFeatureFlags({ tenantId });
    if (res.ok) setFlags(res.data as unknown as Record<string, unknown>[]); else report(res.error);
  }, [tenantId, report]);

  useEffect(() => {
    setLoading(true);
    void load().catch(report).finally(() => setLoading(false));
  }, [load, report]);

  return (
    <View style={styles.panel}>
      {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
      {loading ? <Text style={styles.hint}>Funktionsfreigaben werden geladen…</Text> : !flags.length ? <Text style={styles.hint}>Keine gesonderten Funktionsfreigaben für dieses Unternehmen hinterlegt.</Text> : null}
      {flags.map((f) => (
        <View key={String(f.id)} style={styles.row}>
          <Text style={styles.primary}>{String(f.description || platformName(f.flag_key, 'Individuelle Funktionsfreigabe'))}</Text>
          <Text style={styles.meta}>{f.enabled ? 'aktiv' : 'inaktiv'} · Freigabeanteil {String(f.rollout_percentage ?? '—')}%</Text>
          {canWrite ? (
            <Pressable
              onPress={() =>
                setConfirm({
                  title: f.enabled ? 'Funktionsfreigabe deaktivieren' : 'Funktion freigeben',
                  desc: `${String(f.description || platformName(f.flag_key, 'Individuelle Funktionsfreigabe'))} für dieses Unternehmen ändern.`,
                  action: async (reason) => {
                    await requirePlatformResult(setPlatformFeatureFlag(String(f.flag_key), !f.enabled, reason, {
                      scope: 'tenant',
                      tenantId,
                    }));
                    await load().catch(report);
                  },
                })
              }
            >
              <Text style={styles.link}>{f.enabled ? 'Deaktivieren' : 'Aktivieren'}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <PlatformAuditLink tenantId={tenantId} action="feature_flag" />
      {!canWrite ? <Text style={styles.hint}>Ihr Konto hat für Funktionsfreigaben Leserechte.</Text> : null}
      <PlatformConfirmModal
        error={operation.error}
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.desc ?? ''}
        loading={operation.busy}
        onCancel={() => { setConfirm(null); operation.clear(); }}
        onConfirm={(reason) => {
          if (!confirm) return;
          void operation.run(() => confirm.action(reason)).then(saved => { if (saved) setConfirm(null); });
        }}
      />
    </View>
  );
}

export function TenantLimitsTab({ detail }: Pick<TabProps, 'detail'>) {
  const plan = (detail.plan ?? {}) as Record<string, unknown>;
  const limits = getPlatformPlanLimits(plan);

  return (
    <View style={styles.panel}>
      <Text style={styles.section}>Vereinbarte Kapazitäten</Text>
      {Object.entries(limits).map(([k, v]) => (
        <View key={k} style={styles.infoRow}>
          <Text style={styles.meta}>{platformName(k)}</Text>
          <Text style={styles.primary}>{v ?? 'Unbegrenzt'}</Text>
        </View>
      ))}
      <Text style={styles.hint}>Es gelten die Kapazitäten des aktuellen Tarifs. Nicht begrenzte Werte werden als unbegrenzt angezeigt.</Text>
    </View>
  );
}

export function TenantDiagnosisTab({ tenantId, detail }: Pick<TabProps, 'tenantId' | 'detail'>) {
  const t = detail.tenant as Record<string, unknown>;
  const modules = detail.modules;
  const [audit, setAudit] = useState<{ action: string; created_at: string }[]>([]);

  useEffect(() => {
    void listPlatformAuditLog({ tenantId, limit: 5 }).then((res) => {
      if (res.ok) setAudit(res.data.items.map((a) => ({ action: a.action, created_at: a.created_at })));
    });
  }, [tenantId]);

  const enabledModules = modules.filter((m) => ['enabled', 'beta_enabled', 'trial'].includes(m.status));
  const disabledModules = modules.filter((m) => m.status === 'disabled');
  const inconsistent = modules.filter((m) => m.manualOverride && m.status === 'disabled');

  const openInvoices = mapRecordRows(detail.invoices).filter((i) =>
    ['open', 'past_due', 'failed', 'partially_paid'].includes(String(i.status)),
  );

  const issues = useMemo(() => {
    const list: string[] = [];
    if (String(t.billing_status ?? t.billingStatus) === 'past_due') list.push('Abrechnung überfällig');
    if (openInvoices.length > 0) list.push(`${openInvoices.length} offene Rechnung(en)`);
    if (inconsistent.length > 0) list.push('Widersprüchliche Funktionsfreigaben');
    if (modules.length > 0 && disabledModules.length === modules.length) list.push('Keine aktiven Funktionsbereiche');
    return list;
  }, [t, openInvoices.length, inconsistent.length, disabledModules.length, modules.length]);

  return (
    <View style={styles.panel}>
      <Info label="Unternehmensnummer" value={tenantId} />
      <Info label="Unternehmenskürzel" value={String(t.slug ?? '—')} />
      <Info label="Status" value={consoleLabel(t.status)} />
      <Info label="Abrechnung" value={consoleLabel(t.billing_status ?? t.billingStatus)} />
      <Info label="Aktive Funktionsbereiche" value={String(enabledModules.length)} />
      <Info label="Deaktivierte Funktionsbereiche" value={String(disabledModules.length)} />
      <Info label="Offene Rechnungen" value={String(openInvoices.length)} />
      <Text style={styles.section}>Erkannte Hinweise</Text>
      {issues.length === 0 ? <Text style={styles.hint}>Keine Auffälligkeiten.</Text> : null}
      {issues.map((i) => (
        <Text key={i} style={styles.warn}>
          • {i}
        </Text>
      ))}
      <Text style={styles.section}>Zugriffsübersicht</Text>
      <Text style={styles.hint}>
        Hier sehen Sie die wirksamen Freigaben des Unternehmens. Änderungen erfolgen in der Berechtigungsverwaltung.
      </Text>
      {modules.slice(0, 8).map((m) => (
        <ModuleDiag key={m.moduleKey} mod={m} />
      ))}
      <Text style={styles.section}>Letzte Änderungen</Text>
      {audit.map((a) => (
        <Text key={a.created_at + a.action} style={styles.meta}>
          {platformActionLabel(a.action)} · {formatPlatformDate(a.created_at)}
        </Text>
      ))}
      <PlatformAuditLink tenantId={tenantId} />
      <Text style={styles.hint}>Die Diagnose zeigt Hinweise. Änderungen werden über den zuständigen Verwaltungsbereich vorgenommen.</Text>
    </View>
  );
}

export function TenantAuditTab({ tenantId }: Pick<TabProps, 'tenantId'>) {
  const [items, setItems] = useState<{ id: string; action: string; reason: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true; setLoading(true); setError(null); setItems([]);
    void listPlatformAuditLog({ tenantId, limit: 50 }).then((res) => {
      if (!active) return;
      if (res.ok) {
        setItems(
          res.data.items.map((a) => ({
            id: a.id,
            action: a.action,
            reason: a.reason,
            created_at: a.created_at,
          })),
        );
      } else setError(res.error);
    }).catch(() => { if (active) setError('Das Protokoll konnte nicht geladen werden. Bitte die Ansicht erneut öffnen.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId]);

  if (loading) return <LoadingState message="Änderungsprotokoll wird geladen…" />;
  if (error) return <View style={styles.panel}><Text accessibilityRole="alert" style={styles.operationError}>{error}</Text><PlatformAuditLink tenantId={tenantId} label="Vollständiges Protokoll öffnen" /></View>;

  return (
    <View style={styles.panel}>
      {items.length === 0 ? <Text style={styles.hint}>Keine Einträge im Änderungsprotokoll.</Text> : null}
      {items.map((e) => (
        <View key={e.id} style={styles.row}>
          <Text style={styles.primary}>{platformActionLabel(e.action)}</Text>
          <Text style={styles.meta}>{formatPlatformDate(e.created_at)}</Text>
          {e.reason ? <Text style={styles.meta}>Grund: {e.reason}</Text> : null}
        </View>
      ))}
      <Text style={styles.hint}>Das Änderungsprotokoll kann eingesehen und nicht nachträglich verändert werden.</Text>
      <PlatformAuditLink tenantId={tenantId} label="Vollständiges Änderungsprotokoll öffnen" />
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.primary}>{value}</Text>
    </View>
  );
}

function ModuleDiag({ mod }: { mod: PlatformTenantModuleRow }) {
  return (
    <Text style={styles.meta}>
      {platformName(mod.moduleKey, mod.moduleName)}: {consoleLabel(mod.status)}
      {mod.manualOverride ? ' (Individuelle Vereinbarung)' : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  operationError: { color: '#942A24', backgroundColor: '#FFF1F0', borderWidth: 1, borderColor: '#E9B7B2', borderRadius: 10, padding: 14, fontSize: 15, lineHeight: 23 },
  panel: {
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  subPanel: { gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: PLATFORM_COLORS.border },
  row: { gap: 4, paddingVertical: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  primary: { color: PLATFORM_COLORS.text, fontWeight: '600', fontSize: 13 },
  meta: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  hint: { color: PLATFORM_COLORS.muted, fontSize: 15, lineHeight: 18 },
  warn: { color: PLATFORM_COLORS.danger, fontSize: 12 },
  section: { color: PLATFORM_COLORS.text, fontWeight: '700', marginTop: spacing.sm },
  label: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    color: PLATFORM_COLORS.text,
    backgroundColor: PLATFORM_COLORS.bg,
  },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  btnText: { color: PLATFORM_COLORS.text, fontWeight: '600', fontSize: 13 },
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600', fontSize: 13 },
  chipBtn: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipBtnActive: { borderColor: PLATFORM_COLORS.accent, backgroundColor: '#F1F5F9' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  btnDanger: { backgroundColor: '#3f1212', borderColor: PLATFORM_COLORS.danger },
});
