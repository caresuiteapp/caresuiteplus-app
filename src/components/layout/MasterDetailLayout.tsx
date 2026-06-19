import { ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { colors, radius, spacing, typography } from '@/theme';

type MasterDetailLayoutProps = {
  master: ReactNode;
  detail: ReactNode;
  detailPlaceholder?: ReactNode;
  showDetail?: boolean;
};

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
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
          backgroundColor: shellHostsAurora ? auroraGlass.panel : 'transparent',
          ...(shellHostsAurora
            ? {
                margin: -spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: auroraGlass.border,
                overflow: 'hidden',
                ...webGlassBlur,
              }
            : null),
        },
        master: {
          flexShrink: 0,
          borderRightWidth: 1,
          borderRightColor: shellHostsAurora ? auroraGlass.border : colors.borderSoft,
          backgroundColor: shellHostsAurora ? auroraGlass.table : 'transparent',
        },
        divider: {
          width: 0,
        },
        detail: {
          flex: 1,
          minWidth: 0,
          backgroundColor: shellHostsAurora ? auroraGlass.panel : 'transparent',
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
          color: shellHostsAurora ? auroraGlass.text.secondary : colors.textSecondary,
        },
        placeholderText: {
          ...typography.body,
          color: shellHostsAurora ? auroraGlass.text.muted : colors.textMuted,
          textAlign: 'center',
          maxWidth: 360,
        },
      }),
    [shellHostsAurora],
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
