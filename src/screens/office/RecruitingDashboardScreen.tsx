import { StyleSheet, Text, View } from 'react-native';
import { RecruitingDashboardHero } from '@/components/office/RecruitingDashboardHero';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchRecruitingDashboard, listApplicants } from '@/lib/recruiting/applicantService';
import { APPLICANT_STATUS_LABELS } from '@/types/modules/recruiting';
import { colors, spacing, typography } from '@/theme';

export function RecruitingDashboardScreen() {
  const tenantId = useServiceTenantId();
  const { can, check } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      const dashboard = fetchRecruitingDashboard(tenantId, 'business_admin');
      const applicants = listApplicants(tenantId, 'business_admin');
      if (!dashboard.ok) return Promise.resolve(dashboard);
      if (!applicants.ok) return Promise.resolve(applicants);
      return Promise.resolve({
        ok: true as const,
        data: { dashboard: dashboard.data, applicants: applicants.data },
      });
    },
    [tenantId],
    { enabled: !!tenantId && can('office.recruiting.view') },
  );

  if (!can('office.recruiting.view')) {
    return (
      <ScreenShell title="Bewerbungen & Onboarding" scroll>
        <EmptyState
          title="Keine Berechtigung"
          message={check('office.recruiting.view').reason ?? 'Bewerbungsdaten nicht freigegeben.'}
        />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Bewerbungen & Onboarding" subtitle="Wird geladen…" scroll>
        <LoadingState message="Bewerberpipeline wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Bewerbungen & Onboarding" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <ScreenShell title="Bewerbungen & Onboarding" scroll>
        <EmptyState title="Keine Daten" message="Noch keine Bewerbungen erfasst." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Bewerbungen & Onboarding" subtitle="Mehr → Personal → Bewerbungen & Onboarding" scroll>
      <RecruitingDashboardHero summary={data.dashboard} />

      <SectionPanel title="Aktuelle Bewerbungen" subtitle="Pipeline-Übersicht">
        {data.applicants.length === 0 ? (
          <EmptyState title="Keine Bewerbungen" message="Legen Sie die erste Bewerbung im Service an." />
        ) : (
          <View style={styles.list}>
            {data.applicants.map((applicant) => (
              <View key={applicant.id} style={styles.row}>
                <Text style={styles.name}>
                  {applicant.firstName} {applicant.lastName}
                </Text>
                <Text style={styles.meta}>
                  {applicant.appliedRole} · {APPLICANT_STATUS_LABELS[applicant.status]}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SectionPanel>

      {can('office.recruiting.manage') ? (
        <PremiumButton title="Neue Bewerbung (Service)" variant="secondary" fullWidth onPress={query.refresh} />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
    gap: 2,
  },
  name: { ...typography.body, fontWeight: '600' },
  meta: { ...typography.caption, color: colors.textMuted },
});
