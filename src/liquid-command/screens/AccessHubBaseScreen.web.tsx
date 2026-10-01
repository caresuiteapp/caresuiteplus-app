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
  compact = false,
  reducedMotion,
  onPress,
}: {
  option: AccessOption;
  index: number;
  stacked: boolean;
  compact?: boolean;
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
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onPress={onPress}
        style={({ pressed }) => [
          styles.accessCard,
          stacked && styles.accessCardStacked,
          compact && styles.accessCardCompact,
          hovered && styles.accessCardHovered,
          pressed && styles.accessCardPressed,
        ]}
      >
        <View style={[styles.robotStage, stacked && styles.robotStageStacked, compact && styles.robotStageCompact]}>
          <View style={[styles.robotGlow, compact && styles.robotGlowCompact, hovered && styles.robotGlowHovered]} />
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
              style={[styles.robotImage, stacked && styles.robotImageStacked, compact && styles.robotImageCompact]}
            />
          </Animated.View>
        </View>
        <View style={[styles.cardCopy, stacked && styles.cardCopyStacked, compact && styles.cardCopyCompact]}>
          <Text style={[styles.accessTitle, stacked && styles.accessTitleStacked, compact && styles.accessTitleCompact]}>{option.title}</Text>
          <View style={[styles.accessCta, stacked && styles.accessCtaStacked, hovered && styles.accessCtaHovered]}>
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
  compact = false,
  reducedMotion,
  onPress,
}: {
  stacked: boolean;
  compact?: boolean;
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
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onPress={onPress}
        style={({ pressed }) => [
          styles.registrationCard,
          stacked && styles.registrationCardStacked,
          compact && styles.registrationCardCompact,
          hovered && styles.registrationCardHovered,
          pressed && styles.accessCardPressed,
        ]}
      >
        <View style={[styles.registrationIcon, compact && styles.registrationIconCompact]}>
          <LinearGradient
            colors={['rgba(53,151,255,0.30)', 'rgba(22,131,255,0.08)']}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons color={liquidColors.blue200} name="business-outline" size={32} />
        </View>
        <View style={[styles.registrationCopy, stacked && styles.registrationCopyStacked]}>
          <Text style={[styles.registrationTitle, stacked && styles.registrationTextCentered, compact && styles.registrationTitleCompact]}>
            Unternehmen kostenlos registrieren
          </Text>
          <Text style={[styles.registrationSubtitle, stacked && styles.registrationTextCentered, compact && styles.registrationSubtitleCompact]}>
            CareSuite HealthOS: 0 € · alle verfügbaren Funktionsbereiche · keine Kreditkarte
          </Text>
        </View>
        <View
          style={[
            styles.registrationCta,
            stacked && styles.registrationCtaStacked,
            hovered && styles.accessCtaHovered,
          ]}
        >
          <Text style={styles.accessCtaLabel}>Kostenlos starten</Text>
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
  // Large displays keep the same readable canvas; short displays reduce
  // individual elements instead of enlarging or scaling the whole interface.
  const compact = !stacked && layout.height <= 800;

  return (
    <View style={styles.root} testID="web-access-hub">
      <style>{`
        [data-testid="web-access-hub"] :is(button,[role="button"],a):focus-visible {
          outline: 3px solid #0876e8; outline-offset: 5px;
        }
        .cs-display-switch {display:flex;justify-content:center;gap:12px;flex-wrap:wrap;align-items:center}
        .cs-display-switch button {font:inherit;font-size:16px;line-height:1.4;min-height:48px;padding:12px 24px;border-radius:999px;background:#fff;border:1px solid #a9c9ed;color:#145786;cursor:pointer}
        .cs-display-switch button:hover {background:#e7f2ff;border-color:#0876e8}
        .cs-display-switch span {color:#496a88;font-size:14px;line-height:1.6}
      `}</style>
      <AnimatedBackdrop reducedMotion={reducedMotion} />
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          compact && styles.scrollContentCompact,
          stacked && styles.scrollContentStacked,
          stacked && {
            paddingTop: Math.max(24, insets.top + 16),
            paddingBottom: Math.max(32, insets.bottom + 24),
          },
        ]}
        showsVerticalScrollIndicator
      >
        <View style={[styles.content, stacked && styles.contentStacked, compact && styles.contentCompact]}>
          <View style={[styles.header, stacked && styles.headerStacked, compact && styles.headerCompact]}>
            <Text
              accessibilityRole="header"
              accessibilityLabel="CareSuite HealthOS"
              numberOfLines={1}
              style={[
                styles.logo,
                compact && styles.logoCompact,
                stacked && {
                  fontSize: Math.min(40, (layout.width - 48) / 9.6),
                  lineHeight: 50,
                },
              ]}
            >
              CareSuite<Text style={styles.logoAccent}> HealthOS</Text>
            </Text>
            <Text style={[styles.eyebrow, compact && styles.eyebrowCompact]}>IHR ZUGANG</Text>
            <Text
              accessibilityRole="header"
              style={[styles.headline, stacked && styles.headlineStacked, compact && styles.headlineCompact]}
            >
              Wo möchten Sie starten?
            </Text>
          </View>
          <View style={[styles.accessGrid, stacked && styles.accessGridStacked, compact && styles.accessGridCompact]} testID="access-hub-options">
            {options.map((option, index) => (
              <AccessCard
                key={option.id}
                index={index}
                onPress={() => router.push(option.route as never)}
                option={option}
                reducedMotion={reducedMotion}
                stacked={stacked}
                compact={compact}
              />
            ))}
          </View>
          {showRegistration ? (
            <RegistrationCard
              onPress={() => router.push('/auth/register' as never)}
              reducedMotion={reducedMotion}
              stacked={stacked}
              compact={compact}
            />
          ) : null}
          <nav aria-label="Informationen zu CareSuite" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: compact ? '6px 22px' : '10px 22px', marginTop: compact ? 0 : 10 }}>
            {[['/caresuite', 'Über CareSuite'], ['/landingpage', 'Landingpage'], ['/datenschutz', 'Datenschutz'], ['/nutzungsbedingungen', 'Nutzungsbedingungen'], ['/impressum', 'Kontakt & Impressum']].map(([href, label]) => (
              <a key={href} href={href} style={{ fontFamily: 'CenturyGothic, Arial, sans-serif', color: '#145786', fontSize: 14, lineHeight: 1.6, padding: '8px 4px', minHeight: 44, display: 'inline-flex', alignItems: 'center', textUnderlineOffset: 3 }}>{label}</a>
            ))}
          </nav>
          <div className="cs-display-switch">
            <button type="button" onClick={() => router.push('/device/tv' as never)}>TV-Ansicht · mit dem Handy anmelden</button>
            <span>Für große Bildschirme und Fernseher</span>
          </div>
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
    paddingVertical: 28,
  },
  scrollContentStacked: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  scrollContentCompact: { paddingVertical: 20 },
  contentCompact: { gap: 12 },
  headerCompact: { gap: 4, marginBottom: 0 },
  logoCompact: { fontSize: 38, lineHeight: 46, marginBottom: 4 },
  eyebrowCompact: { fontSize: 12, lineHeight: 18 },
  headlineCompact: { fontSize: 28, lineHeight: 36 },
  accessGridCompact: { gap: 16 },
  accessCardCompact: { minHeight: 260, padding: 14 },
  robotStageCompact: { minHeight: 144 },
  robotImageCompact: { width: 144, height: 144 },
  robotGlowCompact: { width: 142, height: 142, borderRadius: 71 },
  cardCopyCompact: { gap: 8 },
  accessTitleCompact: { fontSize: 20, lineHeight: 26 },
  registrationCardCompact: { minHeight: 88, padding: 12, gap: 14 },
  registrationIconCompact: { width: 56, height: 56, borderRadius: 15 },
  registrationTitleCompact: { fontSize: 18, lineHeight: 24 },
  registrationSubtitleCompact: { fontSize: 13, lineHeight: 19 },
  content: { width: '100%', maxWidth: 1180, gap: 18 },
  contentStacked: { maxWidth: 560, gap: 14, alignSelf: 'center' },
  header: { alignItems: 'center', gap: 7, marginBottom: 6 },
  headerStacked: { gap: 6, marginBottom: 4 },
  logo: {
    width: '100%',
    maxWidth: 720,
    marginBottom: 8,
    color: '#0B2A4A',
    fontSize: 44,
    lineHeight: 54,
    fontWeight: '700',
    letterSpacing: -0.65,
    textAlign: 'center',
  },
  logoAccent: { color: '#1683FF', fontWeight: '700' },
  eyebrow: {
    color: liquidColors.blue200,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  headline: {
    color: liquidColors.white,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.25,
    textAlign: 'center',
  },
  headlineStacked: { fontSize: 26, lineHeight: 32, letterSpacing: -0.55 },
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
    minHeight: 310,
    padding: 16,
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
    minHeight: 192,
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
  robotImage: { width: 192, height: 192 },
  robotImageStacked: { width: 118, height: 118 },
  cardCopy: { width: '100%', alignItems: 'center', gap: 10 },
  cardCopyStacked: {
    width: '100%',
    minWidth: 0,
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  accessTitle: {
    color: liquidColors.white,
    fontSize: 22,
    lineHeight: 28,
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
    minHeight: 48,
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
  accessCtaStacked: { minHeight: 50 },
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,5,15,0.10)',
  },
});
