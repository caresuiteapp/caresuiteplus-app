import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { glassFx } from '@/design/tokens/motion';
import { radius, spacing } from '@/theme';

type SectionPanelProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function SectionPanel({ title, subtitle, children }: SectionPanelProps) {
  const { colors, typography, isDark } = useLegacyTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: isDark ? glassFx.border : colors.borderSoft,
          backgroundColor: isDark ? 'transparent' : colors.bgSurface,
          overflow: 'hidden',
          position: 'relative',
        },
        innerBorder: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: glassFx.innerBorder,
        },
        header: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? glassFx.hairline : colors.borderSoft,
        },
        title: { ...typography.h3 },
        subtitle: { ...typography.caption, marginTop: 4 },
        body: { padding: spacing.md, gap: spacing.sm },
      }),
    [colors.bgSurface, colors.borderSoft, isDark, typography.caption, typography.h3],
  );

  return (
    <View style={styles.panel}>
      {isDark ? (
        <>
          <LinearGradient
            colors={glassFx.surface}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.innerBorder} pointerEvents="none" />
        </>
      ) : null}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}
