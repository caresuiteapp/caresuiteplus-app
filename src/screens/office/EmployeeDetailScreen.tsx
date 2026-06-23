import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { EmployeeDetailHero } from '@/components/office/EmployeeDetailHero';
import { EmployeePortalImpactPanel } from '@/components/office/EmployeePortalImpactPanel';
import { EmployeeSectionEditModal } from '@/components/office/EmployeeSectionEditModal';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
  SegmentedTabs,
} from '@/components/ui';
import { useSectionEditModal } from '@/hooks/useSectionEditModal';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEmployeeDetail } from '@/lib/office/employeeDetailService';
import { deleteEmployee } from '@/lib/office/employeeDeleteService';
import {
  EMPLOYEE_DETAIL_PREPARED_MESSAGE,
  isEmployeeDetailLiveReady,
} from '@/lib/office/employeeModuleConfig';
import { fetchEmployeeEquipmentSummary, INVENTORY_PREPARED_MESSAGE } from '@/lib/inventory';
import {
  resolveEmployeeDepartmentLabel,
  resolveEmployeeRoleLabel,
} from '@/lib/office/employeeCatalogLabels';
import type { EmployeeEditSectionKey } from '@/lib/office/employeeSectionEditLabels';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing } from '@/theme';

export function EmployeeDetailScreen({
  employeeId: employeeIdProp,
  embedded = false,
  embeddedInModal = false,
  initialTabOverride,
  onDeleted,
  onEditMasterData,
  onOpenPersonnelRecord,
  onOpenOffboarding,
}: {
  employeeId?: string;
  embedded?: boolean;
  embeddedInModal?: boolean;
  initialTabOverride?: 'uebersicht' | 'stammdaten' | 'kontakt' | 'anstellung' | 'portal';
  onDeleted?: () => void;
  onEditMasterData?: () => void;
  onOpenPersonnelRecord?: () => void;
  onOpenOffboarding?: () => void;
} = {}) {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const id = employeeIdProp ?? routeId;
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, isReadOnly, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const canView = can('office.employees.view');
  const [activeTab, setActiveTab] = useState<
    'uebersicht' | 'stammdaten' | 'kontakt' | 'anstellung' | 'portal'
  >(initialTabOverride ?? 'uebersicht');
  const sectionEdit = useSectionEditModal<EmployeeEditSectionKey>();
  const hostsLocalSectionEdit = !onEditMasterData;

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
    return embedded ? (
      <LockedActionBanner
        message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    ) : (
      <ScreenShell title="Mitarbeitende:r" subtitle="Kein Zugriff">
        <LockedActionBanner
          message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return embedded ? (
      <LoadingState message="Detaildaten werden geladen…" />
    ) : (
      <ScreenShell title="Mitarbeitende:r" subtitle="Wird geladen…">
        <LoadingState message="Detaildaten werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return embedded ? (
      <ErrorState
        title="Fehler"
        message={query.error}
        onRetry={query.refresh}
      />
    ) : (
      <ScreenShell title="Mitarbeitende:r" subtitle="Fehler">
        <ErrorState
          title="Fehler"
          message={query.error}
          onRetry={query.refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const employee = query.data;
  if (!employee) {
    return embedded ? (
      <EmptyState title="Nicht gefunden" message="Der Datensatz existiert nicht im Demo-Mandanten." />
    ) : (
      <ScreenShell title="Mitarbeitende:r" subtitle="Nicht gefunden">
        <EmptyState title="Nicht gefunden" message="Der Datensatz existiert nicht im Demo-Mandanten." />
      </ScreenShell>
    );
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const canEdit = can('office.employees.edit');
  const canDelete = can('office.employees.delete');
  const hasContact = Boolean(employee.email?.trim() || employee.phone?.trim());

  const handleEditMasterData = () => {
    if (onEditMasterData) {
      onEditMasterData();
      return;
    }
    sectionEdit.openSection('stammdaten');
  };

  const handleEditSection = (section: EmployeeEditSectionKey) => {
    if (onEditMasterData) {
      onEditMasterData();
      return;
    }
    sectionEdit.openSection(section);
  };

  const handleOpenPersonnelRecord = () => {
    if (onOpenPersonnelRecord) {
      onOpenPersonnelRecord();
      return;
    }
    router.push(`/business/office/employees/${id}/personnel` as never);
  };

  const handleOpenOffboarding = () => {
    if (onOpenOffboarding) {
      onOpenOffboarding();
      return;
    }
    router.push(`/office/employees/${id}/offboarding` as never);
  };

  const detailBody = (
    <>
      {!embedded ? (
        <EmployeeDetailHero employee={employee} roleKey={roleKey} isReadOnly={isReadOnly} />
      ) : null}

      <SegmentedTabs
        tabs={[
          { key: 'uebersicht', label: 'Übersicht' },
          { key: 'stammdaten', label: 'Stammdaten' },
          { key: 'kontakt', label: 'Kontakt' },
          { key: 'anstellung', label: 'Anstellung' },
          { key: 'portal', label: 'Portal' },
        ]}
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key as typeof activeTab)}
        layout="wrap"
      />

      <PremiumButton
        title="Personalakte öffnen"
        variant="secondary"
        onPress={handleOpenPersonnelRecord}
      />

      {!isEmployeeDetailLiveReady() ? (
        <InfoBanner title="Daten in Erweiterung" message={EMPLOYEE_DETAIL_PREPARED_MESSAGE} />
      ) : null}

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Mitarbeitenden-Daten einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      {activeTab === 'uebersicht' ? (
        <>
          <SectionPanel title="Kurzprofil">
            <DetailInfoRow label="Name" value={fullName} />
            <DetailInfoRow label="Funktion" value={resolveEmployeeRoleLabel(employee.jobTitle)} />
            <DetailInfoRow label="Abteilung" value={resolveEmployeeDepartmentLabel(employee.department)} />
            <DetailInfoRow label="E-Mail" value={employee.email} />
            <DetailInfoRow label="Telefon" value={employee.phone} />
          </SectionPanel>
        </>
      ) : null}

      {activeTab === 'stammdaten' ? (
        <SectionPanel title="Stammdaten">
          <DetailInfoRow label="Vorname" value={employee.firstName} />
          <DetailInfoRow label="Nachname" value={employee.lastName} />
          <DetailInfoRow label="Funktion" value={resolveEmployeeRoleLabel(employee.jobTitle)} />
          <DetailInfoRow label="Abteilung" value={resolveEmployeeDepartmentLabel(employee.department)} />
          {employee.notes ? <DetailInfoRow label="Hinweise" value={employee.notes} /> : null}
          {canEdit ? (
            <PremiumButton title="Stammdaten bearbeiten" variant="secondary" onPress={() => handleEditSection('stammdaten')} />
          ) : null}
        </SectionPanel>
      ) : null}

      {activeTab === 'kontakt' ? (
        <SectionPanel title="Kontakt">
          {hasContact ? (
            <>
              <DetailInfoRow label="E-Mail" value={employee.email} />
              <DetailInfoRow label="Telefon" value={employee.phone} />
              {employee.mobile ? <DetailInfoRow label="Mobil" value={employee.mobile} /> : null}
            </>
          ) : (
            <EmptyState title="Keine Kontaktdaten" message="Telefon oder E-Mail ergänzen." />
          )}
          {canEdit ? (
            <PremiumButton title="Kontakt bearbeiten" variant="secondary" onPress={() => handleEditSection('stammdaten')} />
          ) : null}
        </SectionPanel>
      ) : null}

      {activeTab === 'anstellung' ? (
        <SectionPanel title="Anstellung">
          <DetailInfoRow label="Eintrittsdatum" value={employee.startDate ? new Date(employee.startDate).toLocaleDateString('de-DE') : null} />
          <DetailInfoRow label="Angelegt am" value={new Date(employee.createdAt).toLocaleDateString('de-DE')} />
          {canEdit ? (
            <PremiumButton title="Anstellung bearbeiten" variant="secondary" onPress={() => handleEditSection('anstellung')} />
          ) : null}
        </SectionPanel>
      ) : null}

      {activeTab === 'portal' ? <EmployeePortalImpactPanel /> : null}

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

      {canEdit || canDelete ? (
        <SectionPanel title="Gefahrenzone" subtitle="Irreversible Aktionen">
          {canEdit ? (
            <PremiumButton title="Offboarding starten" variant="secondary" onPress={handleOpenOffboarding} />
          ) : null}
          {canDelete ? (
            <OfficeRecordDeleteButton
              recordLabel="Mitarbeitende:r"
              displayName={fullName}
              buttonTitle="Mitarbeitende:n löschen"
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
              onDeleted={() => {
                if (onDeleted) {
                  onDeleted();
                  return;
                }
                router.replace('/business/office/employees' as never);
              }}
            />
          ) : null}
        </SectionPanel>
      ) : null}
    </>
  );

  const sectionEditModal =
    hostsLocalSectionEdit && sectionEdit.activeSection && id ? (
      <EmployeeSectionEditModal
        visible={sectionEdit.isOpen}
        employeeId={id}
        section={sectionEdit.activeSection}
        onClose={sectionEdit.closeSection}
        onUpdated={() => {
          sectionEdit.closeSection();
          void query.refresh();
        }}
        onOpenPersonnelRecord={handleOpenPersonnelRecord}
      />
    ) : null;

  if (embedded) {
    return (
      <>
        <View style={styles.embeddedRoot}>{detailBody}</View>
        {sectionEditModal}
      </>
    );
  }

  return (
    <ScreenShell
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
                onPress={handleEditMasterData}
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
                onDeleted={() => {
                  if (onDeleted) {
                    onDeleted();
                    return;
                  }
                  router.replace('/business/office/employees' as never);
                }}
              />
            ) : null}
          </View>
        ) : undefined
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {detailBody}
      </ScrollView>
      {sectionEditModal}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  embeddedRoot: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
});
