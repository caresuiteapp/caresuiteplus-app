import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PlatformAuditLink,
  PlatformConfirmModal,
  PlatformDataTable,
  PlatformFilterChip,
  PlatformFilterChipRow,
  PlatformFormField,
  PlatformReadOnlyBanner,
  PlatformShellLayout,
  PlatformStatusBadge,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import {
  assignPlatformPlanModule,
  createPlatformPlan,
  createPlatformPlanVersion,
  listPlatformModules,
  listPlatformPlans,
  platformRoleHasCapability,
  removePlatformPlanModule,
  setPlatformPlanLimit,
  updatePlatformPlan,
} from '@/lib/platformConsole';
import {
  listPlatformPlanLimits,
  listPlatformPlanModules,
  listPlatformPlanVersions,
} from '@/lib/platformConsole/platformOperatorDataService';
import { formatPlatformCents, formatPlatformDate, parsePlatformEurosToCents } from '@/lib/platformConsole/platformFormat';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { resolvePlatformPlanRowKey } from '@/lib/platformConsole/platformRowKeys';
import { spacing } from '@/theme';

const ACCESS_STATES = ['included', 'beta_included', 'coming_soon', 'excluded'] as const;

type ConfirmState = {
  title: string;
  description: string;
  danger?: boolean;
  action: (reason: string) => Promise<void>;
};

export function PlatformPlansOperatorScreen() {
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'plans.write');
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [modules, setModules] = useState<Record<string, unknown>[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [planModules, setPlanModules] = useState<Record<string, unknown>[]>([]);
  const [planLimits, setPlanLimits] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);

  const [newPlanKey, setNewPlanKey] = useState('');
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newMonthly, setNewMonthly] = useState('99,00');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [versionMonthly, setVersionMonthly] = useState('');
  const [versionYearly, setVersionYearly] = useState('');
  const [moduleKey, setModuleKey] = useState('');
  const [moduleState, setModuleState] = useState<string>(ACCESS_STATES[0]);
  const [limitKey, setLimitKey] = useState('');
  const [limitValue, setLimitValue] = useState('');

  const selectedPlan = useMemo(
    () => plans.find((p) => String(p.plan_key) === selectedKey),
    [plans, selectedKey],
  );

  const activeVersion = useMemo(
    () => versions.find((v) => v.status === 'active') ?? versions[0],
    [versions],
  );

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [planRes, modRes] = await Promise.all([listPlatformPlans(), listPlatformModules()]);
    if (!planRes.ok) {
      setError(planRes.error);
      setLoading(false);
      return;
    }
    setPlans(planRes.data);
    if (modRes.ok) setModules(modRes.data);
    setLoading(false);
  }, []);

  const loadPlanDetail = useCallback(async (planKey: string) => {
    if (!planKey) return;
    setDetailLoading(true);
    const verRes = await listPlatformPlanVersions(planKey);
    if (!verRes.ok) {
      setDetailLoading(false);
      return;
    }
    setVersions(verRes.data);
    const version = verRes.data.find((v) => v.status === 'active') ?? verRes.data[0];
    if (version?.id) {
      const [modRes, limRes] = await Promise.all([
        listPlatformPlanModules(String(version.id)),
        listPlatformPlanLimits(String(version.id)),
      ]);
      if (modRes.ok) setPlanModules(modRes.data);
      if (limRes.ok) setPlanLimits(limRes.data);
    } else {
      setPlanModules([]);
      setPlanLimits([]);
    }
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (selectedKey) void loadPlanDetail(selectedKey);
  }, [selectedKey, loadPlanDetail]);

  useEffect(() => {
    if (selectedPlan) {
      setEditName(String(selectedPlan.plan_name ?? ''));
      setEditDesc(String(selectedPlan.description ?? ''));
    }
  }, [selectedPlan]);

  async function runConfirm(reason: string) {
    if (!confirm) return;
    setConfirmLoading(true);
    await confirm.action(reason);
    setConfirmLoading(false);
    setConfirm(null);
    await loadPlans();
    if (selectedKey) await loadPlanDetail(selectedKey);
  }

  return (
    <PlatformShellLayout title="Tarife" subtitle="Pläne, Versionen, Module und Limits operativ verwalten">
      {!canWrite ? (
        <PlatformReadOnlyBanner message="Lesemodus — Tarifänderungen erfordern plans.write." />
      ) : null}

      {loading ? (
        <LoadingState message="Tarife werden geladen…" />
      ) : error ? (
        <ErrorState title="Tarife nicht verfügbar" message={error} onRetry={() => void loadPlans()} />
      ) : (
        <>
          <PlatformDataTable
              columns={[
                { key: 'key', label: 'Code', minWidth: 120, render: (r) => String(r.plan_key) },
                { key: 'name', label: 'Name', minWidth: 160, render: (r) => String(r.plan_name ?? '—') },
                {
                  key: 'status',
                  label: 'Status',
                  minWidth: 100,
                  render: (r) => <PlatformStatusBadge status={String(r.status ?? 'active')} />,
                },
                {
                  key: 'price',
                  label: 'Preis/Monat',
                  minWidth: 120,
                  render: (r) => formatPlatformCents(r.monthly_price_cents),
                },
                {
                  key: 'public',
                  label: 'Sichtbar',
                  minWidth: 100,
                  render: (r) => (r.is_public ? 'öffentlich' : 'intern'),
                },
                {
                  key: 'open',
                  label: '',
                  minWidth: 80,
                  render: (r) => (
                    <Pressable onPress={() => setSelectedKey(String(r.plan_key))}>
                      <Text style={styles.link}>Details</Text>
                    </Pressable>
                  ),
                },
              ]}
              data={plans}
              keyExtractor={resolvePlatformPlanRowKey}
              emptyTitle="Keine Tarife"
              emptyMessage="Der Tarifkatalog ist leer."
            />

          {canWrite ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>Tarif erstellen</Text>
              <PlatformFormField label="Interner Tarifcode" required hint="Kurzer stabiler Code, z. B. professional."><TextInput style={styles.input} value={newPlanKey} onChangeText={setNewPlanKey} placeholder="professional" placeholderTextColor={PLATFORM_COLORS.muted} /></PlatformFormField>
              <PlatformFormField label="Tarifname" required><TextInput style={styles.input} value={newPlanName} onChangeText={setNewPlanName} placeholder="Professional" placeholderTextColor={PLATFORM_COLORS.muted} /></PlatformFormField>
              <PlatformFormField label="Leistungsbeschreibung"><TextInput style={styles.input} value={newPlanDesc} onChangeText={setNewPlanDesc} placeholder="Zielgruppe und enthaltene Leistungen" placeholderTextColor={PLATFORM_COLORS.muted} multiline /></PlatformFormField>
              <PlatformFormField label="Monatspreis in Euro" required hint="Dezimalbetrag, z. B. 299,00"><TextInput style={styles.input} value={newMonthly} onChangeText={setNewMonthly} placeholder="299,00" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="decimal-pad" /></PlatformFormField>
              <Pressable
                style={[styles.primaryBtn, (!newPlanKey.trim() || !newPlanName.trim() || parsePlatformEurosToCents(newMonthly) === null) && styles.disabledBtn]}
                disabled={!newPlanKey.trim() || !newPlanName.trim() || parsePlatformEurosToCents(newMonthly) === null}
                onPress={() =>
                  setConfirm({
                    title: 'Tarif erstellen',
                    description: `Neuer Tarif „${newPlanName || newPlanKey}". Grund ist Pflicht.`,
                    action: async (reason) => {
                      const res = await createPlatformPlan(newPlanKey.trim(), newPlanName.trim(), reason, {
                        description: newPlanDesc.trim() || undefined,
                        monthlyPriceCents: parsePlatformEurosToCents(newMonthly) ?? 0,
                      });
                      if (!res.ok) throw new Error(res.error);
                      setLastAuditAction('plan.created');
                      setSelectedKey(newPlanKey.trim());
                    },
                  })
                }
              >
                <Text style={styles.primaryBtnText}>Tarif anlegen</Text>
              </Pressable>
            </View>
          ) : null}

          {selectedPlan ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>
                {String(selectedPlan.plan_name)} ({selectedKey})
              </Text>
              {detailLoading ? <LoadingState message="Details laden…" /> : null}

              {canWrite ? (
                <>
                  <Text style={styles.label}>Tarif bearbeiten</Text>
                  <PlatformFormField label="Tarifname" required><TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Name" placeholderTextColor={PLATFORM_COLORS.muted} /></PlatformFormField>
                  <PlatformFormField label="Leistungsbeschreibung"><TextInput style={styles.input} value={editDesc} onChangeText={setEditDesc} placeholder="Beschreibung" placeholderTextColor={PLATFORM_COLORS.muted} multiline /></PlatformFormField>
                  <Pressable
                    style={[styles.primaryBtn, !editName.trim() && styles.disabledBtn]}
                    disabled={!editName.trim()}
                    onPress={() =>
                      setConfirm({
                        title: 'Tarif aktualisieren',
                        description: `Metadaten für ${selectedKey} speichern.`,
                        action: async (reason) => {
                          const res = await updatePlatformPlan(selectedKey, reason, {
                            planName: editName.trim(),
                            description: editDesc.trim(),
                          });
                          if (!res.ok) throw new Error(res.error);
                          setLastAuditAction('plan.updated');
                        },
                      })
                    }
                  >
                    <Text style={styles.primaryBtnText}>Speichern</Text>
                  </Pressable>

                  <Text style={styles.sectionTitle}>Neue Plan-Version</Text>
                  <PlatformFormField label="Monatspreis in Euro" required><TextInput style={styles.input} value={versionMonthly} onChangeText={setVersionMonthly} placeholder="299,00" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="decimal-pad" /></PlatformFormField>
                  <PlatformFormField label="Jahrespreis in Euro" required><TextInput style={styles.input} value={versionYearly} onChangeText={setVersionYearly} placeholder="2.990,00" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="decimal-pad" /></PlatformFormField>
                  <Pressable
                    style={[styles.primaryBtn, (parsePlatformEurosToCents(versionMonthly) === null || parsePlatformEurosToCents(versionYearly) === null) && styles.disabledBtn]}
                    disabled={parsePlatformEurosToCents(versionMonthly) === null || parsePlatformEurosToCents(versionYearly) === null}
                    onPress={() =>
                      setConfirm({
                        title: 'Plan-Version erstellen',
                        description: `Neue Preisversion für ${selectedKey}. Alte Version bleibt erhalten.`,
                        action: async (reason) => {
                          const res = await createPlatformPlanVersion(
                            selectedKey,
                            reason,
                            parsePlatformEurosToCents(versionMonthly) ?? 0,
                            parsePlatformEurosToCents(versionYearly) ?? 0,
                          );
                          if (!res.ok) throw new Error(res.error);
                          setLastAuditAction('plan.version_created');
                        },
                      })
                    }
                  >
                    <Text style={styles.primaryBtnText}>Version erstellen</Text>
                  </Pressable>
                </>
              ) : null}

              <Text style={styles.sectionTitle}>Versionen</Text>
              {versions.map((v) => (
                <Text key={String(v.id ?? v.version_number)} style={styles.hint}>
                  v{String(v.version_number)} · {formatPlatformCents(v.monthly_price_cents)} ·{' '}
                  {String(v.status)} · ab {formatPlatformDate(v.effective_from)}
                </Text>
              ))}

              {activeVersion?.id && canWrite ? (
                <>
                  <Text style={styles.sectionTitle}>Module (aktive Version)</Text>
                  {planModules.map((m) => (
                    <View key={String(m.module_key)} style={styles.rowBetween}>
                      <Text style={styles.hint}>
                        {String(m.module_key)} · {String(m.access_state)}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setConfirm({
                            title: 'Modul entfernen',
                            description: `${String(m.module_key)} aus Plan entfernen.`,
                            danger: true,
                            action: async (reason) => {
                              const res = await removePlatformPlanModule(String(activeVersion.id), String(m.module_key), reason);
                              if (!res.ok) throw new Error(res.error);
                              setLastAuditAction('plan.module_removed');
                            },
                          })
                        }
                      >
                        <Text style={styles.linkDanger}>Entfernen</Text>
                      </Pressable>
                    </View>
                  ))}
                  <PlatformFormField label="Modulcode" required hint="Wählen Sie einen Code aus dem Modulkatalog."><TextInput style={styles.input} value={moduleKey} onChangeText={setModuleKey} placeholder="z. B. assist" placeholderTextColor={PLATFORM_COLORS.muted} /></PlatformFormField>
                  <PlatformFilterChipRow>
                    {ACCESS_STATES.map((s) => (
                      <PlatformFilterChip key={s} label={s} active={moduleState === s} onPress={() => setModuleState(s)} />
                    ))}
                  </PlatformFilterChipRow>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() =>
                      setConfirm({
                        title: 'Modul zu Plan hinzufügen',
                        description: `${moduleKey} als ${moduleState} zuweisen.`,
                        action: async (reason) => {
                          const res = await assignPlatformPlanModule(
                            String(activeVersion.id),
                            moduleKey.trim(),
                            moduleState,
                            reason,
                          );
                          if (!res.ok) throw new Error(res.error);
                          setLastAuditAction('plan.module_assigned');
                        },
                      })
                    }
                  >
                    <Text style={styles.primaryBtnText}>Modul hinzufügen</Text>
                  </Pressable>

                  <Text style={styles.sectionTitle}>Limits</Text>
                  {planLimits.map((l) => (
                    <Text key={String(l.limit_key)} style={styles.hint}>
                      {String(l.limit_key)} = {String(l.limit_value)}
                    </Text>
                  ))}
                  <PlatformFormField label="Limit" required hint="z. B. Maximale Benutzeranzahl"><TextInput style={styles.input} value={limitKey} onChangeText={setLimitKey} placeholder="max_users" placeholderTextColor={PLATFORM_COLORS.muted} /></PlatformFormField>
                  <PlatformFormField label="Grenzwert" required><TextInput style={styles.input} value={limitValue} onChangeText={setLimitValue} placeholder="25" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" /></PlatformFormField>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() =>
                      setConfirm({
                        title: 'Plan-Limit setzen',
                        description: `${limitKey} = ${limitValue}`,
                        action: async (reason) => {
                          const res = await setPlatformPlanLimit(
                            String(activeVersion.id),
                            limitKey.trim(),
                            Number(limitValue) || 0,
                            reason,
                          );
                          if (!res.ok) throw new Error(res.error);
                          setLastAuditAction('plan.limit_set');
                        },
                      })
                    }
                  >
                    <Text style={styles.primaryBtnText}>Limit setzen</Text>
                  </Pressable>
                </>
              ) : null}

              {modules.length > 0 && !canWrite ? (
                <Text style={styles.hint}>{modules.length} Module im Katalog verfügbar.</Text>
              ) : null}
            </View>
          ) : null}

          {lastAuditAction ? (
            <View style={styles.auditRow}>
              <PlatformAuditLink action={lastAuditAction} label="Letzte Aktion im Audit" />
            </View>
          ) : null}
        </>
      )}

      <PlatformConfirmModal
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        danger={confirm?.danger}
        loading={confirmLoading}
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) => void runConfirm(reason)}
      />
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
  formPanel: {
    marginTop: spacing.md,
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { color: PLATFORM_COLORS.text, fontWeight: '700', marginTop: spacing.sm },
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.accent,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  primaryBtnText: { color: PLATFORM_COLORS.accent, fontWeight: '700' },
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600' },
  linkDanger: { color: PLATFORM_COLORS.danger, fontWeight: '600', fontSize: 12 },
  hint: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  auditRow: { flexDirection: 'row', marginTop: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  disabledBtn: { opacity: 0.45 },
});
