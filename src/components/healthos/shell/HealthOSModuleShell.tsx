import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { healthosDensity } from '../tokens';
import { HealthOSAppShell } from './HealthOSAppShell';
import { resolveHealthOSShellBreakpoint } from './healthosShellLayoutRules';

type Props = {
  children: ReactNode;
  moduleLabel: string;
  sidebar?: ReactNode;
  topBar?: ReactNode;
  bottomNav?: ReactNode;
  breadcrumbs?: ReactNode;
  detailPanel?: ReactNode;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Module-level shell (Office / Assist) — composes HealthOSAppShell slots.
 * Adoption in H3/H4; legacy desktop shell not wired here.
 */
export function HealthOSModuleShell({
  children,
  moduleLabel,
  sidebar,
  topBar,
  bottomNav,
  breadcrumbs,
  detailPanel,
  style,
  testID = 'healthos-module-shell',
}: Props) {
  const { width } = useWindowDimensions();
  const breakpoint = resolveHealthOSShellBreakpoint(width);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        moduleTag: {
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
        },
        content: {
          flex: 1,
          gap: healthosDensity.page.gap,
        },
      }),
    [],
  );

  return (
    <HealthOSAppShell
      sidebar={sidebar}
      topBar={topBar}
      bottomNav={bottomNav}
      breadcrumbs={breadcrumbs}
      detailPanel={detailPanel}
      style={style}
      testID={testID}
    >
      <View
        accessibilityLabel={moduleLabel}
        style={styles.moduleTag}
        testID={`${testID}-breakpoint-${breakpoint}`}
      />
      <View style={styles.content}>{children}</View>
    </HealthOSAppShell>
  );
}
