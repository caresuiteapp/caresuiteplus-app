import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PLATFORM_COLORS } from './PlatformColors';

type Props = {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
};

export function PlatformFormField({ label, children, hint, required = false }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  label: { color: PLATFORM_COLORS.text, fontSize: 12, fontWeight: '700' },
  hint: { color: PLATFORM_COLORS.muted, fontSize: 10, lineHeight: 15 },
});
