import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssignmentEditForm } from '@/components/assist/AssignmentEditForm';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, SuccessState } from '@/components/ui';
import { fetchVisitDispositionDetail } from '@/lib/assist/visitService';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { colors } from '@/theme';

/** /assist/einsaetze/[id]/edit */
export function AssignmentEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState<VisitDispositionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id || !tenantId) return;
    setLoading(true);
    setError(null);
    void fetchVisitDispositionDetail(id, tenantId, profile?.roleKey).then((result) => {
      if (result.ok && result.data) {
        setVisit(result.data);
      } else {
        setVisit(null);
        setError(result.ok ? 'Einsatz nicht gefunden.' : result.error);
      }
      setLoading(false);
    });
  }, [id, tenantId, profile?.roleKey]);

  if (loading) {
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
      </ScreenShell>
    );
  }

  if (error || !visit || !id) {
    return (
      <ScreenShell title="Einsatz bearbeiten" subtitle={roleLabel ?? 'Assist'} onBack={() => router.back()}>
        <ErrorState message={error ?? 'Einsatz nicht gefunden.'} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Einsatz bearbeiten" subtitle={roleLabel ?? 'Assist'} onBack={() => router.back()}>
      <FormScreenHero
        eyebrow="ASSIST · EINSATZ"
        title="Einsatz bearbeiten"
        meta="Bezeichnung, Termin, Ort, Status und Katalogfelder"
        icon="✏️"
        formMode="edit"
        accentColor={colors.success}
      />
      <AssignmentEditForm
        visitId={id}
        initialVisit={visit}
        onCancel={() => router.back()}
        onSaved={() => {
          setSaved(true);
          setTimeout(() => router.replace(`/assist/einsaetze/${id}` as never), 900);
        }}
      />
    </ScreenShell>
  );
}
