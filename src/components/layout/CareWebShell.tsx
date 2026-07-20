import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CareSuiteWordmark } from '@/components/brand/CareSuiteWordmark';
import { resolveCareSuitePalette } from '@/design/tokens/colors';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { CareDesktopShell } from './CareDesktopShell';
import { CareLightDesktopShell } from './CareLightDesktopShell';

type CareWebShellProps = {
  area: Parameters<typeof CareDesktopShell>[0]['area'];
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
  useLightShell?: boolean;
};

/**
 * Web shell — desktop navigation with browser-safe top bar.
 */
export function CareWebShell({
  area,
  children,
  accentColor,
  showModuleSwitcher,
  useLightShell = true,
}: CareWebShellProps) {
  const insets = useSafeAreaInsets();
  const { isWeb } = usePlatformLayout();
  const { mode } = useThemeMode();
  const palette = resolveCareSuitePalette(mode);
  const DesktopShell = useLightShell ? CareLightDesktopShell : CareDesktopShell;

  return (
    <View
      style={[
        styles.root,
        useLightShell ? { backgroundColor: palette.background.app } : styles.transparentRoot,
      ]}
    >
      {isWeb && useLightShell ? (
        <View
          style={[
            styles.topbar,
            {
              paddingTop: Math.max(insets.top, careSpacing.sm),
              backgroundColor: palette.background.soft,
              borderBottomColor: `${palette.text.muted}22`,
            },
          ]}
        >
          <CareSuiteWordmark size="sm" />
          <View style={styles.topbarActions}>
            <Text style={[styles.topbarHint, { color: palette.text.muted }]}>
              Browser · responsiv
            </Text>
          </View>
        </View>
      ) : null}
      <View style={styles.body}>
        <DesktopShell
          area={area}
          accentColor={accentColor}
          showModuleSwitcher={showModuleSwitcher}
        >
          {children}
        </DesktopShell>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  transparentRoot: {
    backgroundColor: 'transparent',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: careSpacing.lg,
    paddingBottom: careSpacing.sm,
    borderBottomWidth: 1,
  },
  topbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  topbarHint: {
    ...careTypography.caption,
  },
  body: {
    flex: 1,
  },
});
