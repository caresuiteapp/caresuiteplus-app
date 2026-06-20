import { ScrollView, StyleSheet, Text } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { PortalAnnouncementsHero } from '@/components/portal';
import { PremiumCard } from '@/components/ui';
import { employeePortalDemo } from '@/data/demo/domains/employeePortalDemo';
import { typography, spacing } from '@/theme';

/** WP332 — Portal-Sicht Mitarbeiter */
export function EmployeePortalAnnouncementsScreen() {
  const records = employeePortalDemo.records;
  const activeCount = records.filter((r) => r.status === 'aktiv').length;

  return (
    <ScreenShell title="Ankündigungen" subtitle="Mitarbeiterportal · WP 332">
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption },
});
