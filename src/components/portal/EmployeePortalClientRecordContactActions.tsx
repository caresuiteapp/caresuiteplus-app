import { SemanticArtwork } from '@/components/icons/SemanticArtwork';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { portalPremium } from '@/design/tokens/portalPremium';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

export function dialPhoneNumber(phone: string): void {
  const normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized) return;
  void Linking.openURL(`tel:${normalized}`).catch(() => Alert.alert('Anruf nicht möglich', `Die Telefonanwendung konnte nicht geöffnet werden. Telefonnummer: ${phone}`));
}

type PhoneActionRowProps = {
  label: string;
  value: string;
  icon?: string;
};

export function PhoneActionRow({ label, value, icon = '📞' }: PhoneActionRowProps) {
  const text = useAuroraAdaptiveText();

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <SemanticArtwork style={styles.icon} webSize={24} webColor={text.primary}>{icon}</SemanticArtwork>
      </View>
      <Pressable style={[styles.copy, webCursor]} onPress={() => dialPhoneNumber(value)}
        accessibilityRole="button" accessibilityLabel={`${label} anrufen: ${value}`}>
        <Text style={[styles.label, { color: text.muted }]}>{label}</Text>
        <Text style={[styles.value, { color: text.primary }]}>{value}</Text>
      </Pressable>
      <PremiumButton title="Anrufen" size="sm" variant="secondary" onPress={() => dialPhoneNumber(value)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: portalPremium.borderSoft,
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
