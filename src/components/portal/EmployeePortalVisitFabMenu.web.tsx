import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton } from '@/components/ui';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

type Action = { key: string; label: string; onPress: () => void };
/** Additional actions share the visit toolbar instead of floating above form fields. */
export function EmployeePortalVisitFabMenu({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable style={styles.trigger} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Weitere Inhalte zum Einsatz hinzufügen" accessibilityState={{ expanded: open }}>
      <Ionicons name="add" size={22} color="#FFFFFF" />
      <Text style={styles.label}>Zusatz</Text>
    </Pressable>
    <PlatformModal visible={open} title="Zum Einsatz hinzufügen" subtitle="Interne Informationen und Dateien ergänzen" onClose={() => setOpen(false)} variant="center" maxWidth={520}>
      <View style={styles.menu}>{actions.map(action => <PremiumButton key={action.key} title={action.label} variant="secondary" fullWidth onPress={() => { setOpen(false); action.onPress(); }} />)}</View>
    </PlatformModal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { minWidth: 56, maxWidth: 112, minHeight: 48, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, backgroundColor: '#075DC7', alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: font(13), lineHeight: font(17), color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  menu: { gap: 10 },
});
