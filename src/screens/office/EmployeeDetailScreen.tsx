import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { EmployeeDetailHero } from '@/components/office';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEmployeeDetail } from '@/lib/office/employeeDetailService';
import { deleteEmployee } from '@/lib/office/employeeDeleteService';
import { employeeEditRoute } from '@/lib/office/employeePersonnelLabels';
import {
  EMPLOYEE_DETAIL_PREPARED_MESSAGE,
  isEmployeeDetailLiveReady,
} from '@/lib/office/employeeModuleConfig';
import { fetchEmployeeEquipmentSummary, INVENTORY_PREPARED_MESSAGE } from '@/lib/inventory';
import {
  resolveEmployeeDepartmentLabel,
  resolveEmployeeRoleLabel,
} from '@/lib/office/employeeCatalogLabels';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing } from '@/theme';

export function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, isReadOnly, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const canView = can('office.employees.view');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!id) return Promise.resolve({ ok: false as const, error: 'Keine Mitarbeitenden-ID.' });
      return fetchEmployeeDetail(id, tenantId, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  const equipmentQuery = useAsyncQuery(
    () => {
      if (!tenantId || !id) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchEmployeeEquipmentSummary(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id && can('inventory.view') },
  );

  if (!canView) {
    return (
      <CareLightPageShell title="Mitarbeitende:r" subtitle="Kein Zugriff">
        <LockedActionBanner
          message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Mitarbeitende:r" subtitle="Wird geladen…">
        <LoadingState message="Detaildaten werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Mitarbeitende:r" subtitle="Fehler">
        <ErrorState
          title="Fehler"
          message={query.error}
          onRetry={query.refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  const employee = query.data;
  if (!employee) {
    return (
      <CareLightPageShell title="Mitarbeitende:r" subtitle="Nicht gefunden">
        <EmptyState title="Nicht gefunden" message="Der Datensatz existiert nicht im Demo-Mandanten." />
      </CareLightPageShell>
    );
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const canEdit = can('office.employees.edit');
  const canDelete = can('office.employees.delete');
  const hasContact = Boolean(employee.email?.trim() || employee.phone?.trim());

  return (
    <CareLightPageShell
      title={fullName}
      subtitle="Mitarbeitenden-Details"
      rightSlot={
        canEdit || canDelete ? (
          <View style={styles.headerActions}>
            {canEdit ? (
              <PremiumButton
                title="Stammdaten bearbeiten"
                size="sm"
                variant="secondary"
                onPress={() => router.push(employeeEditRoute(id!) as never)}
              />
            ) : null}
            {canDelete ? (
              <OfficeRecordDeleteButton
                recordLabel="Mitarbeitende:r"
                displayName={fullName}
                fullWidth={false}
                onDelete={() => {
                  if (!tenantId || !id) {
                    return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
                  }
                  return deleteEmployee(
                    id,
                    tenantId,
                    profile?.roleKey,
                    profile?.id,
                    profile?.displayName,
                  );
                }}
                onDeleted={() => router.replace('/business/office/employees' as never)}
              />
            ) : null}
          </View>
        ) : undefined
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <EmployeeDetailHero employee={employee} roleKey={roleKey} isReadOnly={isReadOnly} />

        {canEdit ? (
          <PremiumButton
            title="Stammdaten bearbeiten"
            variant="primary"
            onPress={() => router.push(employeeEditRoute(id!) as never)}
          />
        ) : null}

        <PremiumButton
          title="Personalakte öffnen"
          variant="secondary"
          onPress={() => router.push(`/business/office/employees/${id}/personnel` as never)}
        />

        {canEdit ? (
          <PremiumButton
            title="Offboarding"
            variant="secondary"
            onPress={() => router.push(`/office/employees/${id}/offboarding` as never)}
          />
        ) : null}

        {!isEmployeeDetailLiveReady() ? (
          <InfoBanner title="Teilweise live" message={EMPLOYEE_DETAIL_PREPARED_MESSAGE} />
        ) : null}

        {isReadOnly ? (
          <LockedActionBanner
            title="Lesemodus"
            message="Sie können Mitarbeitenden-Daten einsehen, aber nicht bearbeiten."
            roleLabel={roleLabel}
          />
        ) : null}

        <SectionPanel title="Kontakt">
          {hasContact ? (
            <>
              <DetailInfoRow label="E-Mail" value={employee.email} />
              <DetailInfoRow label="Telefon" value={employee.phone} />
              {employee.mobile ? <DetailInfoRow label="Mobil" value={employee.mobile} /> : null}
            </>
          ) : (
            <EmptyState title="Keine Kontaktdaten" message="Telefon oder E-Mail in der Bearbeitung ergänzen." />
          )}
        </SectionPanel>

        <SectionPanel title="Anstellung">
          <DetailInfoRow
            label="Funktion"
            value={resolveEmployeeRoleLabel(employee.jobTitle)}
          />
          <DetailInfoRow
            label="Abteilung"
            value={resolveEmployeeDepartmentLabel(employee.department)}
          />
          <DetailInfoRow
            label="Eintrittsdatum"
            value={
              employee.startDate
                ? new Date(employee.startDate).toLocaleDateString('de-DE')
                : null
            }
          />
          <DetailInfoRow
            label="Angelegt am"
            value={new Date(employee.createdAt).toLocaleDateString('de-DE')}
          />
          {employee.notes ? <DetailInfoRow label="Hinweise" value={employee.notes} /> : null}
        </SectionPanel>

        {can('inventory.view') && equipmentQuery.data ? (
          <SectionPanel title="Arbeitsmittel & Inventar">
            <DetailInfoRow label="Aktive Ausgaben" value={String(equipmentQuery.data.activeAssignments)} />
            <DetailInfoRow label="Überfällige Rückgaben" value={String(equipmentQuery.data.overdueReturns)} />
            <PremiumButton
              title="Inventar & Rückgabe"
              variant="secondary"
              onPress={() => router.push('/business/office/inventory' as never)}
            />
            <InfoBanner title="Inventar" message={INVENTORY_PREPARED_MESSAGE} />
          </SectionPanel>
        ) : null}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
});
