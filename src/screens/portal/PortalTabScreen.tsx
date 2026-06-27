import { ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortalMobileTabHeader } from '@/components/portal/PortalMobileTabHeader';
import { ScreenShell } from '@/components/layout';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import {
  resolvePortalMobileContentPaddingBottom,
  webSafeAreaCalc,
} from '@/lib/platform/webSafeArea';
import { spacing } from '@/theme';

type PortalTabScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  /** On phone: skip duplicate page header — hero or section title carries context. */
  hideHeaderOnPhone?: boolean;
  eyebrow?: string;
};

export function PortalTabScreen({
  title,
  subtitle,
  children,
  scroll = true,
  hideHeaderOnPhone = false,
  eyebrow,
}: PortalTabScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();

  const bareBottomPadding = useMemo(() => {
    if (!showBottomTabs) return spacing.md;
    return resolvePortalMobileContentPaddingBottom(insets.bottom);
  }, [insets.bottom, showBottomTabs]);

  const barePaddingStyle = useMemo((): ViewStyle => {
    if (!showBottomTabs) return {};
    if (Platform.OS === 'web') {
      return {
        paddingBottom: webSafeAreaCalc(
          'bottom',
          PORTAL_MOBILE_NAV_HEIGHT + spacing.lg,
        ) as number,
      };
    }
    return { paddingBottom: bareBottomPadding };
  }, [bareBottomPadding, showBottomTabs]);

  if (isPhone && hideHeaderOnPhone) {
    return (
      <View style={styles.bare} testID="portal-tab-bare">
        <View style={[styles.bareContent, barePaddingStyle]}>
          {subtitle || eyebrow ? (
            <PortalMobileTabHeader title={title} subtitle={subtitle} eyebrow={eyebrow} />
          ) : null}
          {children}
        </View>
      </View>
    );
  }

  const shellScroll = isPhone ? false : scroll;

  return (
    <ScreenShell
      title={title}
      subtitle={isPhone ? subtitle : subtitle ?? 'Ihr persönlicher Portalbereich'}
      showBack={false}
      scroll={shellScroll}
      hideMobileLogout
      mobileContentPaddingBottom={showBottomTabs ? bareBottomPadding : undefined}
    >
      <View style={styles.content}>{children}</View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%' },
  bare: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  bareContent: {
    width: '100%',
    gap: spacing.md,
  },
});
