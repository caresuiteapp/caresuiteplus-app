import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { EmployeeDetailHero } from '@/components/office';
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
import {
  EMPLOYEE_DETAIL_PREPARED_MESSAGE,
  isEmployeeDetailLiveReady,
} from '@/lib/office/employeeModuleConfig';
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
  const hasContact = Boolean(employee.email?.trim() || employee.phone?.trim());

  return (
    <CareLightPageShell
      title={fullName}
      subtitle="Mitarbeitenden-Details"
      rightSlot={
        canEdit ? (
          <PremiumButton
            title="Bearbeiten"
            size="sm"
            variant="ghost"
            onPress={() => router.push(`/business/office/employees/${id}/edit` as never)}
          />
        ) : undefined
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <EmployeeDetailHero employee={employee} roleKey={roleKey} isReadOnly={isReadOnly} />

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
            </>
          ) : (
            <EmptyState title="Keine Kontaktdaten" message="Telefon oder E-Mail in der Bearbeitung ergänzen." />
          )}
        </SectionPanel>

        <SectionPanel title="Anstellung">
          <DetailInfoRow label="Abteilung" value={employee.department} />
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
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
});
