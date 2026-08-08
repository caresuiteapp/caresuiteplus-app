import type { ComponentProps, ReactNode } from 'react';
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
  liquidColors,
  liquidRadius,
  liquidShadows,
  liquidSpace,
  liquidTypography,
  toneColor,
  type LiquidSemanticTone,
} from '../foundation/tokens';

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
};

export function LiquidGlyph({
  glyph,
  active = false,
  color,
  size = 21,
}: {
  glyph: string;
  active?: boolean;
  color?: string;
  size?: number;
}) {
  const iconName = liquidGlyphIcons[glyph];
  if (iconName) {
    return (
      <Ionicons
        color={color ?? (active ? liquidColors.blue200 : liquidColors.white72)}
        name={iconName}
        size={size}
      />
    );
  }
  return (
    <Text style={[styles.iconGlyph, active && styles.iconGlyphActive, color ? { color } : null]}>
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
  const content = (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.surfaceContent,
        solid && styles.surfaceSolid,
        active && styles.surfaceActive,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.surfaceFrame, active && liquidShadows.focus, style]}>
      {solid ? (
        content
      ) : (
        <BlurView intensity={Platform.OS === 'web' ? 28 : 38} tint="dark" style={styles.blur}>
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
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      style={[liquidTypography[variant], style]}
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
  const responsiveSize = width
    ? ({ width, height: width / 8 } as const)
    : null;

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
        compact && styles.buttonCompact,
        fullWidth && styles.fullWidth,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={liquidColors.white} />
      ) : (
        <>
          {icon ? <LiquidGlyph active glyph={icon} size={18} /> : null}
          <Text style={styles.buttonLabel}>{label}</Text>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
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
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
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
        placeholderTextColor={liquidColors.white32}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          error && styles.inputError,
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
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
  const color = toneColor(tone);
  return (
    <View
      accessible
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      style={[styles.status, { borderColor: `${color}66` }]}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusLabel, { color }]}>{label}</Text>
      {detail ? <Text style={styles.statusDetail}>{detail}</Text> : null}
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
  const color = toneColor(tone);
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${detail ? `. ${detail}` : ''}`} style={styles.metric}>
      <View style={styles.metricHeader}>
        {glyph ? <LiquidGlyph color={color} glyph={glyph} size={16} /> : null}
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
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
  return (
    <LiquidSurface solid contentStyle={styles.state}>
      {kind === 'loading' ? (
        <ActivityIndicator color={liquidColors.blue400} size="large" />
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
  return <View accessibilityElementsHidden importantForAccessibility="no" style={styles.divider} />;
}

export function LiquidBackdrop({ children }: { children: ReactNode }) {
  return (
    <View style={styles.backdrop}>
      <LinearGradient
        pointerEvents="none"
        colors={['#010817', '#021126', '#010817']}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surfaceFrame: {
    overflow: 'hidden',
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.34)',
    backgroundColor: 'rgba(5,23,47,0.78)',
    ...liquidShadows.panel,
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
    borderColor: liquidColors.blue400,
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
    borderColor: liquidColors.blue400,
    backgroundColor: liquidColors.blue600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: liquidSpace[2],
    ...liquidShadows.focus,
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
    borderColor: liquidColors.white22,
    backgroundColor: liquidColors.white08,
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
    borderColor: liquidColors.danger,
    backgroundColor: 'rgba(255,91,110,0.18)',
    shadowColor: liquidColors.danger,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  buttonFocused: {
    borderWidth: 2,
    borderColor: liquidColors.blue200,
  },
  buttonDisabled: {
    opacity: 0.44,
  },
  buttonIcon: {
    color: liquidColors.white,
    fontSize: 18,
    lineHeight: 22,
  },
  buttonLabel: {
    color: liquidColors.white,
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
    borderColor: liquidColors.blue500,
    backgroundColor: 'rgba(20,120,255,0.18)',
    ...liquidShadows.focus,
  },
  iconGlyph: {
    color: liquidColors.white72,
    fontSize: 21,
    lineHeight: 25,
  },
  iconGlyphActive: {
    color: liquidColors.blue200,
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
    backgroundColor: liquidColors.blue500,
  },
  iconBadgeLabel: {
    color: liquidColors.white,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  field: {
    width: '100%',
    gap: 7,
  },
  fieldLabel: {
    color: liquidColors.white88,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  required: {
    color: liquidColors.blue200,
  },
  input: {
    minHeight: 50,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidColors.white22,
    backgroundColor: 'rgba(6,21,43,0.72)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: liquidColors.white,
    fontSize: 16,
    lineHeight: 22,
  },
  inputMultiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: liquidColors.danger,
  },
  fieldHint: {
    color: liquidColors.white56,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: liquidColors.danger,
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
    backgroundColor: liquidColors.white08,
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
    color: liquidColors.white56,
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
    borderColor: liquidColors.white12,
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
    color: liquidColors.white72,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  metricValue: {
    color: liquidColors.white,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricDetail: {
    color: liquidColors.white56,
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
    borderColor: liquidColors.blue500,
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
    color: liquidColors.white56,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: liquidColors.white12,
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
