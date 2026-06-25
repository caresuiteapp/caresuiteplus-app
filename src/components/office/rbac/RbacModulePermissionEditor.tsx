import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { PremiumBadge, PremiumInput } from '@/components/ui';
import type { PermissionKey } from '@/types';
import type { PermissionCatalogEntry, PermissionMatrixAction } from '@/types/permissions/rbac';
import {
  buildPermissionMatrix,
  filterPermissionsForTab,
  RBAC_TAB_MODULE_PREFIXES,
} from '@/lib/permissions/permissionMatrixBuilder';
import {
  findPermissionKeyForAreaAction,
  hasCriticalPermissionChanges,
} from '@/lib/permissions/permissionChangeHelpers';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { spacing } from '@/theme';

const MATRIX_ACTIONS: PermissionMatrixAction[] = [
  'read',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
];

const ACTION_LABELS: Record<PermissionMatrixAction, string> = {
  read: 'Lesen',
  create: 'Erst.',
  edit: 'Bearb.',
  delete: 'Lösch.',
  approve: 'Freig.',
  export: 'Export',
};

const RISK_LABELS: Record<string, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
};

type RbacModulePermissionEditorProps = {
  tabKey: string;
  catalog: PermissionCatalogEntry[];
  desiredPermissions: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  canEdit: boolean;
  search: string;
  riskFilter: string | null;
};

export function RbacModulePermissionEditor({
  tabKey,
  catalog,
  desiredPermissions,
  onChange,
  canEdit,
  search,
  riskFilter,
}: RbacModulePermissionEditorProps) {
  const content = useAdaptiveContentStyles();
  const modulePrefixes = RBAC_TAB_MODULE_PREFIXES[tabKey] ?? [];
  const tabCatalog = catalog.filter((entry) => {
    if (modulePrefixes.length && !modulePrefixes.some((prefix) => entry.key.startsWith(`${prefix}.`))) {
      return false;
    }
    if (search && !entry.label.toLowerCase().includes(search.toLowerCase()) && !entry.module.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (riskFilter && entry.riskLevel !== riskFilter) return false;
    return true;
  });

  const availableKeys = tabCatalog.map((entry) => entry.key);
  const matrix = buildPermissionMatrix(
    filterPermissionsForTab(desiredPermissions, modulePrefixes),
    tabCatalog,
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        matrixHeader: {
          flexDirection: 'row',
          gap: spacing.xs,
          marginBottom: spacing.xs,
        },
        matrixCol: { ...content.caption, width: 52, textAlign: 'center' },
        matrixRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.xs,
        },
        matrixArea: { ...content.body, flex: 1, color: content.primary.color },
        matrixCell: {
          width: 52,
          height: 32,
          borderRadius: 6,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: content.muted.color,
        },
        matrixCellActive: {
          backgroundColor: content.secondary.color,
        },
        matrixCellText: { ...content.caption },
        riskRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
      }),
    [content],
  );

  function toggleAreaAction(area: string, action: PermissionMatrixAction) {
    if (!canEdit) return;
    const permissionKey = findPermissionKeyForAreaAction(area, action, tabCatalog, availableKeys);
    if (!permissionKey) return;

    const set = new Set(desiredPermissions);
    if (set.has(permissionKey)) {
      set.delete(permissionKey);
    } else {
      set.add(permissionKey);
    }
    onChange([...set].sort());
  }

  function isActionActive(area: string, action: PermissionMatrixAction): boolean {
    const permissionKey = findPermissionKeyForAreaAction(area, action, tabCatalog, availableKeys);
    return permissionKey ? desiredPermissions.includes(permissionKey) : false;
  }

  const filteredMatrix = matrix.filter((row) =>
    tabCatalog.some((entry) => entry.key.startsWith(`${row.area}.`) || entry.key === row.area),
  );

  if (filteredMatrix.length === 0) {
    return (
      <Text style={content.caption}>Keine bearbeitbaren Rechte in diesem Bereich.</Text>
    );
  }

  return (
    <View>
      <View style={styles.matrixHeader}>
        <Text style={[styles.matrixArea, content.caption]}>Bereich</Text>
        {MATRIX_ACTIONS.map((action) => (
          <Text key={action} style={styles.matrixCol}>
            {ACTION_LABELS[action]}
          </Text>
        ))}
      </View>
      {filteredMatrix.map((row) => {
        const areaRisk = tabCatalog.find((entry) => entry.key.startsWith(`${row.area}.`))?.riskLevel ?? 'low';
        return (
          <View key={row.area}>
            <View style={styles.matrixRow}>
              <Text style={styles.matrixArea}>{row.areaLabel}</Text>
              {MATRIX_ACTIONS.map((action) => {
                const active = isActionActive(row.area, action);
                const permissionKey = findPermissionKeyForAreaAction(
                  row.area,
                  action,
                  tabCatalog,
                  availableKeys,
                );
                const disabled = !canEdit || !permissionKey;
                return (
                  <Pressable
                    key={action}
                    disabled={disabled}
                    style={[styles.matrixCell, active ? styles.matrixCellActive : null]}
                    onPress={() => toggleAreaAction(row.area, action)}
                  >
                    <Text style={styles.matrixCellText}>{active ? '✓' : '—'}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.riskRow}>
              <PremiumBadge
                label={RISK_LABELS[areaRisk] ?? areaRisk}
                variant={areaRisk === 'critical' || areaRisk === 'high' ? 'orange' : 'muted'}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function RbacCriticalReasonField({
  catalog,
  before,
  after,
  value,
  onChange,
}: {
  catalog: PermissionCatalogEntry[];
  before: PermissionKey[];
  after: PermissionKey[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (!hasCriticalPermissionChanges(catalog, before, after)) return null;

  return (
    <PremiumInput
      label="Begründung (Pflicht bei kritischen Änderungen)"
      value={value}
      onChangeText={onChange}
      placeholder="Warum werden hochriskante Rechte geändert?"
      multiline
    />
  );
}
