import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PlatformAuditLink,
  PlatformConfirmModal,
  PlatformDeferredNote,
  PlatformStatusBadge,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { LoadingState, PremiumDataTable } from '@/components/ui';
import type { PlatformTenantDetail } from '@/lib/platformConsole';
import {
  assignPlatformDiscount,
  endPlatformSupportSession,
  getPlatformLimitsDeferred,
  getPlatformPlanLimits,
  listPlatformAuditLog,
  listPlatformFeatureFlags,
  listPlatformSupportSessions,
  platformRoleHasCapability,
  removePlatformDiscount,
  setPlatformFeatureFlag,
  startPlatformSupportSession,
  updatePlatformInvoiceStatus,
} from '@/lib/platformConsole';
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

export function TenantInvoicesTab({ tenantId, detail, role, onReload }: TabProps) {
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
                  if (!res.ok) return;
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
      {!canWrite ? <Text style={styles.hint}>Lesemodus (billing.write fehlt).</Text> : null}
      {auditAction ? <PlatformAuditLink tenantId={tenantId} action={auditAction} /> : null}
      <PlatformConfirmModal
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.desc ?? ''}
        loading={loading}
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) => {
          if (!confirm) return;
          setLoading(true);
          void confirm.action(reason).finally(() => {
            setLoading(false);
            setConfirm(null);
          });
        }}
      />
    </View>
  );
}

export function TenantPaymentsTab({ tenantId, detail, role }: TabProps) {
  const canRead = platformRoleHasCapability(role, 'payments.read');
  if (!canRead) return <Text style={styles.hint}>Keine Berechtigung für Zahlungen.</Text>;
  const payments = mapRecordRows(detail.payments);
  return (
    <View style={styles.panel}>
      {payments.length === 0 ? <Text style={styles.hint}>Keine Zahlungen.</Text> : null}
      {payments.map((p) => (
        <View key={String(p.id)} style={styles.row}>
          <Text style={styles.primary}>{formatPlatformCents(p.amount_cents)} · {String(p.status)}</Text>
          <Text style={styles.meta}>Provider: {String(p.provider ?? '—')}</Text>
        </View>
      ))}
      <PlatformAuditLink tenantId={tenantId} action="payment" />
      <PlatformDeferredNote phase="PLATFORM.1.3" feature="Zahlungsstatus nachträglich ändern" />
    </View>
  );
}

export function TenantDiscountsTab({ tenantId, detail, role, onReload }: TabProps) {
  const canWrite = platformRoleHasCapability(role, 'discounts.write');
  const discounts = mapRecordRows(detail.discounts);
  const [key, setKey] = useState('');
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <View style={styles.panel}>
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
                    await removePlatformDiscount(tenantId, String(d.discount_key), reason);
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
                  await assignPlatformDiscount(tenantId, key.trim(), reason);
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
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.desc ?? ''}
        loading={loading}
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) => {
          if (!confirm) return;
          setLoading(true);
          void confirm.action(reason).finally(() => {
            setLoading(false);
            setConfirm(null);
          });
        }}
      />
    </View>
  );
}

export function TenantSupportTab({ tenantId, role, onReload }: Omit<TabProps, 'detail'>) {
  const canWrite = platformRoleHasCapability(role, 'support.write');
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [durationMin, setDurationMin] = useState('60');
  const [confirm, setConfirm] = useState<{ action: (reason: string) => Promise<void>; title: string; desc: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await listPlatformSupportSessions({ tenantId });
    if (res.ok) setSessions(res.data as unknown as Record<string, unknown>[]);
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.panel}>
      {sessions.map((s) => (
        <View key={String(s.id)} style={styles.row}>
          <PlatformStatusBadge status={String(s.status)} />
          <Text style={styles.meta}>
            {s.readonly ? 'readonly' : 'WRITE'} · Ablauf {formatPlatformDate(s.expires_at)}
          </Text>
          {canWrite && s.status === 'active' ? (
            <Pressable
              onPress={() =>
                setConfirm({
                  title: 'Session beenden',
                  desc: `Session ${String(s.id)} beenden.`,
                  action: async (reason) => {
                    await endPlatformSupportSession(String(s.id), reason);
                    await load();
                    await onReload();
                  },
                })
              }
            >
              <Text style={styles.link}>Beenden</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {canWrite ? (
        <View style={styles.subPanel}>
          <TextInput style={styles.input} value={durationMin} onChangeText={setDurationMin} placeholder="Dauer Minuten" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" />
          <Pressable
            style={styles.btn}
            onPress={() =>
              setConfirm({
                title: 'Support-Session starten',
                desc: 'Readonly-Session mit Pflichtgrund.',
                action: async (reason) => {
                  const mins = Number(durationMin);
                  const expiresAt = new Date(Date.now() + mins * 60000).toISOString();
                  await startPlatformSupportSession(tenantId, reason, expiresAt, true, ['tenants.read', 'modules.read']);
                  await load();
                },
              })
            }
          >
            <Text style={styles.btnText}>Starten</Text>
          </Pressable>
          <PlatformAuditLink tenantId={tenantId} action="support.session" />
        </View>
      ) : null}
      <PlatformConfirmModal
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.desc ?? ''}
        loading={loading}
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) => {
          if (!confirm) return;
          setLoading(true);
          void confirm.action(reason).finally(() => {
            setLoading(false);
            setConfirm(null);
          });
        }}
      />
    </View>
  );
}

export function TenantFeatureFlagsTab({ tenantId, role }: Omit<TabProps, 'detail' | 'onReload'>) {
  const canWrite = platformRoleHasCapability(role, 'flags.write');
  const [flags, setFlags] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void listPlatformFeatureFlags({ tenantId }).then((res) => {
      if (res.ok) setFlags(res.data as unknown as Record<string, unknown>[]);
    });
  }, [tenantId]);

  return (
    <View style={styles.panel}>
      {flags.length === 0 ? <Text style={styles.hint}>Keine mandantenspezifischen Flags.</Text> : null}
      {flags.map((f) => (
        <View key={String(f.id)} style={styles.row}>
          <Text style={styles.primary}>{String(f.flag_key)}</Text>
          <Text style={styles.meta}>{f.enabled ? 'aktiv' : 'inaktiv'} · Rollout {String(f.rollout_percentage ?? '—')}%</Text>
        </View>
      ))}
      <PlatformAuditLink tenantId={tenantId} action="feature_flag" />
      {!canWrite ? <Text style={styles.hint}>Lesemodus — flags.write erforderlich zum Ändern.</Text> : null}
    </View>
  );
}

export function TenantLimitsTab({ detail }: Pick<TabProps, 'detail'>) {
  const plan = (detail.plan ?? {}) as Record<string, unknown>;
  const limits = getPlatformPlanLimits(plan);
  const deferred = getPlatformLimitsDeferred();

  return (
    <View style={styles.panel}>
      <Text style={styles.section}>Tariflimits (aus aktivem Plan)</Text>
      {Object.entries(limits).map(([k, v]) => (
        <View key={k} style={styles.infoRow}>
          <Text style={styles.meta}>{k}</Text>
          <Text style={styles.primary}>{v ?? '—'}</Text>
        </View>
      ))}
      <Text style={styles.section}>Nutzung / Overrides</Text>
      <Text style={styles.hint}>Nutzungsmetriken und Override-RPCs folgen in PLATFORM.1.3 — aktuell read-only.</Text>
      {deferred.map((k) => (
        <View key={k} style={styles.infoRow}>
          <Text style={styles.meta}>{k}</Text>
          <Text style={styles.primary}>— (PLATFORM.1.3)</Text>
        </View>
      ))}
    </View>
  );
}

export function TenantUsersTab() {
  return (
    <View style={styles.panel}>
      <PlatformDeferredNote
        phase="PLATFORM.1.3"
        feature="Mandantenbenutzer-Administration (sichere RPC fehlt)"
      />
      <Text style={styles.hint}>
        Geplant: Rolle, Status, letzter Login, Einladungsstatus — ohne Passwörter, Tokens oder Secrets.
      </Text>
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
    if (String(t.billing_status ?? t.billingStatus) === 'past_due') list.push('Billing past_due');
    if (openInvoices.length > 0) list.push(`${openInvoices.length} offene Rechnung(en)`);
    if (inconsistent.length > 0) list.push('Inkonsistente Modul-Overrides');
    if (disabledModules.length === modules.length) list.push('Keine aktiven Module');
    return list;
  }, [t, openInvoices.length, inconsistent.length, disabledModules.length, modules.length]);

  return (
    <View style={styles.panel}>
      <Info label="Tenant-ID" value={tenantId} />
      <Info label="Slug" value={String(t.slug ?? '—')} />
      <Info label="Status" value={String(t.status ?? '—')} />
      <Info label="Billing" value={String(t.billing_status ?? t.billingStatus ?? '—')} />
      <Info label="Aktive Module" value={String(enabledModules.length)} />
      <Info label="Deaktivierte Module" value={String(disabledModules.length)} />
      <Info label="Offene Rechnungen" value={String(openInvoices.length)} />
      <Text style={styles.section}>Erkannte Hinweise</Text>
      {issues.length === 0 ? <Text style={styles.hint}>Keine Auffälligkeiten.</Text> : null}
      {issues.map((i) => (
        <Text key={i} style={styles.warn}>
          • {i}
        </Text>
      ))}
      <Text style={styles.section}>Modul-Gating</Text>
      <Text style={styles.hint}>
        Plattform-Quelle: platform_tenant_modules. Fallback tenant_products nur wenn kein Platform-Eintrag (deprecated).
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

  useEffect(() => {
    void listPlatformAuditLog({ tenantId, limit: 50 }).then((res) => {
      if (res.ok) {
        setItems(
          res.data.items.map((a) => ({
            id: a.id,
            action: a.action,
            reason: a.reason,
            created_at: a.created_at,
          })),
        );
      }
      setLoading(false);
    });
  }, [tenantId]);

  if (loading) return <LoadingState message="Audit wird geladen…" />;

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
  hint: { color: PLATFORM_COLORS.muted, fontSize: 12, lineHeight: 18 },
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
    backgroundColor: '#132036',
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  btnText: { color: PLATFORM_COLORS.text, fontWeight: '600', fontSize: 13 },
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600', fontSize: 13 },
});
