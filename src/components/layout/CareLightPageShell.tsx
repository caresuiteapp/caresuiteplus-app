import type { ReactNode } from 'react';
import type { DomainA11yMeta } from '@/lib/a11y/domainScreenMeta';
import { ScreenShell } from './ScreenShell';

type CareLightPageShellProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  showBreadcrumbs?: boolean;
  a11yMeta?: DomainA11yMeta;
};

/** Altname ohne eigene Designwelt: alle Routen laufen ueber ScreenShell. */
export function CareLightPageShell(props: CareLightPageShellProps) {
  return <ScreenShell {...props} />;
}
