import { ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  children: ReactNode;
  scroll?: boolean;
  /** On phone: skip duplicate page header — hero or section title carries context. */
  hideHeaderOnPhone?: boolean;
  eyebrow?: string;
};

export function PortalTabScreen({
  title,
  children,
  scroll = true,
  hideHeaderOnPhone = false,
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
        <View style={[styles.bareContent, barePaddingStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScreenShell
      title={title}
      subtitle={isPhone ? undefined : 'Ihr persönlicher Portalbereich'}
      showBack={false}
      scroll={scroll}
      hideMobileLogout
      mobileContentPaddingBottom={showBottomTabs ? bareBottomPadding : undefined}
    >
      <View style={styles.content}>{children}</View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  bare: {
    flex: 1,
    backgroundColor: 'transparent',
    minHeight: 0,
  },
  bareContent: {
    flex: 1,
    minHeight: 0,
  },
});
