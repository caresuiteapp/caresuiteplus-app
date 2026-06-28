import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { CareDateInput } from '@/components/inputs';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { EmployeePortalAccessPanel } from '@/components/office/EmployeePortalAccessPanel';
import { EmployeeMobilityOfficePanel } from '@/components/office/EmployeeMobilityOfficePanel';
import { EmployeePayrollPersonnelPanel } from '@/components/office/EmployeePayrollPersonnelPanel';
import { EmployeeRolesPermissionsHub } from '@/components/office/EmployeeRolesPermissionsHub';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SegmentedTabs,
  SuccessState,
  Timeline,
} from '@/components/ui';
import { useEmployeePersonnelFile } from '@/hooks/useEmployeePersonnelFile';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { deleteEmployee } from '@/lib/office/employeeDeleteService';
import { buildEmployeePersonnelOverview } from '@/lib/office/employeePersonnelFileService';
import { EMPLOYMENT_TYPE_OPTIONS, resolveEmploymentTypeLabel } from '@/lib/office/employeeCatalogLabels';
import { QUALIFICATION_TYPE_LABELS } from '@/lib/office/employeePersonnelFieldRules';
import {
  employeeEditRoute,
  EMPLOYEE_EMPLOYMENT_STATUS_LABELS,
  labelBackgroundCheckStatus,
  labelEmployeeDeployability,
  labelEmploymentStatus,
  labelQualificationStatus,
  resolvePersonnelBlockerActions,
  resolvePersonnelUiTab,
  type PersonnelUiTabKey,
} from '@/lib/office/employeePersonnelLabels';
import {
  updateEmployeeBackgroundCheck,
  updateEmployeeEmployment,
  updateEmployeeQualificationFlags,
  uploadEmployeePersonnelDocument,
  deleteEmployeePersonnelDocument,
  updateEmployeeRolesPermissions,
} from '@/lib/office/employeePersonnelUpdateService';
import {
  describeEmployeeTimeTrackingMode,
  getEmployeeHomeOfficeOverride,
  resolveEmployeeTimeTrackingMode,
} from '@/lib/office/employeeHomeOfficeService';
import { fetchEmployeeEquipmentSummary, INVENTORY_PREPARED_MESSAGE } from '@/lib/inventory';
import type { EmployeeEmploymentStatus, EmployeeWorkMaterialStatus } from '@/types/modules/employeePersonnelFile';
import type { RoleKey } from '@/types/core/auth';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing } from '@/theme';

export type EmployeePersonnelUiTabKey = PersonnelUiTabKey;

export const OFFICE_PERSONNEL_UI_TABS: Array<{ key: EmployeePersonnelUiTabKey; label: string }> = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'master_data', label: 'Stammdaten' },
  { key: 'contact', label: 'Kontakt' },
  { key: 'employment', label: 'Anstellung' },
  { key: 'compensation', label: 'Vergütung & Bank' },
  { key: 'tax_social', label: 'Steuer & SV' },
  { key: 'secondary_employment', label: 'Mehrfachbeschäftigung' },
  { key: 'roles_permissions', label: 'Rollen & Rechte' },
  { key: 'qualifications', label: 'Qualifikationen' },
  { key: 'documents', label: 'Dokumente' },
  { key: 'portal', label: 'Portal' },
  { key: 'deployability', label: 'Einsatzfähigkeit' },
  { key: 'work_materials', label: 'Arbeitsmaterial' },
  { key: 'audit', label: 'Verlauf' },
];

const WORK_MATERIAL_STATUS_LABELS: Record<EmployeeWorkMaterialStatus, string> = {
  issued: 'Ausgegeben',
  return_pending: 'Rückgabe offen',
  damaged: 'Beschädigt',
  lost: 'Verloren',
  returned: 'Zurückgegeben',
};

type EmployeePersonnelFilePanelProps = {
  employeeId: string;
  embedded?: boolean;
  embeddedInModal?: boolean;
  initialTab?: EmployeePersonnelUiTabKey;
  onDeleted?: () => void;
  onEditMasterData?: () => void;
  onOpenOffboarding?: () => void;
};

export function EmployeePersonnelFilePanel({
  employeeId,
  embedded = false,
  embeddedInModal = false,
  initialTab = 'overview',
  onDeleted,
  onEditMasterData,
  onOpenOffboarding,
}: EmployeePersonnelFilePanelProps) {
  const router = useRouter();
  const content = useAdaptiveContentStyles();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const { file, loading, error, refresh } = useEmployeePersonnelFile(employeeId);
  const equipmentQuery = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchEmployeeEquipmentSummary(tenantId, employeeId, profile?.roleKey);
    },
    [tenantId, employeeId, profile?.roleKey],
    { enabled: !!tenantId && !!employeeId && can('inventory.view') },
  );
  const [activeTab, setActiveTab] = useState<EmployeePersonnelUiTabKey>(initialTab);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [hasFirstAid, setHasFirstAid] = useState(false);
  const [hasDriverLicense, setHasDriverLicense] = useState(false);
  const [hasPoliceClearance, setHasPoliceClearance] = useState(false);
  const [policeClearanceDate, setPoliceClearanceDate] = useState('');
  const [policeClearanceValidUntil, setPoliceClearanceValidUntil] = useState('');

  const [contractType, setContractType] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmployeeEmploymentStatus>('active');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [weeklyHoursError, setWeeklyHoursError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: embedded
          ? { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl }
          : { gap: spacing.md },
        scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: careSpacing.sm,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        },
        tasksBlock: { marginTop: spacing.sm, gap: spacing.xs },
        tasksTitle: { ...content.bodyStrong },
        taskItem: { ...content.body, opacity: 0.85 },
        actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
        hint: { ...content.caption, marginTop: spacing.sm, fontStyle: 'italic' },
        formBlock: { marginTop: spacing.md, gap: spacing.sm },
        formHint: { ...content.bodyStrong },
        toggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        toggleLabel: { ...content.body, flex: 1, color: content.primary.color },
        fieldLabel: { ...content.caption, marginBottom: spacing.xs },
        error: content.error,
      }),
    [content, embedded],
  );

  const overview = useMemo(() => (file ? buildEmployeePersonnelOverview(file) : null), [file]);
  const blockerActions = useMemo(
    () => (file ? resolvePersonnelBlockerActions(file.deployability) : []),
    [file],
  );
  const deployabilityHints = useMemo(() => {
    if (!file) return [];
    return [
      ...file.deployability.warnings.map((issue) => issue.message),
      ...file.deployability.blockers
        .filter((issue) => issue.code !== 'employee_blocked')
        .map((issue) => issue.message),
    ];
  }, [file]);

  const canEdit = can('office.employees.edit');
  const canDelete = can('office.employees.delete');
  const panelCtx = embeddedInModal ? { viewContext: 'form' as const } : {};
  const employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
  }));
  const employmentStatusOptions = useMemo(
    () =>
      (Object.entries(EMPLOYEE_EMPLOYMENT_STATUS_LABELS) as Array<[EmployeeEmploymentStatus, string]>).map(
        ([key, label]) => ({ key, label }),
      ),
    [],
  );

  function syncFormFromFile() {
    if (!file) return;
    const rowHasFirstAid = file.qualifications.some((q) => q.qualificationType === 'first_aid');
    const rowHasDriver = file.qualifications.some((q) => q.qualificationType === 'driving_license');
    setHasFirstAid(rowHasFirstAid);
    setHasDriverLicense(rowHasDriver);
    setHasPoliceClearance(file.backgroundCheck.present || file.backgroundCheck.status === 'verified');
    setPoliceClearanceDate(file.backgroundCheck.issueDate ?? '');
    setPoliceClearanceValidUntil(file.backgroundCheck.followUpDueAt ?? '');
    setContractType(file.employment.contractType ?? '');
    setEmploymentStatus(file.employment.employmentStatus);
    setWeeklyHours(file.employment.weeklyHours != null ? String(file.employment.weeklyHours) : '');
    setEntryDate(file.masterData.entryDate ?? '');
    setWeeklyHoursError(null);
  }

  useEffect(() => {
    syncFormFromFile();
  }, [file]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [employeeId, initialTab]);

  function resolveBlockerTab(tab: string): EmployeePersonnelUiTabKey {
    return resolvePersonnelUiTab(tab);
  }

  async function runAction(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (!tenantId || !employeeId) return;
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    const result = await action();
    setSaving(false);
    if (!result.ok) {
      setActionError(result.error ?? 'Speichern fehlgeschlagen.');
      return;
    }
    setActionSuccess(success);
    await refresh();
    setTimeout(() => setActionSuccess(null), 2500);
  }

  async function handleSaveQualifications() {
    if (!tenantId) return;
    await runAction(
      () =>
        updateEmployeeQualificationFlags(
          tenantId,
          employeeId,
          { hasFirstAidCertificate: hasFirstAid, hasDriverLicense: hasDriverLicense },
          profile?.roleKey,
        ),
      'Qualifikationen gespeichert.',
    );
  }

  function parseWeeklyHours(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function handleSaveEmployment() {
    if (!tenantId) return;

    const trimmedHours = weeklyHours.trim();
    if (trimmedHours) {
      const parsed = parseWeeklyHours(trimmedHours);
      if (parsed == null || parsed < 0 || parsed > 60) {
        setWeeklyHoursError('Wochenstunden zwischen 0 und 60');
        return;
      }
    }
    setWeeklyHoursError(null);

    await runAction(
      () =>
        updateEmployeeEmployment(
          tenantId,
          employeeId,
          {
            contractType: contractType.trim() || null,
            employmentStatus,
            weeklyHours: parseWeeklyHours(weeklyHours),
            entryDate: entryDate.trim() || null,
          },
          profile?.roleKey,
        ),
      'Anstellungsdaten gespeichert.',
    );
  }

  async function handleUploadDocument() {
    if (!tenantId || !canEdit) return;
    setActionError(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const fileName = asset.name ?? 'dokument.pdf';
    const mimeType = asset.mimeType ?? 'application/octet-stream';

    try {
      const response = await fetch(asset.uri);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i] ?? 0);
      }
      const contentBase64 = btoa(binary);

      await runAction(
        () =>
          uploadEmployeePersonnelDocument(
            tenantId,
            employeeId,
            {
              title: fileName,
              fileName,
              mimeType,
              contentBase64,
              sizeBytes: asset.size ?? bytes.length,
            },
            profile?.roleKey,
            profile?.id,
          ),
        'Dokument hochgeladen.',
      );
    } catch {
      setActionError('Datei konnte nicht gelesen werden.');
    }
  }

  async function handleSaveBackgroundCheck() {
    if (!tenantId) return;
    await runAction(
      () =>
        updateEmployeeBackgroundCheck(
          tenantId,
          employeeId,
          {
            hasPoliceClearance,
            policeClearanceDate: policeClearanceDate.trim() || null,
            policeClearanceValidUntil: policeClearanceValidUntil.trim() || null,
          },
          profile?.roleKey,
        ),
      'Führungszeugnis gespeichert.',
    );
  }

  async function handleDeleteDocument(documentId: string) {
    if (!tenantId || !canEdit) return;
    await runAction(
      () =>
        deleteEmployeePersonnelDocument(
          tenantId,
          employeeId,
          documentId,
          profile?.roleKey,
          profile?.id,
        ),
      'Dokument gelöscht.',
    );
  }

  async function handleSaveRoles(patch: {
    roleKey: RoleKey;
    additionalRoleKeys?: RoleKey[];
    homeOfficeEnabled: boolean | null;
    timeTrackingMode?: import('@/lib/office/employeeHomeOfficeService').EmployeeTimeTrackingMode | null;
    desiredPermissions?: import('@/types/permissions').PermissionKey[];
    overrides?: import('@/types/permissions/rbac').EmployeePermissionOverride[];
    dataScopes?: import('@/types/permissions/rbac').EmployeeDataScope[];
    changeReason?: string | null;
  }) {
    if (!tenantId) return;
    await runAction(
      () =>
        updateEmployeeRolesPermissions(
          tenantId,
          employeeId,
          patch,
          profile?.roleKey,
          profile?.id,
        ),
      'Rollen & Rechte gespeichert.',
    );
  }

  function handleEditMasterData() {
    if (onEditMasterData) {
      onEditMasterData();
      return;
    }
    router.push(employeeEditRoute(employeeId) as never);
  }

  function handleOpenOffboarding() {
    if (onOpenOffboarding) {
      onOpenOffboarding();
      return;
    }
    router.push(`/office/employees/${employeeId}/offboarding` as never);
  }

  if (!can('office.employees.view')) {
    return (
      <LockedActionBanner
        message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  if (loading && !file) {
    return <LoadingState message="Personalakte wird geladen…" />;
  }

  if (error && !file) {
    return (
      <View style={styles.root}>
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
        {!embeddedInModal ? (
          <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
        ) : null}
      </View>
    );
  }

  if (!file || !overview) {
    return (
      <EmptyState title="Nicht gefunden" message="Personalakte nicht verfügbar." />
    );
  }

  const body = (
    <>
      {!embedded ? (
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
              displayName={overview.fullName}
              fullWidth={false}
              onDelete={() => {
                if (!tenantId) {
                  return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
                }
                return deleteEmployee(
                  employeeId,
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
      ) : null}

      <View style={styles.badges}>
        <PremiumBadge
          label={labelEmployeeDeployability(overview.deployability)}
          variant={
            overview.deployability === 'assignable'
              ? 'green'
              : overview.deployability === 'warning'
                ? 'orange'
                : 'red'
          }
        />
      </View>

      {deployabilityHints.length > 0 ? (
        <InfoBanner
          variant="info"
          title="Hinweise zur Einsatzfähigkeit"
          message={deployabilityHints.slice(0, 4).join(' · ')}
        />
      ) : null}

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      {actionSuccess ? <SuccessState message={actionSuccess} /> : null}

      {!canEdit ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können die Personalakte einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SegmentedTabs
        tabs={OFFICE_PERSONNEL_UI_TABS}
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key as EmployeePersonnelUiTabKey)}
        layout="wrap"
      />

      {activeTab === 'overview' ? (
        <SectionPanel title="Übersicht">
          <DetailInfoRow label="Rolle" value={overview.roleTitle} />
          <DetailInfoRow label="Status" value={labelEmploymentStatus(overview.employmentStatus)} />
          <DetailInfoRow label="Portal aktiv" value={overview.portalActive ? 'Ja' : 'Nein'} />
          <DetailInfoRow
            label="Einsatzfähigkeit"
            value={labelEmployeeDeployability(overview.deployability)}
          />
          <DetailInfoRow
            label="Zeiterfassung"
            value={describeEmployeeTimeTrackingMode(
              resolveEmployeeTimeTrackingMode(
                file.portalAccess.roleKey,
                getEmployeeHomeOfficeOverride(employeeId),
              ),
            )}
          />
          {overview.openTasks.length > 0 ? (
            <View style={styles.tasksBlock}>
              <Text style={styles.tasksTitle}>Offene Hinweise</Text>
              {overview.openTasks.map((task) => (
                <Text key={task} style={styles.taskItem}>
                  · {task}
                </Text>
              ))}
            </View>
          ) : null}
          {blockerActions.length > 0 && canEdit ? (
            <View style={styles.actionRow}>
              {blockerActions.map((action) => (
                <PremiumButton
                  key={`${action.tab}-${action.label}`}
                  title={action.label}
                  variant="secondary"
                  onPress={() => setActiveTab(resolveBlockerTab(action.tab))}
                />
              ))}
            </View>
          ) : null}
          {overview.nextExpiryDates.slice(0, 3).map((item) => (
            <DetailInfoRow key={`${item.type}-${item.date}`} label={item.label} value={item.date} />
          ))}
        </SectionPanel>
      ) : null}

      {activeTab === 'master_data' && tenantId ? (
        <>
          <SectionPanel title="Organisation">
            <DetailInfoRow label="Personalnummer" value={file.masterData.employeeNumber} />
            <DetailInfoRow label="Vorname" value={file.masterData.firstName} />
            <DetailInfoRow label="Nachname" value={file.masterData.lastName} />
            <DetailInfoRow label="Kostenstelle" value={file.masterData.costCenter} />
            {canEdit ? (
              <PremiumButton title="Stammdaten bearbeiten" variant="secondary" onPress={handleEditMasterData} />
            ) : null}
          </SectionPanel>
          <EmployeePayrollPersonnelPanel
            tab="master_data"
            tenantId={tenantId}
            employeeId={employeeId}
            masterData={file.masterData}
            payroll={file.payrollPersonnel}
            canEdit={canEdit}
            saving={saving}
            actorRoleKey={profile?.roleKey}
            actorProfileId={profile?.id}
            panelCtx={panelCtx}
            onSaved={refresh}
            onError={setActionError}
            onSuccess={setActionSuccess}
            setSaving={setSaving}
          />
        </>
      ) : null}

      {activeTab === 'contact' ? (
        <>
          <SectionPanel title="Kontakt">
            <DetailInfoRow label="E-Mail" value={file.masterData.email} />
            <DetailInfoRow label="Telefon" value={file.masterData.phone} />
            <DetailInfoRow label="Mobil" value={file.masterData.mobile} />
            <DetailInfoRow label="Notfallkontakt" value={file.masterData.emergencyContactName} />
            <DetailInfoRow label="Notfalltelefon" value={file.masterData.emergencyContactPhone} />
            {canEdit ? (
              <PremiumButton title="Kontakt bearbeiten" variant="secondary" onPress={handleEditMasterData} />
            ) : null}
          </SectionPanel>
          <EmployeeMobilityOfficePanel employeeId={employeeId} />
        </>
      ) : null}

      {activeTab === 'employment' && tenantId ? (
        <>
          <SectionPanel {...panelCtx} title="Anstellungsstatus">
            {canEdit ? (
              <View style={styles.formBlock}>
                <Text style={styles.fieldLabel}>Vertragsart</Text>
                <FilterChipGroup
                  options={employmentTypeOptions}
                  value={contractType || employmentTypeOptions[0]?.key || ''}
                  onChange={setContractType}
                />
                <Text style={styles.fieldLabel}>Anstellungsstatus</Text>
                <FilterChipGroup
                  options={employmentStatusOptions}
                  value={employmentStatus}
                  onChange={(value) => setEmploymentStatus(value as EmployeeEmploymentStatus)}
                />
                <PremiumInput
                  label="Wochenstunden"
                  value={weeklyHours}
                  onChangeText={(value) => {
                    setWeeklyHours(value);
                    setWeeklyHoursError(null);
                  }}
                  error={weeklyHoursError ?? undefined}
                  keyboardType="decimal-pad"
                  placeholder="z. B. 20"
                />
                <CareDateInput label="Eintrittsdatum" value={entryDate} onChange={setEntryDate} />
                <PremiumButton title="Anstellung speichern" loading={saving} onPress={handleSaveEmployment} />
              </View>
            ) : (
              <>
                <DetailInfoRow
                  label="Vertragsart"
                  value={resolveEmploymentTypeLabel(file.employment.contractType)}
                />
                <DetailInfoRow
                  label="Anstellungsstatus"
                  value={labelEmploymentStatus(file.employment.employmentStatus)}
                />
                <DetailInfoRow
                  label="Wochenstunden"
                  value={file.employment.weeklyHours?.toString() ?? '—'}
                />
                <DetailInfoRow label="Eintrittsdatum" value={file.masterData.entryDate ?? '—'} />
                <DetailInfoRow label="Einsatzbereich" value={file.employment.deploymentArea ?? '—'} />
              </>
            )}
          </SectionPanel>
          <EmployeePayrollPersonnelPanel
            tab="employment"
            tenantId={tenantId}
            employeeId={employeeId}
            masterData={file.masterData}
            payroll={file.payrollPersonnel}
            canEdit={canEdit}
            saving={saving}
            actorRoleKey={profile?.roleKey}
            actorProfileId={profile?.id}
            panelCtx={panelCtx}
            onSaved={refresh}
            onError={setActionError}
            onSuccess={setActionSuccess}
            setSaving={setSaving}
          />
        </>
      ) : null}

      {activeTab === 'compensation' && tenantId ? (
        <EmployeePayrollPersonnelPanel
          tab="compensation"
          tenantId={tenantId}
          employeeId={employeeId}
          masterData={file.masterData}
          payroll={file.payrollPersonnel}
          canEdit={canEdit}
          saving={saving}
          actorRoleKey={profile?.roleKey}
          actorProfileId={profile?.id}
          panelCtx={panelCtx}
          onSaved={refresh}
          onError={setActionError}
          onSuccess={setActionSuccess}
          setSaving={setSaving}
        />
      ) : null}

      {activeTab === 'tax_social' && tenantId ? (
        <EmployeePayrollPersonnelPanel
          tab="tax_social"
          tenantId={tenantId}
          employeeId={employeeId}
          masterData={file.masterData}
          payroll={file.payrollPersonnel}
          canEdit={canEdit}
          saving={saving}
          actorRoleKey={profile?.roleKey}
          actorProfileId={profile?.id}
          panelCtx={panelCtx}
          onSaved={refresh}
          onError={setActionError}
          onSuccess={setActionSuccess}
          setSaving={setSaving}
        />
      ) : null}

      {activeTab === 'secondary_employment' && tenantId ? (
        <EmployeePayrollPersonnelPanel
          tab="secondary_employment"
          tenantId={tenantId}
          employeeId={employeeId}
          masterData={file.masterData}
          payroll={file.payrollPersonnel}
          canEdit={canEdit}
          saving={saving}
          actorRoleKey={profile?.roleKey}
          actorProfileId={profile?.id}
          panelCtx={panelCtx}
          onSaved={refresh}
          onError={setActionError}
          onSuccess={setActionSuccess}
          setSaving={setSaving}
        />
      ) : null}

      {activeTab === 'roles_permissions' ? (
        <EmployeeRolesPermissionsHub
          tenantId={tenantId ?? ''}
          employeeId={employeeId}
          employeeName={`${file.masterData.firstName} ${file.masterData.lastName}`}
          employmentStatus={labelEmploymentStatus(file.employment.employmentStatus)}
          roleKey={file.portalAccess.roleKey}
          portalActive={file.portalAccess.portalActive}
          lastLoginAt={file.portalAccess.lastLoginAt}
          canEdit={canEdit}
          canManageTenantRoles={can('business.modules.manage') || can('business.tenant.manage')}
          actorProfileId={profile?.id}
          saving={saving}
          panelCtx={panelCtx}
          onSave={async (patch) => {
            await handleSaveRoles(patch);
          }}
        />
      ) : null}

      {activeTab === 'qualifications' ? (
        <SectionPanel {...panelCtx} title="Qualifikationen & Führungszeugnis">
          {file.qualifications.length > 0 ? (
            file.qualifications.map((q) => (
              <DetailInfoRow key={q.id} label={q.title} value={labelQualificationStatus(q.status)} />
            ))
          ) : (
            <EmptyState title="Keine Qualifikationen" message="Noch keine Qualifikationen erfasst." />
          )}
          {canEdit ? (
            <View style={styles.formBlock}>
              <Text style={styles.formHint}>Qualifikationen erfassen</Text>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{QUALIFICATION_TYPE_LABELS.first_aid}</Text>
                <PremiumButton
                  title={hasFirstAid ? 'Erfasst' : 'Erfassen'}
                  size="sm"
                  variant={hasFirstAid ? 'primary' : 'secondary'}
                  onPress={() => setHasFirstAid((v) => !v)}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{QUALIFICATION_TYPE_LABELS.driving_license}</Text>
                <PremiumButton
                  title={hasDriverLicense ? 'Erfasst' : 'Erfassen'}
                  size="sm"
                  variant={hasDriverLicense ? 'primary' : 'secondary'}
                  onPress={() => setHasDriverLicense((v) => !v)}
                />
              </View>
              <PremiumButton
                title="Qualifikationen speichern"
                loading={saving}
                onPress={handleSaveQualifications}
              />
            </View>
          ) : null}
          <Text style={[styles.formHint, { marginTop: spacing.md }]}>Führungszeugnis</Text>
          <DetailInfoRow
            label="Status"
            value={labelBackgroundCheckStatus(file.backgroundCheck.status)}
          />
          <DetailInfoRow label="Ausstellungsdatum" value={file.backgroundCheck.issueDate ?? '—'} />
          {canEdit ? (
            <View style={styles.formBlock}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Führungszeugnis hinterlegt</Text>
                <PremiumButton
                  title={hasPoliceClearance ? 'Ja' : 'Nein'}
                  size="sm"
                  variant={hasPoliceClearance ? 'primary' : 'secondary'}
                  onPress={() => setHasPoliceClearance((v) => !v)}
                />
              </View>
              <PremiumInput
                label="Ausstellungsdatum (JJJJ-MM-TT)"
                value={policeClearanceDate}
                onChangeText={setPoliceClearanceDate}
                placeholder="2026-01-15"
              />
              <PremiumInput
                label="Gültig bis (JJJJ-MM-TT)"
                value={policeClearanceValidUntil}
                onChangeText={setPoliceClearanceValidUntil}
                placeholder="2028-01-15"
              />
              <PremiumButton
                title="Führungszeugnis speichern"
                loading={saving}
                onPress={handleSaveBackgroundCheck}
              />
            </View>
          ) : null}
        </SectionPanel>
      ) : null}

      {activeTab === 'portal' && tenantId ? (
        <EmployeePortalAccessPanel
          tenantId={tenantId}
          employeeId={employeeId}
          firstName={file.masterData.firstName}
          lastName={file.masterData.lastName}
          portalActive={file.portalAccess.portalActive}
          lastLoginAt={file.portalAccess.lastLoginAt}
          isReadOnly={!canEdit}
          onAccessChanged={() => void refresh()}
        />
      ) : null}

      {activeTab === 'documents' ? (
        <SectionPanel {...panelCtx} title="Dokumente">
          {file.documents.length === 0 ? (
            <EmptyState title="Keine Dokumente" message="Noch keine Personalakten-Dokumente hinterlegt." />
          ) : (
            file.documents.map((doc) => (
              <View key={doc.id} style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <DetailInfoRow label={doc.title} value={doc.fileName} />
                </View>
                {canEdit ? (
                  <PremiumButton
                    title="Löschen"
                    size="sm"
                    variant="secondary"
                    loading={saving}
                    onPress={() => void handleDeleteDocument(doc.id)}
                  />
                ) : null}
              </View>
            ))
          )}
          {canEdit ? (
            <PremiumButton
              title="Dokument hochladen"
              variant="secondary"
              loading={saving}
              onPress={handleUploadDocument}
            />
          ) : null}
        </SectionPanel>
      ) : null}

      {activeTab === 'deployability' ? (
        <SectionPanel title="Einsatzfähigkeit" subtitle="Hinweise — keine harte Sperre">
          <DetailInfoRow
            label="Status"
            value={labelEmployeeDeployability(file.deployability.result)}
          />
          <DetailInfoRow label="Portal" value={file.deployability.portalOk ? 'OK' : 'Hinweis'} />
          <DetailInfoRow
            label="Qualifikationen"
            value={file.deployability.qualificationOk ? 'OK' : 'Hinweis'}
          />
          <DetailInfoRow
            label="Führungszeugnis"
            value={file.deployability.backgroundCheckOk ? 'OK' : 'Hinweis'}
          />
          {deployabilityHints.length > 0 ? (
            <InfoBanner
              variant="info"
              title="Offene Hinweise"
              message={deployabilityHints.join(' · ')}
            />
          ) : (
            <EmptyState title="Keine Hinweise" message="Alle Prüfpunkte ohne offene Hinweise." />
          )}
          {blockerActions.length > 0 && canEdit ? (
            <View style={styles.actionRow}>
              {blockerActions.map((action) => (
                <PremiumButton
                  key={`deploy-${action.tab}-${action.label}`}
                  title={action.label}
                  variant="secondary"
                  onPress={() => setActiveTab(resolveBlockerTab(action.tab))}
                />
              ))}
            </View>
          ) : null}
        </SectionPanel>
      ) : null}

      {activeTab === 'work_materials' ? (
        <SectionPanel title="Arbeitsmaterial">
          {file.workMaterials.length === 0 ? (
            <EmptyState title="Kein Arbeitsmaterial" message="Noch keine Ausgaben erfasst." />
          ) : (
            file.workMaterials.map((item) => (
              <DetailInfoRow
                key={item.id}
                label={item.itemName}
                value={WORK_MATERIAL_STATUS_LABELS[item.status]}
              />
            ))
          )}
          {equipmentQuery.data ? (
            <>
              <DetailInfoRow
                label="Aktive Inventar-Ausgaben"
                value={String(equipmentQuery.data.activeAssignments)}
              />
              <DetailInfoRow
                label="Überfällige Rückgaben"
                value={String(equipmentQuery.data.overdueReturns)}
              />
            </>
          ) : null}
          {can('inventory.view') ? (
            <PremiumButton
              title="Inventar öffnen"
              variant="secondary"
              onPress={() => router.push('/business/office/inventory' as never)}
            />
          ) : null}
          <InfoBanner title="Inventar" message={INVENTORY_PREPARED_MESSAGE} />
        </SectionPanel>
      ) : null}

      {activeTab === 'audit' ? (
        <SectionPanel title="Verlauf">
          {file.auditEvents.length === 0 ? (
            <EmptyState title="Kein Verlauf" message="Noch keine Änderungen protokolliert." />
          ) : (
            <Timeline
              items={file.auditEvents.map((event) => ({
                id: event.id,
                icon: '📋',
                title: event.summary,
                subtitle: event.action,
                timestamp: event.createdAt,
                status: 'aktiv' as const,
                type: 'care' as const,
              }))}
            />
          )}
        </SectionPanel>
      ) : null}

      {(canEdit || canDelete) && !embedded ? (
        <SectionPanel title="Gefahrenzone" subtitle="Irreversible Aktionen">
          {canEdit ? (
            <PremiumButton title="Offboarding starten" variant="secondary" onPress={handleOpenOffboarding} />
          ) : null}
        </SectionPanel>
      ) : null}
    </>
  );

  if (embedded) {
    return <View style={styles.root}>{body}</View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {body}
    </ScrollView>
  );
}
