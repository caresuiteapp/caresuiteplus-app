import { ReactNode, useMemo } from 'react';
import { View } from 'react-native';
import { BreadcrumbBar, PageHeader } from '@/components/layout/platform';
import { CareLightScreen } from '@/components/layout';
import type { BreadcrumbSegment } from '@/components/layout/platform/breadcrumbbar';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';

type ModuleDashboardShellProps = {
  moduleLabel: string;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbSegment[];
  children: ReactNode;
};

/** Shared module dashboard frame — PageHeader + breadcrumb + content. */
export function ModuleDashboardShell({
  moduleLabel,
  title = 'Dashboard',
  subtitle,
  breadcrumbs,
  children,
}: ModuleDashboardShellProps) {
  const { mode } = useThemeMode();
  const { colors } = useLegacyTheme();
  const shellHostsAurora = useShellHostsAurora();
  const pageStyle = useMemo(
    () => ({
      gap: careSpacing.md,
      backgroundColor: shellHostsAurora ? 'transparent' : colors.bgBase,
    }),
    [colors.bgBase, shellHostsAurora],
  );
  const header = (
    <>
      <PageHeader badge={moduleLabel} title={title} subtitle={subtitle} />
      {breadcrumbs ? <BreadcrumbBar segments={breadcrumbs} /> : null}
    </>
  );

  if (mode === 'dark' || shellHostsAurora) {
    return (
      <View style={pageStyle}>
        {header}
        {children}
      </View>
    );
  }

  return (
    <CareLightScreen>
      {header}
      {children}
    </CareLightScreen>
  );
}

