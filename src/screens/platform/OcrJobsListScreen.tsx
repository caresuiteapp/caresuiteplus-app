import { OcrJobsListView } from '@/components/platform/OcrJobsListView';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useOcrJobList } from '@/hooks/useOcrJobList';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'expo-router';

export function OcrJobsListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, error, refresh } = useOcrJobList();

  return (
    <ScreenShell
      title="OCR-Jobs"
      subtitle={`Azure Document Intelligence · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Hub" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      {loading && items.length === 0 ? (
        <LoadingState message="OCR-Jobs werden geladen…" />
      ) : error && items.length === 0 ? (
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      ) : (
        <OcrJobsListView items={items} roleKey={roleKey} loading={loading} onRefresh={refresh} />
      )}
    </ScreenShell>
  );
}
