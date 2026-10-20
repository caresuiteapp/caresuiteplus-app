import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState } from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { portalPremium } from '@/design/tokens/portalPremium';

type PortalEmptyStateProps = {
  title: string;
  message: string;
  icon?: string;
};

/** Shared Aurora/Glass empty state for both portals. */
export function PortalEmptyState({ title, message, icon = '✨' }: PortalEmptyStateProps) {
  const text = useAuroraAdaptiveText();
  const iconName = icon === '❓'
    ? 'help-circle-outline'
    : icon === '✓'
      ? 'checkmark-circle-outline'
      : icon === '💶'
        ? 'wallet-outline'
        : 'sparkles-outline';

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconStage}>
          <Ionicons name={iconName} size={27} color={portalPremium.accent.blueDark} />
        </View>
        <Text style={[styles.title, { color: text.primary }]}>{title}</Text>
      </View>
      <EmptyState title="" message={message} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.lg },
  header: { alignItems: 'center', marginBottom: careSpacing.sm, gap: careSpacing.xs },
  iconStage: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    backgroundColor: portalPremium.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
