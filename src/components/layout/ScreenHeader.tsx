import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { MOBILE_MIN_TOUCH_TARGET } from '@/lib/platform/webSafeArea';
import { spatialCare, spatialCareColors } from '@/design/tokens/spatialCareSuite';
import { spacing, typography } from '@/theme';
import { BreadcrumbTrail } from './BreadcrumbTrail';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbTrail?: BreadcrumbTrailType;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  /** Hide breadcrumb trail on phone for compact portal pages. */
  simplifyOnPhone?: boolean;
};

export function ScreenHeader({
  title,
  subtitle,
  breadcrumbTrail,
  showBack = true,
  onBack,
  rightSlot,
  simplifyOnPhone = true,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { isPhone } = useDeviceClass();
  const showBreadcrumbs = simplifyOnPhone ? !isPhone && breadcrumbTrail : breadcrumbTrail;
  const sideInsetWidth = showBack || rightSlot ? 88 : 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          minHeight: isPhone ? 68 : 82,
          borderBottomWidth: 1,
          borderBottomColor: spatialCare.border,
          backgroundColor: spatialCare.navigation,
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: `blur(${spatialCare.blur.navigation}px) saturate(1.25)`,
                WebkitBackdropFilter: `blur(${spatialCare.blur.navigation}px) saturate(1.25)`,
              } as unknown as ViewStyle)
            : null),
        },
        left: {
          width: sideInsetWidth,
          minWidth: sideInsetWidth,
        },
        center: {
          flex: 1,
          alignItems: isPhone ? 'center' : 'flex-start',
          minWidth: 0,
        },
        right: {
          width: sideInsetWidth,
          minWidth: sideInsetWidth,
          maxWidth: sideInsetWidth || 120,
          alignItems: 'flex-end',
          flexShrink: 0,
        },
        backButton: {
          minWidth: MOBILE_MIN_TOUCH_TARGET,
          minHeight: MOBILE_MIN_TOUCH_TARGET,
          justifyContent: 'center',
          paddingVertical: spacing.xs,
        },
        backText: {
          ...typography.caption,
          color: spatialCareColors.cyanLight,
          fontWeight: '700',
        },
        title: {
          ...typography.h3,
          color: spatialCare.textOnNight,
          textAlign: isPhone ? 'center' : 'left',
          flexShrink: 1,
        },
        subtitle: {
          ...typography.caption,
          color: spatialCare.textOnNightMuted,
          textAlign: isPhone ? 'center' : 'left',
          marginTop: 2,
        },
      }),
    [isPhone, sideInsetWidth],
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/' as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
            <Text style={styles.backText}>← Zurück</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.center}>
        {showBreadcrumbs ? <BreadcrumbTrail trail={breadcrumbTrail!} /> : null}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{rightSlot}</View>
    </View>
  );
}
