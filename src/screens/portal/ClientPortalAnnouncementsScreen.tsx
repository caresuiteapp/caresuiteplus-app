import { ScrollView, StyleSheet, Text } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import { PortalAnnouncementsHero } from '@/components/portal';
import { PremiumCard } from '@/components/ui';
import { clientPortalDemo } from '@/data/demo/domains/clientPortalDemo';
import { typography, spacing } from '@/theme';

/** WP352 — Portal-Sicht Klient:innen */
export function ClientPortalAnnouncementsScreen() {
  const records = clientPortalDemo.records;
  const activeCount = records.filter((r) => r.status === 'aktiv').length;

  return (
    <CareLightPageShell title="Mitteilungen" subtitle="Klient:innenportal · WP 352">
      <ScrollView contentContainerStyle={styles.scroll}>
        <PortalAnnouncementsHero
          scope="portal_client"
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
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption },
});
