import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import {
  FilterChipGroup,
  InfoBanner,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { ROLE_LABELS } from '@/data/constants/roleLabels';
import {
  describeEmployeeTimeTrackingMode,
  EMPLOYEE_ASSIGNABLE_ROLE_KEYS,
  getEmployeeHomeOfficeOverride,
  resolveEmployeeTimeTrackingMode,
  roleQualifiesForHomeOfficeSetting,
} from '@/lib/office/employeeHomeOfficeService';
import { PERMISSION_LABELS, getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import type { RoleKey } from '@/types/core/auth';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { spacing } from '@/theme';

type EmployeePersonnelRolesPanelProps = {
  employeeId: string;
  roleKey: RoleKey | null;
  canEdit: boolean;
  saving: boolean;
  panelCtx?: { viewContext?: 'form' };
  onSave: (patch: { roleKey: RoleKey; homeOfficeEnabled: boolean | null }) => Promise<void>;
};

export function EmployeePersonnelRolesPanel({
  employeeId,
  roleKey,
  canEdit,
  saving,
  panelCtx = {},
  onSave,
}: EmployeePersonnelRolesPanelProps) {
  const content = useAdaptiveContentStyles();
  const initialRole = roleKey ?? 'employee_portal';
  const initialOverride = getEmployeeHomeOfficeOverride(employeeId);

  const [selectedRole, setSelectedRole] = useState<RoleKey>(initialRole);
  const [homeOfficeEnabled, setHomeOfficeEnabled] = useState<boolean>(
    initialOverride ?? roleQualifiesForHomeOfficeSetting(initialRole),
  );
  const [homeOfficeManual, setHomeOfficeManual] = useState(initialOverride !== null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        formBlock: { marginTop: spacing.sm, gap: spacing.sm },
        fieldLabel: { ...content.caption, marginBottom: spacing.xs },
        permList: { gap: spacing.xs, marginTop: spacing.sm },
        permItem: { ...content.caption, opacity: 0.9 },
        toggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        toggleLabel: { ...content.body, flex: 1, color: content.primary.color },
      }),
    [content],
  );

  const roleOptions = useMemo(
    () =>
      EMPLOYEE_ASSIGNABLE_ROLE_KEYS.map((key) => ({
        key,
        label: ROLE_LABELS[key],
      })),
    [],
  );

  const trackingMode = resolveEmployeeTimeTrackingMode(
    selectedRole,
    homeOfficeManual ? homeOfficeEnabled : null,
  );
  const showHomeOfficeToggle = roleQualifiesForHomeOfficeSetting(selectedRole);
  const permissionPreview = getPermissionsForRole(selectedRole)
    .filter((key) => key.startsWith('office.') || key.startsWith('time.') || key.startsWith('assist.'))
    .slice(0, 8);

  function handleRoleChange(nextRole: string) {
    const key = nextRole as RoleKey;
    setSelectedRole(key);
    if (!homeOfficeManual) {
      setHomeOfficeEnabled(roleQualifiesForHomeOfficeSetting(key));
    }
  }

  async function handleSave() {
    await onSave({
      roleKey: selectedRole,
      homeOfficeEnabled: homeOfficeManual ? homeOfficeEnabled : null,
    });
  }

  return (
    <SectionPanel {...panelCtx} title="Rollen & Rechte">
      <DetailInfoRow label="Systemrolle" value={roleKey ? ROLE_LABELS[roleKey] : '—'} />
      <DetailInfoRow
        label="Zeiterfassungsmodus"
        value={describeEmployeeTimeTrackingMode(trackingMode)}
      />

      {canEdit ? (
        <View style={styles.formBlock}>
          <Text style={styles.fieldLabel}>Rolle zuweisen</Text>
          <FilterChipGroup
            options={roleOptions}
            value={selectedRole}
            onChange={handleRoleChange}
          />

          {showHomeOfficeToggle ? (
            <>
              <InfoBanner
                variant="info"
                title="Homeoffice-Zeiterfassung"
                message="Für Büro- und Koordinationsrollen gilt die Homeoffice-Arbeitszeit (Tätigkeitsnachweis, Metadaten). Feldrollen nutzen die Einsatz-Zeiterfassung über Assist."
              />
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Homeoffice-Zeiterfassung aktiv</Text>
                <PremiumButton
                  title={homeOfficeEnabled ? 'Ja' : 'Nein'}
                  size="sm"
                  variant={homeOfficeEnabled ? 'primary' : 'secondary'}
                  onPress={() => {
                    setHomeOfficeManual(true);
                    setHomeOfficeEnabled((v) => !v);
                  }}
                />
              </View>
            </>
          ) : (
            <InfoBanner
              variant="info"
              title="Einsatz-Zeiterfassung"
              message="Diese Rolle nutzt die Zeiterfassung über Assist-Einsätze (Check-in/out). Homeoffice-Einstellungen sind für diese Rolle nicht vorgesehen."
            />
          )}

          <Text style={styles.fieldLabel}>Rechte-Vorschau (Auszug)</Text>
          <View style={styles.permList}>
            {permissionPreview.map((key) => (
              <Text key={key} style={styles.permItem}>
                · {PERMISSION_LABELS[key] ?? key}
              </Text>
            ))}
          </View>

          <PremiumButton title="Rollen & Rechte speichern" loading={saving} onPress={handleSave} />
        </View>
      ) : null}
    </SectionPanel>
  );
}
