import { SemanticArtwork } from '@/components/icons/SemanticArtwork';
import { useMemo, type ReactNode } from 'react';

import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import {
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useShellGlassSurfaceStyle,
} from '@/design/tokens/auroraGlass';
import {
  resolvePopupShellCloseButtonStyle,
  resolvePopupShellCloseIconStyle,
  resolvePopupShellColors,
  resolvePopupShellHeaderGlow,
  resolvePopupShellHeaderGradient,
  resolvePopupShellTitleStyle,
} from '@/design/tokens/popupShell';
import { glassFx } from '@/design/tokens/motion';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { portalPremium, usePortalPremiumRuntimeTheme } from '@/design/tokens/portalPremium';

export type GradientModalHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onClose: () => void;
  actions?: ReactNode;
  tone?: 'light' | 'dark';
};

export function GradientModalHeader({
  title,
  subtitle,
  onBack,
  onClose,
  actions,
  tone,
}: GradientModalHeaderProps) {
  const runtimePortalTheme = usePortalPremiumRuntimeTheme();
  const runtimeTheme = useLegacyTheme();
  const webTone = Platform.OS === 'web' ? tone : undefined;
  const explicitLight = webTone === 'light';
  const portalTheme = webTone ? { ...runtimePortalTheme, active: false } : runtimePortalTheme;
  const isLight = webTone ? webTone === 'light' : runtimeTheme.isLight;
  const auroraActive = useAuroraGlassActive();
  const shellHostsAurora = useShellHostsAurora();
  const auroraHeader = !webTone && !portalTheme.active && auroraActive && shellHostsAurora;
  const plainLightHeader = portalTheme.active || (isLight && !auroraHeader);
  const text = useAuroraAdaptiveText();
  const headerGlass = useShellGlassSurfaceStyle('modal', { viewContext: 'form' });
  const shellMode = portalTheme.active || isLight ? 'light' : 'dark';
  const shellColors = resolvePopupShellColors(shellMode);

  const headerColors = auroraHeader || !plainLightHeader
    ? resolvePopupShellHeaderGradient(shellMode)
    : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          overflow: 'hidden',
          backgroundColor: portalTheme.active ? portalPremium.surfaceRaised : undefined,
          ...Platform.select({
            web: auroraHeader || !plainLightHeader
              ? (resolvePopupShellHeaderGlow(shellMode) as object)
              : {},
            default: {},
          }),
        },
        gradientBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: careSpacing.md,
          paddingTop: careSpacing.md,
          paddingBottom: careSpacing.sm,
          gap: careSpacing.sm,
        },
        plainLightHeader: {
          borderBottomWidth: 1,
          borderBottomColor: shellColors.subtitleBar.border,
        },
        heroSheen: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60%',
        },
        headerLeading: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: careSpacing.sm,
          flex: 1,
          minWidth: 0,
        },
        headerTrailing: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: careSpacing.sm,
          flexShrink: 1,
        },
        title: {
          flex: 1,
        },
        iconLabel: {
          ...careTypography.bodyStrong,
          fontSize: 18,
          lineHeight: 20,
        },
        statusBar: {
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.xs,
          borderBottomWidth: 1,
        },
        statusText: {
          ...careTypography.caption,
        },
      }),
    [auroraHeader, plainLightHeader, portalTheme.active, shellColors.subtitleBar.border, shellMode],
  );

  const titleStyle = auroraHeader || !plainLightHeader
    ? resolvePopupShellTitleStyle(shellMode)
    : {
        ...resolvePopupShellTitleStyle('light'),
        color: explicitLight ? '#15304E' : portalTheme.active ? portalPremium.text.primary : text.primary,
      };

  const closeButtonStyle: StyleProp<ViewStyle> = auroraHeader || !plainLightHeader
    ? resolvePopupShellCloseButtonStyle(shellMode)
    : [resolvePopupShellCloseButtonStyle('light'), headerGlass,
        ...(explicitLight ? [{ backgroundColor: '#FFFFFF', borderColor: '#C5D6E9' }] : [])];

  const backButtonStyle: StyleProp<ViewStyle> = closeButtonStyle;
  const iconColor: string =
    auroraHeader || !plainLightHeader
      ? String(resolvePopupShellCloseIconStyle(shellMode).color ?? '#FFFFFF')
      : explicitLight
        ? '#15304E'
        : portalTheme.active
        ? portalPremium.text.primary
        : text.primary;

  const closeIconStyle =
    auroraHeader || !plainLightHeader
      ? resolvePopupShellCloseIconStyle(shellMode)
      : {
          ...resolvePopupShellCloseIconStyle('light'),
          color: explicitLight ? '#15304E' : portalTheme.active ? portalPremium.text.primary : text.primary,
        };

  const gradientContent = (
    <>
      <View style={styles.headerLeading}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={backButtonStyle}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
          >
            <SemanticArtwork webSize={24} style={[styles.iconLabel, { color: iconColor }]}>←</SemanticArtwork>
          </Pressable>
        ) : null}
        <Text style={[styles.title, titleStyle]} numberOfLines={Platform.OS === 'web' ? 1 : undefined}>
          {title}
        </Text>
      </View>
      <View style={styles.headerTrailing}>
        {actions}
        <Pressable
          onPress={onClose}
          style={closeButtonStyle}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
        >
          <SemanticArtwork webSize={24} style={closeIconStyle}>×</SemanticArtwork>
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={styles.wrapper}>
      <View style={[styles.gradientBar, plainLightHeader ? [headerGlass, styles.plainLightHeader] : null,
        explicitLight ? { backgroundColor: '#FFFFFF', borderBottomColor: '#D7E3F1' } : null]}>
        {headerColors ? (
          <>
            <LinearGradient
              colors={[...headerColors] as [string, string, ...string[]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={glassFx.sheen}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 0.6 }}
              style={styles.heroSheen}
              pointerEvents="none"
            />
          </>
        ) : null}
        {gradientContent}
      </View>
      {subtitle ? (
        <View
          style={[
            styles.statusBar,
            {
              backgroundColor: explicitLight
                ? '#F4F8FD'
                : portalTheme.active
                ? portalPremium.surfaceSoft
                : shellColors.subtitleBar.background,
              borderBottomColor: explicitLight
                ? '#D7E3F1'
                : portalTheme.active
                ? portalPremium.borderSoft
                : shellColors.subtitleBar.border,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: explicitLight
                  ? '#59708C'
                  : portalTheme.active
                  ? portalPremium.text.secondary
                  : shellColors.subtitleBar.text,
              },
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
