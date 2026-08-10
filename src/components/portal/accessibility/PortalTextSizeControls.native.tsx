import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { liquidClassicColors, liquidColors, liquidRadius } from '@/liquid-command/foundation/tokens';
import { useLiquidVisualMode } from '@/liquid-command/components/LiquidPrimitives';

type Props = { compact?: boolean };

/** Native text follows the device accessibility setting; this opens that setting directly. */
export function PortalTextSizeControls({ compact = false }: Props) {
  const orbit = useLiquidVisualMode() === 'orbit';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Textgröße in den Geräteeinstellungen ändern"
      onPress={() => void Linking.openSettings()}
      style={({ pressed }) => [styles.button, orbit && styles.orbitButton, compact && styles.compact, pressed && styles.pressed]}
      testID="portal-text-size-controls"
    >
      <Text style={[styles.label, orbit && styles.orbitLabel]}>aA</Text>
      {!compact ? <View><Text style={[styles.caption, orbit && styles.orbitCaption]}>Textgröße</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: liquidClassicColors.blue300Alpha32,
    borderRadius: liquidRadius.control,
    backgroundColor: 'rgba(9,43,78,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  compact: { minWidth: 42, paddingHorizontal: 9, justifyContent: 'center' },
  label: { color: liquidClassicColors.blue200, fontSize: 17, lineHeight: 21, fontWeight: '900' },
  caption: { color: liquidClassicColors.white88, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  orbitButton: { borderColor: liquidColors.white12, backgroundColor: '#FFFFFF' },
  orbitLabel: { color: liquidColors.blue600 },
  orbitCaption: { color: liquidColors.white72 },
  pressed: { opacity: 0.72 },
});
