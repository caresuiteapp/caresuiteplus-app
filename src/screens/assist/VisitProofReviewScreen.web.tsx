import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { VisitProofReviewPanel } from '@/components/assist/VisitProofReviewPanel';
import { ProofReviewWorkspace } from '@/components/assist/ProofReviewWorkspace.web';
import { usePermissions } from '@/hooks/usePermissions';
import { useProofReviewWorkspace } from '@/hooks/useProofReviewWorkspace.web';

/** Desktop/Web only; native portal build continues using the existing screen. */
export function VisitProofReviewScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const permitted = can('assist.records.view');
  const query = useProofReviewWorkspace(permitted);
  return <ScreenShell title="Nachweis-Prüfung" subtitle="Vollständigkeit · Klientenportal · Unterschriften" showBack={false} scroll>
    {!permitted ? <LockedActionBanner message={check('assist.records.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      : !query.tenantId ? <ErrorState message="Es ist kein Unternehmen ausgewählt." onRetry={query.refresh} />
      : query.loading && !query.data ? <LoadingState message="Nachweise, Einsätze und Portal-Unterschriften werden abgeglichen…" />
      : query.error && !query.data ? <ErrorState message={query.error} onRetry={query.refresh} />
      : <ProofReviewWorkspace key={`${query.tenantId}:${query.profile?.id}`} entries={query.entries}
          loadedAt={query.data?.loadedAt ?? null} refreshing={query.refreshing} error={query.error ?? query.refreshError}
          onRefresh={() => { void query.refresh(); }}
          onOpenVisit={entry => router.push(`/assist/assignments/${encodeURIComponent(entry.assignmentId)}` as never)}
          renderProof={entry => entry.proof && query.tenantId ? <VisitProofReviewPanel key={entry.id} proof={entry.proof}
            tenantId={query.tenantId} actorProfileId={query.profile?.id ?? null} actorRoleKey={query.profile?.roleKey ?? null}
            onUpdated={() => { void query.refresh(); }} /> : null} />}
  </ScreenShell>;
}
