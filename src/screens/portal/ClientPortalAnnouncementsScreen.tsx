import { View, StyleSheet } from 'react-native';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { PortalEmptyState } from '@/components/portal/assist/PortalEmptyState';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { careSpacing } from '@/design/tokens/spacing';

export function ClientPortalAnnouncementsScreen() {
  return (
    <PortalTabScreen title="Mitteilungen" hideHeaderOnPhone>
      <View style={styles.content}>
        <PortalGlassHero
          title="Mitteilungen"
          subtitle="Wichtige Informationen von Ihrem Pflegebüro"
          showStatusDot
        />
        <PortalEmptyState
          title="Keine neuen Mitteilungen"
          message="Sobald Ihr Pflegebüro eine Information für Sie veröffentlicht, erscheint sie hier."
        />
      </View>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: careSpacing.md,
    paddingBottom: careSpacing.xxl,
  },
});
