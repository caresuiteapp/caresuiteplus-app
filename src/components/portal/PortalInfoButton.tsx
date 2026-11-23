import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CareSuiteImage as Image } from '@/components/images/CareSuiteImage';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { clientPortalNight as portalPremium } from '@/design/tokens/clientPortalNight';

export function PortalInfoButton({
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Information: ${title}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={[styles.button, compact && styles.buttonCompact]}
      >
        <Image
          source={require('../../../assets/auth/access-client.png')}
          style={[styles.robot, compact && styles.robotCompact]}
          resizeMode="contain"
          accessible={false}
        />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>i</Text>
        </View>
      </Pressable>
      <PortalGlassModal
        visible={open}
        title={title}
        onClose={() => setOpen(false)}
        primaryLabel={actionLabel}
        onPrimary={
          onAction
            ? () => {
                setOpen(false);
                onAction();
              }
            : undefined
        }
      >
        <Text style={styles.message}>
          {message.trim() ||
            'Öffnen Sie den gewünschten Eintrag, um die Einzelheiten und verfügbaren Schritte zu sehen.'}
        </Text>
      </PortalGlassModal>
    </>
  );
}
const styles = StyleSheet.create({
  button: {
    width: 64,
    height: 64,
    alignSelf: 'flex-end',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    backgroundColor: portalPremium.control,
  },
  robot: { width: 60, height: 60 },
  buttonCompact: { width: 44, height: 44, borderRadius: 22 },
  robotCompact: { width: 40, height: 40 },
  badge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: portalPremium.accent.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: portalPremium.text.onStrong, fontWeight: '900', fontSize: 18 },
  message: { fontSize: 17, lineHeight: 26, color: portalPremium.text.primary },
});
