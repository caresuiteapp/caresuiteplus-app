import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { simplifyBreadcrumbTrailForMobile } from '@/lib/ui/uiVisibility';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careTypography } from '@/design/tokens/typography';

type CareLightBreadcrumbTrailProps = {
  trail: BreadcrumbTrailType;
};

export function CareLightBreadcrumbTrail({ trail }: CareLightBreadcrumbTrailProps) {
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
    ...careTypography.caption,
    color: careLightColors.cyan,
    fontWeight: '600',
  },
  text: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
  current: {
    color: careLightColors.navy,
    fontWeight: '600',
  },
  sep: {
    ...careTypography.caption,
    color: careLightColors.muted,
    opacity: 0.6,
  },
});
