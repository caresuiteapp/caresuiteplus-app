import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';

type AssistPortalShellProps = {
  children: ReactNode;
};

/** Assist module content wrapper — section nav lives in ShellLayout bottom tabs. */
export function AssistPortalShell({ children }: AssistPortalShellProps) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minWidth: 0,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    gap: careSpacing.md,
  },
});
