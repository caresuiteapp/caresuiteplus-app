import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LiquidLogo } from '../components/LiquidPrimitives';
import { liquidColors, liquidShadows } from '../foundation/tokens';
import { useLiquidLayout } from '../foundation/useLiquidLayout';

export type AccessOption = {
  id: 'employee' | 'client' | 'administration';
  title: string;
  route: '/auth/employee-login' | '/auth/client-login' | '/auth/business-login';
  image: ImageSourcePropType;
  imageAccessibilityLabel: string;
};

const ACCESS_ANIMATION_USES_NATIVE_DRIVER = Platform.OS !== 'web';

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

function AnimatedBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const drift = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      drift.setValue(0);
      breathe.setValue(0);
      return;
    }
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 13000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 13000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
        }),
      ]),
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
        }),
      ]),
    );
    driftLoop.start();
    breatheLoop.start();
    return () => {
      driftLoop.stop();
      breatheLoop.stop();
    };
  }, [breathe, drift, reducedMotion]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#F8FBFF', '#EAF4FF', '#FFFFFF']}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.backdropOrb,
          styles.backdropOrbTop,
          {
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.58] }),
            transform: [
              { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) },
              { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 28] }) },
              { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.backdropOrb,
          styles.backdropOrbBottom,
          {
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.48] }),
            transform: [
              { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }) },
              { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) },
              { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1.06, 0.98] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.backdropHalo,
          {
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.34] }),
            transform: [
              { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '8deg'] }) },
            ],
          },
        ]}
      />
      <View style={styles.backdropVignette} />
    </View>
  );
}

function AccessCard({
  option,
  index,
  stacked,
  reducedMotion,
  onPress,
}: {
  option: AccessOption;
  index: number;
  stacked: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const interaction = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      float.setValue(0);
      shimmer.setValue(0);
      return;
    }
    const entranceAnimation = Animated.timing(entrance, {
      toValue: 1,
      delay: 140 + index * 100,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
    });
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2600 + index * 180,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600 + index * 180,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
        }),
      ]),
    );
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1100 + index * 470),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
        }),
        Animated.delay(2300),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
        }),
      ]),
    );
    entranceAnimation.start();
    floatLoop.start();
    shimmerLoop.start();
    return () => {
      entranceAnimation.stop();
      floatLoop.stop();
      shimmerLoop.stop();
    };
  }, [entrance, float, index, reducedMotion, shimmer]);

  useEffect(() => {
    Animated.timing(interaction, {
      toValue: hovered ? 1 : 0,
      duration: hovered ? 190 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
    }).start();
  }, [hovered, interaction]);

  return (
    <Animated.View
      style={[
        styles.accessCardFrame,
        !stacked && styles.accessCardFrameWide,
        stacked && styles.accessCardFrameStacked,
        {
          opacity: entrance,
          transform: [
            {
              translateY: Animated.add(
                entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
                interaction.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }),
              ),
            },
            { scale: interaction.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${option.title} anmelden`}
        accessibilityHint={`Öffnet die Anmeldung für ${option.title}`}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={onPress}
        style={({ pressed }) => [
          styles.accessCard,
          stacked && styles.accessCardStacked,
          hovered && styles.accessCardHovered,
          pressed && styles.accessCardPressed,
        ]}
      >
        <View style={[styles.robotStage, stacked && styles.robotStageStacked]}>
          <View style={[styles.robotGlow, hovered && styles.robotGlowHovered]} />
          <Animated.View
            style={{
              transform: [
                { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [2, -5] }) },
                { scale: interaction.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
              ],
            }}
          >
            <Image
              accessibilityLabel={option.imageAccessibilityLabel}
              resizeMode="contain"
              source={option.image}
              style={[styles.robotImage, stacked && styles.robotImageStacked]}
            />
          </Animated.View>
        </View>
        <View style={[styles.cardCopy, stacked && styles.cardCopyStacked]}>
          <Text style={[styles.accessTitle, stacked && styles.accessTitleStacked]}>{option.title}</Text>
          <View style={[styles.accessCta, hovered && styles.accessCtaHovered]}>
            <LinearGradient
              colors={hovered ? ['#248cff', '#096ee9'] : ['#1683ff', '#056ce8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.buttonShimmer,
                {
                  transform: [
                    { translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-150, 280] }) },
                    { rotate: '18deg' },
                  ],
                },
              ]}
            />
            <Text style={styles.accessCtaLabel}>Anmelden</Text>
            <Animated.View
              style={{
                transform: [
                  { translateX: interaction.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) },
                ],
              }}
            >
              <Ionicons color={liquidColors.white} name="chevron-forward" size={19} />
            </Animated.View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function RegistrationCard({
  stacked,
  reducedMotion,
  onPress,
}: {
  stacked: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      delay: 470,
      duration: 540,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: ACCESS_ANIMATION_USES_NATIVE_DRIVER,
    }).start();
  }, [entrance, reducedMotion]);

  return (
    <Animated.View
      style={[
        styles.registrationFrame,
        {
          opacity: entrance,
          transform: [
            { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Firma oder Unternehmen registrieren"
        accessibilityHint="Öffnet die Registrierung für eine neue Organisation"
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={onPress}
        style={({ pressed }) => [
          styles.registrationCard,
          stacked && styles.registrationCardStacked,
          hovered && styles.registrationCardHovered,
          pressed && styles.accessCardPressed,
        ]}
      >
        <View style={styles.registrationIcon}>
          <LinearGradient
            colors={['rgba(53,151,255,0.30)', 'rgba(22,131,255,0.08)']}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons color={liquidColors.blue200} name="business-outline" size={32} />
        </View>
        <View style={[styles.registrationCopy, stacked && styles.registrationCopyStacked]}>
          <Text style={[styles.registrationTitle, stacked && styles.registrationTextCentered]}>
            Firma / Unternehmen registrieren
          </Text>
          <Text style={[styles.registrationSubtitle, stacked && styles.registrationTextCentered]}>
            CareSuite HealthOS für Ihre Organisation einrichten
          </Text>
        </View>
        <View
          style={[
            styles.registrationCta,
            stacked && styles.registrationCtaStacked,
            hovered && styles.accessCtaHovered,
          ]}
        >
          <Text style={styles.accessCtaLabel}>Jetzt registrieren</Text>
          <Ionicons color={liquidColors.white} name="chevron-forward" size={19} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function AccessHubBaseScreen({
  options,
  showRegistration = false,
}: {
  options: readonly AccessOption[];
  showRegistration?: boolean;
}) {
  const router = useRouter();
  const layout = useLiquidLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const stacked = layout.width < 900;

  return (
    <View style={styles.root}>
      <AnimatedBackdrop reducedMotion={reducedMotion} />
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          stacked && styles.scrollContentStacked,
          stacked && {
            paddingTop: Math.max(24, insets.top + 16),
            paddingBottom: Math.max(32, insets.bottom + 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, stacked && styles.contentStacked]}>
          <View style={[styles.header, stacked && styles.headerStacked]}>
            <View style={[styles.logo, stacked && styles.logoStacked]}>
              <LiquidLogo width={stacked ? 286 : 560} />
            </View>
            <Text style={styles.eyebrow}>IHR ZUGANG</Text>
            <Text
              accessibilityRole="header"
              style={[styles.headline, stacked && styles.headlineStacked]}
            >
              Wo möchten Sie starten?
            </Text>
            <Text style={[styles.subtitle, stacked && styles.subtitleStacked]}>
              Wählen Sie den passenden Bereich und melden Sie sich sicher an.
            </Text>
          </View>
          <View style={[styles.accessGrid, stacked && styles.accessGridStacked]} testID="access-hub-options">
            {options.map((option, index) => (
              <AccessCard
                key={option.id}
                index={index}
                onPress={() => router.push(option.route as never)}
                option={option}
                reducedMotion={reducedMotion}
                stacked={stacked}
              />
            ))}
          </View>
          {showRegistration ? (
            <RegistrationCard
              onPress={() => router.push('/auth/register' as never)}
              reducedMotion={reducedMotion}
              stacked={stacked}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? '100vh' as never : undefined,
    backgroundColor: liquidColors.navy950,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 38,
  },
  scrollContentStacked: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  content: { width: '100%', maxWidth: 1180, gap: 20 },
  contentStacked: { maxWidth: 560, gap: 14, alignSelf: 'center' },
  header: { alignItems: 'center', gap: 7, marginBottom: 6 },
  headerStacked: { gap: 6, marginBottom: 4 },
  logo: { width: 560, maxWidth: '90%', minHeight: 56, marginBottom: 4, alignItems: 'center', justifyContent: 'center' },
  logoStacked: { width: 310, minHeight: 40, marginBottom: 6 },
  eyebrow: {
    color: liquidColors.blue200,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  headline: {
    color: liquidColors.white,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: -1.25,
    textAlign: 'center',
  },
  headlineStacked: { fontSize: 26, lineHeight: 32, letterSpacing: -0.55 },
  subtitle: {
    color: liquidColors.white72,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
  },
  subtitleStacked: { maxWidth: 390, fontSize: 14, lineHeight: 20 },
  accessGrid: { width: '100%', flexDirection: 'row', alignItems: 'stretch', gap: 20 },
  accessGridStacked: { flexDirection: 'column', gap: 12 },
  accessCardFrame: { minWidth: 0, borderRadius: 20, ...liquidShadows.panel },
  accessCardFrameWide: { flex: 1 },
  accessCardFrameStacked: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  accessCard: {
    minHeight: 352,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.48)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  accessCardStacked: {
    minHeight: 156,
    padding: 14,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  accessCardHovered: {
    borderColor: 'rgba(112,181,255,0.96)',
    backgroundColor: '#EFF6FF',
    shadowColor: liquidColors.blue400,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 12,
  },
  accessCardPressed: { opacity: 0.92 },
  robotStage: {
    width: '100%',
    flex: 1,
    minHeight: 238,
    alignItems: 'center',
    justifyContent: 'center',
  },
  robotStageStacked: {
    position: 'absolute',
    left: 22,
    bottom: 10,
    width: 112,
    minHeight: 118,
    zIndex: 4,
    elevation: 12,
  },
  robotGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(22,131,255,0.13)',
    shadowColor: '#2b91ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 34,
  },
  robotGlowHovered: { backgroundColor: 'rgba(22,131,255,0.21)', shadowOpacity: 0.5 },
  robotImage: { width: 244, height: 244 },
  robotImageStacked: { width: 118, height: 118 },
  cardCopy: { width: '100%', alignItems: 'center', gap: 12 },
  cardCopyStacked: {
    width: '100%',
    minWidth: 0,
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  accessTitle: {
    color: liquidColors.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  accessTitleStacked: {
    width: '100%',
    fontSize: 18,
    lineHeight: 23,
    textAlign: 'center',
  },
  accessCta: {
    width: '100%',
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.72)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: liquidColors.blue500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 7,
  },
  accessCtaHovered: { borderColor: liquidColors.blue200, shadowOpacity: 0.48 },
  accessCtaLabel: {
    color: liquidColors.onAccent,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  buttonShimmer: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 42,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  registrationFrame: { width: '100%', borderRadius: 18, ...liquidShadows.panel },
  registrationCard: {
    width: '100%',
    minHeight: 108,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.40)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  registrationCardStacked: { padding: 16, flexDirection: 'column', gap: 12 },
  registrationCardHovered: {
    borderColor: 'rgba(112,181,255,0.88)',
    backgroundColor: '#EFF6FF',
    shadowColor: liquidColors.blue500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },
  registrationIcon: {
    width: 64,
    height: 64,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.44)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registrationCopy: { minWidth: 0, flex: 1, gap: 5 },
  registrationCopyStacked: { alignItems: 'center' },
  registrationTitle: {
    color: liquidColors.white,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  registrationSubtitle: { color: liquidColors.white72, fontSize: 14, lineHeight: 20 },
  registrationTextCentered: { textAlign: 'center' },
  registrationCta: {
    minWidth: 220,
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.72)',
    backgroundColor: liquidColors.blue600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: liquidColors.blue500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 7,
  },
  registrationCtaStacked: { width: '100%' },
  backdropOrb: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(53,151,255,0.16)',
    backgroundColor: 'rgba(8,49,102,0.45)',
    shadowColor: '#1683ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 80,
  },
  backdropOrbTop: {
    width: 540,
    height: 540,
    borderRadius: 270,
    top: -240,
    right: -155,
  },
  backdropOrbBottom: {
    width: 470,
    height: 470,
    borderRadius: 235,
    bottom: -255,
    left: -175,
  },
  backdropHalo: {
    position: 'absolute',
    width: 760,
    height: 760,
    borderRadius: 380,
    borderWidth: 1,
    borderColor: 'rgba(53,151,255,0.17)',
    top: '16%',
    left: '30%',
  },
  backdropVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,5,15,0.10)',
  },
});
