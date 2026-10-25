import { CareSuiteNativeText as Text } from '@/components/ui/CareSuiteNativeText';
import { desktopHeaderControl, desktopHeaderControlColors } from '@/design/web/desktopHeaderControls';
import { useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, ScrollView, View, useWindowDimensions } from 'react-native';
import { liquidClassicColors, liquidColors, liquidRadius } from '@/liquid-command/foundation/tokens';
import { useLiquidVisualMode } from '@/liquid-command/components/LiquidPrimitives';

type Props = { compact?: boolean; dense?: boolean; appearance?: 'default' | 'desktop-header' };

/** Native text follows the device text scale. The dialog routes to the relevant setting on Android. */
export function PortalTextSizeControls({ compact = false, dense = false, appearance = 'default' }: Props) {
  const desktopHeader = appearance === 'desktop-header';
  const orbit = useLiquidVisualMode() === 'orbit';
  const { fontScale } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAndroidTextSettings = async () => {
    setError(null);
    try {
      await Linking.sendIntent('android.settings.DISPLAY_SETTINGS');
    } catch {
      setError('Die Anzeige-Einstellungen konnten nicht geöffnet werden. Öffnen Sie Einstellungen > Anzeige > Schriftgröße.');
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Textgröße ändern"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.button, orbit && styles.orbitButton, compact && styles.compact, dense && styles.dense, desktopHeader && styles.header, pressed && styles.pressed]}
        testID="portal-text-size-controls"
      >
        <Text style={[styles.label, orbit && styles.orbitLabel, desktopHeader && styles.headerText]}>aA</Text>
        {!compact && !dense ? <View><Text style={[styles.caption, orbit && styles.orbitCaption]}>Textgröße</Text></View> : null}
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled"><View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>Textgröße</Text>
            <Text style={styles.modalBody}>
              CareSuite übernimmt automatisch die Textgröße Ihres Geräts. Aktuell werden etwa {Math.round(fontScale * 100)} % verwendet.
            </Text>
            <Text style={styles.modalHint}>
              {Platform.OS === 'android'
                ? 'Ändern Sie die Schriftgröße unter Anzeige. Nach der Rückkehr passt sich CareSuite automatisch an.'
                : 'Öffnen Sie Einstellungen > Anzeige & Helligkeit > Textgröße. Nach der Rückkehr passt sich CareSuite automatisch an.'}
            </Text>
            {error ? <Text style={styles.modalError}>{error}</Text> : null}
            {Platform.OS === 'android' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Anzeige & Textgröße öffnen" style={styles.modalPrimary} onPress={() => void openAndroidTextSettings()}>
                <Text style={styles.modalPrimaryText}>Anzeige & Textgröße öffnen</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Schließen" style={styles.modalSecondary} onPress={() => setVisible(false)}>
              <Text style={styles.modalSecondaryText}>Schließen</Text>
            </Pressable>
          </View></ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: { ...desktopHeaderControl, minWidth: 44, minHeight: 44 },
  headerText: { color: desktopHeaderControlColors.text },
  dense: { minWidth: 44, paddingHorizontal: 10 },
  modalScroll: { flexShrink: 1, width: '100%' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 8 },
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 12, 28, 0.72)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: liquidClassicColors.blue300Alpha32,
    backgroundColor: '#F8FBFF',
  },
  modalTitle: { color: '#071A31', fontSize: 23, lineHeight: 29, fontWeight: '900' },
  modalBody: { color: '#17324D', fontSize: 16, lineHeight: 23, fontWeight: '600' },
  modalHint: { color: '#4D647A', fontSize: 14, lineHeight: 21 },
  modalError: { color: '#B42318', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  modalPrimary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#0879E6',
  },
  modalPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  modalSecondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  modalSecondaryText: { color: '#0A5FB8', fontSize: 15, fontWeight: '800' },
});
