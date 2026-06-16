import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PdlCockpitHero } from '@/components/reporting/PdlCockpitHero';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumCard,
} from '@/components/ui';
import { usePdlCockpit } from '@/hooks/usePdlCockpit';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp501A11y } from '@/lib/a11y/wp501-reporting';
import {
  isPdlCockpitLiveReady,
  PDL_COCKPIT_PREPARED_MESSAGE,
} from '@/lib/reporting/reportingModuleConfig';
import { colors, spacing, typography } from '@/theme';

const SEVERITY_VARIANT = {
  critical: 'red' as const,
  warning: 'orange' as const,
  info: 'cyan' as const,
};

const PRIORITY_VARIANT = {
  high: 'red' as const,
  medium: 'orange' as const,
  low: 'cyan' as const,
};

/** WP503 — PDL-Cockpit Dashboard */
export function PdlCockpitScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh } = usePdlCockpit();

  if (!can('business.reporting.view')) {
    return (
      <ScreenShell title="PDL-Cockpit" subtitle={roleLabel ?? 'Reporting'} showBack={false} a11yMeta={wp501A11y}>
        <LockedActionBanner
          message={check('business.reporting.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && !data) {
    return (
      <ScreenShell title="PDL-Cockpit" subtitle="WP 503" showBack={false} a11yMeta={wp501A11y}>
        <LoadingState message="KPIs und Aufgaben werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && !data) {
    return (
      <ScreenShell title="PDL-Cockpit" subtitle="Fehler" showBack={false} a11yMeta={wp501A11y}>
        <ErrorState title="PDL-Cockpit" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const snapshot = data!;

  return (
    <ScreenShell
      title="PDL-Cockpit"
      subtitle="Pflegedienstleitung · WP 503"
      showBack={false}
      a11yMeta={wp501A11y}
      rightSlot={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Pressable onPress={() => router.push('/business/reporting/dashboard' as never)}>
            <Text style={styles.link}>KPI-Dashboard</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/business/reporting/list' as never)}>
            <Text style={styles.link}>Berichte</Text>
          </Pressable>
        </View>
      }
    >
      <PdlCockpitHero
        snapshot={snapshot}
        roleKey={roleKey}
        openTaskCount={snapshot.openTasks.length}
        riskCount={snapshot.risks.length}
      />

      {!isPdlCockpitLiveReady() ? (
        <InfoBanner title="Live-Pfad in Vorbereitung" message={PDL_COCKPIT_PREPARED_MESSAGE} />
      ) : null}

      <PremiumCard>
        <Text style={styles.sectionTitle}>Offene Aufgaben</Text>
        {snapshot.openTasks.length === 0 ? (
          <EmptyState title="Keine Aufgaben" message="Alle PDL-Aufgaben sind erledigt." />
        ) : (
          snapshot.openTasks.map((task) => (
            <View key={task.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{task.title}</Text>
                <Text style={styles.rowMeta}>
                  {task.assignee} · fällig {new Date(task.dueDate).toLocaleDateString('de-DE')}
                </Text>
              </View>
              <PremiumBadge label={task.priority} variant={PRIORITY_VARIANT[task.priority]} />
            </View>
          ))
        )}
      </PremiumCard>

      <PremiumCard>
        <Text style={styles.sectionTitle}>Risiken & Hinweise</Text>
        {snapshot.risks.map((risk) => (
          <View key={risk.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{risk.label}</Text>
              <Text style={styles.rowMeta}>{risk.hint}</Text>
            </View>
            <PremiumBadge label={risk.severity} variant={SEVERITY_VARIANT[risk.severity]} />
          </View>
        ))}
      </PremiumCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowTitle: { ...typography.bodyStrong },
  rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  link: { ...typography.caption, color: colors.cyan },
});
