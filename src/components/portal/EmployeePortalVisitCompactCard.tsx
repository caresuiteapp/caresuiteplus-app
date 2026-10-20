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
  completed?: boolean;
  warning?: boolean;
  actionLabel?: string;
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
  completed = false,
  warning = false,
  actionLabel = 'Öffnen →',
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
          color: pending || warning ? '#B7791F' : completed ? '#16A34A' : '#64748B',
          fontWeight: '800',
        },
        title: { ...typography.bodyStrong, color: text.primary },
        status: { ...typography.caption, color: text.secondary },
        subtitle: { ...typography.caption, color: text.muted },
        action: { ...typography.caption, color: disabled ? text.muted : '#0F766E', marginTop: spacing.xs, fontWeight: '700' },
      }),
    [disabled, pending, completed, warning, text],
  );

  const content = (
    <PremiumCard accentColor={accentColor} style={styles.card} contentStyle={styles.cardContent}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}><Text style={styles.icon}>{icon ?? '✓'}</Text></View>
        <Text style={styles.state} testID={testID ? `${testID}-state` : undefined}>
          {pending ? '↻' : warning ? '!' : completed ? '✓' : '○'}
        </Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.status}>{status}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {onPress && !disabled ? <Text style={styles.action}>{actionLabel}</Text> : null}
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
