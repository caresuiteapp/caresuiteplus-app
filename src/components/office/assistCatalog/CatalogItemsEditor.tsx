import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EmptyState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import type { CatalogItem } from '@/types/assistCatalog';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  createCatalogItem,
  deactivateCatalogItem,
  loadCatalogItems,
  loadCatalogs,
} from '@/lib/assistCatalog';
import { colors, spacing, typography } from '@/theme';

type CatalogItemsEditorProps = {
  catalogKey: string;
  title: string;
  canEdit?: boolean;
  showParentOnly?: boolean;
};

export function CatalogItemsEditor({
  catalogKey,
  title,
  canEdit = false,
  showParentOnly = false,
}: CatalogItemsEditorProps) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const res = await loadCatalogItems(
      tenantId,
      catalogKey,
      { search: search || undefined, includeInactive: canEdit },
      profile?.roleKey,
    );
    if (res.ok) {
      let rows = res.data;
      if (showParentOnly) rows = rows.filter((i) => !i.parentItemId);
      setItems(rows);
      setError(null);
    } else setError(res.error);
    setLoading(false);
  }, [tenantId, catalogKey, search, canEdit, showParentOnly, profile?.roleKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = async () => {
    if (!tenantId || !newLabel.trim()) return;
    const defs = await loadCatalogs(tenantId, { catalogKey }, profile?.roleKey);
    if (!defs.ok || !defs.data[0]) {
      setError('Katalog nicht gefunden.');
      return;
    }
    const key = newLabel.trim().toLowerCase().replace(/\s+/g, '_');
    const res = await createCatalogItem(
      tenantId,
      {
        catalogId: defs.data[0].id,
        itemKey: key,
        label: newLabel.trim(),
        sortOrder: items.length,
      },
      profile?.roleKey,
    );
    if (res.ok) {
      setNewLabel('');
      void reload();
    } else setError(res.error);
  };

  const handleDeactivate = async (itemId: string) => {
    if (!tenantId) return;
    const res = await deactivateCatalogItem(tenantId, itemId, profile?.roleKey);
    if (res.ok) void reload();
    else setError(res.error);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => `${i.label} ${i.itemKey}`.toLowerCase().includes(q));
  }, [items, search]);

  if (loading) return <LoadingState message={`${title} wird geladen…`} />;

  return (
    <SectionPanel title={title}>
      <PremiumInput
        label="Suchen"
        value={search}
        onChangeText={setSearch}
        placeholder="Eintrag suchen…"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {canEdit ? (
        <View style={styles.createRow}>
          <View style={styles.createInput}>
            <PremiumInput
              label="Neuer Eintrag"
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="Bezeichnung"
            />
          </View>
          <PremiumButton title="Anlegen" onPress={() => void handleCreate()} disabled={!newLabel.trim()} />
        </View>
      ) : null}
      <ScrollView style={styles.list} nestedScrollEnabled>
        {filtered.length === 0 ? (
          <EmptyState title="Keine Einträge" message="Noch keine Katalogeinträge vorhanden." />
        ) : (
          filtered.map((item) => (
            <PremiumCard key={item.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardBody}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.meta}>
                    {item.isSystemDefault ? 'System' : 'Mandant'}
                    {item.defaultDurationMinutes ? ` · ${item.defaultDurationMinutes} Min.` : ''}
                    {!item.isActive ? ' · inaktiv' : ''}
                  </Text>
                  {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
                </View>
                {canEdit && item.isActive ? (
                  <PremiumButton
                    title="Deaktivieren"
                    variant="secondary"
                    onPress={() => void handleDeactivate(item.id)}
                  />
                ) : null}
              </View>
            </PremiumCard>
          ))
        )}
      </ScrollView>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  createRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end', marginBottom: spacing.md },
  createInput: { flex: 1 },
  list: { maxHeight: 480 },
  card: { marginBottom: spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardBody: { flex: 1 },
  label: { ...typography.body, fontWeight: '600' },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  desc: { ...typography.caption, marginTop: spacing.xs },
});
