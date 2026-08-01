import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { liquidColors, liquidRadius } from '@/liquid-command/foundation/tokens';

type Props = { compact?: boolean };

/** Native text follows the device accessibility setting; this opens that setting directly. */
export function PortalTextSizeControls({ compact = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Textgröße in den Geräteeinstellungen ändern"
      onPress={() => void Linking.openSettings()}
      style={({ pressed }) => [styles.button, compact && styles.compact, pressed && styles.pressed]}
      testID="portal-text-size-controls"
    >
      <Text style={styles.label}>aA</Text>
      {!compact ? <View><Text style={styles.caption}>Textgröße</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    borderRadius: liquidRadius.control,
    backgroundColor: 'rgba(9,43,78,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  compact: { minWidth: 42, paddingHorizontal: 9, justifyContent: 'center' },
  label: { color: liquidColors.blue200, fontSize: 17, lineHeight: 21, fontWeight: '900' },
  caption: { color: liquidColors.white88, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
