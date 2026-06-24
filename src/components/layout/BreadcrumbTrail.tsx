import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useInteractiveTextColor } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { typography } from '@/theme';

type BreadcrumbTrailProps = {
  trail: BreadcrumbTrailType;
};

export function BreadcrumbTrail({ trail }: BreadcrumbTrailProps) {
  const router = useRouter();
  const { colors, isLight } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const linkColor = useInteractiveTextColor();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 2,
        },
        segment: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        link: {
          ...typography.caption,
          color: linkColor,
          fontWeight: '600',
        },
        text: {
          ...typography.caption,
          color: isLight ? text.secondary : colors.cyan,
          opacity: 0.7,
        },
        current: {
          opacity: 1,
          fontWeight: '600',
          color: isLight ? text.primary : colors.cyan,
        },
        sep: {
          ...typography.caption,
          color: isLight ? text.muted : colors.cyan,
          opacity: 0.5,
        },
      }),
    [colors.cyan, isLight, linkColor, text.muted, text.primary, text.secondary],
  );

  if (trail.length <= 1) return null;

  return (
    <View style={styles.row}>
      {trail.map((item, index) => {
        const isLast = index === trail.length - 1;
        const canNavigate = !isLast && !item.isCurrent && item.path !== '/';

        return (
          <View key={`${item.path}-${index}`} style={styles.segment}>
            {canNavigate ? (
              <Pressable
                onPress={() => router.push(item.path as never)}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityLabel={`Navigiere zu ${item.label}`}
              >
                <Text style={styles.link}>{item.label}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.text, isLast && styles.current]}>{item.label}</Text>
            )}
            {!isLast ? <Text style={styles.sep}> › </Text> : null}
          </View>
        );
      })}
    </View>
  );
}
