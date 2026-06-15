import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import { colors, typography } from '@/theme';

type ContextCardProps = {
  icon: string;
  label: string;
  count: number;
  accentColor?: string;
};

export function ContextCard({
  icon,
  label,
  count,
  accentColor = colors.cyan,
}: ContextCardProps) {
  return (
    <PremiumCard style={styles.card} accentColor={accentColor}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.count, { color: accentColor }]}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    alignItems: 'center',
  },
  icon: {
    fontSize: 22,
    marginBottom: 4,
  },
  count: {
    fontSize: 22,
    fontWeight: '800',
  },
  label: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 4,
  },
});
