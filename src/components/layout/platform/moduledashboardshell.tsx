import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BreadcrumbBar, CareLightScreen, PageHeader } from '@/components/layout';
import type { BreadcrumbSegment } from '@/components/layout/platform/breadcrumbbar';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { careSpacing } from '@/design/tokens/spacing';

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
  const header = (
    <>
      <PageHeader badge={moduleLabel} title={title} subtitle={subtitle} />
      {breadcrumbs ? <BreadcrumbBar segments={breadcrumbs} /> : null}
    </>
  );

  if (mode === 'dark') {
    return (
      <View style={[styles.page, fill && styles.pageFill]}>
        {header}
        {fill ? <View style={styles.bodyFill}>{children}</View> : children}
      </View>
    );
  }

  return (
    <CareLightScreen scroll={scroll} embedded={fill}>
      {header}
      {fill ? <View style={styles.bodyFill}>{children}</View> : children}
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: careSpacing.md,
  },
});
