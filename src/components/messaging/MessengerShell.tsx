import { ReactNode, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMessagingGlassSurface } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { spacing, radius } from '@/theme';

export type MessengerShellProps = {
  /** Inbox / thread list pane */
  inbox: ReactNode;
  /** Active conversation pane */
  thread: ReactNode;
  /** Placeholder when no thread is selected (split view only) */
  emptyThread?: ReactNode;
  selectedThreadId: string | null;
  onCloseThread: () => void;
  /** Shown in the mobile thread chrome header */
  threadTitle?: string;
  variant?: 'default' | 'glass';
};

function DefaultEmptyThread({ message }: { message: string }) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  return (
    <View style={emptyStyles.wrap}>
      <Text style={[emptyStyles.title, typography.h3, { color: c.text }]}>Chat auswählen</Text>
      <Text style={[emptyStyles.text, typography.body, { color: c.muted }]}>{message}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { textAlign: 'center' },
  text: { textAlign: 'center', maxWidth: 360 },
});

/**
 * Responsive messenger chrome: split inbox + thread on tablet/desktop,
 * full-width list or full-screen thread on phone.
 */
export function MessengerShell({
  inbox,
  thread,
  emptyThread,
  selectedThreadId,
  onCloseThread,
  threadTitle = 'Chat',
  variant = 'default',
}: MessengerShellProps) {
  const { useMasterDetail, masterPaneWidth } = usePlatformLayout();
  const { c } = useCareLightPalette();
  const { colors } = useLegacyTheme();
  const isGlass = variant === 'glass';
  const { surfaces, ink } = useMessagingGlassSurface(isGlass);

  const showSplit = useMasterDetail;
  const showMobileThread = !showSplit && !!selectedThreadId;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          minHeight: 0,
          width: '100%',
        },
        splitRow: {
          flex: 1,
          minHeight: 0,
          flexDirection: 'row',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: isGlass ? surfaces.borderStrong : c.border,
          backgroundColor: isGlass ? surfaces.panel : c.surface,
          overflow: 'hidden',
        },
        inboxPane: {
          flexShrink: 0,
          minHeight: 0,
          borderRightWidth: 1,
          borderRightColor: isGlass ? surfaces.border : c.border,
          backgroundColor: isGlass ? surfaces.panel : 'transparent',
        },
        threadPane: {
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          backgroundColor: isGlass ? surfaces.card : 'transparent',
        },
        mobileThread: {
          flex: 1,
          minHeight: 0,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: isGlass ? surfaces.borderStrong : c.border,
          backgroundColor: isGlass ? surfaces.card : c.surface,
          overflow: 'hidden',
        },
        mobileList: {
          flex: 1,
          minHeight: 0,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: isGlass ? surfaces.borderStrong : c.border,
          backgroundColor: isGlass ? surfaces.panel : c.surface,
          overflow: 'hidden',
        },
        mobileChrome: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: isGlass ? surfaces.border : c.border,
          backgroundColor: isGlass ? surfaces.panel : colors.bgSurface,
        },
        backBtn: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.md,
        },
        backLabel: {
          color: c.violet,
          fontWeight: '700',
          fontSize: 15,
        },
        chromeTitle: {
          flex: 1,
          fontWeight: '700',
          fontSize: 16,
          color: ink?.primary ?? c.text,
        },
      }),
    [c, colors.bgSurface, ink, isGlass, surfaces],
  );

  const placeholder =
    emptyThread ?? (
      <DefaultEmptyThread message="Wählen Sie einen Chat aus der Liste, um den Verlauf anzuzeigen." />
    );

  if (showSplit) {
    return (
      <View style={styles.root}>
        <View style={styles.splitRow}>
          <View style={[styles.inboxPane, { width: masterPaneWidth, maxWidth: masterPaneWidth }]}>
            {inbox}
          </View>
          <View style={styles.threadPane}>
            {selectedThreadId ? thread : placeholder}
          </View>
        </View>
      </View>
    );
  }

  if (showMobileThread) {
    return (
      <View style={styles.root}>
        <View style={styles.mobileThread}>
          <View style={styles.mobileChrome}>
            <Pressable
              onPress={onCloseThread}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Zurück zur Liste"
              testID="messenger-back-to-list"
            >
              <Text style={styles.backLabel}>← Liste</Text>
            </Pressable>
            <Text style={styles.chromeTitle} numberOfLines={1}>
              {threadTitle}
            </Text>
          </View>
          {thread}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.mobileList}>{inbox}</View>
    </View>
  );
}

/** Shared flex container for messenger screens inside ScreenShell. */
export function messengerScreenRootStyle(viewportHeight: number) {
  if (Platform.OS === 'web') {
    return {
      flex: 1,
      minHeight: 'calc(100dvh - 200px)' as unknown as number,
    };
  }
  return {
    flex: 1,
    minHeight: Math.max(480, viewportHeight - 240),
  };
}
