import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightScreen } from '@/components/layout';
import { EmptyState, InfoBanner, LoadingState } from '@/components/ui';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';
import {
  fetchInventoryItems,
  fetchInventoryAssignments,
  fetchInventoryCategories,
  fetchInventoryLocations,
  fetchInventoryDamageReports,
  fetchInventoryReturnRecords,
  fetchInventoryReturnProtocols,
  fetchInventoryAuditEvents,
  INVENTORY_PREPARED_MESSAGE,
  INVENTORY_MDM_PREPARED_MESSAGE,
  isInventoryLiveReady,
} from '@/lib/inventory';
import type { InventoryListScreenProps } from './inventoryListConfig';

export function InventoryListScreen({ variant }: InventoryListScreenProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(async (): Promise<{ ok: true; data: Record<string, unknown>[] } | { ok: false; error: string }> => {
    if (!tenantId) return { ok: false, error: 'Kein Mandant.' };
    switch (variant) {
      case 'items': {
        const r = await fetchInventoryItems(tenantId, roleKey);
        return r.ok ? { ok: true, data: r.data as Record<string, unknown>[] } : r;
      }
      case 'assignments': {
        const r = await fetchInventoryAssignments(tenantId, roleKey);
        return r.ok ? { ok: true, data: r.data as Record<string, unknown>[] } : r;
      }
      case 'categories': {
        const r = await fetchInventoryCategories(tenantId, roleKey);
        return r.ok ? { ok: true, data: r.data as Record<string, unknown>[] } : r;
      }
      case 'locations': {
        const r = await fetchInventoryLocations(tenantId, roleKey);
        return r.ok ? { ok: true, data: r.data as Record<string, unknown>[] } : r;
      }
      case 'damage': {
        const r = await fetchInventoryDamageReports(tenantId, roleKey);
        return r.ok ? { ok: true, data: r.data as Record<string, unknown>[] } : r;
      }
      case 'returns': {
        const r = await fetchInventoryReturnRecords(tenantId, roleKey);
        return r.ok ? { ok: true, data: r.data as Record<string, unknown>[] } : r;
      }
      case 'protocols': {
        const r = await fetchInventoryReturnProtocols(tenantId, roleKey);
        return r.ok ? { ok: true, data: r.data as Record<string, unknown>[] } : r;
      }
      case 'audit': {
        const r = await fetchInventoryAuditEvents(tenantId, roleKey);
        return r.ok ? { ok: true, data: r.data as Record<string, unknown>[] } : r;
      }
      default:
        return { ok: true, data: [] };
    }
  }, [tenantId, roleKey, variant]);

  const titles: Record<InventoryListScreenProps['variant'], string> = {
    items: 'Inventarposten',
    assignments: 'Ausgaben',
    categories: 'Kategorien',
    locations: 'Lagerorte',
    damage: 'Schaden & Verlust',
    returns: 'Rückgaben',
    protocols: 'Rückgabeprotokolle',
    audit: 'Audit-Protokoll',
    employees: 'Mitarbeiter-Ausstattung',
    mdm: 'Geräteverwaltung (MDM)',
    offboarding: 'Offboarding-Check',
    barcode: 'Barcode / QR',
    settings: 'Einstellungen',
  };

  return (
    <CareLightScreen>
      {!isInventoryLiveReady() ? <InfoBanner title="Inventar" message={INVENTORY_PREPARED_MESSAGE} /> : null}
      {variant === 'mdm' ? <InfoBanner title="MDM" message={INVENTORY_MDM_PREPARED_MESSAGE} /> : null}
      <Text style={styles.title}>{titles[variant]}</Text>
      {query.loading ? <LoadingState message="Wird geladen…" /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState title="Keine Einträge" message="Noch keine Daten in dieser Ansicht." />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <View style={styles.list}>
          {query.data.slice(0, 20).map((row) => {
            const key = 'id' in row ? String(row.id) : JSON.stringify(row).slice(0, 40);
            const label =
              'name' in row && row.name
                ? String(row.name)
                : 'action' in row
                  ? String(row.action)
                  : 'status' in row
                    ? String(row.status)
                    : key;
            return (
              <View key={key} style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
      <Text style={styles.back} onPress={() => router.back()}>
        ← Zurück zum Dashboard
      </Text>
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...careTypography.h2,
    color: careLightColors.text,
    marginBottom: careSpacing.md,
  },
  list: { gap: careSpacing.xs },
  row: {
    padding: careSpacing.sm,
    backgroundColor: careLightColors.surface,
    borderRadius: 8,
  },
  rowLabel: {
    ...careTypography.body,
    color: careLightColors.text,
  },
  back: {
    ...careTypography.caption,
    color: careLightColors.orange,
    marginTop: careSpacing.lg,
  },
});
