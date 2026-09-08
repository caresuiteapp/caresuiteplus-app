import { usePlatformOperation, requirePlatformResult } from '@/hooks/usePlatformOperation.web';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PlatformAuditLink,
  PlatformConfirmModal,
  PlatformFilterChip,
  PlatformFilterChipRow,
  PlatformStatusBadge,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { LoadingState } from '@/components/ui';
import type { PlatformTenantDetail } from '@/lib/platformConsole';
import {
  assignPlatformDiscount,
  assignPlatformPlan,
  bookPlatformTenantCredit,
  cancelPlatformTenantSubscription,
  getPlatformEffectiveTenantEntitlements,
  getPlatformPlanLimits,
  listPlatformAuditLog,
  listPlatformFeatureFlags,
  listPlatformPlans,
  listPlatformTenantUsers,
  platformRoleHasCapability,
  recalculatePlatformTenantEntitlements,
  reactivatePlatformTenantSubscription,
  removePlatformDiscount,
  setPlatformFeatureFlag,
  updatePlatformPaymentStatus,
  suspendPlatformTenantSubscription,
  updatePlatformInvoiceStatus,
} from '@/lib/platformConsole';
import {
  getPlatformTenantCredits,
  listPlatformTenantAddons,
  listPlatformTenantSubscriptions,
} from '@/lib/platformConsole/platformOperatorDataService';
import { PlatformBillingPreviewPanel } from '@/components/platformConsole/PlatformBillingPreviewPanel';
import { formatPlatformCents, formatPlatformDate } from '@/lib/platformConsole/platformFormat';
import type { PlatformRoleKey, PlatformTenantModuleRow } from '@/types/platformConsole';
import { spacing } from '@/theme';

type TabProps = {
  tenantId: string;
  detail: PlatformTenantDetail;
  role: PlatformRoleKey | null | undefined;
  onReload: () => Promise<void>;
};

function mapRecordRows(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items ?? [];
}

export function TenantSubscriptionTab({ tenantId, detail, role, onReload }: TabProps) {
  const operation = usePlatformOperation();
  const canWrite = platformRoleHasCapability(role, 'plans.write');
  const [subscriptions, setSubscriptions] = useState<Record<string, unknown>[]>([]);
  const [addons, setAddons] = useState<Record<string, unknown>[]>([]);
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [planKey, setPlanKey] = useState('');
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string; danger?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditAction, setAuditAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [sub, ad, pl] = await Promise.all([
      listPlatformTenantSubscriptions(tenantId),
      listPlatformTenantAddons(tenantId),
      listPlatformPlans(),
    ]);
    if (sub.ok) setSubscriptions(sub.data); else operation.report(sub.error);
    if (ad.ok) setAddons(ad.data); else operation.report(ad.error);
    if (pl.ok) setPlans(pl.data); else operation.report(pl.error);
  }, [tenantId]);

  useEffect(() => {
    void load().catch(operation.report).finally(() => setLoading(false));
  }, [load]);

  const activeSub = subscriptions.find((s) => s.status === 'active') ?? subscriptions[0];
  const plan = (detail.plan ?? {}) as Record<string, unknown>;

  return (
    <View style={styles.panel}>
      {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
      <Text style={styles.section}>Vertrag</Text>
      {activeSub ? (
        <>
          <Info label="Status" value={String(activeSub.status ?? '—')} />
          <Info label="Plan" value={String(activeSub.plan_key ?? plan.plan_key ?? '—')} />
          <Info label="Intervall" value={String(activeSub.billing_interval ?? '—')} />
          <Info label="Periode Start" value={formatPlatformDate(activeSub.current_period_start)} />
          <Info label="Periode Ende" value={formatPlatformDate(activeSub.current_period_end)} />
          <Info label="Trial bis" value={formatPlatformDate(activeSub.trial_ends_at)} />
        </>
      ) : (
        <Text style={styles.hint}>Kein aktiver Vertrag hinterlegt.</Text>
      )}

      <Text style={styles.section}>Aktive Add-ons</Text>
      {addons.length === 0 ? <Text style={styles.hint}>Keine Add-ons.</Text> : null}
      {addons.map((a) => (
        <Text key={String(a.addon_key ?? a.id)} style={styles.meta}>
          {String(a.addon_key)} · {String(a.status ?? 'active')}
        </Text>
      ))}

      {canWrite ? (
        <View style={styles.subPanel}>
          <Text style={styles.label}>Plan zuweisen / wechseln</Text>
          <PlatformFilterChipRow>
            {plans.map((p) => (
              <PlatformFilterChip
                key={String(p.plan_key)}
                label={String(p.plan_key)}
                active={planKey === String(p.plan_key)}
                onPress={() => setPlanKey(String(p.plan_key))}
              />
            ))}
          </PlatformFilterChipRow>
          <Pressable
            style={styles.btn}
            disabled={!planKey}
            onPress={() =>
              setConfirm({
                title: 'Plan zuweisen',
                desc: `Plan ${planKey} dem Mandanten zuweisen. Entitlements werden neu berechnet.`,
                action: async (reason) => {
                  const res = await assignPlatformPlan(tenantId, planKey, reason);
                  if (!res.ok) throw new Error(res.error);
                  await requirePlatformResult(recalculatePlatformTenantEntitlements(tenantId, reason));
                  setAuditAction('subscription.plan_assigned');
                  await load().catch(operation.report);
                  await onReload();
                },
              })
            }
          >
            <Text style={styles.btnText}>Plan zuweisen</Text>
          </Pressable>

          <View style={styles.rowActions}>
            <Pressable
              style={styles.btn}
              onPress={() =>
                setConfirm({
                  title: 'Subscription pausieren',
                  desc: 'Zugriff eingeschränkt. Billing-Auswirkung prüfen.',
                  danger: true,
                  action: async (reason) => {
                    const res = await suspendPlatformTenantSubscription(tenantId, reason);
                    if (!res.ok) throw new Error(res.error);
                    setAuditAction('subscription.suspended');
                    await load().catch(operation.report);
                    await onReload();
                  },
                })
              }
            >
              <Text style={styles.btnText}>Pausieren</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() =>
                setConfirm({
                  title: 'Subscription reaktivieren',
                  desc: 'Subscription wieder aktivieren.',
                  action: async (reason) => {
                    const res = await reactivatePlatformTenantSubscription(tenantId, reason);
                    if (!res.ok) throw new Error(res.error);
                    setAuditAction('subscription.reactivated');
                    await load().catch(operation.report);
                    await onReload();
                  },
                })
              }
            >
              <Text style={styles.btnText}>Reaktivieren</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnDanger]}
              onPress={() =>
                setConfirm({
                  title: 'Subscription kündigen',
                  desc: 'Kündigung ohne Rückgängig — Grund Pflicht.',
                  danger: true,
                  action: async (reason) => {
                    const res = await cancelPlatformTenantSubscription(tenantId, reason);
                    if (!res.ok) throw new Error(res.error);
                    setAuditAction('subscription.cancelled');
                    await load().catch(operation.report);
                    await onReload();
                  },
                })
              }
            >
              <Text style={styles.btnText}>Kündigen</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>Ihr Konto hat für Verträge Leserechte.</Text>
      )}

      {auditAction ? <PlatformAuditLink tenantId={tenantId} action={auditAction} /> : null}
      <PlatformConfirmModal
        error={operation.error}
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.desc ?? ''}
        danger={confirm?.danger}
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

export function TenantEntitlementsTab({ tenantId, role }: Pick<TabProps, 'tenantId' | 'role'>) {
  const operation = usePlatformOperation();
  const canWrite = platformRoleHasCapability(role, 'plans.write');
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getPlatformEffectiveTenantEntitlements(tenantId);
    if (res.ok) setItems((res.data as Record<string, unknown>[]) ?? []); else operation.report(res.error);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void load().catch(operation.report).finally(() => setLoading(false));
  }, [load]);

  if (loading) return <LoadingState message="Berechtigungen werden geladen…" />;

  return (
    <View style={styles.panel}>
      {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
      {items.length === 0 ? <Text style={styles.hint}>Keine Berechtigungen hinterlegt.</Text> : null}
      {items.map((e, i) => (
        <View key={String(e.module_key ?? e.entitlement_key ?? i)} style={styles.row}>
          <Text style={styles.primary}>{String(e.module_key ?? e.entitlement_key ?? '—')}</Text>
          <Text style={styles.meta}>
            {String(e.access_state ?? e.status ?? '—')} · Quelle: {String(e.source ?? '—')}
            {e.limit_value != null ? ` · Limit ${String(e.limit_value)}` : ''}
          </Text>
        </View>
      ))}
      {canWrite ? (
        <Pressable
          style={styles.btn}
          onPress={() =>
            setConfirm({
              title: 'Berechtigungen aktualisieren',
              desc: 'Effektive Rechte aus Plan, Add-ons und Overrides neu berechnen.',
              action: async (reason) => {
                await requirePlatformResult(recalculatePlatformTenantEntitlements(tenantId, reason));
                await load().catch(operation.report);
              },
            })
          }
        >
          <Text style={styles.btnText}>Neu berechnen</Text>
        </Pressable>
      ) : null}
      <PlatformAuditLink tenantId={tenantId} action="entitlements.recalculated" />
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

export function TenantCreditsTab({ tenantId, role, onReload }: Pick<TabProps, 'tenantId' | 'role' | 'onReload'>) {
  const operation = usePlatformOperation();
  const canWrite = platformRoleHasCapability(role, 'billing.write');
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await getPlatformTenantCredits(tenantId);
    if (res.ok && res.data) setBalance(Number(res.data.balance_cents ?? 0)); else if (!res.ok) operation.report(res.error);
  }, [tenantId]);

  useEffect(() => {
    void load().catch(operation.report).finally(() => setLoading(false));
  }, [load]);

  return (
    <View style={styles.panel}>
      {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
      <Text style={styles.primary}>Aktuelles Guthaben: {formatPlatformCents(balance ?? 0)}</Text>
      {canWrite ? (
        <View style={styles.subPanel}>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Betrag (Cent)" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" />
          <Pressable
            style={styles.btn}
            onPress={() =>
              setConfirm({
                title: 'Credit buchen',
                desc: `${amount} Cent gutschreiben. Ledger-Eintrag append-only.`,
                action: async (reason) => {
                  const res = await bookPlatformTenantCredit(tenantId, Number(amount) || 0, reason, 'credit');
                  if (!res.ok) throw new Error(res.error);
                  await load().catch(operation.report);
                  await onReload();
                },
              })
            }
          >
            <Text style={styles.btnText}>Credit buchen</Text>
          </Pressable>
          <PlatformAuditLink tenantId={tenantId} action="credit.booked" />
        </View>
      ) : (
        <Text style={styles.hint}>Lesemodus — billing.write erforderlich.</Text>
      )}
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
  const [newStatus, setNewStatus] = useState('paid');
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);
  const [loading, setLoading] = useState(false);
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
              {String(inv.status)} · {formatPlatformCents(inv.total_cents ?? inv.amount_cents)} · Fällig:{' '}
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
          <TextInput style={styles.input} value={newStatus} onChangeText={setNewStatus} placeholder="paid, open, …" placeholderTextColor={PLATFORM_COLORS.muted} />
          <Pressable
            style={styles.btn}
            onPress={() =>
              setConfirm({
                title: 'Rechnungsstatus ändern',
                desc: `Status → ${newStatus}. Grund Pflicht.`,
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
  const [loading, setLoading] = useState(false);
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
      <PlatformConfirmModal error={operation.error} visible={Boolean(confirm)} title="Zahlungsstatus berichtigen" description={`Zahlung als ${confirm?.status ?? ''} markieren.`} loading={operation.busy} onCancel={() => { setConfirm(null); operation.clear(); }} onConfirm={(reason) => {
        if (!confirm) return; void operation.run(async () => { await requirePlatformResult(updatePlatformPaymentStatus(confirm.paymentId, confirm.status, reason)); await onReload(); }).then(saved => { if (saved) setConfirm(null); });
      }} />
    </View>
  );
}

export function TenantDiscountsTab({ tenantId, detail, role, onReload }: TabProps) {
  const operation = usePlatformOperation();
  const canWrite = platformRoleHasCapability(role, 'discounts.write');
  const discounts = mapRecordRows(detail.discounts);
  const [key, setKey] = useState('');
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <View style={styles.panel}>
      {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
      {discounts.map((d) => (
        <View key={String(d.id ?? d.discount_key)} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.primary}>{String(d.discount_key)}</Text>
            <Text style={styles.meta}>
              {String(d.status)} · {formatPlatformDate(d.starts_at)} – {formatPlatformDate(d.ends_at)}
            </Text>
          </View>
          {canWrite && d.status === 'active' ? (
            <Pressable
              onPress={() =>
                setConfirm({
                  title: 'Rabatt entfernen',
                  desc: `Rabatt ${String(d.discount_key)} widerrufen.`,
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
          <TextInput style={styles.input} value={key} onChangeText={setKey} placeholder="discount_key" placeholderTextColor={PLATFORM_COLORS.muted} />
          <Pressable
            style={styles.btn}
            onPress={() =>
              setConfirm({
                title: 'Rabatt zuweisen',
                desc: `Rabatt ${key} zuweisen.`,
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
    </View>
  );
}

export function TenantSupportTab({ tenantId }: Omit<TabProps, 'detail'>) {
  const router = useRouter();
  return <View style={styles.panel}><Text style={styles.section}>Support & Freigaben</Text><Text style={styles.hint}>Support-Nachrichten und zeitlich begrenzte Datenfreigaben werden gemeinsam am Ticket verwaltet.</Text><Pressable accessibilityRole="button" style={styles.btn} onPress={() => router.push('/platform/support' as never)}><Text style={styles.btnText}>Support-Zentrale öffnen</Text></Pressable><PlatformAuditLink tenantId={tenantId} action="support" /></View>;
}

export function TenantFeatureFlagsTab({ tenantId, role }: Omit<TabProps, 'detail' | 'onReload'>) {
  const operation = usePlatformOperation();
  const canWrite = platformRoleHasCapability(role, 'flags.write');
  const [flags, setFlags] = useState<Record<string, unknown>[]>([]);
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await listPlatformFeatureFlags({ tenantId });
    if (res.ok) setFlags(res.data as unknown as Record<string, unknown>[]); else operation.report(res.error);
  }, [tenantId]);

  useEffect(() => {
    void load().catch(operation.report).finally(() => setLoading(false));
  }, [load]);

  return (
    <View style={styles.panel}>
      {operation.error ? <Text accessibilityRole="alert" style={styles.operationError}>{operation.error}</Text> : null}
      {flags.length === 0 ? <Text style={styles.hint}>Keine mandantenspezifischen Flags.</Text> : null}
      {flags.map((f) => (
        <View key={String(f.id)} style={styles.row}>
          <Text style={styles.primary}>{String(f.flag_key)}</Text>
          <Text style={styles.meta}>{f.enabled ? 'aktiv' : 'inaktiv'} · Rollout {String(f.rollout_percentage ?? '—')}%</Text>
          {canWrite ? (
            <Pressable
              onPress={() =>
                setConfirm({
                  title: f.enabled ? 'Flag deaktivieren' : 'Flag aktivieren',
                  desc: `${String(f.flag_key)} für Mandant ${tenantId.slice(0, 8)}…`,
                  action: async (reason) => {
                    await requirePlatformResult(setPlatformFeatureFlag(String(f.flag_key), !f.enabled, reason, {
                      scope: 'tenant',
                      tenantId,
                    }));
                    await load().catch(operation.report);
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
      <Text style={styles.section}>Tariflimits (aus aktivem Plan)</Text>
      {Object.entries(limits).map(([k, v]) => (
        <View key={k} style={styles.infoRow}>
          <Text style={styles.meta}>{k}</Text>
          <Text style={styles.primary}>{v ?? '—'}</Text>
        </View>
      ))}
      <Text style={styles.hint}>Es werden ausschließlich wirksame Tariflimits angezeigt. Nicht konfigurierte Limits gelten als unbegrenzt.</Text>
    </View>
  );
}

export function TenantUsersTab({ tenantId }: { tenantId: string }) {
  const [users, setUsers] = useState<{ id: string; display_name: string | null; email: string | null; phone: string | null; role_key: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true; setLoading(true); setError(null); setUsers([]);
    void listPlatformTenantUsers(tenantId).then(result => {
      if (!active) return;
      if (result.ok) setUsers(result.data); else setError(result.error);
    }).catch(() => { if (active) setError('Die Benutzerliste konnte nicht geladen werden. Bitte die Ansicht erneut öffnen.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId]);
  return (
    <View style={styles.panel}>
      <Text style={styles.section}>Mandantenbenutzer</Text>
      {loading ? <LoadingState message="Benutzer werden geladen…" /> : error ? <Text style={styles.hint}>{error}</Text> : users.length === 0 ? <Text style={styles.hint}>Für diesen Mandanten sind keine Benutzerprofile vorhanden.</Text> : users.map((user) => <View key={user.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.primary}>{user.display_name || user.email || 'Ohne Namen'}</Text><Text style={styles.meta}>{user.email || 'Keine E-Mail'} · {String(user.role_key || 'Keine Rolle')}</Text>{user.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}</View></View>)}
      <Text style={styles.hint}>Einladungen und Rollenwechsel werden innerhalb des Mandanten in Office → Zugänge verwaltet; hier erfolgt die plattformweite Kontrolle ohne Passwörter oder Tokens.</Text>
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
      <Info label="Tenant-ID" value={tenantId} />
      <Info label="Slug" value={String(t.slug ?? '—')} />
      <Info label="Status" value={String(t.status ?? '—')} />
      <Info label="Billing" value={String(t.billing_status ?? t.billingStatus ?? '—')} />
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
      <Text style={styles.section}>Letzte Audit-Einträge</Text>
      {audit.map((a) => (
        <Text key={a.created_at + a.action} style={styles.meta}>
          {a.action} · {formatPlatformDate(a.created_at)}
        </Text>
      ))}
      <PlatformAuditLink tenantId={tenantId} />
      <Text style={styles.hint}>Keine automatische Reparatur — nur Diagnose.</Text>
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

  if (loading) return <LoadingState message="Audit wird geladen…" />;
  if (error) return <View style={styles.panel}><Text accessibilityRole="alert" style={styles.operationError}>{error}</Text><PlatformAuditLink tenantId={tenantId} label="Vollständiges Protokoll öffnen" /></View>;

  return (
    <View style={styles.panel}>
      {items.length === 0 ? <Text style={styles.hint}>Keine Audit-Einträge.</Text> : null}
      {items.map((e) => (
        <View key={e.id} style={styles.row}>
          <Text style={styles.primary}>{e.action}</Text>
          <Text style={styles.meta}>{formatPlatformDate(e.created_at)}</Text>
          {e.reason ? <Text style={styles.meta}>Grund: {e.reason}</Text> : null}
        </View>
      ))}
      <Text style={styles.hint}>Audit ist unveränderlich (read-only).</Text>
      <PlatformAuditLink tenantId={tenantId} label="Vollständiges Audit öffnen" />
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
      {mod.moduleKey}: {mod.status}
      {mod.manualOverride ? ' (Override)' : ''}
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
