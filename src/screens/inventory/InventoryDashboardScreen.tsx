import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';
import { useAuth } from '@/lib/auth/context';
import {
  fetchInventoryAssignments,
  fetchInventoryDamageReports,
  fetchInventoryItems,
  INVENTORY_CATEGORY_LABELS,
} from '@/lib/inventory';

const ITEM_STATUS: Record<string, string> = {
  available: 'Verfügbar', assigned: 'Ausgegeben', in_use: 'In Benutzung', reserved: 'Reserviert',
  maintenance: 'In Wartung', damaged: 'Beschädigt', lost: 'Verloren', returned: 'Zurückgegeben',
  decommissioned: 'Ausgemustert', archived: 'Archiviert',
};

const AREAS = [
  { id: 'items', icon: '▦', title: 'Bestand', text: 'Posten anlegen, suchen und verwalten', route: '/business/office/inventory/items' },
  { id: 'assignments', icon: '→', title: 'Ausgabe', text: 'Verfügbare Ausstattung zuordnen', route: '/business/office/inventory/assignments' },
  { id: 'returns', icon: '↩', title: 'Rücknahme', text: 'Rückgaben vollständig dokumentieren', route: '/business/office/inventory/returns' },
  { id: 'damage', icon: '!', title: 'Schaden & Verlust', text: 'Vorfälle aufnehmen und nachhalten', route: '/business/office/inventory/damage' },
  { id: 'employees', icon: '◎', title: 'Personalausstattung', text: 'Ausgaben nach Mitarbeitenden', route: '/business/office/inventory/employees' },
  { id: 'categories', icon: '#', title: 'Stammdaten', text: 'Kategorien und Lagerorte', route: '/business/office/inventory/categories' },
] as const;

export function InventoryDashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const { c } = useCareLightPalette();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? null;
  const query = useAsyncQuery(async () => {
    if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
    const [items, assignments, damage] = await Promise.all([
      fetchInventoryItems(tenantId, roleKey),
      fetchInventoryAssignments(tenantId, roleKey),
      fetchInventoryDamageReports(tenantId, roleKey),
    ]);
    if (!items.ok) return items;
    if (!assignments.ok) return assignments;
    if (!damage.ok) return damage;
    return { ok: true as const, data: { items: items.data, assignments: assignments.data, damage: damage.data } };
  }, [tenantId, roleKey]);

  const styles = useMemo(() => createStyles(c), [c]);
  if (!can('inventory.view')) {
    return <ScreenShell title="Inventar & Rückgabe" subtitle="Office · Personal"><LockedActionBanner message={check('inventory.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} /></ScreenShell>;
  }
  if (query.loading && !query.data) return <ScreenShell title="Inventar & Rückgabe" subtitle="Office · Personal"><LoadingState message="Inventar wird geladen…" /></ScreenShell>;
  if (query.error && !query.data) return <ScreenShell title="Inventar & Rückgabe" subtitle="Office · Personal"><ErrorState message={query.error} onRetry={query.refresh} /></ScreenShell>;

  const items = query.data?.items ?? [];
  const assignments = query.data?.assignments ?? [];
  const openAssignments = assignments.filter((entry) => !['returned', 'archived', 'lost'].includes(entry.status));
  const overdue = openAssignments.filter((entry) => entry.status === 'overdue' || (entry.expectedReturnAt && new Date(entry.expectedReturnAt) < new Date()));
  const openDamage = (query.data?.damage ?? []).filter((entry) => !entry.resolvedAt);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const kpis = [
    { label: 'Bestand', value: items.length, tone: c.cyan },
    { label: 'Verfügbar', value: items.filter((item) => item.status === 'available').length, tone: c.green },
    { label: 'Ausgegeben', value: openAssignments.length, tone: c.violet },
    { label: 'Überfällig', value: overdue.length, tone: c.warning },
    { label: 'Offene Schäden', value: openDamage.length, tone: c.danger },
  ];

  return (
    <ScreenShell title="Inventar & Rückgabe" subtitle="Bestand, Ausgabe, Rücknahme und Schäden" showBack={false}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarCopy}>
          <Text style={styles.eyebrow}>INVENTARZENTRALE</Text>
          <Text style={styles.lead}>Alle Arbeitsmittel im Blick – von der Erfassung bis zur dokumentierten Rückgabe.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={query.refresh} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>↻ Aktualisieren</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/business/office/inventory/items' as never)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>+ Inventarposten</Text></Pressable>
      </View>

      <View style={styles.kpiGrid}>
        {kpis.map((kpi) => <View key={kpi.label} style={[styles.kpi, { borderTopColor: kpi.tone }]}><Text style={styles.kpiLabel}>{kpi.label}</Text><Text style={styles.kpiValue}>{kpi.value}</Text></View>)}
      </View>

      <View style={[styles.columns, compact && styles.columnsCompact]}>
        <View style={styles.mainColumn}>
          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Offene Vorgänge</Text><Text style={styles.sectionMeta}>{openAssignments.length + openDamage.length} Vorgänge benötigen Bearbeitung</Text></View><Pressable onPress={() => router.push('/business/office/inventory/returns' as never)}><Text style={styles.link}>Alle Vorgänge →</Text></Pressable></View>
          <View style={styles.panel}>
            {overdue.slice(0, 4).map((entry) => {
              const item = itemMap.get(entry.itemId);
              return <Pressable key={entry.id} onPress={() => router.push('/business/office/inventory/returns' as never)} style={styles.workRow}>
                <View style={[styles.marker, { backgroundColor: c.warning }]} />
                <View style={styles.workCopy}><Text style={styles.workTitle}>{item?.name ?? 'Inventarposten'}</Text><Text style={styles.workMeta}>Rückgabe überfällig · {entry.recipientEmployeeId}</Text></View>
                <Text style={styles.statusWarning}>Überfällig</Text><Text style={styles.chevron}>›</Text>
              </Pressable>;
            })}
            {openDamage.slice(0, Math.max(0, 4 - overdue.length)).map((entry) => {
              const item = itemMap.get(entry.itemId);
              return <Pressable key={entry.id} onPress={() => router.push('/business/office/inventory/damage' as never)} style={styles.workRow}>
                <View style={[styles.marker, { backgroundColor: c.danger }]} />
                <View style={styles.workCopy}><Text style={styles.workTitle}>{item?.name ?? 'Inventarposten'}</Text><Text style={styles.workMeta}>{entry.reportType === 'loss' ? 'Verlust' : 'Schaden'} · {entry.description}</Text></View>
                <Text style={styles.statusDanger}>Offen</Text><Text style={styles.chevron}>›</Text>
              </Pressable>;
            })}
            {overdue.length === 0 && openDamage.length === 0 ? <View style={styles.empty}><Text style={styles.emptyIcon}>✓</Text><View><Text style={styles.workTitle}>Keine offenen Vorgänge</Text><Text style={styles.workMeta}>Rückgaben und Schäden sind vollständig bearbeitet.</Text></View></View> : null}
          </View>

          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Bestandsübersicht</Text><Text style={styles.sectionMeta}>Zuletzt gepflegte Inventarposten</Text></View><Pressable onPress={() => router.push('/business/office/inventory/items' as never)}><Text style={styles.link}>Bestand öffnen →</Text></Pressable></View>
          <View style={styles.panel}>
            {items.slice(0, 5).map((item) => <Pressable key={item.id} onPress={() => router.push('/business/office/inventory/items' as never)} style={styles.stockRow}>
              <View style={styles.assetIcon}><Text style={styles.assetIconText}>▦</Text></View>
              <View style={styles.workCopy}><Text style={styles.workTitle}>{item.name}</Text><Text style={styles.workMeta}>{INVENTORY_CATEGORY_LABELS[item.categoryGroup]} · {item.serialNumber || item.barcode || 'Ohne Kennnummer'}</Text></View>
              <Text style={styles.stockStatus}>{ITEM_STATUS[item.status] ?? item.status}</Text><Text style={styles.chevron}>›</Text>
            </Pressable>)}
            {items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyIcon}>▦</Text><View style={styles.workCopy}><Text style={styles.workTitle}>Noch kein Inventar erfasst</Text><Text style={styles.workMeta}>Legen Sie den ersten Posten an. Danach sind Ausgabe und Rücknahme direkt nutzbar.</Text></View><Pressable onPress={() => router.push('/business/office/inventory/items' as never)}><Text style={styles.link}>Jetzt anlegen</Text></Pressable></View> : null}
          </View>
        </View>

        <View style={styles.sideColumn}>
          <Text style={styles.sectionTitle}>Arbeitsbereiche</Text>
          <View style={styles.areaGrid}>{AREAS.map((area) => <Pressable key={area.id} accessibilityRole="button" onPress={() => router.push(area.route as never)} style={({ pressed }) => [styles.areaCard, pressed && styles.pressed]}>
            <View style={styles.areaIcon}><Text style={styles.areaIconText}>{area.icon}</Text></View><View style={styles.workCopy}><Text style={styles.areaTitle}>{area.title}</Text><Text style={styles.areaText}>{area.text}</Text></View><Text style={styles.chevron}>›</Text>
          </Pressable>)}</View>
        </View>
      </View>
    </ScreenShell>
  );
}

function createStyles(c: ReturnType<typeof useCareLightPalette>['c']) {
  return StyleSheet.create({
    toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, alignItems: 'center', padding: careSpacing.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 22 },
    toolbarCopy: { flex: 1, minWidth: 280 }, eyebrow: { color: '#0878E8', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }, lead: { color: c.text, fontSize: 16, lineHeight: 23, fontWeight: '600', marginTop: 4 },
    primaryButton: { minHeight: 46, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#0878E8', alignItems: 'center', justifyContent: 'center' }, primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    secondaryButton: { minHeight: 46, paddingHorizontal: 18, borderRadius: 14, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: c.text, fontSize: 15, fontWeight: '700' },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }, kpi: { flexGrow: 1, flexBasis: 150, minHeight: 112, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderTopWidth: 4, borderRadius: 18, padding: 18 }, kpiLabel: { color: c.muted, fontSize: 13, fontWeight: '700' }, kpiValue: { color: c.text, fontSize: 30, fontWeight: '900', marginTop: 12 },
    columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 18, marginTop: 22 }, columnsCompact: { flexDirection: 'column' }, mainColumn: { flex: 1.6, minWidth: 0, width: '100%' }, sideColumn: { flex: 1, minWidth: 300, width: '100%' }, sectionHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 4, marginBottom: 10 }, sectionTitle: { color: c.text, fontSize: 20, fontWeight: '800' }, sectionMeta: { color: c.muted, fontSize: 13, marginTop: 3 }, link: { color: '#0878E8', fontSize: 14, fontWeight: '800' },
    panel: { overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, marginBottom: 18 }, workRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, stockRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, marker: { width: 5, height: 38, borderRadius: 4 }, workCopy: { flex: 1, minWidth: 0 }, workTitle: { color: c.text, fontSize: 15, fontWeight: '800' }, workMeta: { color: c.muted, fontSize: 13, marginTop: 4 }, statusWarning: { color: '#A35B00', backgroundColor: '#FFF1D2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 12, fontWeight: '800' }, statusDanger: { color: '#B42332', backgroundColor: '#FFE5E8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 12, fontWeight: '800' }, stockStatus: { color: c.text, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 12, fontWeight: '700' }, chevron: { color: c.muted, fontSize: 25, fontWeight: '400' }, assetIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E4F1FF', alignItems: 'center', justifyContent: 'center' }, assetIconText: { color: '#0878E8', fontSize: 18, fontWeight: '900' },
    empty: { minHeight: 100, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, emptyIcon: { width: 42, height: 42, borderRadius: 21, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#E5F7ED', color: '#108B4D', fontSize: 20, fontWeight: '900' },
    areaGrid: { gap: 10, marginTop: 10 }, areaCard: { flexDirection: 'row', alignItems: 'center', minHeight: 76, gap: 12, padding: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 17 }, pressed: { opacity: 0.72, transform: [{ scale: 0.995 }] }, areaIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E4F1FF', alignItems: 'center', justifyContent: 'center' }, areaIconText: { color: '#0878E8', fontSize: 18, fontWeight: '900' }, areaTitle: { color: c.text, fontSize: 15, fontWeight: '800' }, areaText: { color: c.muted, fontSize: 12, marginTop: 3 },
  });
}
