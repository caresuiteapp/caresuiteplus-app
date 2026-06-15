import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { radius, spacing } from '@/theme';

type SectionPanelProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function SectionPanel({ title, subtitle, children }: SectionPanelProps) {
  const { colors, typography } = useLegacyTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          backgroundColor: colors.bgSurface,
          overflow: 'hidden',
        },
        header: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSoft,
        },
        title: {
          ...typography.h3,
        },
        subtitle: {
          ...typography.caption,
          marginTop: 4,
        },
        body: {
          padding: spacing.md,
          gap: spacing.sm,
        },
      }),
    [colors.bgSurface, colors.borderSoft, typography.caption, typography.h3],
  );

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}
