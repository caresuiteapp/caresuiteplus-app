import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { CareRecordsListView } from '@/components/assist/CareRecordsListView';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, SuccessState } from '@/components/ui';
import { useCareRecordList } from '@/hooks/useCareRecordList';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { fetchCareRecordList } from '@/lib/assist/careRecordService';

/** Arbeitsplan 043 — /assist/nachweise */
export function LeistungsnachweiseListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
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
      <ScreenShell title="Leistungsnachweise" subtitle="Kein Zugriff" showBack={false}>
        <LockedActionBanner
          message={check('assist.records.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && items.length === 0) {
    return (
      <ScreenShell title="Leistungsnachweise" subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="Leistungsnachweise werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && items.length === 0) {
    return (
      <ScreenShell title="Leistungsnachweise" subtitle="Fehler" showBack={false}>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Leistungsnachweise"
      subtitle={`Nachweise prüfen und abrechnungsbereit machen · ${filteredCount} Einträge`}
      showBack={false}
      scroll={false}
    >
      {showSuccess ? <SuccessState message="Liste aktualisiert." /> : null}
      <PremiumButton
        title="Nachweis-Prüfung & Portal-Freigabe"
        onPress={() => router.push('/assist/nachweise/review' as never)}
      />
      {items.length === 0 && !search ? (
        <EmptyState
          title="Keine Nachweise"
          message="Es sind noch keine Leistungsnachweise erfasst."
        />
      ) : (
        <CareRecordsListView
          items={items}
          totalCount={totalCount}
          roleKey={roleKey}
          search={search}
          onSearchChange={setSearch}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      )}
    </ScreenShell>
  );
}

void fetchCareRecordList;
