import { Linking, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { darkGlassSurfaceText } from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

export function dialPhoneNumber(phone: string): void {
  const normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized) return;
  void Linking.openURL(`tel:${normalized}`);
}

type PhoneActionRowProps = {
  label: string;
  value: string;
  icon?: string;
};

export function PhoneActionRow({ label, value, icon = '📞' }: PhoneActionRowProps) {
  const text = darkGlassSurfaceText;

  return (
    <Pressable
      onPress={() => dialPhoneNumber(value)}
      accessibilityRole="button"
      accessibilityLabel={`${label} anrufen: ${value}`}
      style={[styles.row, webCursor]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: text.muted }]}>{label}</Text>
        <Text style={[styles.value, { color: text.primary }]}>{value}</Text>
      </View>
      <PremiumButton title="Anrufen" size="sm" variant="secondary" onPress={() => dialPhoneNumber(value)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: careLightColors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(98,243,255,0.12)',
  },
  icon: { fontSize: 18 },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  label: { ...careTypography.caption },
  value: { ...careTypography.bodyStrong },
});
