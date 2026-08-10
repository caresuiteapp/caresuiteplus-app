import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/permissions';
import { CARE_ASSESSMENT_VARIANT_LABELS, fetchCareAssessments } from '@/lib/careAssessment';
import type { CareAssessmentListItem, CareAssessmentSubjectType } from '@/types/modules/careAssessment';
import { colors, radius, spacing, typography } from '@/theme';

const STATUS: Record<CareAssessmentListItem['status'], string> = {
  draft: 'Entwurf',
  in_progress: 'In Bearbeitung',
  professional_review: 'Fachliche Prüfung',
  approved: 'Freigegeben',
  superseded: 'Abgelöst',
  archived: 'Archiviert',
};

export function CareAssessmentListScreen({ subjectType }: { subjectType: CareAssessmentSubjectType }) {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const resident = subjectType === 'resident';
  const base = resident ? '/stationaer/assessment' : '/pflege/sis';
  const canManage = hasPermission(
    profile?.roleKey,
    resident ? 'stationaer.assessments.manage' : 'pflege.assessments.manage',
  );
  const query = useAsyncQuery(
    () => tenantId
      ? fetchCareAssessments(tenantId, subjectType, profile?.roleKey)
      : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, subjectType, profile?.roleKey],
    { enabled: !!tenantId },
  );
  const items = query.data ?? [];
  const urgent = items.reduce((sum, item) => sum + item.urgentRiskCount, 0);
  const reviews = items.filter((item) =>
    item.reassessmentRequired ||
    (!!item.nextReviewAt && new Date(item.nextReviewAt).getTime() <= Date.now()),
  ).length;
  return (
    <ScreenShell
      title={resident ? 'SIS & Assessment Stationär' : 'SIS & Assessment Pflege'}
      subtitle="Personenzentrierter Pflegeprozess · QPR 2026 · versionsgeführt"
      rightSlot={canManage ? (
        <PremiumButton title="+ Neuaufnahme" size="sm" onPress={() => router.push(`${base}/new` as never)} />
      ) : undefined}
    >
      <InfoBanner
        variant="info"
        title="Pflegeverständnis & Versorgungssicherheit"
        message="Originalton, sechs Themenfelder, Risiken, fokussierte Assessments, Maßnahmen, Verlauf und fachliche Freigabe bilden einen geschlossenen Pflegeprozess."
      />
      <View style={styles.kpis}>
        <SectionPanel title="Aktive Assessments"><Text style={styles.kpi}>{items.length}</Text></SectionPanel>
        <SectionPanel title="Review erforderlich"><Text style={styles.kpi}>{reviews}</Text></SectionPanel>
        <SectionPanel title="Dringende Risiken"><Text style={styles.kpi}>{urgent}</Text></SectionPanel>
      </View>
      {query.loading && !items.length ? <LoadingState message="Assessments werden geladen…" /> : null}
      {query.error && !items.length ? <ErrorState message={query.error} onRetry={query.refresh} /> : null}
      {!query.loading && !query.error && !items.length ? (
        <EmptyState
          title="Noch kein SIS-/Assessmentprozess"
          message="Starten Sie die erste personenzentrierte Informationssammlung."
          actionLabel={canManage ? 'Neuaufnahme starten' : undefined}
          onAction={canManage ? () => router.push(`${base}/new` as never) : undefined}
        />
      ) : (
        <SectionPanel title={resident ? 'Bewohnerbezogene Pflegeprozesse' : 'Klientenbezogene Pflegeprozesse'}>
          {items.map((item) => (
            <Pressable key={item.id} style={styles.card} onPress={() => router.push(`${base}/${item.id}` as never)}>
              <View style={styles.flex}>
                <Text style={styles.title}>{item.subjectName}</Text>
                <Text style={styles.meta}>
                  {CARE_ASSESSMENT_VARIANT_LABELS[item.variant]} · Version {item.version} · {item.completenessPercent} %
                </Text>
                <View style={styles.badges}>
                  <PremiumBadge label={STATUS[item.status]} variant={item.status === 'approved' ? 'green' : 'cyan'} />
                  <PremiumBadge label={`${item.activeRiskCount} Risiken`} variant={item.activeRiskCount ? 'warning' : 'muted'} />
                  <PremiumBadge label={`${item.openMeasureCount} Maßnahmen`} variant="purple" />
                </View>
              </View>
              <Text style={styles.open}>Öffnen ›</Text>
            </Pressable>
          ))}
        </SectionPanel>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: { ...typography.h1, color: colors.cyan },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: { flex: 1, gap: spacing.xs },
  title: { ...typography.h3 },
  meta: { ...typography.caption, color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  open: { ...typography.label, color: colors.cyan },
});
