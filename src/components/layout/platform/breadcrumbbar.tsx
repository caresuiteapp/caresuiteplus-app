import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, typography } from '@/theme';

export type BreadcrumbSegment = {
  label: string;
  href?: string;
};

type BreadcrumbBarProps = {
  segments: BreadcrumbSegment[];
};

export function BreadcrumbBar({ segments }: BreadcrumbBarProps) {
  const router = useRouter();
  const { colors } = useLegacyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (segments.length <= 1) {
    return null;
  }

  return (
    <View style={styles.row}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const canNavigate = Boolean(segment.href) && !isLast;

        return (
          <View key={`${segment.label}-${index}`} style={styles.segment}>
            {canNavigate ? (
              <Pressable onPress={() => router.push(segment.href as never)} accessibilityRole="link">
                <Text style={styles.link}>{segment.label}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.text, isLast && styles.current]}>{segment.label}</Text>
            )}
            {!isLast ? <Text style={styles.sep}>/</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useLegacyTheme>['colors']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 2,
    },
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    link: {
      ...typography.caption,
      color: colors.cyan,
      fontWeight: '600',
    },
    text: {
      ...typography.caption,
      color: colors.textMuted,
    },
    current: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    sep: {
      ...typography.caption,
      color: colors.textMuted,
      opacity: 0.5,
      marginHorizontal: 4,
    },
  });
}
