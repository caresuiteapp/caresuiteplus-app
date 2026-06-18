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
import { useEmployeeDetail } from '@/hooks/useEmployeeDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type EmployeeDetailSummaryPanelProps = {
  employeeId: string;
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

export function EmployeeDetailSummaryPanel({ employeeId }: EmployeeDetailSummaryPanelProps) {
  const router = useRouter();
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

  if (!employee) return null;

  const fullName = `${employee.firstName} ${employee.lastName}`;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.orange}>
        <Text style={styles.name}>{fullName}</Text>
        <View style={styles.badgeRow}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[employee.status]}
            variant={statusVariant(employee.status)}
            dot
          />
          {employee.department ? (
            <PremiumBadge label={employee.department} variant="cyan" />
          ) : null}
        </View>
        {employee.jobTitle ? <Text style={styles.role}>{employee.jobTitle}</Text> : null}
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Mitarbeitenden-Daten einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Kontakt" subtitle="Erreichbarkeit">
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
            fullWidth
            onPress={() => router.push(`/office/employees/${employee.id}/edit` as never)}
          />
        ) : null}
        <PremiumButton
          title="Vollständiges Profil öffnen"
          variant="secondary"
          fullWidth
          onPress={() => router.push(`/office/employees/${employee.id}` as never)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  name: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  role: {
    ...typography.caption,
    color: colors.textMuted,
  },
  row: {
    marginBottom: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  rowValue: {
    ...typography.body,
  },
  hintLabel: {
    ...typography.label,
    color: colors.orange,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.body,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
});
