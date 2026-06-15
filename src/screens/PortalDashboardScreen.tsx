import { useState } from 'react';
import { useRouter } from 'expo-router';
import { DashboardView } from '@/components/dashboard';
import { CareLightPageShell } from '@/components/layout';
import { PremiumButton } from '@/components/ui';
import { useDashboard } from '@/hooks/useDashboard';
import { useAuth } from '@/lib/auth/context';
import type { DashboardScope } from '@/types/dashboard';

type PortalDashboardScreenProps = {
  portalLabel: string;
  scope: DashboardScope;
};

export function PortalDashboardScreen({ portalLabel, scope }: PortalDashboardScreenProps) {
  const router = useRouter();
  const { profile, signOut, user } = useAuth();
  const { data, loading, error, refresh } = useDashboard(scope);
  const [showSuccess, setShowSuccess] = useState(false);

  const displayName = profile?.displayName ?? user?.displayName ?? 'Portal';

  const handleRefresh = async () => {
    await refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  return (
    <CareLightPageShell
      title={portalLabel}
      subtitle="Ihre persönliche Übersicht"
      rightSlot={
        <PremiumButton
          title="Abmelden"
          variant="ghost"
          size="sm"
          onPress={() => signOut().then(() => router.replace('/' as never))}
        />
      }
    >
      <DashboardView
        snapshot={data}
        loading={loading}
        error={error}
        displayName={displayName}
        onRefresh={handleRefresh}
        showSuccess={showSuccess}
      />
    </CareLightPageShell>
  );
}
