import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { simplifyBreadcrumbTrailForMobile } from '@/lib/ui/uiVisibility';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { colors, typography } from '@/theme';

type BreadcrumbTrailProps = {
  trail: BreadcrumbTrailType;
};

export function BreadcrumbTrail({ trail }: BreadcrumbTrailProps) {
  const router = useRouter();
  const { isPhone } = useDeviceClass();
  const displayTrail = isPhone ? simplifyBreadcrumbTrailForMobile(trail) : trail;

  if (displayTrail.length <= 1) return null;

  return (
    <View style={styles.row}>
      {displayTrail.map((item, index) => {
        const isLast = index === displayTrail.length - 1;
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

const styles = StyleSheet.create({
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
    color: colors.cyan,
    fontWeight: '600',
  },
  text: {
    ...typography.caption,
    color: colors.cyan,
    opacity: 0.7,
  },
  current: {
    opacity: 1,
    fontWeight: '600',
  },
  sep: {
    ...typography.caption,
    color: colors.cyan,
    opacity: 0.5,
  },
});
