import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PortalKind } from '@/types/portalSystem';
import { PortalShellLayout } from '@/components/layout/portal';
import { moduleColor } from '@/design/tokens/modules';

type PortalShellProps = {
  kind: PortalKind;
  children: ReactNode;
  accentColor?: string;
};

/**
 * Unified portal shell — client and employee use PortalShellLayout (scroll-only mobile).
 */
export function PortalShell({ kind, children, accentColor }: PortalShellProps) {
  const resolvedAccent = accentColor ?? moduleColor('assist');

  return (
    <PortalShellLayout accentColor={resolvedAccent} kind={kind === 'client' ? 'client' : 'employee'}>
      <View style={styles.slot}>{children}</View>
    </PortalShellLayout>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
});
