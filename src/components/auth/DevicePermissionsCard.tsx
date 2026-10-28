import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { readDevicePermissions, openDevicePermissionSettings, devicePermissionLabels, type DevicePermissionItem } from '@/lib/platform/devicePermissions';

export function DevicePermissionsCard() {
  const { user, portalSession } = useAuth();
  const identity = `${user?.id}:${portalSession?.tenantId}:${user?.roleKey}`;
  return <DevicePermissionsContent key={identity} />;
}
function DevicePermissionsContent() {
  const { user } = useAuth();
  const includeLocation = ['employee_portal', 'caregiver', 'nurse'].includes(String(user?.roleKey));
  const [items, setItems] = useState<DevicePermissionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    setBusy(true);
    try { const value = await readDevicePermissions(includeLocation); if (active.current) { setItems(value); setError(null); } }
    catch { if (active.current) setError('Gerätefreigaben konnten nicht vollständig gelesen werden. Bitte erneut prüfen.'); }
    finally { if (active.current) setBusy(false); }
  }, [includeLocation]);
  useEffect(() => {
    active.current = true; void refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active.current = false; listener.remove(); };
  }, [refresh]);
  return <View style={styles.card}>
    <Text style={styles.title}>Gerätefreigaben</Text>
    <Text style={styles.text}>Diese Übersicht zeigt die aktuelle Gerätefreigabe. Eine Erklärung oder interne Bestätigung erteilt keine Systemberechtigung.</Text>
    {items.map(item => <View key={item.key} style={styles.item}>
      <Text style={styles.label}>{item.title}</Text>
      <Text style={styles.text}>{item.purpose}</Text>
      <Text style={styles.status}>{item.kind === 'workflow' ? 'Fachliche Berechtigung · kein Systemdialog' : devicePermissionLabels[item.status]}</Text>
    </View>)}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <PremiumButton title="Gerätefreigaben erneut prüfen" variant="secondary" loading={busy} onPress={() => void refresh()} />
    {Platform.OS !== 'web' ? <PremiumButton title="Systemeinstellungen öffnen" variant="secondary" onPress={() => {
      void openDevicePermissionSettings().catch(() => { if (active.current) setError('Die Systemeinstellungen konnten nicht geöffnet werden.'); });
    }} /> : <Text style={styles.text}>Browserfreigaben ändern Sie über das Symbol neben der Website-Adresse.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 18, gap: 12, borderWidth: 1, borderColor: '#CBD8E6', backgroundColor: '#FFFFFF', borderRadius: 18, minWidth: 0 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: '#10283F' },
  text: { fontSize: 15, lineHeight: 23, color: '#304E69', flexShrink: 1 },
  item: { gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E4EBF2' },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: '#10283F' },
  status: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: '#355B83' },
  error: { color: '#A51E35', fontSize: 15, lineHeight: 23 },
});
