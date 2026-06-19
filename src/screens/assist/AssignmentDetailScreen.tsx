import { ScrollView, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssignmentDetailTabsPanel } from '@/components/assist/AssignmentDetailTabsPanel';
import { CareLightPageShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useVisitDispositionDetail } from '@/hooks/useVisitDispositionDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { spacing } from '@/theme';

type AssignmentDetailScreenProps = {
  assignmentId?: string;
  embedded?: boolean;
  onClose?: () => void;
};

export function AssignmentDetailScreen({
  assignmentId: assignmentIdProp,
  embedded = false,
  onClose,
}: AssignmentDetailScreenProps = {}) {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const assignmentId = assignmentIdProp ?? routeId;
  const router = useRouter();
  const { roleLabel } = usePermissions();
  const { loading, error, notFound, refresh, data } = useVisitDispositionDetail(assignmentId);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { paddingBottom: spacing.xxl },
        panel: { backgroundColor: auroraGlass.modal, flex: 1 },
      }),
    [],
  );

  const handleBack = () => {
    if (onClose) {
      onClose();
      return;
    }
    router.back();
  };

  if (!assignmentId) {
    const message = 'Keine Einsatz-ID angegeben.';
    if (embedded) return <ErrorState title="Nicht gefunden" message={message} />;
    return (
      <CareLightPageShell title="Einsatz" subtitle="Fehler">
        <ErrorState title="Nicht gefunden" message={message} />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={handleBack} />
      </CareLightPageShell>
    );
  }

  if (loading) {
    if (embedded) return <LoadingState message="Einsatzdetails werden geladen…" />;
    return (
      <CareLightPageShell title="Einsatz" subtitle="Wird geladen…">
        <LoadingState message="Einsatzdetails werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || error) {
    const errorContent = (
      <>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Einsatz existiert nicht.'}
          onRetry={refresh}
        />
        {!embedded ? (
          <PremiumButton title="Zur Liste" variant="secondary" onPress={handleBack} />
        ) : null}
      </>
    );
    if (embedded) return errorContent;
    return (
      <CareLightPageShell title="Einsatz" subtitle="Fehler">
        {errorContent}
      </CareLightPageShell>
    );
  }

  const panel = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.panel}
      showsVerticalScrollIndicator={false}
    >
      <AssignmentDetailTabsPanel
        assignmentId={assignmentId}
        mode="full"
        onClose={embedded ? onClose : undefined}
      />
    </ScrollView>
  );

  if (embedded) return panel;

  return (
    <CareLightPageShell
      title={data?.title ?? 'Einsatz'}
      subtitle={`${data?.clientName ?? '—'} · ${roleLabel ?? 'Assist'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={handleBack} />
      }
    >
      {panel}
    </CareLightPageShell>
  );
}
