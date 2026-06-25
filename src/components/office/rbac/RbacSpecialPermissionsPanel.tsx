import { StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import {
  FilterChipGroup,
  InfoBanner,
  PremiumButton,
  PremiumInput,
} from '@/components/ui';
import { CareDateInput } from '@/components/inputs';
import type { PermissionKey } from '@/types';
import type {
  EmployeeDataScope,
  EmployeePermissionOverride,
  PermissionCatalogEntry,
} from '@/types/permissions/rbac';
import { getCatalogLabel } from '@/lib/permissions/permissionCatalogService';
import { DATA_SCOPE_TYPE_OPTIONS } from '@/lib/office/employeeRbacSaveService';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { spacing } from '@/theme';

type RbacSpecialPermissionsPanelProps = {
  tenantId: string;
  employeeId: string;
  catalog: PermissionCatalogEntry[];
  overrides: EmployeePermissionOverride[];
  dataScopes: EmployeeDataScope[];
  effectivePermissionCount: number;
  rolePermissionCount: number;
  canEdit: boolean;
  onOverridesChange: (overrides: EmployeePermissionOverride[]) => void;
  onDataScopesChange: (scopes: EmployeeDataScope[]) => void;
};

export function RbacSpecialPermissionsPanel({
  tenantId,
  employeeId,
  catalog,
  overrides,
  dataScopes,
  effectivePermissionCount,
  rolePermissionCount,
  canEdit,
  onOverridesChange,
  onDataScopesChange,
}: RbacSpecialPermissionsPanelProps) {
  const content = useAdaptiveContentStyles();
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<PermissionKey | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [reason, setReason] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [scopeModule, setScopeModule] = useState('office');
  const [scopeType, setScopeType] = useState('team');
  const [scopeValue, setScopeValue] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: { gap: spacing.sm, marginBottom: spacing.md },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          paddingVertical: spacing.xs,
        },
        label: { ...content.body, flex: 1, color: content.primary.color },
        caption: { ...content.caption, marginBottom: spacing.xs },
      }),
    [content],
  );

  const pickerOptions = catalog
    .filter(
      (entry) =>
        !pickerSearch ||
        entry.label.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        entry.key.toLowerCase().includes(pickerSearch.toLowerCase()),
    )
    .slice(0, 12)
    .map((entry) => ({ key: entry.key, label: entry.label }));

  function addOverride() {
    if (!selectedPermission || !canEdit) return;
    const next: EmployeePermissionOverride = {
      id: `override-${selectedPermission}-${Date.now()}`,
      tenantId,
      employeeId,
      permissionKey: selectedPermission,
      allowed,
      reason: reason.trim() || null,
      validFrom: validFrom.trim() || null,
      validUntil: validUntil.trim() || null,
      createdBy: null,
    };
    onOverridesChange([
      ...overrides.filter((item) => item.permissionKey !== selectedPermission),
      next,
    ]);
    setSelectedPermission(null);
    setReason('');
    setValidFrom('');
    setValidUntil('');
  }

  function removeOverride(permissionKey: PermissionKey) {
    if (!canEdit) return;
    onOverridesChange(overrides.filter((item) => item.permissionKey !== permissionKey));
  }

  function addDataScope() {
    if (!canEdit) return;
    const next: EmployeeDataScope = {
      id: `scope-${scopeModule}-${Date.now()}`,
      tenantId,
      employeeId,
      module: scopeModule.trim(),
      scopeType,
      scopeValue: scopeValue.trim() || null,
    };
    onDataScopesChange([...dataScopes, next]);
    setScopeValue('');
  }

  function removeDataScope(scopeId: string) {
    if (!canEdit) return;
    onDataScopesChange(dataScopes.filter((item) => item.id !== scopeId));
  }

  return (
    <View>
      <InfoBanner
        variant="info"
        title="Effektive Rechte"
        message={`Rollen-Basis: ${rolePermissionCount} · Mit Sonderrechten: ${effectivePermissionCount}`}
      />

      <View style={styles.block}>
        <Text style={styles.caption}>Aktive Sonderrechte</Text>
        {overrides.length === 0 ? (
          <InfoBanner variant="info" title="Keine Overrides" message="Keine individuellen Berechtigungs-Overrides." />
        ) : (
          overrides.map((override) => (
            <View key={override.id} style={styles.row}>
              <Text style={styles.label}>
                {getCatalogLabel(override.permissionKey, catalog)} —{' '}
                {override.allowed ? 'Freigegeben' : 'Entzogen'}
              </Text>
              {canEdit ? (
                <PremiumButton
                  title="Entfernen"
                  size="sm"
                  variant="secondary"
                  onPress={() => removeOverride(override.permissionKey)}
                />
              ) : null}
            </View>
          ))
        )}
      </View>

      {canEdit ? (
        <View style={styles.block}>
          <Text style={styles.caption}>Override hinzufügen</Text>
          <PremiumInput
            label="Recht suchen"
            value={pickerSearch}
            onChangeText={setPickerSearch}
            placeholder="Berechtigung filtern…"
          />
          <FilterChipGroup
            options={pickerOptions}
            value={selectedPermission ?? ''}
            onChange={(key) => setSelectedPermission(key as PermissionKey)}
          />
          <FilterChipGroup
            options={[
              { key: 'grant', label: 'Freigeben' },
              { key: 'deny', label: 'Entziehen' },
            ]}
            value={allowed ? 'grant' : 'deny'}
            onChange={(key) => setAllowed(key === 'grant')}
          />
          <PremiumInput label="Begründung" value={reason} onChangeText={setReason} multiline />
          <CareDateInput label="Gültig ab" value={validFrom} onChange={setValidFrom} />
          <CareDateInput label="Gültig bis" value={validUntil} onChange={setValidUntil} />
          <PremiumButton title="Override übernehmen" onPress={addOverride} disabled={!selectedPermission} />
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.caption}>Daten-Sichtbarkeit (Scopes)</Text>
        {dataScopes.length === 0 ? (
          <InfoBanner variant="info" title="Keine Scopes" message="Keine modulspezifischen Sichtbarkeitsregeln." />
        ) : (
          dataScopes.map((scope) => (
            <View key={scope.id} style={styles.row}>
              <Text style={styles.label}>
                {scope.module}: {DATA_SCOPE_TYPE_OPTIONS.find((o) => o.key === scope.scopeType)?.label ?? scope.scopeType}
                {scope.scopeValue ? ` (${scope.scopeValue})` : ''}
              </Text>
              {canEdit ? (
                <PremiumButton
                  title="Entfernen"
                  size="sm"
                  variant="secondary"
                  onPress={() => removeDataScope(scope.id)}
                />
              ) : null}
            </View>
          ))
        )}
      </View>

      {canEdit ? (
        <View style={styles.block}>
          <PremiumInput label="Modul" value={scopeModule} onChangeText={setScopeModule} placeholder="z. B. office" />
          <FilterChipGroup
            options={DATA_SCOPE_TYPE_OPTIONS.map((option) => ({ key: option.key, label: option.label }))}
            value={scopeType}
            onChange={setScopeType}
          />
          <PremiumInput
            label="Scope-Wert (optional)"
            value={scopeValue}
            onChangeText={setScopeValue}
            placeholder="Team-ID, Standort, …"
          />
          <PremiumButton title="Scope hinzufügen" onPress={addDataScope} />
        </View>
      ) : null}
    </View>
  );
}
