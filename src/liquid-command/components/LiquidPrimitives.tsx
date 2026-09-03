import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  liquidClassicColors,
  liquidClassicShadows,
  liquidClassicTypography,
  liquidRadius,
  liquidSpace,
  liquidTypography,
  toneColor,
  type LiquidSemanticTone,
} from '../foundation/tokens';

export type LiquidVisualMode = 'classic' | 'orbit';

// ORBIT is the product default and the light native contract shared by the
// employee and client portals. Classic remains available for legacy surfaces.
const LiquidVisualModeContext = createContext<LiquidVisualMode>('orbit');

export function LiquidVisualModeProvider({ mode, children }: { mode: LiquidVisualMode; children: ReactNode }) {
  return <LiquidVisualModeContext.Provider value={mode}>{children}</LiquidVisualModeContext.Provider>;
}

export function useLiquidVisualMode() {
  return useContext(LiquidVisualModeContext);
}

type LiquidSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  active?: boolean;
  solid?: boolean;
  accessibilityLabel?: string;
};

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const liquidGlyphIcons: Record<string, IoniconName> = {
  '⌂': 'home-outline',
  '▣': 'grid-outline',
  '◇': 'navigate-outline',
  '✚': 'medical-outline',
  '▦': 'business-outline',
  '▧': 'briefcase-outline',
  '◎': 'people-circle-outline',
  '△': 'school-outline',
  '⬡': 'hardware-chip-outline',
  '◈': 'layers-outline',
  '⚙': 'settings-outline',
  '☷': 'options-outline',
  '⌕': 'search-outline',
  '◔': 'notifications-outline',
  '♙': 'person-outline',
  '▱': 'chatbubble-ellipses-outline',
  '€': 'cash-outline',
  '◷': 'time-outline',
  '□': 'document-text-outline',
  '⌘': 'apps-outline',
  '⌾': 'body-outline',
  '○': 'ellipse-outline',
  '≡': 'list-outline',
  '✓': 'checkmark-outline',
  '!': 'warning-outline',
  '+': 'add-outline',
  '−': 'remove-outline',
  '→': 'arrow-forward-outline',
  '‹': 'chevron-back-outline',
  '↪': 'log-out-outline',
  '×': 'close-outline',
  '▤': 'reader-outline',
  '✉': 'mail-outline',
  '⌑': 'lock-closed-outline',
  '↻': 'refresh-outline',
  '✋': 'hand-left-outline',
  '✎': 'create-outline',
  '♧': 'chatbubbles-outline',
  '▷': 'play-outline',
  '◌': 'sync-outline',
  '◉': 'shield-checkmark-outline',
  '⌁': 'refresh-circle-outline',
  '›': 'chevron-forward-outline',
  '⌖': 'location-outline',
  '➤': 'navigate-outline',
  '☼': 'airplane-outline',
  '↑': 'cloud-upload-outline',
  '?': 'help-circle-outline',
  '•••': 'ellipsis-horizontal-circle-outline',
};

const orbitModuleGlyphIcons: Record<string, { filled: IoniconName; outline: IoniconName }> = {
  '⌂': { filled: 'home', outline: 'home-outline' },
  '▣': { filled: 'grid', outline: 'grid-outline' },
  '◇': { filled: 'navigate', outline: 'navigate-outline' },
  '✚': { filled: 'medical', outline: 'medical-outline' },
  '▦': { filled: 'business', outline: 'business-outline' },
  '◎': { filled: 'people-circle', outline: 'people-circle-outline' },
  '△': { filled: 'school', outline: 'school-outline' },
  '⬡': { filled: 'hardware-chip', outline: 'hardware-chip-outline' },
  '◈': { filled: 'layers', outline: 'layers-outline' },
  '⚙': { filled: 'settings', outline: 'settings-outline' },
};

export function LiquidGlyph({
  glyph,
  active = false,
  color,
  size = 21,
  presentation = 'plain',
}: {
  glyph: string;
  active?: boolean;
  color?: string;
  size?: number;
  presentation?: 'plain' | 'navigation';
}) {
  const iconName = liquidGlyphIcons[glyph];
  const orbit = useLiquidVisualMode() === 'orbit';
  const orbitModuleIcon = orbitModuleGlyphIcons[glyph];
  if (orbit && presentation === 'navigation' && iconName) {
    const frameSize = Math.max(28, size + 10);
    return (
      <LinearGradient
        colors={active ? ['#F7FBFF', '#DCEBFF'] : ['#FFFFFF', '#EEF3F8']}
        start={{ x: 0.12, y: 0.08 }}
        end={{ x: 0.9, y: 1 }}
        style={[
          styles.orbitGlyphFrame,
          active && styles.orbitGlyphFrameActive,
          { width: frameSize, height: frameSize, borderRadius: Math.round(frameSize * 0.34) },
        ]}
      >
        <Ionicons
          color={color ?? (active ? '#0B63F3' : '#334155')}
          name={iconName}
          size={size}
        />
        <View style={[styles.orbitGlyphNode, active && styles.orbitGlyphNodeActive]} />
      </LinearGradient>
    );
  }
  if (orbit && orbitModuleIcon) {
    const frameSize = Math.max(28, size + 10);
    const iconColor = color ?? (active ? '#0B63F3' : '#334155');
    return (
      <LinearGradient
        colors={active ? ['#F7FBFF', '#DCEBFF'] : ['#FFFFFF', '#EEF3F8']}
        start={{ x: 0.12, y: 0.08 }}
        end={{ x: 0.9, y: 1 }}
        style={[
          styles.orbitGlyphFrame,
          active && styles.orbitGlyphFrameActive,
          { width: frameSize, height: frameSize, borderRadius: Math.round(frameSize * 0.34) },
        ]}
      >
        <Ionicons
          color={active ? 'rgba(11,99,243,0.18)' : 'rgba(51,65,85,0.12)'}
          name={orbitModuleIcon.filled}
          size={size + 3}
          style={styles.orbitGlyphFill}
        />
        <Ionicons color={iconColor} name={orbitModuleIcon.outline} size={size} />
        <View style={[styles.orbitGlyphNode, active && styles.orbitGlyphNodeActive]} />
      </LinearGradient>
    );
  }
  if (iconName) {
    return (
      <Ionicons
        color={color ?? (active ? liquidClassicColors.blue600 : orbit ? '#334155' : liquidClassicColors.white72)}
        name={iconName}
        size={size}
      />
    );
  }
  return (
    <Text style={[styles.iconGlyph, orbit && styles.orbitIconGlyph, active && styles.iconGlyphActive, color ? { color } : null]}>
      {glyph}
    </Text>
  );
}

export function LiquidSurface({
  children,
  style,
  contentStyle,
  active = false,
  solid = false,
  accessibilityLabel,
}: LiquidSurfaceProps) {
  const orbit = useLiquidVisualMode() === 'orbit';
  const content = (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.surfaceContent,
        orbit && styles.orbitSurfaceContent,
        solid && styles.surfaceSolid,
        solid && orbit && styles.orbitSurfaceSolid,
        active && styles.surfaceActive,
        active && orbit && styles.orbitSurfaceActive,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.surfaceFrame, orbit && styles.orbitSurfaceFrame, active && liquidClassicShadows.focus, style]}>
      {solid ? (
        content
      ) : (
        <BlurView intensity={Platform.OS === 'web' ? 22 : 30} tint={orbit ? 'light' : 'dark'} style={styles.blur}>
          {content}
        </BlurView>
      )}
    </View>
  );
}

type LiquidTextVariant = 'display' | 'title' | 'section' | 'body' | 'meta' | 'kicker';

export function LiquidText({
  children,
  variant = 'body',
  style,
  numberOfLines,
  accessibilityRole,
}: {
  children: ReactNode;
  variant?: LiquidTextVariant;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityRole?: 'header' | 'text';
}) {
  const orbit = useLiquidVisualMode() === 'orbit';
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      style={[
        orbit ? liquidTypography[variant] : liquidClassicTypography[variant],
        orbit && styles.orbitText,
        variant === 'kicker' && orbit && styles.orbitKicker,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function LiquidLogo({
  compact = false,
  mini = false,
  width,
}: {
  compact?: boolean;
  mini?: boolean;
  /** Responsive wordmark width. The intrinsic 8:1 ratio is preserved. */
  width?: number;
}) {
  const orbit = useLiquidVisualMode() === 'orbit';
  const wordmarkWidth = width ?? (mini ? 116 : compact ? 224 : 320);
  const wordmarkFontSize = Math.max(14, Math.min(38, wordmarkWidth / 12));
  const responsiveSize = width
    ? ({ width, height: width / 8 } as const)
    : null;

  if (orbit) {
    return (
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel="CareSuite HealthOS"
        style={[
          styles.orbitWordmark,
          {
            width: wordmarkWidth,
            minHeight: Math.ceil(wordmarkFontSize * 1.3),
          },
        ]}
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={1}
          style={[styles.orbitWordmarkText, { fontSize: wordmarkFontSize }]}
        >
          CareSuite<Text style={styles.orbitWordmarkAccent}> HealthOS</Text>
        </Text>
      </View>
    );
  }

  return (
    <View accessible accessibilityRole="header" accessibilityLabel="CareSuite HealthOS">
      <Image
        resizeMode="contain"
        source={require('../../../assets/brand/caresuite-healthos-logo.png')}
        style={[
          styles.brandImage,
          compact && styles.brandImageCompact,
          mini && styles.brandImageMini,
          responsiveSize,
        ]}
      />
    </View>
  );
}

export type LiquidButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function LiquidButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  compact = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: LiquidButtonVariant;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
}) {
  const orbit = useLiquidVisualMode() === 'orbit';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        orbit && styles.orbitButton,
        compact && styles.buttonCompact,
        fullWidth && styles.fullWidth,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'secondary' && orbit && styles.orbitButtonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={orbit ? '#0B1220' : liquidClassicColors.white} />
      ) : (
        <>
          {icon ? <LiquidGlyph active color={orbit && variant === 'primary' ? '#FFFFFF' : undefined} glyph={icon} size={18} /> : null}
          <Text style={[
            styles.buttonLabel,
            orbit && styles.orbitButtonLabel,
            orbit && (variant === 'secondary' || variant === 'ghost') && styles.orbitButtonSecondaryLabel,
          ]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function LiquidIconButton({
  label,
  glyph,
  onPress,
  active = false,
  badge,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  active?: boolean;
  badge?: string;
}) {
  const orbit = useLiquidVisualMode() === 'orbit';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        orbit && styles.orbitIconButton,
        active && styles.iconButtonActive,
        pressed && styles.buttonPressed,
      ]}
    >
      <LiquidGlyph active={active} glyph={glyph} />
      {badge ? (
        <View style={styles.iconBadge}>
          <Text style={styles.iconBadgeLabel}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type LiquidFieldProps = Partial<Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'autoComplete'
  | 'autoCorrect'
  | 'maxLength'
  | 'multiline'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'secureTextEntry'
  | 'textContentType'
>> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  required?: boolean;
};

export function LiquidField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  keyboardType,
  required,
  multiline,
  ...inputProps
}: LiquidFieldProps) {
  const orbit = useLiquidVisualMode() === 'orbit';
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, orbit && styles.orbitFieldLabel]}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityHint={error || hint}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={orbit ? '#94A3B8' : liquidClassicColors.white32}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.input,
          orbit && styles.orbitInput,
          multiline && styles.inputMultiline,
          error && styles.inputError,
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && hint ? <Text style={[styles.fieldHint, orbit && styles.orbitMutedText]}>{hint}</Text> : null}
    </View>
  );
}

export function LiquidStatus({
  label,
  tone = 'neutral',
  detail,
}: {
  label: string;
  tone?: LiquidSemanticTone;
  detail?: string;
}) {
  const orbit = useLiquidVisualMode() === 'orbit';
  const color = tone === 'neutral'
    ? orbit ? '#475569' : liquidClassicColors.white72
    : toneColor(tone);
  return (
    <View
      accessible
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      style={[styles.status, orbit && styles.orbitStatus, { borderColor: `${color}66` }]}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusLabel, { color }]}>{label}</Text>
      {detail ? <Text style={[styles.statusDetail, orbit && styles.orbitMutedText]}>{detail}</Text> : null}
    </View>
  );
}

export function LiquidMetric({
  label,
  value,
  detail,
  tone = 'neutral',
  glyph,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: LiquidSemanticTone;
  glyph?: string;
}) {
  const orbit = useLiquidVisualMode() === 'orbit';
  const color = tone === 'neutral'
    ? orbit ? '#475569' : liquidClassicColors.white72
    : toneColor(tone);
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${detail ? `. ${detail}` : ''}`} style={[styles.metric, orbit && styles.orbitMetric]}>
      <View style={styles.metricHeader}>
        {glyph ? <LiquidGlyph color={color} glyph={glyph} size={16} /> : null}
        <Text style={[styles.metricLabel, orbit && styles.orbitMutedText]}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, orbit && styles.orbitStrongText]}>{value}</Text>
      {detail ? <Text style={[styles.metricDetail, orbit && styles.orbitMutedText]}>{detail}</Text> : null}
    </View>
  );
}

export type LiquidStateKind =
  | 'loading'
  | 'empty'
  | 'error'
  | 'offline'
  | 'locked'
  | 'success';

const stateGlyph: Record<LiquidStateKind, string> = {
  loading: '◌',
  empty: '○',
  error: '!',
  offline: '⌁',
  locked: '⌑',
  success: '✓',
};

export function LiquidState({
  kind,
  title,
  message,
  reference,
  actionLabel,
  onAction,
}: {
  kind: LiquidStateKind;
  title: string;
  message: string;
  reference?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const orbit = useLiquidVisualMode() === 'orbit';
  return (
    <LiquidSurface solid contentStyle={styles.state}>
      {kind === 'loading' ? (
        <ActivityIndicator color={orbit ? liquidClassicColors.blue600 : liquidClassicColors.blue400} size="large" />
      ) : (
        <View style={styles.stateGlyph}>
          <LiquidGlyph glyph={stateGlyph[kind]} size={24} />
        </View>
      )}
      <View style={styles.stateCopy}>
        <LiquidText variant="section" accessibilityRole="header">{title}</LiquidText>
        <LiquidText variant="meta">{message}</LiquidText>
        {reference ? <Text selectable style={styles.reference}>Referenz: {reference}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <LiquidButton label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </LiquidSurface>
  );
}

export function LiquidDivider() {
  const orbit = useLiquidVisualMode() === 'orbit';
  return <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.divider, orbit && styles.orbitDivider]} />;
}

export function LiquidBackdrop({ children }: { children: ReactNode }) {
  const orbit = useLiquidVisualMode() === 'orbit';
  return (
    <View style={[styles.backdrop, orbit && styles.orbitBackdrop]}>
      {!orbit ? (
        <LinearGradient
          pointerEvents="none"
          colors={['#010817', '#021126', '#010817']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View pointerEvents="none" style={[styles.glowTop, orbit && styles.orbitGlowTop]} />
      <View pointerEvents="none" style={[styles.glowBottom, orbit && styles.orbitGlowBottom]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  orbitWordmark: {
    justifyContent: 'center',
  },
  orbitWordmarkText: {
    color: '#0B2A4A',
    fontWeight: '700',
    letterSpacing: -0.65,
  },
  orbitWordmarkAccent: {
    color: '#1683FF',
    fontWeight: '700',
  },
  orbitGlyphFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.12)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  orbitGlyphFrameActive: {
    borderColor: 'rgba(37,99,235,0.35)',
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  orbitGlyphFill: {
    position: 'absolute',
  },
  orbitGlyphNode: {
    position: 'absolute',
    right: 3,
    top: 3,
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#94A3B8',
  },
  orbitGlyphNodeActive: {
    backgroundColor: '#38BDF8',
  },
  orbitSurfaceFrame: {
    borderColor: 'rgba(37,99,235,0.18)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#2563EB',
    shadowOpacity: 0.08,
  },
  orbitSurfaceContent: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  orbitSurfaceSolid: {
    backgroundColor: '#FFFFFF',
  },
  orbitSurfaceActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#F8FBFF',
  },
  orbitText: {
    color: '#0B1220',
  },
  orbitKicker: {
    color: '#2563EB',
  },
  orbitIconGlyph: {
    color: '#334155',
  },
  orbitButton: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  orbitButtonSecondary: {
    borderColor: 'rgba(15,23,42,0.16)',
    backgroundColor: '#FFFFFF',
  },
  orbitButtonLabel: {
    color: '#FFFFFF',
  },
  orbitButtonSecondaryLabel: {
    color: '#0B1220',
  },
  orbitIconButton: {
    borderColor: 'rgba(15,23,42,0.1)',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  orbitFieldLabel: {
    color: '#172033',
  },
  orbitInput: {
    borderColor: 'rgba(15,23,42,0.18)',
    backgroundColor: '#FFFFFF',
    color: '#0B1220',
  },
  orbitMutedText: {
    color: '#64748B',
  },
  orbitStrongText: {
    color: '#0B1220',
  },
  orbitStatus: {
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  orbitMetric: {
    borderColor: 'rgba(15,23,42,0.1)',
    backgroundColor: '#F8FAFC',
  },
  orbitDivider: {
    backgroundColor: 'rgba(15,23,42,0.1)',
  },
  orbitBackdrop: {
    backgroundColor: 'transparent',
  },
  orbitGlowTop: {
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  orbitGlowBottom: {
    backgroundColor: 'rgba(14,165,233,0.09)',
  },
  surfaceFrame: {
    overflow: 'hidden',
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.34)',
    backgroundColor: 'rgba(5,23,47,0.78)',
    ...liquidClassicShadows.panel,
  },
  blur: {
    flex: 1,
  },
  surfaceContent: {
    flex: 1,
    backgroundColor: 'rgba(7,29,57,0.54)',
  },
  surfaceSolid: {
    backgroundColor: 'rgba(5,24,49,0.96)',
  },
  surfaceActive: {
    borderWidth: 1,
    borderColor: liquidClassicColors.blue400,
    backgroundColor: 'rgba(8,38,76,0.72)',
  },
  brandImage: {
    width: 320,
    height: 40,
  },
  brandImageCompact: {
    width: 224,
    height: 28,
  },
  brandImageMini: {
    width: 94,
    height: 12,
  },
  button: {
    minHeight: 42,
    paddingHorizontal: liquidSpace[4],
    paddingVertical: liquidSpace[3],
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidClassicColors.blue400,
    backgroundColor: liquidClassicColors.blue600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: liquidSpace[2],
    ...liquidClassicShadows.focus,
  },
  buttonCompact: {
    minHeight: 38,
    paddingVertical: liquidSpace[2],
    paddingHorizontal: liquidSpace[3],
  },
  fullWidth: {
    width: '100%',
  },
  buttonSecondary: {
    borderColor: liquidClassicColors.white22,
    backgroundColor: liquidClassicColors.white08,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonGhost: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonDanger: {
    borderColor: liquidClassicColors.danger,
    backgroundColor: 'rgba(255,91,110,0.18)',
    shadowColor: liquidClassicColors.danger,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  buttonFocused: {
    borderWidth: 2,
    borderColor: liquidClassicColors.blue200,
  },
  buttonDisabled: {
    opacity: 0.44,
  },
  buttonIcon: {
    color: liquidClassicColors.white,
    fontSize: 18,
    lineHeight: 22,
  },
  buttonLabel: {
    color: liquidClassicColors.white,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  iconButton: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    borderColor: liquidClassicColors.blue500,
    backgroundColor: 'rgba(20,120,255,0.18)',
    ...liquidClassicShadows.focus,
  },
  iconGlyph: {
    color: liquidClassicColors.white72,
    fontSize: 21,
    lineHeight: 25,
  },
  iconGlyphActive: {
    color: liquidClassicColors.blue200,
  },
  iconBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: liquidClassicColors.blue500,
  },
  iconBadgeLabel: {
    color: liquidClassicColors.white,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  field: {
    width: '100%',
    gap: 7,
  },
  fieldLabel: {
    color: liquidClassicColors.white88,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  required: {
    color: liquidClassicColors.blue200,
  },
  input: {
    minHeight: 50,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidClassicColors.white22,
    backgroundColor: 'rgba(6,21,43,0.72)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: liquidClassicColors.white,
    fontSize: 16,
    lineHeight: 22,
  },
  inputMultiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: liquidClassicColors.danger,
  },
  fieldHint: {
    color: liquidClassicColors.white56,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: liquidClassicColors.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  status: {
    minHeight: 34,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: liquidRadius.pill,
    borderWidth: 1,
    backgroundColor: liquidClassicColors.white08,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  statusDetail: {
    minWidth: 0,
    flexShrink: 1,
    color: liquidClassicColors.white56,
    fontSize: 12,
    lineHeight: 16,
  },
  metric: {
    minWidth: 112,
    flex: 1,
    padding: liquidSpace[4],
    borderRadius: liquidRadius.small,
    backgroundColor: 'rgba(9,34,66,0.72)',
    borderWidth: 1,
    borderColor: liquidClassicColors.white12,
    gap: 5,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metricGlyph: {
    fontSize: 16,
    lineHeight: 20,
  },
  metricLabel: {
    color: liquidClassicColors.white72,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  metricValue: {
    color: liquidClassicColors.white,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricDetail: {
    color: liquidClassicColors.white56,
    fontSize: 12,
    lineHeight: 17,
  },
  state: {
    minHeight: 118,
    padding: liquidSpace[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace[4],
  },
  stateGlyph: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: liquidClassicColors.blue500,
    backgroundColor: 'rgba(20,120,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCopy: {
    flex: 1,
    gap: 4,
  },
  reference: {
    marginTop: 3,
    color: liquidClassicColors.white56,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: liquidClassicColors.white12,
  },
  backdrop: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#010817',
  },
  glowTop: {
    position: 'absolute',
    top: -300,
    right: -240,
    width: 620,
    height: 620,
    borderRadius: 310,
    backgroundColor: 'rgba(15,101,210,0.08)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -260,
    left: -220,
    width: 560,
    height: 560,
    borderRadius: 280,
    backgroundColor: 'rgba(15,101,210,0.07)',
  },
});
