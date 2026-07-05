import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { CareLightCard } from '@/components/ui/CareLightCard';
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
};

export function EmployeePortalVisitCompactCard({
  title,
  status,
  subtitle,
  onPress,
  testID,
  accentColor,
}: EmployeePortalVisitCompactCardProps) {
  const text = employeePortalExecutionText;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { padding: spacing.md, gap: spacing.xs },
        title: { ...typography.bodyStrong, color: text.primary },
        status: { ...typography.caption, color: text.secondary },
        subtitle: { ...typography.caption, color: text.muted },
        action: { ...typography.caption, color: text.primary, marginTop: spacing.xs, fontWeight: '600' },
      }),
    [text],
  );

  const content = (
    <CareLightCard accentColor={accentColor} style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.status}>{status}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {onPress ? <Text style={styles.action}>Öffnen →</Text> : null}
    </CareLightCard>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) =>
        [
          pressed ? { opacity: 0.92 } : null,
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
        ] as ViewStyle[]
      }
    >
      {content}
    </Pressable>
  );
}
