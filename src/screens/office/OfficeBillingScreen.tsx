import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OfficeBillingHero } from '@/components/office';
import { ScreenShell, MasterDetailLayout } from '@/components/layout';
import { InvoiceDetailSummaryPanel } from '@/components/office/InvoiceDetailSummaryPanel';
import { InvoicesListView } from '@/components/office/InvoicesListView';
import { PremiumButton, SegmentedTabs, type TabOption } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchBillingDashboardStats } from '@/lib/office';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing } from '@/theme';
import { BudgetsListScreen } from './BudgetsListScreen';

const BILLING_TABS: TabOption[] = [
  { key: 'invoices', label: 'Rechnungen' },
  { key: 'budgets', label: 'Budgets' },
];

function InvoicesTabContent() {
  const [modalInvoiceId, setModalInvoiceId] = useState<string | null>(null);

  return (
    <>
      <InvoicesListView
        embedded
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
  const [activeTab, setActiveTab] = useState('invoices');
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

  const stats = statsQuery.data;
  const roleKey = profile?.roleKey ?? 'billing';

  return (
    <ScreenShell title="Abrechnung" subtitle="Rechnungen & Budgets" scroll={false}>
      {stats ? <OfficeBillingHero stats={stats} roleKey={roleKey} /> : null}

      <View style={styles.catalogLink}>
        <PremiumButton
          title="Leistungskatalog"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/office/catalogs' as never)}
        />
      </View>

      <View style={styles.tabs}>
        <SegmentedTabs tabs={BILLING_TABS} activeKey={activeTab} onSelect={setActiveTab} />
      </View>

      <View style={styles.content}>
        {activeTab === 'invoices' ? <InvoicesTabContent /> : <BudgetsListScreen embedded />}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  catalogLink: { marginBottom: spacing.sm, marginTop: spacing.md },
  tabs: { marginBottom: spacing.sm },
  content: { flex: 1 },
});
