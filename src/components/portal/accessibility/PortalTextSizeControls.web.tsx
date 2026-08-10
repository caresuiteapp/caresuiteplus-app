import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatWebFontScaleLabel } from '@/design/web/webFontScaleConfig';
import { useWebFontScale } from '@/design/web/WebFontScaleProvider';
import { liquidClassicColors, liquidColors, liquidRadius } from '@/liquid-command/foundation/tokens';
import { useLiquidVisualMode } from '@/liquid-command/components/LiquidPrimitives';

type Props = { compact?: boolean };

export function PortalTextSizeControls({ compact = false }: Props) {
  const { scale, increase, decrease, reset, canIncrease, canDecrease } = useWebFontScale();
  const orbit = useLiquidVisualMode() === 'orbit';
  const label = formatWebFontScaleLabel(scale);

  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={canIncrease ? `Textgröße ${label}. Text vergrößern` : `Textgröße ${label}. Auf 100 Prozent zurücksetzen`}
        onPress={canIncrease ? increase : reset}
        style={({ pressed }) => [styles.compactTrigger, orbit && styles.orbitWrap, pressed && styles.pressed]}
        testID="portal-text-size-controls"
      >
        <Text style={[styles.bigA, orbit && styles.orbitText]}>aA</Text>
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={`Textgröße ${label}`}
      style={[styles.wrap, orbit && styles.orbitWrap, compact && styles.wrapCompact]}
      testID="portal-text-size-controls"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Text verkleinern"
        accessibilityState={{ disabled: !canDecrease }}
        disabled={!canDecrease}
        onPress={decrease}
        style={({ pressed }) => [styles.button, compact && styles.buttonCompact, !canDecrease && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={[styles.smallA, orbit && styles.orbitText]}>A−</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Textgröße ${label}. Auf 100 Prozent zurücksetzen`}
        onPress={reset}
        style={({ pressed }) => [styles.value, compact && styles.valueCompact, pressed && styles.pressed]}
      >
        <Text style={[styles.largeA, orbit && styles.orbitAccent]}>aA</Text>
        {!compact ? <Text style={[styles.percent, orbit && styles.orbitMuted]}>{label}</Text> : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Text vergrößern"
        accessibilityState={{ disabled: !canIncrease }}
        disabled={!canIncrease}
        onPress={increase}
        style={({ pressed }) => [styles.button, compact && styles.buttonCompact, !canIncrease && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={[styles.bigA, orbit && styles.orbitText]}>A+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 42,
    padding: 3,
    borderWidth: 1,
    borderColor: liquidClassicColors.blue300Alpha32,
    borderRadius: liquidRadius.control,
    backgroundColor: 'rgba(9,43,78,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  wrapCompact: { minHeight: 38 },
  compactTrigger: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: liquidClassicColors.blue300Alpha32,
    borderRadius: liquidRadius.control,
    backgroundColor: 'rgba(9,43,78,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minWidth: 42,
    minHeight: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minWidth: 36, minHeight: 32 },
  value: { minWidth: 58, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  valueCompact: { minWidth: 38 },
  smallA: { color: liquidClassicColors.white88, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  largeA: { color: liquidClassicColors.blue200, fontSize: 15, lineHeight: 18, fontWeight: '900' },
  bigA: { color: liquidClassicColors.white, fontSize: 17, lineHeight: 20, fontWeight: '900' },
  percent: { color: liquidClassicColors.white72, fontSize: 9, lineHeight: 11, fontWeight: '700' },
  orbitWrap: { borderColor: liquidColors.white12, backgroundColor: '#FFFFFF' },
  orbitText: { color: liquidColors.white },
  orbitAccent: { color: liquidColors.blue600 },
  orbitMuted: { color: liquidColors.white56 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.72 },
});
