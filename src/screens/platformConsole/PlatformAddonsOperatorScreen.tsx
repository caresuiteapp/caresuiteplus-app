import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PlatformAuditLink,
  PlatformConfirmModal,
  PlatformDataTable,
  PlatformReadOnlyBanner,
  PlatformShellLayout,
  PlatformStatusBadge,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import {
  assignPlatformAddonToTenant,
  createPlatformAddon,
  createPlatformAddonVersion,
  platformRoleHasCapability,
  recalculatePlatformTenantEntitlements,
  removePlatformAddonFromTenant,
  updatePlatformAddon,
  validatePlatformAddonKey,
} from '@/lib/platformConsole';
import {
  listPlatformAddonVersions,
  listPlatformAddonsCatalog,
} from '@/lib/platformConsole/platformOperatorDataService';
import { formatPlatformCents, formatPlatformDate } from '@/lib/platformConsole/platformFormat';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { resolvePlatformAddonRowKey } from '@/lib/platformConsole/platformRowKeys';
import { spacing } from '@/theme';

type ConfirmState = {
  title: string;
  description: string;
  action: (reason: string) => Promise<void>;
  danger?: boolean;
};

export function PlatformAddonsOperatorScreen() {
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'plans.write');
  const [addons, setAddons] = useState<Record<string, unknown>[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMonthly, setNewMonthly] = useState('1500');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [versionMonthly, setVersionMonthly] = useState('');
  const [versionYearly, setVersionYearly] = useState('');
  const [assignTenantId, setAssignTenantId] = useState('');
  const [assignOverride, setAssignOverride] = useState('');

  const selected = useMemo(
    () => addons.find((a) => String(a.addon_key) === selectedKey),
    [addons, selectedKey],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listPlatformAddonsCatalog();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setAddons(res.data);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (addonKey: string) => {
    if (!addonKey) return;
    setDetailLoading(true);
    const res = await listPlatformAddonVersions(addonKey);
    if (res.ok) setVersions(res.data);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedKey) void loadDetail(selectedKey);
  }, [selectedKey, loadDetail]);

  useEffect(() => {
    if (selected) {
      setEditName(String(selected.addon_name ?? ''));
      setEditDesc(String(selected.description ?? ''));
    }
  }, [selected]);

  async function runConfirm(reason: string) {
    if (!confirm) return;
    setConfirmLoading(true);
    await confirm.action(reason);
    setConfirmLoading(false);
    setConfirm(null);
    await load();
    if (selectedKey) await loadDetail(selectedKey);
  }

  return (
    <PlatformShellLayout title="Add-ons" subtitle="Add-on-Katalog, Versionen und Mandantenzuweisungen">
      {!canWrite ? (
        <PlatformReadOnlyBanner message="Lesemodus — Add-on-Änderungen erfordern plans.write." />
      ) : null}

      {loading ? (
        <LoadingState message="Add-ons werden geladen…" />
      ) : error ? (
        <ErrorState title="Add-ons nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <>
          <PlatformDataTable
              columns={[
                { key: 'key', label: 'Code', minWidth: 120, render: (r) => String(r.addon_key || '—') },
                { key: 'name', label: 'Name', minWidth: 160, render: (r) => String(r.addon_name ?? '—') },
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
                  key: 'open',
                  label: '',
                  minWidth: 80,
                  render: (r) => {
                    const rowKey = resolvePlatformAddonRowKey(r, 0);
                    return (
                      <Pressable onPress={() => setSelectedKey(String(r.addon_key ?? rowKey))}>
                        <Text style={styles.link}>Details</Text>
                      </Pressable>
                    );
                  },
                },
              ]}
              data={addons}
              keyExtractor={resolvePlatformAddonRowKey}
              emptyTitle="Keine Add-ons"
              emptyMessage="Der Katalog ist leer oder noch nicht synchronisiert."
            />

          {canWrite ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>Add-on erstellen</Text>
              <TextInput style={styles.input} value={newKey} onChangeText={setNewKey} placeholder="addon_key" placeholderTextColor={PLATFORM_COLORS.muted} />
              <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Name" placeholderTextColor={PLATFORM_COLORS.muted} />
              <TextInput style={styles.input} value={newDesc} onChangeText={setNewDesc} placeholder="Beschreibung" placeholderTextColor={PLATFORM_COLORS.muted} />
              <TextInput style={styles.input} value={newMonthly} onChangeText={setNewMonthly} placeholder="Monatspreis (Cent)" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" />
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  const addonKey = newKey.trim();
                  const addonName = newName.trim();
                  const addonDesc = newDesc.trim();
                  const monthlyCents = Number(newMonthly) || 0;
                  const keyError = validatePlatformAddonKey(addonKey);
                  if (keyError) {
                    setFormError(keyError);
                    return;
                  }
                  if (!addonName) {
                    setFormError('Add-on-Name ist Pflicht.');
                    return;
                  }
                  setFormError(null);
                  setConfirm({
                    title: 'Add-on erstellen',
                    description: `Neues Add-on „${addonName}" (${addonKey}).`,
                    action: async (reason) => {
                      const res = await createPlatformAddon(addonKey, addonName, reason, {
                        description: addonDesc || undefined,
                        monthlyPriceCents: monthlyCents,
                      });
                      if (!res.ok) throw new Error(res.error);
                      setLastAuditAction('addon.created');
                      setSelectedKey(addonKey);
                      setNewKey('');
                      setNewName('');
                      setNewDesc('');
                      setNewMonthly('1500');
                    },
                  });
                }}
              >
                <Text style={styles.primaryBtnText}>Add-on anlegen</Text>
              </Pressable>
            </View>
          ) : null}

          {selected ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>
                {String(selected.addon_name)} ({selectedKey})
              </Text>
              {detailLoading ? <LoadingState message="Versionen laden…" /> : null}

              {canWrite ? (
                <>
                  <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Name" placeholderTextColor={PLATFORM_COLORS.muted} />
                  <TextInput style={styles.input} value={editDesc} onChangeText={setEditDesc} placeholder="Beschreibung" placeholderTextColor={PLATFORM_COLORS.muted} />
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() =>
                      setConfirm({
                        title: 'Add-on bearbeiten',
                        description: `Metadaten für ${selectedKey} speichern.`,
                        action: async (reason) => {
                          const res = await updatePlatformAddon(selectedKey, reason, {
                            addonName: editName.trim(),
                            description: editDesc.trim(),
                          });
                          if (!res.ok) throw new Error(res.error);
                          setLastAuditAction('addon.updated');
                        },
                      })
                    }
                  >
                    <Text style={styles.primaryBtnText}>Speichern</Text>
                  </Pressable>

                  <Text style={styles.sectionTitle}>Neue Add-on-Version</Text>
                  <TextInput style={styles.input} value={versionMonthly} onChangeText={setVersionMonthly} placeholder="Monat (Cent)" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" />
                  <TextInput style={styles.input} value={versionYearly} onChangeText={setVersionYearly} placeholder="Jahr (Cent)" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" />
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() =>
                      setConfirm({
                        title: 'Add-on-Version erstellen',
                        description: `Neue Preisversion für ${selectedKey}.`,
                        action: async (reason) => {
                          const res = await createPlatformAddonVersion(
                            selectedKey,
                            reason,
                            Number(versionMonthly) || 0,
                            Number(versionYearly) || 0,
                          );
                          if (!res.ok) throw new Error(res.error);
                          setLastAuditAction('addon.version_created');
                        },
                      })
                    }
                  >
                    <Text style={styles.primaryBtnText}>Version erstellen</Text>
                  </Pressable>

                  <Text style={styles.sectionTitle}>Mandant zuweisen</Text>
                  <TextInput style={styles.input} value={assignTenantId} onChangeText={setAssignTenantId} placeholder="tenant_id (UUID)" placeholderTextColor={PLATFORM_COLORS.muted} />
                  <TextInput style={styles.input} value={assignOverride} onChangeText={setAssignOverride} placeholder="Preis-Override (Cent, optional)" placeholderTextColor={PLATFORM_COLORS.muted} keyboardType="numeric" />
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => {
                      const tenantId = assignTenantId.trim();
                      const overrideCents = assignOverride ? Number(assignOverride) : null;
                      if (!tenantId) {
                        setFormError('Mandanten-ID ist Pflicht.');
                        return;
                      }
                      setFormError(null);
                      setConfirm({
                        title: 'Add-on Mandant zuweisen',
                        description: `${selectedKey} → Mandant ${tenantId.slice(0, 8)}… Entitlements werden neu berechnet.`,
                        action: async (reason) => {
                          const res = await assignPlatformAddonToTenant(tenantId, selectedKey, reason, {
                            priceOverrideCents: overrideCents,
                          });
                          if (!res.ok) throw new Error(res.error);
                          await recalculatePlatformTenantEntitlements(tenantId, reason);
                          setLastAuditAction('addon.assigned');
                        },
                      });
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Zuweisen + Entitlements</Text>
                  </Pressable>

                  <Text style={styles.sectionTitle}>Mandant entfernen</Text>
                  <Pressable
                    style={[styles.primaryBtn, styles.dangerBtn]}
                    onPress={() => {
                      const tenantId = assignTenantId.trim();
                      if (!tenantId) {
                        setFormError('Mandanten-ID ist Pflicht.');
                        return;
                      }
                      setFormError(null);
                      setConfirm({
                        title: 'Add-on von Mandant entfernen',
                        description: `${selectedKey} vom Mandanten ${tenantId.slice(0, 8)}… entfernen.`,
                        danger: true,
                        action: async (reason) => {
                          const res = await removePlatformAddonFromTenant(tenantId, selectedKey, reason);
                          if (!res.ok) throw new Error(res.error);
                          await recalculatePlatformTenantEntitlements(tenantId, reason);
                          setLastAuditAction('addon.removed');
                        },
                      });
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Entfernen</Text>
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
            </View>
          ) : null}

          {lastAuditAction ? (
            <PlatformAuditLink action={lastAuditAction} label="Letzte Aktion im Audit" />
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
  dangerBtn: { borderColor: PLATFORM_COLORS.danger },
  primaryBtnText: { color: PLATFORM_COLORS.accent, fontWeight: '700' },
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600' },
  hint: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  formError: { color: PLATFORM_COLORS.danger, fontSize: 13 },
});
