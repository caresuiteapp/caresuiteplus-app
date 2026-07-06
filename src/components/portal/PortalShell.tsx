import { ReactNode } from 'react';
import type { PortalKind } from '@/types/portalSystem';
import { PortalShellLayout, type PortalShellKind } from '@/components/layout/portal';
import { moduleColor } from '@/design/tokens/modules';
import { PortalMessengerFocusProvider } from '@/lib/portal/portalMessengerFocusContext';

type PortalShellProps = {
  kind: PortalKind;
  children: ReactNode;
  accentColor?: string;
};

/**
 * Unified portal shell — client and employee use PortalShellLayout (scroll-only mobile).
 * Children pass through without a flex slot wrapper so AutoScrollView can measure content height.
 */
export function PortalShell({ kind, children, accentColor }: PortalShellProps) {
  const resolvedAccent = accentColor ?? moduleColor('assist');
  const shellKind: PortalShellKind =
    kind === 'employee' ? 'employee' : kind === 'relative' ? 'relative' : 'client';

  return (
    <PortalMessengerFocusProvider>
      <PortalShellLayout accentColor={resolvedAccent} kind={shellKind}>
        {children}
      </PortalShellLayout>
    </PortalMessengerFocusProvider>
  );
}
