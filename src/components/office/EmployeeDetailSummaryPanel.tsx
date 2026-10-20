import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { EmployeeListAvatar } from '@/components/office/EmployeeListAvatar';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import { useEmployeeDetail } from '@/hooks/useEmployeeDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { deleteEmployee } from '@/lib/office/employeeDeleteService';
import {
  resolveEmployeeDepartmentLabel,
  resolveEmployeeRoleLabel,
} from '@/lib/office/employeeCatalogLabels';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type EmployeeDetailSummaryPanelProps = {
  employeeId: string;
  onOpenFullRecord?: () => void;
  /** Opens EmployeeEditModal in edit mode; parent may host the modal instead. */
  onEditMasterData?: () => void;
  onOpenOffboarding?: () => void;
  onDeleted?: () => void;
};

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function EmployeeDetailSummaryPanel({
  employeeId,
  onOpenFullRecord,
  onEditMasterData,
  onOpenOffboarding,
  onDeleted,
}: EmployeeDetailSummaryPanelProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, roleLabel, isReadOnly } = usePermissions();
  const { data: employee, loading, error, refresh, notFound } = useEmployeeDetail(employeeId);

  if (loading) {
    return <LoadingState message="Mitarbeitende:r wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Datensatz existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!employee) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title="Datensatz nicht verfügbar"
          message="Die Mitarbeitenden-Daten konnten nicht geladen werden."
          onRetry={refresh}
        />
      </View>
    );
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const isArchived = employee.status === 'archiviert';
  const canDeleteDraft = employee.status === 'entwurf';

  const handleEditMasterData = () => {
    if (onEditMasterData) {
      onEditMasterData();
      return;
    }
    router.push(`/office/employees/${employee.id}/edit` as never);
  };

  const handleOpenOffboarding = () => {
    if (onOpenOffboarding) {
      onOpenOffboarding();
      return;
    }
    router.push(`/office/employees/${employee.id}/offboarding` as never);
  };

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.orange}>
        <View style={styles.headerRow}>
          <EmployeeListAvatar
            firstName={employee.firstName}
            lastName={employee.lastName}
            avatarUrl={employee.avatarUrl}
            size="lg"
          />
          <View style={styles.headerMain}>
            <Text style={styles.name}>{fullName}</Text>
            <View style={styles.badgeRow}>
              <PremiumBadge
                label={WORKFLOW_STATUS_LABELS[employee.status]}
                variant={statusVariant(employee.status)}
                dot
              />
              {employee.department ? (
                <PremiumBadge
                  label={resolveEmployeeDepartmentLabel(employee.department)}
                  variant="cyan"
                />
              ) : null}
            </View>
            {employee.jobTitle ? (
              <Text style={styles.role}>{resolveEmployeeRoleLabel(employee.jobTitle)}</Text>
            ) : null}
          </View>
        </View>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Mitarbeitenden-Daten einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Kontakt & Beschäftigung" subtitle="Direkte Erreichbarkeit und Eintrittsdaten">
        <SummaryRow label="E-Mail" value={employee.email} />
        <SummaryRow label="Telefon" value={employee.phone} />
        <SummaryRow label="Eintritt" value={employee.startDate} />
        {!employee.email && !employee.phone ? (
          <EmptyState title="Keine Kontaktdaten" message="Noch keine Kontaktinformationen hinterlegt." />
        ) : null}
      </SectionPanel>

      {employee.notes ? (
        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.hintLabel}>Hinweis</Text>
          <Text style={styles.hint}>{employee.notes}</Text>
        </PremiumCard>
      ) : null}

      <View style={styles.actions}>
        {can('office.employees.edit') ? (
          <PremiumButton
            title="Stammdaten bearbeiten"
            variant="primary"
            style={styles.actionButton}
            onPress={handleEditMasterData}
          />
        ) : null}
        <PremiumButton
          title="Personalakte öffnen"
          variant="secondary"
          style={styles.actionButton}
          onPress={
            onOpenFullRecord
              ? onOpenFullRecord
              : () => router.push(`/business/office/employees/${employee.id}/personnel` as never)
          }
        />
        {can('office.employees.edit') ? (
          <PremiumButton
            title={isArchived ? 'Archivierte Personalakte' : 'Kündigung / Offboarding'}
            variant="secondary"
            style={styles.actionButton}
            onPress={handleOpenOffboarding}
          />
        ) : null}
        {can('office.employees.delete') && canDeleteDraft ? (
          <OfficeRecordDeleteButton
            recordLabel="Mitarbeitende:r"
            displayName={fullName}
            onDelete={() => {
              if (!tenantId) {
                return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
              }
              return deleteEmployee(
                employee.id,
                tenantId,
                profile?.roleKey,
                profile?.id,
                profile?.displayName,
              );
            }}
            onDeleted={onDeleted}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: '#F4F9FD',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  name: {
    ...typography.h2,
    color: '#09213F',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  role: {
    ...typography.caption,
    color: '#526A84',
    fontWeight: '700',
  },
  row: {
    marginBottom: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    color: '#526A84',
    fontWeight: '700',
    marginBottom: 2,
  },
  rowValue: {
    ...typography.body,
    color: '#09213F',
    fontWeight: '600',
  },
  hintLabel: {
    ...typography.label,
    color: colors.orange,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.body,
    color: '#09213F',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  actionButton: { flexGrow: 1, minWidth: 210 },
});
