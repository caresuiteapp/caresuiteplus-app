import { useMemo, type ReactNode } from 'react';

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import {

  useAuroraAdaptiveText,

  useAuroraGlassActive,

  useShellGlassSurfaceStyle,

} from '@/design/tokens/auroraGlass';

import { resolveGalaxyGradientColors } from '@/design/tokens/galaxy';

import { resolveLlganModalHeaderGradient } from '@/design/tokens/lightLiquidGlassAuroraNebula';

import { glassFx, neonGlow } from '@/design/tokens/motion';

import { careRadius } from '@/design/tokens/radius';

import { careSpacing } from '@/design/tokens/spacing';

import { careTypography } from '@/design/tokens/typography';

import { useLegacyTheme } from '@/design/tokens/themeBridge';

import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';



export type GradientModalHeaderProps = {

  title: string;

  subtitle?: string;

  onBack?: () => void;

  onClose: () => void;

  actions?: ReactNode;

};



export function GradientModalHeader({

  title,

  subtitle,

  onBack,

  onClose,

  actions,

}: GradientModalHeaderProps) {

  const { isLight } = useLegacyTheme();

  const auroraActive = useAuroraGlassActive();

  const shellHostsAurora = useShellHostsAurora();

  const auroraHeader = auroraActive && shellHostsAurora;

  const plainLightHeader = isLight && !auroraHeader;

  const text = useAuroraAdaptiveText();

  const headerGlass = useShellGlassSurfaceStyle('modal', { viewContext: 'form' });



  const headerColors = auroraHeader

    ? isLight

      ? resolveLlganModalHeaderGradient()

      : resolveGalaxyGradientColors('modalHeader')

    : null;



  const styles = useMemo(

    () =>

      StyleSheet.create({

        wrapper: {

          overflow: 'hidden',

          ...Platform.select({

            web: auroraHeader

              ? (neonGlow(isLight ? '#E878C8' : '#C44BA8', isLight ? 0.22 : 0.28, 20, 8) as object)

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

          borderBottomColor: 'rgba(110,160,255,0.18)',

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

          ...careTypography.h3,

          fontWeight: '700',

          flex: 1,

        },

        iconBtn: {

          width: 36,

          height: 36,

          borderRadius: careRadius.sm,

          alignItems: 'center',

          justifyContent: 'center',

          borderWidth: 1,

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

    [auroraHeader, isLight],

  );



  const titleColor = plainLightHeader ? text.primary : '#FFFFFF';

  const iconColor = plainLightHeader ? text.primary : '#FFFFFF';

  const iconBtnStyle = auroraHeader

    ? [

        styles.iconBtn,

        {

          borderColor: 'rgba(255,255,255,0.35)',

          backgroundColor: 'rgba(255,255,255,0.16)',

        },

      ]

    : plainLightHeader

      ? [styles.iconBtn, headerGlass]

      : [

          styles.iconBtn,

          {

            borderColor: 'rgba(255,255,255,0.28)',

            backgroundColor: 'rgba(255,255,255,0.12)',

          },

        ];



  const gradientContent = (

    <>

      <View style={styles.headerLeading}>

        {onBack ? (

          <Pressable

            onPress={onBack}

            style={iconBtnStyle}

            accessibilityRole="button"

            accessibilityLabel="Zurück"

          >

            <Text style={[styles.iconLabel, { color: iconColor }]}>←</Text>

          </Pressable>

        ) : null}

        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>

          {title}

        </Text>

      </View>

      <View style={styles.headerTrailing}>

        {actions}

        <Pressable

          onPress={onClose}

          style={iconBtnStyle}

          accessibilityRole="button"

          accessibilityLabel="Schließen"

        >

          <Text style={[styles.iconLabel, { color: iconColor }]}>×</Text>

        </Pressable>

      </View>

    </>

  );



  return (

    <View style={styles.wrapper}>

      <View style={[styles.gradientBar, plainLightHeader ? [headerGlass, styles.plainLightHeader] : null]}>

        {headerColors ? (

          <>

            <LinearGradient

              colors={[...headerColors]}

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

        ) : !plainLightHeader ? (

          <>

            <LinearGradient

              colors={[...resolveGalaxyGradientColors('modalHeader')]}

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

            auroraHeader

              ? {

                  backgroundColor: isLight ? 'rgba(255,255,255,0.22)' : 'rgba(11, 16, 32, 0.88)',

                  borderBottomColor: isLight ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)',

                }

              : plainLightHeader

                ? {

                    backgroundColor: 'rgba(255,255,255,0.42)',

                    borderBottomColor: 'rgba(110,160,255,0.14)',

                  }

                : {

                    backgroundColor: 'rgba(11, 16, 32, 0.88)',

                    borderBottomColor: 'rgba(255,255,255,0.08)',

                  },

          ]}

        >

          <Text

            style={[

              styles.statusText,

              {

                color: auroraHeader || !plainLightHeader

                  ? 'rgba(255,255,255,0.88)'

                  : text.secondary,

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


