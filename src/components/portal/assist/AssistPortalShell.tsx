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
    flex: 1,
    gap: careSpacing.md,
  },
});
