import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  EMPLOYEE_OFFBOARDING_PREPARED_MESSAGE,
  fetchOffboardingProgress,
  lockOffboardingPortalAccess,
  prepareOffboardingExternalAccess,
  recordOffboardingReturn,
  refreshOffboardingChecks,
  saveOffboardingExitDetails,
  startOffboardingSession,
} from '@/lib/office/offboarding';
import {
  OFFBOARDING_STEP_LABELS,
  TERMINATION_TYPE_LABELS,
} from '@/types/modules/employeeOffboarding';
import { colors, spacing, typography } from '@/theme';

export function EmployeeOffboardingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const canManage = can('office.employees.edit');
  const canView = can('office.employees.view');

  const query = useAsyncQuery(
    async () => {
      if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
      if (!id) return { ok: false as const, error: 'Keine Mitarbeitenden-ID.' };
      return fetchOffboardingProgress(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id && canView },
  );

  if (!canView) {
    return (
      <ScreenShell title="Offboarding" subtitle="Kein Zugriff">
        <LockedActionBanner
          message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Offboarding" subtitle="Wird geladen…" scroll>
        <LoadingState message="Offboarding-Checkliste wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Offboarding" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const progress = query.data;
  if (!progress) {
    return (
      <ScreenShell title="Offboarding" scroll>
        <EmptyState title="Keine Daten" message="Offboarding konnte nicht geladen werden." />
      </ScreenShell>
    );
  }

  const handleStart = async () => {
    if (!tenantId || !id || !canManage) return;
    await startOffboardingSession(tenantId, id, profile?.roleKey, profile?.id);
    query.refresh();
  };

  const handleRecordExit = async () => {
    if (!tenantId || !id || !canManage) return;
    await saveOffboardingExitDetails(
      tenantId,
      id,
      {
        exitDate: '2026-07-31',
        terminationType: 'voluntary',
        internalReason: 'Offboarding über UI',
      },
      profile?.roleKey,
      profile?.id,
    );
    query.refresh();
  };

  const handleRefresh = async () => {
    if (!tenantId || !id) return;
    await refreshOffboardingChecks(tenantId, id, profile?.roleKey, profile?.id);
    query.refresh();
  };

  const handleLockPortal = async () => {
    if (!tenantId || !id || !canManage) return;
    await lockOffboardingPortalAccess(tenantId, id, profile?.roleKey, profile?.id);
    query.refresh();
  };

  const handlePrepareExternal = async () => {
    if (!tenantId || !id || !canManage) return;
    await prepareOffboardingExternalAccess(tenantId, id, profile?.roleKey, profile?.id);
    query.refresh();
  };

  const handleReturn = async (materialId: string) => {
    if (!tenantId || !id || !canManage) return;
    await recordOffboardingReturn(tenantId, id, materialId, profile?.roleKey, profile?.id);
    query.refresh();
  };

  return (
    <ScreenShell
      title="Offboarding"
      subtitle={progress.employeeName || 'Mitarbeitende:r'}
      showBack
      onBack={() => router.back()}
      scroll
    >
      <InfoBanner message={EMPLOYEE_OFFBOARDING_PREPARED_MESSAGE} variant="info" />

      <SectionPanel
        title="Status"
        subtitle={`${progress.employeeName} · ${progress.completedStepCount}/${progress.totalStepCount} Schritte (${progress.progressPercent} %)`}
      >
        <Text style={styles.statusLine}>Gesamtstatus: {progress.session.overallStatus}</Text>
        {progress.session.exitDate ? (
          <Text style={styles.meta}>
            Austritt: {progress.session.exitDate}
            {progress.session.terminationType
              ? ` · ${TERMINATION_TYPE_LABELS[progress.session.terminationType]}`
              : ''}
          </Text>
        ) : null}
      </SectionPanel>

      {progress.blockers.length > 0 ? (
        <SectionPanel title="Blocker" subtitle="Abschluss noch nicht möglich">
          {progress.blockers.map((blocker) => (
            <Text key={blocker.checkKey} style={styles.blocker}>
              • {blocker.message}
            </Text>
          ))}
        </SectionPanel>
      ) : null}

      {progress.steps.length === 0 ? (
        <SectionPanel title="Checkliste" subtitle="Noch keine Offboarding-Schritte">
          <EmptyState
            title="Offboarding vorbereitet"
            message="Die Checkliste wird beim Start des Offboardings angelegt. Persistenz in Supabase folgt mit Migration 0052."
          />
        </SectionPanel>
      ) : (
        <SectionPanel title="Checkliste" subtitle="20 Offboarding-Schritte">
          <View style={styles.stepList}>
            {progress.steps.map((step) => (
              <View key={step.id} style={styles.stepRow}>
                <Text style={styles.stepLabel}>{OFFBOARDING_STEP_LABELS[step.stepKey]}</Text>
                <Text style={styles.stepStatus}>{step.status}</Text>
              </View>
            ))}
          </View>
        </SectionPanel>
      )}

      {canManage ? (
        <SectionPanel title="Aktionen" subtitle="Offboarding steuern">
          <View style={styles.actions}>
            <PremiumButton title="Offboarding starten" onPress={handleStart} />
            <PremiumButton title="Austritt erfassen" variant="secondary" onPress={handleRecordExit} />
            <PremiumButton title="Prüfungen aktualisieren" variant="secondary" onPress={handleRefresh} />
            <PremiumButton title="Portal sperren" variant="secondary" onPress={handleLockPortal} />
            <PremiumButton
              title="Externe Zugänge vorbereiten"
              variant="secondary"
              onPress={handlePrepareExternal}
            />
          </View>
        </SectionPanel>
      ) : null}

      {progress.blockers.some((b) => b.checkKey === 'open_returns') && canManage ? (
        <SectionPanel title="Rückgaben" subtitle="Inventar / Arbeitsmaterial">
          <PremiumButton
            title="Dienstkleidung zurückgeben (Demo)"
            variant="ghost"
            onPress={() => handleReturn(`wm-uniform-${id}`)}
          />
        </SectionPanel>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statusLine: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  blocker: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  stepList: {
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.textSecondary,
  },
  stepLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  stepStatus: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
  },
});
