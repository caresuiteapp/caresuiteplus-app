import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PortalKind } from '@/types/portalSystem';
import { PortalShellLayout } from '@/components/layout/portal';
import { ShellLayout } from '@/components/layout';
import { moduleColor } from '@/design/tokens/modules';

type PortalShellProps = {
  kind: PortalKind;
  children: ReactNode;
  accentColor?: string;
};

/**
 * Unified portal shell — delegates to client or employee layout.
 */
export function PortalShell({ kind, children, accentColor }: PortalShellProps) {
  if (kind === 'client') {
    return (
      <PortalShellLayout accentColor={accentColor ?? moduleColor('assist')}>
        {children}
      </PortalShellLayout>
    );
  }

  return (
    <ShellLayout
      area="portal_employee"
      accentColor={accentColor ?? moduleColor('assist')}
      showModuleSwitcher={false}
    >
      <View style={styles.slot}>{children}</View>
    </ShellLayout>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
});
