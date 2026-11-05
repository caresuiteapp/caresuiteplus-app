import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import { PremiumBadge, PremiumInput } from '@/components/ui';
import type { PermissionKey } from '@/types';
import type { PermissionCatalogEntry, PermissionMatrixAction } from '@/types/permissions/rbac';
import {
  buildPermissionMatrix,
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
  scopeKey: string;
  tabKey: string;
  catalog: PermissionCatalogEntry[];
  desiredPermissions: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  canEdit: boolean;
  search: string;
  riskFilter: string | null;
};

export function RbacModulePermissionEditor({
  scopeKey,
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
  // Available rows come from the catalogue, including rights not yet granted.
  // Selection is always derived independently from desiredPermissions below.
  const areas = buildPermissionMatrix(availableKeys, tabCatalog)
    .map(({ area, areaLabel }) => ({ area, areaLabel }));
  const current = useRef({ scopeKey, tabKey, tabCatalog, desiredPermissions, onChange, canEdit, epoch: 0, alive: false });
  const previous = current.current;
  const changed = previous.scopeKey !== scopeKey || previous.tabKey !== tabKey || previous.canEdit !== canEdit;
  current.current = { scopeKey, tabKey, tabCatalog, desiredPermissions, onChange, canEdit,
    epoch: previous.epoch + (changed ? 1 : 0), alive: previous.alive };
  const epoch = current.current.epoch;
  useEffect(() => {
    current.current.alive = true;
    return () => { current.current.alive = false; };
  }, []);

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
        permissionList: { gap: spacing.xs, minWidth: 0 },
        permissionOption: {
          flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
          paddingVertical: spacing.sm, minHeight: 48, minWidth: 0,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: content.muted.color,
        },
        permissionCheck: {
          width: 24, minWidth: 24, height: 24, borderRadius: 6, borderWidth: 1,
          borderColor: content.muted.color, alignItems: 'center', justifyContent: 'center',
        },
        permissionCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
        permissionLabel: { ...content.body, color: content.primary.color, flexShrink: 1 },
      }),
    [content],
  );

  function togglePermission(permissionKey: PermissionKey) {
    const live = current.current;
    if (!live.alive || live.epoch !== epoch || live.scopeKey !== scopeKey || !live.canEdit || live.tabKey !== tabKey ||
        !live.tabCatalog.some(entry => entry.key === permissionKey)) return;
    const set = new Set(live.desiredPermissions);
    if (set.has(permissionKey)) {
      set.delete(permissionKey);
    } else {
      set.add(permissionKey);
    }
    live.onChange([...set].sort());
  }

  function toggleAreaAction(area: string, action: PermissionMatrixAction) {
    const live = current.current;
    if (!live.alive || live.epoch !== epoch || live.scopeKey !== scopeKey || !live.canEdit || live.tabKey !== tabKey) return;
    const permissionKey = findPermissionKeyForAreaAction(area, action, live.tabCatalog,
      live.tabCatalog.map(entry => entry.key));
    if (permissionKey) togglePermission(permissionKey);
  }

  function isActionActive(area: string, action: PermissionMatrixAction): boolean {
    const permissionKey = findPermissionKeyForAreaAction(area, action, tabCatalog, availableKeys);
    return permissionKey ? desiredPermissions.includes(permissionKey) : false;
  }

  if (tabCatalog.length === 0) {
    return (
      <Text style={content.caption}>Keine bearbeitbaren Rechte in diesem Bereich.</Text>
    );
  }

  // Clinical actions such as signing, reviewing and administering are distinct
  // permissions and must never share a guessed matrix cell with another right.
  if (tabKey === 'pflege') {
    return (
      <View style={styles.permissionList}>
        {tabCatalog.map(entry => {
          const checked = desiredPermissions.includes(entry.key);
          return (
            <Pressable key={entry.key} accessibilityRole="checkbox"
              accessibilityLabel={entry.label}
              accessibilityState={{ checked, disabled: !canEdit }}
              disabled={!canEdit} onPress={() => togglePermission(entry.key)}
              style={styles.permissionOption}>
              <View style={styles.permissionCheck}>
                <Text style={styles.matrixCellText}>{checked ? '✓' : ''}</Text>
              </View>
              <View style={styles.permissionCopy}>
                <Text style={styles.permissionLabel}>{entry.label}</Text>
                {entry.description ? <Text style={content.caption}>{entry.description}</Text> : null}
                <View style={styles.riskRow}>
                  <PremiumBadge label={RISK_LABELS[entry.riskLevel] ?? entry.riskLevel}
                    variant={entry.riskLevel === 'critical' || entry.riskLevel === 'high' ? 'orange' : 'muted'} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
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
      {areas.map((row) => {
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
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${row.areaLabel}: ${ACTION_LABELS[action]}`}
                    accessibilityState={{ checked: active, disabled }}
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
