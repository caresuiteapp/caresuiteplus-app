import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listPlatformTenants, resolvePlatformTenantDetailId } from '@/lib/platformConsole';
import { PLATFORM_NAV_ITEMS } from '@/lib/platformConsole/platformNavigation';
import type { PlatformTenantListItem } from '@/types/platformConsole';
import { spacing } from '@/theme';
import { PLATFORM_COLORS } from './PlatformColors';
import { statusLabel } from './PlatformOperatorUi';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

export function PlatformGlobalSearch() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<PlatformTenantListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const open = useCallback(() => {
    setVisible(true);
    setQuery('');
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [open]);

  useEffect(() => {
    if (!visible) return;
    const handle = setTimeout(() => {
      setLoading(true);
      void listPlatformTenants({ search: query.trim() || undefined, limit: 12 }).then((result) => {
        if (result.ok) setTenants(result.data.items);
        setLoading(false);
      });
    }, 180);
    return () => clearTimeout(handle);
  }, [query, visible]);

  const navResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PLATFORM_NAV_ITEMS.slice(0, 6);
    return PLATFORM_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(needle));
  }, [query]);

  const navigate = (path: string) => {
    setVisible(false);
    router.push(path as never);
  };

  return (
    <>
      <Pressable style={styles.trigger} onPress={open} accessibilityLabel="Platform durchsuchen">
        <Text style={styles.searchIcon}>⌕</Text>
        <Text style={styles.triggerText}>Platform durchsuchen</Text>
        <Text style={styles.shortcut}>Strg K</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Mandant oder Platform-Bereich suchen …"
              placeholderTextColor={PLATFORM_COLORS.muted}
              style={styles.input}
            />
            <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
              <Text style={styles.groupTitle}>Bereiche</Text>
              {navResults.map((item) => (
                <Pressable key={item.path} style={styles.result} onPress={() => navigate(item.path)}>
                  <Text style={styles.resultIcon}>{item.icon}</Text>
                  <Text style={styles.resultText}>{item.label}</Text>
                </Pressable>
              ))}
              <Text style={styles.groupTitle}>Mandanten {loading ? '· wird geladen' : ''}</Text>
              {tenants.map((tenant) => {
                const id = resolvePlatformTenantDetailId(tenant);
                return (
                  <Pressable
                    key={tenant.id}
                    disabled={!id}
                    style={styles.result}
                    onPress={() => id && navigate(`/platform/tenants/${id}`)}
                  >
                    <View style={styles.tenantMark}><Text style={styles.tenantMarkText}>M</Text></View>
                    <View style={styles.resultCopy}>
                      <Text style={styles.resultText}>{tenant.tenantName}</Text>
                      <Text style={styles.resultMeta}>{tenant.planKey ?? 'Kein Tarif'} · {statusLabel(tenant.status)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 260,
    maxWidth: 420,
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.borderStrong,
    borderRadius: 12,
    backgroundColor: systemLiquidGlass.input,
    paddingHorizontal: 12,
  },
  searchIcon: { color: PLATFORM_COLORS.accent, fontSize: 20 },
  triggerText: { color: PLATFORM_COLORS.muted, fontSize: 13, flex: 1 },
  shortcut: { color: PLATFORM_COLORS.muted, fontSize: 11, backgroundColor: systemLiquidGlass.chip, padding: 4, borderRadius: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(3,10,24,0.72)', alignItems: 'center', paddingTop: 90, paddingHorizontal: spacing.lg },
  dialog: { width: '100%', maxWidth: 680, maxHeight: 620, borderRadius: 22, backgroundColor: systemLiquidGlass.panelStrong, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: systemLiquidGlass.borderStrong },
  input: { minHeight: 52, borderWidth: 1, borderColor: PLATFORM_COLORS.accent, borderRadius: 12, paddingHorizontal: spacing.md, color: PLATFORM_COLORS.text, fontSize: 16 },
  results: { gap: 4, paddingBottom: spacing.md },
  groupTitle: { color: PLATFORM_COLORS.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.sm, marginBottom: 4 },
  result: { minHeight: 48, borderRadius: 10, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultIcon: { width: 26, color: PLATFORM_COLORS.accent, textAlign: 'center' },
  resultText: { color: PLATFORM_COLORS.text, fontWeight: '600', fontSize: 14 },
  resultMeta: { color: PLATFORM_COLORS.muted, fontSize: 11, marginTop: 2 },
  resultCopy: { flex: 1 },
  tenantMark: { width: 30, height: 30, borderRadius: 9, backgroundColor: systemLiquidGlass.chipActive, alignItems: 'center', justifyContent: 'center' },
  tenantMarkText: { color: PLATFORM_COLORS.accent, fontWeight: '800' },
});
