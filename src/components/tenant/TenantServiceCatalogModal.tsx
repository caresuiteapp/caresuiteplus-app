import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { FilterChipGroup } from '@/components/ui/FilterChip';
import { TenantCenterGlassModal } from '@/components/tenant/TenantCenterGlassModal';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import type {
  ServiceCatalogCategory,
  ServiceTaxMode,
  TenantModuleKey,
  TenantServiceCatalogItem,
} from '@/types/tenant/tenantCenter';
import {
  fetchTenantServiceCatalog,
  saveTenantServiceCatalogItem,
  seedTenantServiceCatalogIfEmpty,
} from '@/lib/tenant/tenantServiceCatalogService';
import {
  formatServicePriceUnit,
  formatServicePriceUnitShort,
  SERVICE_TAX_MODE_OPTIONS,
  TENANT_MODULE_LABELS,
} from '@/lib/tenant/serviceCatalogLabels';
import { usePermissions } from '@/hooks/usePermissions';

type TabKey = 'services' | 'travel' | 'surcharges' | 'versions';

const MODULES: Array<{ key: TenantModuleKey; label: string }> = (
  Object.entries(TENANT_MODULE_LABELS) as Array<[TenantModuleKey, string]>
).map(([key, label]) => ({ key, label }));

const TAB_LABELS: Record<TabKey, string> = {
  services: 'Leistungen',
  travel: 'Fahrkosten',
  surcharges: 'Zuschläge',
  versions: 'Preisversionen',
};

const TAB_CATEGORY: Record<TabKey, ServiceCatalogCategory | 'all'> = {
  services: 'service',
  travel: 'travel',
  surcharges: 'surcharge',
  versions: 'all',
};

type Props = {
  visible: boolean;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
};

function formatPriceLine(item: TenantServiceCatalogItem): string {
  if (item.defaultPriceNet == null) return 'Kein Preis hinterlegt';
  const amount = String(item.defaultPriceNet).replace('.', ',');
  return `${amount} € / ${formatServicePriceUnitShort(item.unit)}`;
}

export function TenantServiceCatalogModal({ visible, tenantId, onClose, onSaved }: Props) {
  const text = useAuroraAdaptiveText();
  const { roleKey } = usePermissions();
  const [moduleKey, setModuleKey] = useState<TenantModuleKey>('assist');
  const [tab, setTab] = useState<TabKey>('services');
  const [items, setItems] = useState<TenantServiceCatalogItem[]>([]);
  const [selected, setSelected] = useState<TenantServiceCatalogItem | null>(null);
  const [priceNet, setPriceNet] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    await seedTenantServiceCatalogIfEmpty(tenantId);
    const result = await fetchTenantServiceCatalog(tenantId, roleKey);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems(result.data.items);
  };

  useEffect(() => {
    if (visible) void load();
  }, [visible, tenantId]);

  const filtered = useMemo(() => {
    const category = TAB_CATEGORY[tab];
    return items
      .filter((item) => {
        if (item.moduleKey !== moduleKey) return false;
        if (category === 'all') return true;
        return item.category === category;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [items, moduleKey, tab]);

  useEffect(() => {
    if (!filtered.length) {
      setSelected(null);
      return;
    }
    if (!selected || !filtered.some((item) => item.id === selected.id)) {
      setSelected(filtered[0] ?? null);
    }
  }, [filtered, selected?.id]);

  useEffect(() => {
    if (selected?.defaultPriceNet != null) {
      setPriceNet(String(selected.defaultPriceNet).replace('.', ','));
    } else {
      setPriceNet('');
    }
  }, [selected?.id]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const parsed = Number.parseFloat(priceNet.replace(',', '.'));
    const result = await saveTenantServiceCatalogItem(
      tenantId,
      {
        id: selected.id,
        moduleKey: selected.moduleKey,
        serviceKey: selected.serviceKey,
        name: selected.name,
        description: selected.description,
        unit: selected.unit,
        category: selected.category,
        isActive: selected.isActive,
        sortOrder: selected.sortOrder,
        priceNet: Number.isFinite(parsed) ? parsed : undefined,
        taxMode: selected.defaultTaxMode ?? 'exempt_4_16',
      },
      roleKey,
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems(result.data.items);
    const updated = result.data.items.find((item) => item.id === selected.id);
    if (updated) setSelected(updated);
    onSaved();
  };

  const selectedTaxMode = (selected?.defaultTaxMode ?? 'exempt_4_16') as ServiceTaxMode;

  return (
    <TenantCenterGlassModal
      visible={visible}
      title="Preis- und Leistungskatalog"
      subtitle="Leistungen, Fahrkosten, Zuschläge und Preisversionen je Modul pflegen"
      onClose={onClose}
      large
      primaryLabel="Preis speichern"
      onPrimary={handleSave}
      primaryLoading={saving}
      primaryDisabled={!selected || tab === 'versions'}
    >
      <View style={styles.layout}>
        <View style={styles.sidebar}>
          <Text style={[styles.sectionLabel, { color: text.muted }]}>Module</Text>
          {MODULES.map((module) => (
            <Pressable key={module.key} onPress={() => setModuleKey(module.key)} style={styles.filterBtn}>
              <Text
                style={{
                  color: moduleKey === module.key ? text.primary : text.secondary,
                  fontWeight: moduleKey === module.key ? '700' : '500',
                }}
              >
                {module.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.main}>
          <View style={styles.tabs}>
            {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => (
              <PremiumButton
                key={key}
                title={TAB_LABELS[key]}
                variant={tab === key ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => setTab(key)}
              />
            ))}
          </View>
          {loading ? <Text style={{ color: text.muted }}>Katalog wird geladen…</Text> : null}
          {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
          {tab === 'versions' ? (
            <Text style={{ color: text.secondary }}>
              Preisversionen werden bei Katalog-Updates automatisch protokolliert. Detailansicht folgt in Phase 2.
            </Text>
          ) : filtered.length === 0 ? (
            <Text style={{ color: text.muted }}>
              Keine Einträge für {TENANT_MODULE_LABELS[moduleKey]} in „{TAB_LABELS[tab]}“.
            </Text>
          ) : (
            filtered.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelected(item)}
                style={[styles.itemRow, selected?.id === item.id ? styles.itemSelected : null]}
              >
                <Text style={{ color: text.primary, fontWeight: '600' }}>{item.name}</Text>
                {item.description ? (
                  <Text style={{ color: text.secondary, fontSize: 12 }} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={{ color: text.muted, fontSize: 12 }}>{formatPriceLine(item)}</Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.detail}>
          {selected ? (
            <>
              <Text style={{ color: text.primary, fontWeight: '700', fontSize: 16 }}>{selected.name}</Text>
              <Text style={{ color: text.muted, fontSize: 11 }}>
                Interne Kennung: {selected.serviceKey}
              </Text>
              <PremiumInput
                label="Bezeichnung"
                value={selected.name}
                onChangeText={(v) => setSelected({ ...selected, name: v })}
              />
              <PremiumInput
                label="Beschreibung"
                value={selected.description}
                onChangeText={(v) => setSelected({ ...selected, description: v })}
                multiline
              />
              <PremiumInput
                label="Preis netto (€)"
                value={priceNet}
                onChangeText={setPriceNet}
                keyboardType="decimal-pad"
                placeholder="z. B. 38,00"
              />
              <PremiumInput
                label="Abrechnungseinheit"
                value={formatServicePriceUnit(selected.unit)}
                editable={false}
              />
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: text.secondary }]}>Steuerregel</Text>
                <FilterChipGroup
                  options={SERVICE_TAX_MODE_OPTIONS}
                  value={selectedTaxMode}
                  onChange={(mode) => setSelected({ ...selected, defaultTaxMode: mode })}
                  wrap
                />
              </View>
            </>
          ) : (
            <Text style={{ color: text.muted }}>Leistung aus der Liste auswählen</Text>
          )}
        </View>
      </View>
    </TenantCenterGlassModal>
  );
}

const styles = StyleSheet.create({
  layout: { flexDirection: 'row', gap: careSpacing.md, minHeight: 420 },
  sidebar: { width: 120, gap: careSpacing.xs },
  main: { flex: 1.2, gap: careSpacing.sm },
  detail: { flex: 1, gap: careSpacing.sm },
  sectionLabel: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  filterBtn: { paddingVertical: 6 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  itemRow: {
    padding: careSpacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  itemSelected: {
    borderColor: 'rgba(255,149,0,0.45)',
    backgroundColor: 'rgba(255,149,0,0.08)',
  },
  fieldBlock: { gap: careSpacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
});
