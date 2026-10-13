import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssignmentEditForm } from '@/components/assist/AssignmentEditForm';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, SuccessState, PremiumButton } from '@/components/ui';
import { fetchVisitDispositionDetail } from '@/lib/assist/visitService';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';

/** /assist/einsaetze/[id]/edit */
export function AssignmentEditScreen() {
  const { id: routeId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(routeId) ? routeId[0] : routeId;
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState<VisitDispositionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const scope = JSON.stringify([tenantId, profile?.id, profile?.roleKey, id]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [loadedScope, setLoadedScope] = useState(scope);

  useEffect(() => {
    let cancelled = false;
    setLoadedScope(scope);
    setVisit(null);
    setSaved(false);
    setError(null);
    if (!id || !tenantId) {
      setLoading(false);
      setError(!id ? 'Keine Einsatz-ID angegeben.' : 'Kein Mandant verfügbar.');
      return;
    }
    setLoading(true);
    void fetchVisitDispositionDetail(id, tenantId, profile?.roleKey).then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setVisit(result.data);
      } else {
        setVisit(null);
        setError(result.ok ? 'Einsatz nicht gefunden.' : result.error);
      }
      setLoading(false);
    }).catch((cause) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : 'Einsatz konnte nicht geladen werden.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, tenantId, profile?.id, profile?.roleKey, scope, retryKey]);
  const returnToDetail = () => router.canGoBack() ? router.back() : router.replace(id ? `/assist/assignments/${encodeURIComponent(id)}` as never : '/assist/assignments');

  if (loading || loadedScope !== scope) {
    return (
      <ScreenShell title="Einsatz bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Einsatz wird geladen…" />
      </ScreenShell>
    );
  }

  if (saved) {
    return (
      <ScreenShell title="Gespeichert" showBack={false}>
        <SuccessState message="Einsatz aktualisiert." />
        <PremiumButton title="Weiter bearbeiten" onPress={() => { setSaved(false); setRetryKey(key => key + 1); }} />
        <PremiumButton title="Zurück" variant="secondary" onPress={returnToDetail} />
      </ScreenShell>
    );
  }

  if (error || !visit || !id) {
    return (
      <ScreenShell title="Einsatz bearbeiten" subtitle={roleLabel ?? 'Assist'} onBack={returnToDetail}>
        <ErrorState message={error ?? 'Einsatz nicht gefunden.'} onRetry={() => setRetryKey(key => key + 1)} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Einsatz bearbeiten"
      subtitle={`${visit.clientName} · ${roleLabel ?? 'Assist'}`}
      onBack={returnToDetail}
    >
      <AssignmentEditForm
        visitId={id}
        initialVisit={visit}
        onCancel={returnToDetail}
        onSaved={() => {
          if (scopeRef.current !== scope) return;
          setSaved(true);
        }}
      />
    </ScreenShell>
  );
}
