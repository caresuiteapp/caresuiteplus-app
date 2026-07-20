import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OfficeBillingHero } from '@/components/office';
import { InvoiceDetailModal } from '@/components/office/invoicedetailmodal';
import { ScreenShell } from '@/components/layout';
import { InvoicesListView } from '@/components/office/InvoicesListView';
import { PremiumButton, PremiumCard, SegmentedTabs, type TabOption } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchBillingDashboardStats, fetchInvoiceList } from '@/lib/office';
import {
  getInvoiceModule,
  INVOICE_MODULES,
  type InvoiceWorkspaceKey,
} from '@/lib/office/invoiceModules';
import { formatCurrency } from '@/lib/office/invoiceListService';
import { useAuth } from '@/lib/auth/context';
import { colors, radius, spacing, typography } from '@/theme';
import { BudgetsListScreen } from './BudgetsListScreen';

type BillingWorkspace = 'dashboard' | 'budgets' | InvoiceWorkspaceKey;

const BILLING_TABS: TabOption[] = [
  { key: 'dashboard', label: 'Modul-Dashboard' },
  { key: 'all', label: 'Alle Rechnungen' },
  { key: 'budgets', label: 'Budgets' },
];

function InvoicesWorkspace({ moduleKey }: { moduleKey: InvoiceWorkspaceKey }) {
  const [modalInvoiceId, setModalInvoiceId] = useState<string | null>(null);

  return (
    <>
      <InvoicesListView
        embedded
        moduleFilter={moduleKey}
        selectedId={modalInvoiceId}
        onInvoicePress={setModalInvoiceId}
      />
      <InvoiceDetailModal
        visible={modalInvoiceId !== null}
        invoiceId={modalInvoiceId}
        onClose={() => setModalInvoiceId(null)}
      />
    </>
  );
}

export function OfficeBillingScreen() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<BillingWorkspace>('dashboard');
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const statsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant am Profil hinterlegt.' });
      return fetchBillingDashboardStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );
  const invoicesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant am Profil hinterlegt.' });
      return fetchInvoiceList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const moduleStats = useMemo(() => {
    const invoices = invoicesQuery.data ?? [];
    return new Map(
      INVOICE_MODULES.map((module) => {
        const matching = invoices.filter((invoice) => invoice.billingModule === module.key);
        return [module.key, {
          count: matching.length,
          amountCents: matching.reduce((sum, invoice) => sum + invoice.amountCents, 0),
        }] as const;
      }),
    );
  }, [invoicesQuery.data]);

  const stats = statsQuery.data;
  const roleKey = profile?.roleKey ?? 'billing';
  const selectedModule = workspace !== 'dashboard' && workspace !== 'budgets' && workspace !== 'all'
    ? getInvoiceModule(workspace)
    : null;

  return (
    <ScreenShell title="Rechnungen" subtitle="Zentrale Abrechnung nach Modulen" scroll={false}>
      {stats ? <OfficeBillingHero stats={stats} roleKey={roleKey} compact /> : null}

      <View style={styles.topBar}>
        <SegmentedTabs
          tabs={BILLING_TABS}
          activeKey={workspace === 'budgets' || workspace === 'all' ? workspace : 'dashboard'}
          onSelect={(key) => setWorkspace(key as BillingWorkspace)}
        />
        <PremiumButton
          title="Leistungskatalog"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/office/catalogs' as never)}
        />
      </View>

      {workspace === 'dashboard' ? (
        <ScrollView contentContainerStyle={styles.dashboard} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Text style={styles.title}>Abrechnung nach Leistungsmodul</Text>
            <Text style={styles.subtitle}>
              Jede Rechnung nutzt ausschließlich Nachweise, Katalogpositionen, Budgets und Regeln des gewählten Moduls.
              Die fertigen Rechnungen und PDFs bleiben zentral im Office verfügbar.
            </Text>
          </View>
          <View style={styles.moduleGrid}>
            {INVOICE_MODULES.map((module) => {
              const totals = moduleStats.get(module.key) ?? { count: 0, amountCents: 0 };
              return (
                <PremiumCard
                  key={module.key}
                  style={styles.moduleCard}
                  accentColor={module.accent}
                  onPress={() => setWorkspace(module.key)}
                >
                  <View style={styles.moduleHeading}>
                    <Text style={styles.moduleIcon}>{module.icon}</Text>
                    <View style={styles.moduleHeadingText}>
                      <Text style={styles.moduleTitle}>{module.label}</Text>
                      <Text style={[styles.moduleBasis, { color: module.accent }]}>{module.basis}</Text>
                    </View>
                  </View>
                  <Text style={styles.moduleDescription}>{module.description}</Text>
                  <View style={styles.moduleMetrics}>
                    <View>
                      <Text style={styles.metricValue}>{totals.count}</Text>
                      <Text style={styles.metricLabel}>Rechnungen</Text>
                    </View>
                    <View>
                      <Text style={styles.metricValue}>{formatCurrency(totals.amountCents)}</Text>
                      <Text style={styles.metricLabel}>Gesamtvolumen</Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <PremiumButton
                      title="Rechnungen öffnen"
                      variant="secondary"
                      size="sm"
                      onPress={() => setWorkspace(module.key)}
                    />
                    <PremiumButton
                      title="+ Neue Rechnung"
                      size="sm"
                      onPress={() => router.push(`/office/invoices/create?module=${module.key}` as never)}
                    />
                  </View>
                </PremiumCard>
              );
            })}
          </View>
        </ScrollView>
      ) : workspace === 'budgets' ? (
        <View style={styles.content}><BudgetsListScreen embedded /></View>
      ) : (
        <View style={styles.content}>
          {selectedModule ? (
            <View style={styles.workspaceHeader}>
              <PremiumButton title="← Modul-Dashboard" variant="ghost" size="sm" onPress={() => setWorkspace('dashboard')} />
              <View style={styles.workspaceTitleBlock}>
                <Text style={styles.workspaceTitle}>{selectedModule.icon} {selectedModule.label}-Abrechnung</Text>
                <Text style={styles.workspaceSubtitle}>{selectedModule.basis}</Text>
              </View>
              <PremiumButton
                title="+ Neue Rechnung"
                size="sm"
                onPress={() => router.push(`/office/invoices/create?module=${selectedModule.key}` as never)}
              />
            </View>
          ) : null}
          <InvoicesWorkspace moduleKey={workspace as InvoiceWorkspaceKey} />
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  topBar: {
    marginVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  dashboard: { paddingBottom: spacing.xxl, gap: spacing.md },
  intro: { gap: spacing.xs },
  title: { ...typography.h2 },
  subtitle: { ...typography.body, color: colors.textMuted, maxWidth: 920 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  moduleCard: { minWidth: 320, flexBasis: '47%', flexGrow: 1, gap: spacing.md },
  moduleHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moduleIcon: { fontSize: 30 },
  moduleHeadingText: { flex: 1 },
  moduleTitle: { ...typography.h2 },
  moduleBasis: { ...typography.label },
  moduleDescription: { ...typography.body, color: colors.textMuted, minHeight: 48 },
  moduleMetrics: {
    flexDirection: 'row',
    gap: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(111, 83, 242, 0.06)',
  },
  metricValue: { ...typography.h3 },
  metricLabel: { ...typography.caption, color: colors.textMuted },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  content: { flex: 1 },
  workspaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  workspaceTitleBlock: { flex: 1, minWidth: 220 },
  workspaceTitle: { ...typography.h3 },
  workspaceSubtitle: { ...typography.caption, color: colors.textMuted },
});
