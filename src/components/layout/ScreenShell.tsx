import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBreadcrumbs } from '@/lib/navigation';
import { isAuthRoutePath, isPortalRoutePath } from '@/lib/navigation/isPortalRoute';
import type { DomainA11yMeta } from '@/lib/a11y/domainScreenMeta';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import {
  MOBILE_AUTH_BOTTOM_RESERVE,
  webSafeAreaCalc,
  webShellViewportLockStyle,
} from '@/lib/platform/webSafeArea';
import { spacing } from '@/theme';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { AutoScrollView } from './AutoScrollView';
import { ScreenHeader } from './ScreenHeader';
import { LinearGradient } from 'expo-linear-gradient';

type ScreenShellProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  showBreadcrumbs?: boolean;
  a11yMeta?: DomainA11yMeta;
  hideMobileLogout?: boolean;
  mobileContentPaddingBottom?: number;
};

/** Verbindliche Seitenschale für alle Module und Portale. */
export function ScreenShell({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightSlot,
  children,
  scroll = true,
  showBreadcrumbs = true,
  a11yMeta,
  hideMobileLogout = false,
  mobileContentPaddingBottom,
}: ScreenShellProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const effectiveRightSlot = hideMobileLogout && isPhone ? undefined : rightSlot;
  const breadcrumbTrail = showBreadcrumbs && pathname !== '/' ? getBreadcrumbs(pathname) : undefined;
  const isPortalShell = isPortalRoutePath(pathname);
  const isAuthRoute = isAuthRoutePath(pathname);
  const shellScroll = scroll && !(isPhone && isPortalShell);
  const useMobileTouchScroll = shellScroll && isPhone && !isPortalShell;
  const bottomPad =
    isPhone && isAuthRoute
      ? Platform.OS === 'web'
        ? (webSafeAreaCalc('bottom', MOBILE_AUTH_BOTTOM_RESERVE) as number)
        : MOBILE_AUTH_BOTTOM_RESERVE + Math.max(insets.bottom, spacing.sm)
      : (mobileContentPaddingBottom ?? spacing.xxl);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          flexGrow: 1,
          width: '100%',
          alignSelf: 'stretch',
          minHeight: 0,
          backgroundColor: 'transparent',
        },
        stage: {
          flex: 1,
          flexGrow: 1,
          minHeight: 0,
          width: '100%',
          backgroundColor: 'rgba(238,234,245,0.97)',
          borderTopLeftRadius: spatialCare.radius.shell,
          borderTopRightRadius: spatialCare.radius.shell,
          borderBottomLeftRadius: isPhone ? 0 : spatialCare.radius.stage,
          borderBottomRightRadius: isPhone ? 0 : spatialCare.radius.stage,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.78)',
          ...(Platform.OS === 'web'
            ? ({ boxShadow: spatialCare.shadowSoft } as unknown as ViewStyle)
            : null),
        },
        scrollHost: {
          flex: 1,
          flexGrow: 1,
          width: '100%',
          backgroundColor: 'transparent',
        },
        scrollContent: {
          flexGrow: isPhone && isAuthRoute ? undefined : 1,
          padding: isPhone ? spacing.md : spacing.xxl,
          gap: isPhone ? spacing.md : spacing.lg,
          paddingBottom: bottomPad,
          backgroundColor: 'transparent',
        },
        content: {
          flex: 1,
          flexGrow: 1,
          minHeight: 0,
          width: '100%',
          padding: isPhone ? spacing.md : spacing.xxl,
          gap: isPhone ? spacing.md : spacing.lg,
          backgroundColor: 'transparent',
        },
      }),
    [bottomPad, isAuthRoute, isPhone],
  );

  const body = shellScroll ? (
    useMobileTouchScroll ? (
      <AutoScrollView style={styles.scrollHost} contentContainerStyle={styles.scrollContent} fillViewport={false}>
        {children}
      </AutoScrollView>
    ) : (
      <ScrollView
        style={styles.scrollHost}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    )
  ) : (
    <View style={styles.content}>{children}</View>
  );

  const rootStyle: ViewStyle[] = [styles.root];
  if (useMobileTouchScroll && Platform.OS === 'web') rootStyle.push(webShellViewportLockStyle());

  return (
    <View
      style={rootStyle}
      testID="screen-shell"
      accessibilityLabel={a11yMeta ? `${a11yMeta.screenLabel} · WP ${a11yMeta.wpNumber}` : title}
    >
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        breadcrumbTrail={breadcrumbTrail}
        showBack={showBack}
        onBack={onBack}
        rightSlot={effectiveRightSlot}
      />
      <View
        style={styles.stage}
        accessible={!!a11yMeta}
        accessibilityRole={a11yMeta?.headingRole}
        accessibilityHint={a11yMeta?.reduceMotionHint}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.98)', 'rgba(225,220,237,0.97)', 'rgba(211,224,240,0.96)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {body}
      </View>
    </View>
  );
}
