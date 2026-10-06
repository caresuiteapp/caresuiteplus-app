import { usePlatformOperation, requirePlatformResult } from '@/hooks/usePlatformOperation.web';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlatformAuditLink, PLATFORM_COLORS } from '@/components/platformConsole';
import { PlatformConfirmModal } from '@/components/platformConsole/PlatformConfirmModal.web';
import { PlatformFreeUsagePanel } from '@/components/platformConsole/PlatformFreeUsagePanel.web';
import { LoadingState } from '@/components/ui';
import type { PlatformTenantDetail } from '@/lib/platformConsole';
import { listPlatformAuditLog, listPlatformFeatureFlags, platformRoleHasCapability, setPlatformFeatureFlag } from '@/lib/platformConsole';
import { formatPlatformDate } from '@/lib/platformConsole/platformFormat';
import type { PlatformRoleKey, PlatformTenantModuleRow } from '@/types/platformConsole';
import { spacing } from '@/theme';
import { consoleLabel } from '@/lib/platformConsole/consoleWorkspaceModel';
import { platformName, platformActionLabel } from '@/lib/platformConsole/platformLanguage';

type TabProps = { tenantId: string; detail: PlatformTenantDetail; role: PlatformRoleKey | null | undefined; onReload: () => Promise<void> };

// Old imports receive the current free-usage information and perform no financial requests.
function RetiredTenantCommercialTab(props: Partial<TabProps>) { void props; return <PlatformFreeUsagePanel />; }
export const TenantCreditsTab = RetiredTenantCommercialTab;
export const TenantBillingPreviewTab = RetiredTenantCommercialTab;
export const TenantInvoicesTab = RetiredTenantCommercialTab;
export const TenantPaymentsTab = RetiredTenantCommercialTab;
export const TenantDiscountsTab = RetiredTenantCommercialTab;
export const TenantLimitsTab = RetiredTenantCommercialTab;

export function TenantEntitlementsTab({ detail }: Pick<TabProps, 'tenantId' | 'role' | 'detail'>) {
  return <View style={styles.panel}><Text style={styles.section}>Freigaben der kostenlosen Funktionsbereiche</Text>
    {detail.modules.length ? detail.modules.map(module => <View key={module.moduleKey} style={styles.row}>
      <Text style={styles.primary}>{platformName(module.moduleKey, module.moduleName)}</Text>
      <Text style={styles.meta}>{consoleLabel(module.status === 'trial' ? 'enabled' : module.status)}{module.manualOverride ? ' · Individuelle Freigabe' : ''}</Text>
    </View>) : <Text style={styles.hint}>Für dieses Unternehmen sind keine Funktionsfreigaben hinterlegt.</Text>}
    <Text style={styles.hint}>Die Freigaben steuern den Zugriff. Alle derzeit bereitgestellten Funktionen sind kostenlos.</Text>
  </View>;
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

  const issues = useMemo(() => {
    const list: string[] = [];
    if (inconsistent.length > 0) list.push('Widersprüchliche Funktionsfreigaben');
    if (modules.length > 0 && disabledModules.length === modules.length) list.push('Keine aktiven Funktionsbereiche');
    return list;
  }, [inconsistent.length, disabledModules.length, modules.length]);

  return (
    <View style={styles.panel}>
      <Info label="Unternehmensnummer" value={tenantId} />
      <Info label="Unternehmenskürzel" value={String(t.slug ?? '—')} />
      <Info label="Status" value={consoleLabel(t.status)} />
      <Info label="Nutzung" value="Kostenlos · 0 €" />
      <Info label="Aktive Funktionsbereiche" value={String(enabledModules.length)} />
      <Info label="Deaktivierte Funktionsbereiche" value={String(disabledModules.length)} />
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
      {platformName(mod.moduleKey, mod.moduleName)}: {consoleLabel(mod.status === 'trial' ? 'enabled' : mod.status)}
      {mod.manualOverride ? ' (Individuelle Freigabe)' : ''}
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
