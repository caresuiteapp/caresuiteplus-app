import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import {
  VisitProofReviewList,
  VisitProofReviewPanel,
  VisitProofStatusFilterBar,
} from '@/components/assist/VisitProofReviewPanel';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { useVisitProofReviewList } from '@/hooks/useVisitProofReviewList';
import { usePermissions } from '@/hooks/usePermissions';
import { spacing } from '@/theme';

/** Assist/Office — Leistungsnachweis Prüfung, Freigabe, Portal-Release (Phase 4.5). */
export function VisitProofReviewScreen() {
  const { can, check, roleLabel } = usePermissions();
  const {
    items,
    filteredCount,
    loading,
    error,
    refreshing,
    showSuccess,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    refresh,
    profile,
    tenantId,
  } = useVisitProofReviewList();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedProof = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  if (!can('assist.records.view')) {
    return (
      <ScreenShell title="Nachweis-Prüfung" subtitle="Kein Zugriff" showBack={false}>
        <LockedActionBanner
          message={check('assist.records.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && items.length === 0) {
    return (
      <ScreenShell title="Nachweis-Prüfung" subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="Leistungsnachweise werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && items.length === 0) {
    return (
      <ScreenShell title="Nachweis-Prüfung" subtitle="Fehler" showBack={false}>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Nachweis-Prüfung"
      subtitle={`Freigabe & Klientenportal · ${filteredCount} Einträge`}
      showBack={false}
      scroll
    >
      {showSuccess ? <SuccessState message="Liste aktualisiert." /> : null}

      <View style={{ gap: spacing.md }}>
        <PremiumInput
          label="Suche"
          value={search}
          onChangeText={setSearch}
          placeholder="Klient:in, Mitarbeitende:r, Leistung…"
        />
        <VisitProofStatusFilterBar
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as typeof statusFilter)}
        />

        {items.length === 0 ? (
          <EmptyState
            title="Keine Nachweise"
            message="Für den gewählten Filter liegen keine Leistungsnachweise vor."
          />
        ) : (
          <>
            <VisitProofReviewList
              items={items}
              selectedId={selectedProof?.id ?? null}
              onSelect={setSelectedId}
            />
            {selectedProof && tenantId ? (
              <VisitProofReviewPanel
                proof={selectedProof}
                tenantId={tenantId}
                actorProfileId={profile?.id ?? null}
                actorRoleKey={profile?.roleKey ?? null}
                onUpdated={refresh}
              />
            ) : null}
          </>
        )}
      </View>
    </ScreenShell>
  );
}
