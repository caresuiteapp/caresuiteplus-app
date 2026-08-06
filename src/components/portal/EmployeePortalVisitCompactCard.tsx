import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PremiumCard } from '@/components/ui/PremiumCard';
import {
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import { spacing, typography } from '@/theme';

type EmployeePortalVisitCompactCardProps = {
  title: string;
  status: string;
  subtitle?: string;
  onPress?: () => void;
  testID?: string;
  accentColor?: string;
  icon?: string;
  disabled?: boolean;
  pending?: boolean;
};

export function EmployeePortalVisitCompactCard({
  title,
  status,
  subtitle,
  onPress,
  testID,
  accentColor,
  icon,
  disabled = false,
  pending = false,
}: EmployeePortalVisitCompactCardProps) {
  const text = employeePortalExecutionText;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { width: '100%', minWidth: 0 },
        card: { minHeight: 132, width: '100%', minWidth: 0 },
        cardContent: { gap: spacing.xs, justifyContent: 'space-between' },
        topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        iconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13, 148, 136, 0.09)' },
        icon: { fontSize: 21, color: '#0F8F8A', fontWeight: '700' },
        state: {
          fontSize: 16,
          color: pending ? '#B7791F' : disabled ? '#94A3B8' : '#16A34A',
          fontWeight: '800',
        },
        title: { ...typography.bodyStrong, color: text.primary },
        status: { ...typography.caption, color: text.secondary },
        subtitle: { ...typography.caption, color: text.muted },
        action: { ...typography.caption, color: disabled ? text.muted : '#0F766E', marginTop: spacing.xs, fontWeight: '700' },
      }),
    [disabled, pending, text],
  );

  const content = (
    <PremiumCard accentColor={accentColor} style={styles.card} contentStyle={styles.cardContent}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}><Text style={styles.icon}>{icon ?? '✓'}</Text></View>
        <Text style={styles.state}>{pending ? '↻' : disabled ? '○' : '✓'}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.status}>{status}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {onPress ? <Text style={styles.action}>{disabled ? 'Nach Einsatzende' : 'Öffnen →'}</Text> : null}
    </PremiumCard>
  );

  if (!onPress || disabled) return content;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) =>
        [
          styles.root,
          pressed ? { opacity: 0.92 } : null,
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
        ] as ViewStyle[]
      }
    >
      {content}
    </Pressable>
  );
}
