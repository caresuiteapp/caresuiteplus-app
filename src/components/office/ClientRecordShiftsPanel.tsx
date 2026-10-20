import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientAssignments } from '@/lib/assist/assignmentListService';
import type { ClientFullDetail } from '@/types/modules/client';
import { ClientProofBillingStatusPanel } from '@/components/office/ClientProofBillingStatusPanel';
import { ClientAssignmentProfilesPanel } from '@/components/office/ClientAssignmentProfilesPanel';
import { ClientAssignmentHistoryPanel } from '@/components/office/ClientAssignmentHistoryPanel';
import { colors, spacing, typography } from '@/theme';

type ClientRecordShiftsPanelProps = {
  clientId: string;
  fullClient?: ClientFullDetail | null;
};

export function ClientRecordShiftsPanel({ clientId, fullClient }: ClientRecordShiftsPanelProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientAssignments(tenantId, clientId, profile?.roleKey, {
        userId: profile?.id ?? null,
        employeeId: profile?.employeeId ?? null,
      });
    },
    [tenantId, clientId, profile?.roleKey, profile?.id, profile?.employeeId],
    {
      enabled: Boolean(tenantId && clientId),
      queryKey: `client-assignments:${tenantId}:${clientId}:${profile?.id}:${profile?.roleKey}`,
    },
  );

  if (query.loading && !query.data) {
    return <LoadingState message="Einsätze werden geladen…" />;
  }

  if (query.error && !query.data) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  return (
    <View style={styles.panel}>
      {!isReadOnly ? (
        <ClientAssignmentProfilesPanel clientId={clientId} fullClient={fullClient} />
      ) : null}

      {query.refreshError ? <ErrorState message={query.refreshError} onRetry={query.refresh} /> : null}
      <ClientAssignmentHistoryPanel
        key={`${tenantId}:${clientId}:${profile?.id}:${profile?.roleKey}`}
        assignments={query.data ?? []}
        onOpenAssignment={(assignment) => router.push(`/assist/assignments/${assignment.id}` as never)}
        onRefresh={query.refresh}
        refreshing={query.refreshing}
      />

      {fullClient?.preferences ? (
        <SectionPanel title="Einsatzpräferenzen">
          <DetailInfoRow
            label="Bevorzugte Zeiten"
            value={fullClient.preferences.preferredShifts.join(', ') || null}
          />
          <DetailInfoRow label="Mobilität" value={fullClient.preferences.mobilityNotes} />
          <DetailInfoRow label="Zugang" value={fullClient.preferences.accessInstructions} />
        </SectionPanel>
      ) : null}

      <ClientProofBillingStatusPanel clientId={clientId} />

      {!isReadOnly ? (
        <SectionPanel title="Planung in Assist">
          <Text style={styles.hint}>
            Einsatzprofile erscheinen automatisch im Assist-Kalender. Ziehen Sie das gewünschte Profil auf einen Tag
            und bestätigen Sie nur die Uhrzeit. Der Einsatz wird anschließend direkt freigegeben.
          </Text>
          <PremiumButton
            title="Assist-Kalender öffnen"
            onPress={() => router.push('/assist/kalender' as never)}
          />
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  hint: { ...typography.caption, color: colors.textMuted },
});
