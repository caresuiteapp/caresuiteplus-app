import { AiJobsListView } from '@/components/platform/AiJobsListView';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { useAiJobList } from '@/hooks/useAiJobList';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';

export function AiJobsListScreen() {
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, error, refresh } = useAiJobList();

  return (
    <ScreenShell title="KI-Jobs" subtitle={`OpenAI · ${roleLabel ?? 'Demo'}`} showBack={false}>
      {loading && items.length === 0 ? (
        <LoadingState message="KI-Jobs werden geladen…" />
      ) : error && items.length === 0 ? (
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      ) : (
        <AiJobsListView items={items} roleKey={roleKey} loading={loading} onRefresh={refresh} />
      )}
    </ScreenShell>
  );
}
