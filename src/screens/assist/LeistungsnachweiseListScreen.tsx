import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { CareRecordsListView } from '@/components/assist/CareRecordsListView';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, SuccessState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
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
  const assistAccent = moduleColor('assist');
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
    <C14vSubpageShell
      title="Leistungsnachweise"
      eyebrow="ASSIST · NACHWEISE"
      subtitle={`Nachweise prüfen und abrechnungsbereit machen · ${filteredCount} Einträge`}
      moduleLabel="Assist"
      showBack={false}
      scroll={false}
      accentColor={assistAccent}
      actions={[
        { key: 'review', label: 'Nachweis-Prüfung & Portal-Freigabe', onPress: () => router.push('/assist/nachweise/review' as never), variant: 'primary' as const },
        { key: 'refresh', label: 'Aktualisieren', onPress: refresh, variant: 'ghost' as const },
      ]}
    >
      {showSuccess ? <SuccessState message="Liste aktualisiert." /> : null}
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
    </C14vSubpageShell>
  );
}

void fetchCareRecordList;
