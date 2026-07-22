import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { typography } from '@/theme';
import { spatialCareColors } from '@/design/tokens/spatialCareSuite';

type BreadcrumbTrailProps = {
  trail: BreadcrumbTrailType;
};

export function BreadcrumbTrail({ trail }: BreadcrumbTrailProps) {
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          alignItems: 'center',
          marginBottom: 2,
        },
        segment: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        link: {
          ...typography.caption,
          color: spatialCareColors.cyanLight,
          fontWeight: '600',
        },
        text: {
          ...typography.caption,
          color: spatialCareColors.inkMuted,
          opacity: 1,
        },
        current: {
          opacity: 1,
          fontWeight: '600',
          color: spatialCareColors.white,
        },
        sep: {
          ...typography.caption,
          color: spatialCareColors.inkMuted,
          opacity: 0.8,
        },
      }),
    [],
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
