import { StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';

type PortalEmptyStateProps = {
  title: string;
  message: string;
  icon?: string;
};

/** Shared Aurora/Glass empty state for both portals. */
export function PortalEmptyState({ title, message, icon = '✨' }: PortalEmptyStateProps) {
  const text = useAuroraAdaptiveText();

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.title, { color: text.primary }]}>{title}</Text>
      </View>
      <EmptyState title="" message={message} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.lg },
  header: { alignItems: 'center', marginBottom: careSpacing.sm, gap: careSpacing.xs },
  icon: { fontSize: 28 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
