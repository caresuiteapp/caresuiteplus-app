import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { listPlatformTenants, resolvePlatformTenantDetailId } from '@/lib/platformConsole';
import type { PlatformTenantListItem } from '@/types/platformConsole';
import { spacing } from '@/theme';
import { PLATFORM_COLORS } from './PlatformColors';

type Props = {
  value: string;
  onChange: (tenantId: string) => void;
  label?: string;
  required?: boolean;
  allowAll?: boolean;
};

export function PlatformTenantPicker({ value, onChange, label = 'Mandant', required = false, allowAll = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PlatformTenantListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (needle = '') => {
    setLoading(true);
    const result = await listPlatformTenants({ search: needle || undefined, limit: 50 });
    if (result.ok) setItems(result.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  useEffect(() => {
    if (!visible) return;
    const handle = setTimeout(() => void load(search.trim()), 180);
    return () => clearTimeout(handle);
  }, [load, search, visible]);

  const selected = useMemo(
    () => items.find((item) => resolvePlatformTenantDetailId(item) === value),
    [items, value],
  );

  const choose = (tenantId: string) => {
    onChange(tenantId);
    setVisible(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <Pressable style={styles.field} onPress={() => setVisible(true)} accessibilityRole="button">
        <Text style={value ? styles.value : styles.placeholder} numberOfLines={1}>
          {value ? selected?.tenantName ?? 'Ausgewählter Mandant' : allowAll ? 'Alle Mandanten' : 'Mandant auswählen'}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      {value && !selected ? <Text style={styles.hint}>Mandant ausgewählt · ID wird verborgen verarbeitet</Text> : null}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>Mandant auswählen</Text>
            <TextInput value={search} onChangeText={setSearch} autoFocus placeholder="Nach Name oder Unternehmen suchen …" placeholderTextColor={PLATFORM_COLORS.muted} style={styles.search} />
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              {allowAll ? (
                <Pressable style={styles.item} onPress={() => choose('')}>
                  <Text style={styles.itemName}>Alle Mandanten</Text>
                </Pressable>
              ) : null}
              {items.map((item) => {
                const id = resolvePlatformTenantDetailId(item);
                return (
                  <Pressable key={item.id} disabled={!id} style={styles.item} onPress={() => id && choose(id)}>
                    <Text style={styles.itemName}>{item.tenantName}</Text>
                    <Text style={styles.itemMeta}>{item.planKey ?? 'Kein Tarif'} · {item.status}</Text>
                  </Pressable>
                );
              })}
              {!loading && items.length === 0 ? <Text style={styles.empty}>Keine passenden Mandanten gefunden.</Text> : null}
              {loading ? <Text style={styles.empty}>Mandanten werden geladen …</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  label: { color: PLATFORM_COLORS.text, fontSize: 12, fontWeight: '700' },
  field: { minHeight: 46, borderWidth: 1, borderColor: PLATFORM_COLORS.borderStrong, borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { color: PLATFORM_COLORS.text, fontSize: 14, flex: 1 },
  placeholder: { color: PLATFORM_COLORS.muted, fontSize: 14, flex: 1 },
  chevron: { color: PLATFORM_COLORS.accent, fontSize: 18 },
  hint: { color: PLATFORM_COLORS.muted, fontSize: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 620, maxHeight: 640, borderRadius: 18, backgroundColor: '#FFFFFF', padding: spacing.lg, gap: spacing.sm },
  title: { color: PLATFORM_COLORS.text, fontSize: 20, fontWeight: '800' },
  search: { minHeight: 48, borderWidth: 1, borderColor: PLATFORM_COLORS.accent, borderRadius: 10, paddingHorizontal: spacing.md, color: PLATFORM_COLORS.text },
  list: { gap: 5, paddingBottom: spacing.md },
  item: { minHeight: 52, borderRadius: 10, borderWidth: 1, borderColor: PLATFORM_COLORS.border, backgroundColor: '#FFFFFF', paddingHorizontal: spacing.md, justifyContent: 'center' },
  itemName: { color: PLATFORM_COLORS.text, fontWeight: '700' },
  itemMeta: { color: PLATFORM_COLORS.muted, fontSize: 11, marginTop: 2 },
  empty: { color: PLATFORM_COLORS.muted, textAlign: 'center', padding: spacing.lg },
});
