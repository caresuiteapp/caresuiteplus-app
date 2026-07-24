import type { ReactNode } from 'react';
import type { BreadcrumbSegment } from '@/components/layout/platform/breadcrumbbar';
import { ScreenShell } from '@/components/layout';

type ModuleDashboardShellProps = {
  moduleLabel: string;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbSegment[];
  children: ReactNode;
};

/**
 * Module dashboards no longer own a second page/header design.
 * Every dashboard uses the same ScreenShell as the payroll reference.
 */
export function ModuleDashboardShell({
  moduleLabel,
  title = 'Dashboard',
  subtitle,
  children,
}: ModuleDashboardShellProps) {
  return (
    <ScreenShell
      title={title}
      subtitle={subtitle ?? moduleLabel}
      showBack={false}
    >
      {children}
    </ScreenShell>
  );
}
