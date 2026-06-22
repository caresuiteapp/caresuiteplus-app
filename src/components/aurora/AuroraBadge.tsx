import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

type Variant = 'default' | 'cyan' | 'pink' | 'muted' | 'green' | 'red';

type Props = {
  label: string;
  variant?: Variant;
  dot?: boolean;
};

const VARIANT_BORDER: Record<Variant, string> = {
  default: careSuiteAuroraTheme.glass.border,
  cyan: careSuiteAuroraTheme.accent.cyan,
  pink: careSuiteAuroraTheme.accent.pink,
  muted: 'rgba(255,255,255,0.24)',
  green: '#10B981',
  red: '#EF4444',
};

export function AuroraBadge({ label, variant = 'default', dot = false }: Props) {
  const { typography } = useLegacyTheme();

  return (
    <View style={[styles.chip, { borderColor: VARIANT_BORDER[variant] }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: VARIANT_BORDER[variant] }]} /> : null}
      <Text style={[typography.caption, styles.label]}>{label}</Text>
    </View>
  );
}

export const AuroraStatusChip = AuroraBadge;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { color: careSuiteAuroraTheme.text.primary, fontWeight: '600' },
});
