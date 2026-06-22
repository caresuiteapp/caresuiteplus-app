import { ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useActiveGlassTokens } from '@/design/tokens/auroraGlass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { colors, radius, spacing, typography } from '@/theme';

type MasterDetailLayoutProps = {
  master: ReactNode;
  detail: ReactNode;
  detailPlaceholder?: ReactNode;
  showDetail?: boolean;
};

const webGlassBlur = (blurPx: number): ViewStyle | null =>
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
      } as unknown as ViewStyle)
    : null;

function DefaultDetailPlaceholder({
  titleStyle,
  textStyle,
  containerStyle,
}: {
  titleStyle: TextStyle;
  textStyle: TextStyle;
  containerStyle: ViewStyle;
}) {
  return (
    <View style={containerStyle}>
      <Text style={titleStyle}>Auswahl treffen</Text>
      <Text style={textStyle}>
        Wählen Sie einen Eintrag in der Liste, um Details anzuzeigen.
      </Text>
    </View>
  );
}

/**
 * Split-pane layout for tablet and desktop. On phone, only the master pane is shown —
 * detail navigation remains stack-based via Expo Router.
 */
export function MasterDetailLayout({
  master,
  detail,
  detailPlaceholder,
  showDetail = true,
}: MasterDetailLayoutProps) {
  const { useMasterDetail, masterPaneWidth: paneWidth } = usePlatformLayout();
  const shellHostsAurora = useShellHostsAurora();
  const glass = useActiveGlassTokens();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        phone: {
          flex: 1,
        },
        split: {
          flex: 1,
          flexDirection: 'row',
          minHeight: 0,
          backgroundColor: shellHostsAurora ? glass.panel : 'transparent',
          ...(shellHostsAurora
            ? {
                margin: -spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: glass.border,
                overflow: 'hidden',
                ...webGlassBlur(glass.blur.medium),
              }
            : null),
        },
        master: {
          flexShrink: 0,
          borderRightWidth: 1,
          borderRightColor: shellHostsAurora ? glass.border : colors.borderSoft,
          backgroundColor: shellHostsAurora ? glass.table : 'transparent',
        },
        divider: {
          width: 0,
        },
        detail: {
          flex: 1,
          minWidth: 0,
          backgroundColor: shellHostsAurora ? glass.panel : 'transparent',
        },
        placeholder: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.sm,
        },
        placeholderTitle: {
          ...typography.h3,
          color: shellHostsAurora ? glass.text.secondary : colors.textSecondary,
        },
        placeholderText: {
          ...typography.body,
          color: shellHostsAurora ? glass.text.muted : colors.textMuted,
          textAlign: 'center',
          maxWidth: 360,
        },
      }),
    [glass, shellHostsAurora],
  );

  const placeholder =
    detailPlaceholder ?? (
      <DefaultDetailPlaceholder
        containerStyle={styles.placeholder}
        titleStyle={styles.placeholderTitle}
        textStyle={styles.placeholderText}
      />
    );

  if (!useMasterDetail) {
    return <View style={styles.phone}>{master}</View>;
  }

  return (
    <View style={styles.split}>
      <View style={[styles.master, { width: paneWidth, maxWidth: paneWidth }]}>
        {master}
      </View>
      <View style={styles.divider} />
      <View style={styles.detail}>{showDetail ? detail : placeholder}</View>
    </View>
  );
}
