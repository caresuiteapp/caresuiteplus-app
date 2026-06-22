import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careTypography } from '@/design/tokens/typography';

type CareLightBreadcrumbTrailProps = {
  trail: BreadcrumbTrailType;
};

export function CareLightBreadcrumbTrail({ trail }: CareLightBreadcrumbTrailProps) {
  const router = useRouter();
  const { c } = useCareLightPalette();
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
          ...careTypography.caption,
          color: c.cyan,
          fontWeight: '600',
        },
        text: {
          ...careTypography.caption,
          color: c.muted,
        },
        current: {
          color: c.text,
          fontWeight: '600',
        },
        sep: {
          ...careTypography.caption,
          color: c.muted,
          opacity: 0.6,
        },
      }),
    [c.cyan, c.muted, c.text],
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
