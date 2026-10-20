import { Children, cloneElement, isValidElement, useId, type ReactNode, type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
type Props = { label: string; children: ReactNode; hint?: string; required?: boolean };
export function PlatformFormField({ label, children, hint, required = false }: Props) {
  const id = useId();
  const fields = Children.map(children, child => isValidElement(child) ? cloneElement(child as ReactElement<Record<string, unknown>>, {
    accessibilityLabel: (child.props as Record<string, unknown>).accessibilityLabel ?? label,
    ...(hint ? { 'aria-describedby': `${id}-hint` } : {}),
  }) : child);
  return <View style={styles.wrap}>
    <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>{fields}
    {hint ? <Text nativeID={`${id}-hint`} style={styles.hint}>{hint}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ wrap: { gap: 7, minWidth: 0 },
  label: { color: '#203E5C', fontSize: font(15), lineHeight: font(22), fontWeight: '700' },
  hint: { color: '#526B82', fontSize: font(13), lineHeight: font(20) },
});
