import { ScrollView, StyleSheet, Text } from 'react-native';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { PortalAnnouncementsHero } from '@/components/portal';
import { PremiumCard } from '@/components/ui';
import { employeePortalDemo } from '@/data/demo/domains/employeePortalDemo';
import { typography, spacing } from '@/theme';
import { spatialCare } from '@/design/tokens/spatialCareSuite';

/** WP332 — Portal-Sicht Mitarbeiter */
export function EmployeePortalAnnouncementsScreen() {
  const records = employeePortalDemo.records;
  const activeCount = records.filter((r) => r.status === 'aktiv').length;

  return (
    <PortalTabScreen title="Ankündigungen" subtitle="Mitteilungen aus dem Office">
      <ScrollView contentContainerStyle={styles.scroll}>
        <PortalAnnouncementsHero
          scope="portal_employee"
          itemCount={records.length}
          activeCount={activeCount}
        />
        {records.map((r) => (
          <PremiumCard key={r.id}>
            <Text style={styles.title}>{r.label}</Text>
            <Text style={styles.meta}>Status: {r.status}</Text>
          </PremiumCard>
        ))}
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md },
  title: { ...typography.bodyStrong, color: spatialCare.textOnNight },
  meta: { ...typography.caption, color: spatialCare.textOnNightMuted },
});
