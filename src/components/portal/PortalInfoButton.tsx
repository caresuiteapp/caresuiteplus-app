import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { portalPremium } from '@/design/tokens/portalPremium';

export function PortalInfoButton({ title, message, actionLabel, onAction }: {
  title: string; message: string; actionLabel?: string; onAction?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Information: ${title}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={styles.button}>
      <Image source={require('../../../assets/auth/access-client.png')} style={styles.robot} resizeMode="contain" accessible={false} />
      <View style={styles.badge}><Text style={styles.badgeText}>i</Text></View>
    </Pressable>
    <PortalGlassModal visible={open} title={title} onClose={() => setOpen(false)} primaryLabel={actionLabel} onPrimary={onAction ? () => { setOpen(false); onAction(); } : undefined}>
      <Text style={styles.message}>{message.trim() || 'Öffnen Sie den gewünschten Eintrag, um die Einzelheiten und verfügbaren Schritte zu sehen.'}</Text>
    </PortalGlassModal>
  </>;
}
const styles = StyleSheet.create({
  button: { width: 64, height: 64, alignSelf: 'flex-end', borderRadius: 32, borderWidth: 1, borderColor: portalPremium.borderStrong, backgroundColor: '#FFFFFF' },
  robot: { width: 60, height: 60 },
  badge: { position: 'absolute', right: -1, bottom: -1, width: 24, height: 24, borderRadius: 12, backgroundColor: portalPremium.accent.blue, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  message: { fontSize: 17, lineHeight: 26, color: portalPremium.text.primary },
});
