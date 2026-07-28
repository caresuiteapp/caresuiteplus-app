import type { ReactNode } from 'react';
import {
  ActivityIndicator,
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

export function LiquidLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="CareSuite HealthOS">
      <Text style={[styles.brand, compact && styles.brandCompact]}>
        CareSuite <Text style={styles.brandAccent}>HealthOS</Text>
      </Text>
      {!compact ? <Text style={styles.brandMode}>LIQUID COMMAND</Text> : null}
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
          {icon ? <Text style={styles.buttonIcon}>{icon}</Text> : null}
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
      <Text style={[styles.iconGlyph, active && styles.iconGlyphActive]}>{glyph}</Text>
      {badge ? (
        <View style={styles.iconBadge}>
          <Text style={styles.iconBadgeLabel}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type LiquidFieldProps = Pick<
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
> & {
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
        {glyph ? <Text style={[styles.metricGlyph, { color }]}>{glyph}</Text> : null}
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
          <Text style={styles.stateGlyphText}>{stateGlyph[kind]}</Text>
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
  brand: {
    color: liquidColors.white,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandCompact: {
    fontSize: 18,
  },
  brandAccent: {
    color: liquidColors.blue400,
    fontWeight: '500',
  },
  brandMode: {
    marginTop: 2,
    color: liquidColors.white56,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.4,
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
    borderRadius: liquidRadius.pill,
    borderWidth: 1,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  statusDetail: {
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
  stateGlyphText: {
    color: liquidColors.blue200,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
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
