import { LockedActionBanner } from '@/components/permissions';
import { fetchCareRecordList } from '@/lib/assist/careRecordService';
import { CareRecordsListView } from '@/components/assist/CareRecordsListView';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumInput, SuccessState } from '@/components/ui';
import { useCareRecordList } from '@/hooks/useCareRecordList';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';

export function CareRecordsListScreen() {
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const pageTitle = 'Nachweise';
  const roleKey = profile?.roleKey ?? 'caregiver';
  const {
    items,
    totalCount,
    filteredCount,
    loading,
    error,
    refreshing,
    showSuccess,
    search,
    setSearch,
    refresh,
  } = useCareRecordList();

  if (!can('assist.records.view')) {
    return (
      <ScreenShell title={pageTitle} subtitle="Kein Zugriff" showBack={false}>
        <LockedActionBanner
          message={check('assist.records.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && items.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="Leistungsnachweise werden geladen…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={pageTitle} subtitle={`${filteredCount} Einträge`} showBack={false} scroll={false}>
      {showSuccess ? <SuccessState message="Liste aktualisiert." /> : null}
      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      <CareRecordsListView
        items={items}
        totalCount={totalCount}
        roleKey={roleKey}
        search={search}
        onSearchChange={setSearch}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </ScreenShell>
  );
}
