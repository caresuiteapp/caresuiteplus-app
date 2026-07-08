import { useCallback, useEffect, useMemo, useState } from 'react';

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLocalSearchParams } from 'expo-router';

import {

  PlatformAuditLink,

  PlatformConfirmModal,

  PlatformShellLayout,

  PLATFORM_COLORS,

} from '@/components/platformConsole';

import { ErrorState, LoadingState, SegmentedTabs } from '@/components/ui';

import {

  getPlatformTenantDetail,

  platformRoleHasCapability,

  setPlatformTenantModule,

  updatePlatformTenantStatus,

} from '@/lib/platformConsole';

import type { PlatformTenantDetail } from '@/lib/platformConsole';

import type { PlatformTenantModuleRow } from '@/types/platformConsole';

import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';

import {

  TenantAuditTab,

  TenantBillingPreviewTab,

  TenantCreditsTab,

  TenantDiagnosisTab,

  TenantDiscountsTab,

  TenantEntitlementsTab,

  TenantFeatureFlagsTab,

  TenantInvoicesTab,

  TenantLimitsTab,

  TenantPaymentsTab,

  TenantSubscriptionTab,

  TenantSupportTab,

  TenantUsersTab,

} from './PlatformTenantOperatorTabs';

import { spacing } from '@/theme';



const TABS = [

  { key: 'overview', label: 'Übersicht' },

  { key: 'subscription', label: 'Subscription' },

  { key: 'entitlements', label: 'Entitlements' },

  { key: 'modules', label: 'Module' },

  { key: 'billing', label: 'Rechnungen' },

  { key: 'preview', label: 'Billing Preview' },

  { key: 'credits', label: 'Credits' },

  { key: 'payments', label: 'Zahlungen' },

  { key: 'discounts', label: 'Rabatte' },

  { key: 'support', label: 'Support' },

  { key: 'flags', label: 'Feature Flags' },

  { key: 'limits', label: 'Limits' },

  { key: 'users', label: 'Benutzer' },

  { key: 'diagnosis', label: 'Diagnose' },

  { key: 'audit', label: 'Audit' },

] as const;



type TabKey = (typeof TABS)[number]['key'];



export function PlatformTenantDetailScreen() {

  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();

  const { platformUser } = usePlatformAuth();

  const [detail, setDetail] = useState<PlatformTenantDetail | null>(null);

  const [tab, setTab] = useState<TabKey>('overview');

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<{

    title: string;

    description: string;

    action: (reason: string) => Promise<void>;

    danger?: boolean;

    typed?: string;

    auditAction?: string;

  } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);



  const canWrite = platformRoleHasCapability(platformUser?.role, 'tenants.suspend');

  const canModules = platformRoleHasCapability(platformUser?.role, 'modules.write');



  const load = useCallback(async () => {

    if (!tenantId) return;

    setLoading(true);

    setError(null);

    const result = await getPlatformTenantDetail(String(tenantId));

    if (!result.ok) {

      setError(result.error);

      setLoading(false);

      return;

    }

    setDetail(result.data);

    setLoading(false);

  }, [tenantId]);



  useEffect(() => {

    void load();

  }, [load]);



  const tenantName = useMemo(() => {

    const t = detail?.tenant;

    if (!t) return 'Mandant';

    return String(t.tenant_name ?? t.tenantName ?? 'Mandant');

  }, [detail]);



  async function runConfirm(reason: string) {

    if (!confirm) return;

    setActionLoading(true);

    await confirm.action(reason);

    if (confirm.auditAction) setLastAuditAction(confirm.auditAction);

    setActionLoading(false);

    setConfirm(null);

    await load();

  }



  if (loading) {

    return (

      <PlatformShellLayout title="Mandant">

        <LoadingState message="Mandantendetails werden geladen…" />

      </PlatformShellLayout>

    );

  }



  if (error || !detail) {

    return (

      <PlatformShellLayout title="Mandant">

        <ErrorState title="Mandant nicht gefunden" message={error ?? 'Unbekannter Fehler'} onRetry={() => void load()} />

      </PlatformShellLayout>

    );

  }



  const tid = String(tenantId);



  return (

    <PlatformShellLayout title={tenantName} subtitle={`Tenant-ID: ${tenantId}`}>

      <SegmentedTabs

        tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}

        activeKey={tab}

        onSelect={(v) => setTab(v as TabKey)}

        layout="scroll"

      />



      {lastAuditAction ? (

        <View style={styles.auditBanner}>

          <Text style={styles.auditHint}>Aktion protokolliert.</Text>

          <PlatformAuditLink tenantId={tid} action={lastAuditAction} />

        </View>

      ) : null}



      <ScrollView contentContainerStyle={styles.content}>

        {tab === 'overview' ? (

          <OverviewTab

            detail={detail}

            canWrite={canWrite}

            onSuspend={() =>

              setConfirm({

                title: 'Mandant sperren',

                description: `Der Mandant „${tenantName}" wird gesperrt. Nutzer können sich nicht mehr anmelden.`,

                danger: true,

                typed: 'SPERREN',

                auditAction: 'tenant.suspended',

                action: async (reason) => {

                  await updatePlatformTenantStatus(tid, 'suspended', reason);

                },

              })

            }

            onUnsuspend={() =>

              setConfirm({

                title: 'Mandant entsperren',

                description: `Der Mandant „${tenantName}" wird wieder freigegeben.`,

                auditAction: 'tenant.unsuspended',

                action: async (reason) => {

                  await updatePlatformTenantStatus(tid, 'active', reason);

                },

              })

            }

          />

        ) : null}



        {tab === 'subscription' ? (
          <TenantSubscriptionTab tenantId={tid} detail={detail} role={platformUser?.role} onReload={load} />
        ) : null}

        {tab === 'entitlements' ? (
          <TenantEntitlementsTab tenantId={tid} role={platformUser?.role} />
        ) : null}

        {tab === 'modules' ? (

          <ModulesTab

            modules={detail.modules}

            canWrite={canModules}

            onToggle={(mod, enable) =>

              setConfirm({

                title: enable ? 'Modul aktivieren' : 'Modul deaktivieren',

                description: `${mod.moduleName} (${mod.moduleKey}) wird ${enable ? 'aktiviert' : 'deaktiviert'}.`,

                danger: !enable,

                auditAction: enable ? 'module.enabled' : 'module.disabled',

                action: async (reason) => {

                  await setPlatformTenantModule(tid, mod.moduleKey, enable ? 'enabled' : 'disabled', reason);

                },

              })

            }

          />

        ) : null}



        {tab === 'billing' ? (

          <TenantInvoicesTab tenantId={tid} detail={detail} role={platformUser?.role} onReload={load} />

        ) : null}



        {tab === 'preview' ? (
          <TenantBillingPreviewTab tenantId={tid} role={platformUser?.role} />
        ) : null}

        {tab === 'credits' ? (
          <TenantCreditsTab tenantId={tid} role={platformUser?.role} onReload={load} />
        ) : null}

        {tab === 'payments' ? (

          <TenantPaymentsTab tenantId={tid} detail={detail} role={platformUser?.role} onReload={load} />

        ) : null}



        {tab === 'discounts' ? (

          <TenantDiscountsTab tenantId={tid} detail={detail} role={platformUser?.role} onReload={load} />

        ) : null}



        {tab === 'support' ? (

          <TenantSupportTab tenantId={tid} role={platformUser?.role} onReload={load} />

        ) : null}



        {tab === 'flags' ? (

          <TenantFeatureFlagsTab tenantId={tid} role={platformUser?.role} />

        ) : null}



        {tab === 'limits' ? <TenantLimitsTab detail={detail} /> : null}

        {tab === 'users' ? <TenantUsersTab /> : null}

        {tab === 'diagnosis' ? <TenantDiagnosisTab tenantId={tid} detail={detail} /> : null}

        {tab === 'audit' ? <TenantAuditTab tenantId={tid} /> : null}

      </ScrollView>



      <PlatformConfirmModal

        visible={Boolean(confirm)}

        title={confirm?.title ?? ''}

        description={confirm?.description ?? ''}

        danger={confirm?.danger}

        requireTypedConfirmation={confirm?.typed}

        loading={actionLoading}

        onCancel={() => setConfirm(null)}

        onConfirm={(reason) => void runConfirm(reason)}

      />

    </PlatformShellLayout>

  );

}



function OverviewTab({

  detail,

  canWrite,

  onSuspend,

  onUnsuspend,

}: {

  detail: PlatformTenantDetail;

  canWrite: boolean;

  onSuspend: () => void;

  onUnsuspend: () => void;

}) {

  const t = detail.tenant;

  return (

    <View style={styles.panel}>

      <InfoRow label="Status" value={String(t.status ?? '—')} />

      <InfoRow label="Lifecycle" value={String(t.lifecycle_status ?? t.lifecycleStatus ?? '—')} />

      <InfoRow label="Billing" value={String(t.billing_status ?? t.billingStatus ?? '—')} />

      <InfoRow label="Tarif" value={String(t.plan_key ?? t.planKey ?? detail.plan?.plan_key ?? '—')} />

      <InfoRow label="Slug" value={String(t.slug ?? '—')} />

      {canWrite ? (

        <View style={styles.actions}>

          <Pressable style={styles.btnDanger} onPress={onSuspend}>

            <Text style={styles.btnText}>Sperren</Text>

          </Pressable>

          <Pressable style={styles.btn} onPress={onUnsuspend}>

            <Text style={styles.btnText}>Entsperren</Text>

          </Pressable>

        </View>

      ) : null}

    </View>

  );

}



function ModulesTab({

  modules,

  canWrite,

  onToggle,

}: {

  modules: PlatformTenantModuleRow[];

  canWrite: boolean;

  onToggle: (mod: PlatformTenantModuleRow, enable: boolean) => void;

}) {

  return (

    <View style={styles.panel}>

      {modules.map((mod) => {

        const enabled = mod.status === 'enabled' || mod.status === 'beta_enabled' || mod.status === 'trial';

        return (

          <View key={mod.moduleKey} style={styles.moduleRow}>

            <View style={{ flex: 1 }}>

              <Text style={styles.moduleName}>{mod.moduleName}</Text>

              <Text style={styles.moduleMeta}>

                {mod.moduleKey} · {mod.status}

              </Text>

            </View>

            {canWrite ? (

              <Pressable style={enabled ? styles.btnDanger : styles.btn} onPress={() => onToggle(mod, !enabled)}>

                <Text style={styles.btnText}>{enabled ? 'Deaktivieren' : 'Aktivieren'}</Text>

              </Pressable>

            ) : null}

          </View>

        );

      })}

    </View>

  );

}



function InfoRow({ label, value }: { label: string; value: string }) {

  return (

    <View style={styles.infoRow}>

      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value}</Text>

    </View>

  );

}



const styles = StyleSheet.create({

  content: { paddingTop: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

  panel: {

    backgroundColor: PLATFORM_COLORS.panel,

    borderWidth: 1,

    borderColor: PLATFORM_COLORS.border,

    borderRadius: 10,

    padding: spacing.md,

    gap: spacing.sm,

  },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },

  infoLabel: { color: PLATFORM_COLORS.muted, fontSize: 13 },

  infoValue: { color: PLATFORM_COLORS.text, fontSize: 13, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  btn: {

    backgroundColor: '#132036',

    paddingHorizontal: spacing.md,

    paddingVertical: 8,

    borderRadius: 8,

    borderWidth: 1,

    borderColor: PLATFORM_COLORS.border,

  },

  btnDanger: {

    backgroundColor: '#3f1212',

    paddingHorizontal: spacing.md,

    paddingVertical: 8,

    borderRadius: 8,

    borderWidth: 1,

    borderColor: PLATFORM_COLORS.danger,

  },

  btnText: { color: PLATFORM_COLORS.text, fontSize: 13, fontWeight: '600' },

  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },

  moduleName: { color: PLATFORM_COLORS.text, fontWeight: '600' },

  moduleMeta: { color: PLATFORM_COLORS.muted, fontSize: 12 },

  auditBanner: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: spacing.sm,

    marginTop: spacing.sm,

  },

  auditHint: { color: PLATFORM_COLORS.muted, fontSize: 12 },

});


