import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { healthosDensity } from '../tokens';
import {
  healthosShellLayoutRules,
  resolveHealthOSShellBreakpoint,
} from './healthosShellLayoutRules';

type Props = {
  children: ReactNode;
  sidebar?: ReactNode;
  topBar?: ReactNode;
  bottomNav?: ReactNode;
  detailPanel?: ReactNode;
  breadcrumbs?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Composable HealthOS app shell — slot-based, no domain services.
 * Does not replace PlatformShell or PortalShellLayout until explicitly adopted.
 */
export function HealthOSAppShell({
  children,
  sidebar,
  topBar,
  bottomNav,
  detailPanel,
  breadcrumbs,
  style,
  testID = 'healthos-app-shell',
}: Props) {
  const { width } = useWindowDimensions();
  const breakpoint = resolveHealthOSShellBreakpoint(width);
  const rules = healthosShellLayoutRules[breakpoint];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, flexDirection: 'column' },
        body: { flex: 1, flexDirection: 'row', minHeight: 0 },
        sidebar: {
          width: breakpoint === 'tablet' ? 220 : 260,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderRightColor: 'rgba(0,0,0,0.08)',
        },
        center: { flex: 1, minWidth: 0 },
        main: {
          flex: 1,
          padding: healthosDensity.page.paddingHorizontal,
        },
        detail: {
          width: 320,
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderLeftColor: 'rgba(0,0,0,0.08)',
        },
        breadcrumbHost: {
          paddingHorizontal: healthosDensity.page.paddingHorizontal,
          paddingTop: healthosDensity.page.gap,
        },
      }),
    [breakpoint],
  );

  const showSidebar = Boolean(sidebar) && rules.sidebar.visible;
  const showBottomNav = Boolean(bottomNav) && rules.bottomNav.visible;
  const showDetail = Boolean(detailPanel) && breakpoint === 'desktop';

  return (
    <View style={[styles.root, style]} testID={testID}>
      {topBar}
      <View style={styles.body}>
        {showSidebar ? <View style={styles.sidebar}>{sidebar}</View> : null}
        <View style={styles.center}>
          {breadcrumbs && rules.topBar.breadcrumbs ? (
            <View style={styles.breadcrumbHost}>{breadcrumbs}</View>
          ) : null}
          <View style={styles.main}>{children}</View>
        </View>
        {showDetail ? <View style={styles.detail}>{detailPanel}</View> : null}
      </View>
      {showBottomNav ? bottomNav : null}
    </View>
  );
}
