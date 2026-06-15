import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  PortalAppointmentsTab,
  PortalDocumentsTab,
  PortalMessagesTab,
  PortalOverviewTab,
} from '@/components/portal';
import { CareLightPageShell } from '@/components/layout';
import { PremiumButton, SegmentedTabs, type TabOption } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import type { DashboardScope } from '@/types/dashboard';
import type { PortalTabKey } from '@/types/portal';
import { PORTAL_CLIENT_TAB_LABELS, PORTAL_TAB_LABELS } from '@/types/portal';
import { spacing } from '@/theme';

type PortalViewScreenProps = {
  portalLabel: string;
  scope: DashboardScope;
  /** Klient:innenportal zeigt „Termine" statt „Einsätze" */
  variant?: 'employee' | 'client';
  /** Direkte Tab-Auswahl für Deep-Links (WP 061) */
  initialTab?: PortalTabKey;
};

function buildTabs(variant: 'employee' | 'client'): TabOption[] {
  const labels = variant === 'client' ? PORTAL_CLIENT_TAB_LABELS : PORTAL_TAB_LABELS;
  const keys: PortalTabKey[] = ['overview', 'appointments', 'messages', 'documents'];
  return keys.map((key) => ({ key, label: labels[key] }));
}

export function PortalViewScreen({
  portalLabel,
  scope,
  variant = 'employee',
  initialTab = 'overview',
}: PortalViewScreenProps) {
  const router = useRouter();
  const { profile, signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState<PortalTabKey>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [showSuccess, setShowSuccess] = useState(false);

  const displayName = profile?.displayName ?? user?.displayName ?? 'Portal';
  const tabs = buildTabs(variant);
  const appointmentsLabel = variant === 'client' ? 'Termine' : 'Einsätze';

  const handleRefreshSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <PortalOverviewTab
            scope={scope}
            displayName={displayName}
            showSuccess={showSuccess}
            onRefresh={handleRefreshSuccess}
          />
        );
      case 'appointments':
        return <PortalAppointmentsTab appointmentsLabel={appointmentsLabel} />;
      case 'messages':
        return <PortalMessagesTab />;
      case 'documents':
        return <PortalDocumentsTab />;
      default:
        return null;
    }
  };

  return (
    <CareLightPageShell
      title={portalLabel}
      subtitle={`Willkommen, ${displayName}`}
      rightSlot={
        <PremiumButton
          title="Abmelden"
          variant="ghost"
          size="sm"
          onPress={() => signOut().then(() => router.replace('/' as never))}
        />
      }
    >
      <View style={styles.tabs}>
        <SegmentedTabs
          tabs={tabs}
          activeKey={activeTab}
          onSelect={(key) => setActiveTab(key as PortalTabKey)}
        />
      </View>
      <View style={styles.content}>{renderTab()}</View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  tabs: {
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
});
