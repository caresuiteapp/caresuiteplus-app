import { StyleSheet, Text, View } from 'react-native';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { PortalAnnouncementsHero } from '@/components/portal';
import { PremiumCard } from '@/components/ui';
import { employeePortalDemo } from '@/data/demo/domains/employeePortalDemo';
import { typography, spacing } from '@/theme';
import { portalPremium } from '@/design/tokens/portalPremium';

/** WP332 — Portal-Sicht Mitarbeiter */
export function EmployeePortalAnnouncementsScreen() {
  const records = employeePortalDemo.records;
  const activeCount = records.filter((r) => r.status === 'aktiv').length;

  return (
    <PortalTabScreen title="Ankündigungen" subtitle="Mitteilungen aus dem Office">
      <View style={styles.scroll}>
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
      </View>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md },
  title: { ...typography.bodyStrong, color: portalPremium.text.primary },
  meta: { ...typography.caption, color: portalPremium.text.secondary },
});
