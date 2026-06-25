import { useEffect, useMemo, useState } from 'react';

import { StyleSheet, Text, View } from 'react-native';

import { DetailInfoRow } from '@/components/detail';

import {

  FilterChip,

  FilterChipGroup,

  InfoBanner,

  PremiumButton,

  PremiumInput,

  SectionPanel,

  SegmentedTabs,

} from '@/components/ui';

import { RbacCriticalReasonField, RbacModulePermissionEditor } from '@/components/office/rbac/RbacModulePermissionEditor';

import { RbacSpecialPermissionsPanel } from '@/components/office/rbac/RbacSpecialPermissionsPanel';

import { RbacTenantRolesPanel } from '@/components/office/rbac/RbacTenantRolesPanel';

import { ROLE_LABELS } from '@/data/constants/roleLabels';

import {

  describeEmployeeTimeTrackingMode,

  EMPLOYEE_ASSIGNABLE_ROLE_KEYS,

  EMPLOYEE_TIME_TRACKING_MODE_OPTIONS,

  getEmployeeHomeOfficeOverride,

  getEmployeeTimeTrackingModeOverride,

  resolveEmployeeTimeTrackingModeWithOverride,

  roleQualifiesForHomeOfficeSetting,

  type EmployeeTimeTrackingMode,

} from '@/lib/office/employeeHomeOfficeService';

import { fetchPermissionCatalog } from '@/lib/permissions/permissionCatalogService';

import {

  buildPermissionMatrix,

  RBAC_TAB_MODULE_PREFIXES,

  RBAC_TAB_PRODUCT_KEYS,

} from '@/lib/permissions/permissionMatrixBuilder';

import {

  fetchEmployeeDataScopes,

  fetchEmployeePermissionOverrides,

  listPermissionAuditLogForEmployee,

  resolveEffectivePermissionsSync,

  resolveRoleBasePermissionsSync,

} from '@/lib/permissions/rbacService';

import { getTenantModules } from '@/lib/modules/moduleAccessService';

import type { PermissionKey, RoleKey } from '@/types';

import type {

  EmployeeDataScope,

  EmployeePermissionOverride,

  PermissionCatalogEntry,

  RbacHubTabKey,

} from '@/types/permissions/rbac';

import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';

import { spacing } from '@/theme';



const HUB_TABS: Array<{ key: RbacHubTabKey; label: string }> = [

  { key: 'overview', label: 'Übersicht' },

  { key: 'system_role', label: 'Systemrolle' },

  { key: 'module', label: 'Module' },

  { key: 'verwaltung', label: 'Verwaltung' },

  { key: 'assist', label: 'Assist' },

  { key: 'pflege', label: 'Pflege' },

  { key: 'beratung', label: 'Beratung' },

  { key: 'stationaer', label: 'Stationär' },

  { key: 'akademie', label: 'Akademie' },

  { key: 'office', label: 'Office' },

  { key: 'billing', label: 'Abrechnung' },

  { key: 'personal', label: 'Personal' },

  { key: 'documents', label: 'Dokumente' },

  { key: 'messages', label: 'Nachrichten' },

  { key: 'time', label: 'Zeiterfassung' },

  { key: 'tracking', label: 'Tracking' },

  { key: 'integrations', label: 'Integrationen' },

  { key: 'privacy_audit', label: 'Datenschutz & Audit' },

  { key: 'special', label: 'Sonderrechte' },

  { key: 'preview', label: 'Rechte-Vorschau' },

];



const RISK_FILTER_OPTIONS = [

  { key: '', label: 'Alle Risiken' },

  { key: 'low', label: 'Niedrig' },

  { key: 'medium', label: 'Mittel' },

  { key: 'high', label: 'Hoch' },

  { key: 'critical', label: 'Kritisch' },

];



const MODULE_TAB_KEYS = new Set<RbacHubTabKey>([

  'verwaltung',

  'assist',

  'pflege',

  'beratung',

  'stationaer',

  'akademie',

  'office',

  'billing',

  'personal',

  'documents',

  'messages',

  'time',

  'tracking',

  'integrations',

  'privacy_audit',

]);



export type EmployeeRolesPermissionsSavePatch = {

  roleKey: RoleKey;

  additionalRoleKeys: RoleKey[];

  homeOfficeEnabled: boolean | null;

  timeTrackingMode: EmployeeTimeTrackingMode | null;

  desiredPermissions?: PermissionKey[];

  overrides?: EmployeePermissionOverride[];

  dataScopes?: EmployeeDataScope[];

  changeReason?: string | null;

};



type EmployeeRolesPermissionsHubProps = {

  tenantId: string;

  employeeId: string;

  employeeName: string;

  employmentStatus: string;

  roleKey: RoleKey | null;

  portalActive: boolean;

  lastLoginAt: string | null;

  canEdit: boolean;

  canManageTenantRoles?: boolean;

  actorProfileId?: string | null;

  saving: boolean;

  panelCtx?: { viewContext?: 'form' };

  onSave: (patch: EmployeeRolesPermissionsSavePatch) => Promise<void>;

};



export function EmployeeRolesPermissionsHub({

  tenantId,

  employeeId,

  employeeName,

  employmentStatus,

  roleKey,

  portalActive,

  lastLoginAt,

  canEdit,

  canManageTenantRoles = false,

  actorProfileId,

  saving,

  panelCtx = {},

  onSave,

}: EmployeeRolesPermissionsHubProps) {

  const content = useAdaptiveContentStyles();

  const initialRole = roleKey ?? 'employee_portal';

  const [activeTab, setActiveTab] = useState<RbacHubTabKey>('overview');

  const [search, setSearch] = useState('');

  const [riskFilter, setRiskFilter] = useState('');

  const [selectedRoles, setSelectedRoles] = useState<RoleKey[]>([initialRole]);

  const [primaryRole, setPrimaryRole] = useState<RoleKey>(initialRole);

  const [timeMode, setTimeMode] = useState<EmployeeTimeTrackingMode>(

    resolveEmployeeTimeTrackingModeWithOverride(

      initialRole,

      getEmployeeHomeOfficeOverride(employeeId, tenantId),

      getEmployeeTimeTrackingModeOverride(employeeId, tenantId),

    ),

  );

  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);

  const [desiredPermissions, setDesiredPermissions] = useState<PermissionKey[]>([]);

  const [draftOverrides, setDraftOverrides] = useState<EmployeePermissionOverride[]>([]);

  const [draftScopes, setDraftScopes] = useState<EmployeeDataScope[]>([]);

  const [changeReason, setChangeReason] = useState('');

  const [initialEffectivePermissions, setInitialEffectivePermissions] = useState<PermissionKey[]>([]);

  const [rbacLoaded, setRbacLoaded] = useState(false);



  useEffect(() => {

    fetchPermissionCatalog().then((result) => {

      if (result.ok) setCatalog(result.data);

    });

  }, []);



  useEffect(() => {

    void fetchEmployeePermissionOverrides(tenantId, employeeId).then((result) => {

      if (result.ok) {

        setDraftOverrides(result.data.map((item) => ({ ...item, tenantId, employeeId })));

      }

    });

    void fetchEmployeeDataScopes(tenantId, employeeId).then((result) => {

      if (result.ok) {

        setDraftScopes(result.data.map((item) => ({ ...item, tenantId, employeeId })));

      }

      setRbacLoaded(true);

    });

  }, [tenantId, employeeId]);



  const tenantModules = getTenantModules(tenantId);

  const enabledProductKeys = new Set(

    tenantModules.filter((m) => m.isActive).map((m) => m.productKey),

  );



  const visibleTabs = HUB_TABS.filter((tab) => {

    const productKey = RBAC_TAB_PRODUCT_KEYS[tab.key];

    if (productKey && !enabledProductKeys.has(productKey as never)) return false;

    return true;

  });



  const effective = useMemo(

    () =>

      resolveEffectivePermissionsSync(

        tenantId,

        employeeId,

        primaryRole,

        selectedRoles.filter((r) => r !== primaryRole),

      ),

    [tenantId, employeeId, primaryRole, selectedRoles, draftOverrides.length, draftScopes.length, rbacLoaded],

  );



  const roleBasePermissions = useMemo(

    () =>

      resolveRoleBasePermissionsSync(

        tenantId,

        employeeId,

        primaryRole,

        selectedRoles.filter((r) => r !== primaryRole),

      ),

    [tenantId, employeeId, primaryRole, selectedRoles],

  );



  useEffect(() => {

    if (!rbacLoaded) return;

    setDesiredPermissions(effective.permissions);

    setInitialEffectivePermissions(effective.permissions);

  }, [rbacLoaded, effective.permissions.join('|'), primaryRole, selectedRoles.join('|')]);



  const hasSpecialRights = draftOverrides.length > 0 || draftScopes.length > 0;

  const auditEntries = listPermissionAuditLogForEmployee(tenantId, employeeId);

  const lastPermissionChange = auditEntries.at(-1)?.createdAt ?? null;



  const roleOptions = useMemo(

    () =>

      EMPLOYEE_ASSIGNABLE_ROLE_KEYS.map((key) => ({

        key,

        label: ROLE_LABELS[key],

      })),

    [],

  );



  const previewMatrix = buildPermissionMatrix(desiredPermissions, catalog);



  const styles = useMemo(

    () =>

      StyleSheet.create({

        headerBlock: { gap: spacing.xs, marginBottom: spacing.sm },

        headerTitle: { ...content.subheading, color: content.primary.color },

        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },

        formBlock: { marginTop: spacing.sm, gap: spacing.sm },

        fieldLabel: { ...content.caption, marginBottom: spacing.xs },

        tabScroll: { marginBottom: spacing.sm },

      }),

    [content],

  );



  function toggleRole(role: string) {

    const key = role as RoleKey;

    if (selectedRoles.includes(key)) {

      const next = selectedRoles.filter((r) => r !== key);

      setSelectedRoles(next.length ? next : [primaryRole]);

      if (key === primaryRole && next.length) setPrimaryRole(next[0]);

      return;

    }

    setSelectedRoles([...selectedRoles, key]);

  }



  function setAsPrimary(role: string) {

    const key = role as RoleKey;

    setPrimaryRole(key);

    if (!selectedRoles.includes(key)) setSelectedRoles([...selectedRoles, key]);

  }



  async function handleSave() {

    const homeOfficeManual = getEmployeeHomeOfficeOverride(employeeId, tenantId) !== null;

    const derivedMode = resolveEmployeeTimeTrackingModeWithOverride(

      primaryRole,

      homeOfficeManual ? timeMode === 'homeoffice' || timeMode === 'hybrid' : null,

      timeMode,

    );

    const homeOfficeEnabled =

      derivedMode === 'homeoffice' || derivedMode === 'hybrid' ? true : derivedMode === 'field' ? false : null;



    await onSave({

      roleKey: primaryRole,

      additionalRoleKeys: selectedRoles,

      homeOfficeEnabled,

      timeTrackingMode: timeMode,

      desiredPermissions,

      overrides: draftOverrides,

      dataScopes: draftScopes,

      changeReason: changeReason.trim() || null,

    });

  }



  const isModuleTab = MODULE_TAB_KEYS.has(activeTab);



  return (

    <SectionPanel {...panelCtx} title="Rollen & Rechte">

      <View style={styles.headerBlock}>

        <Text style={styles.headerTitle}>{employeeName}</Text>

        <DetailInfoRow label="Mandant" value={tenantId.slice(0, 8) + '…'} />

        <DetailInfoRow label="Status" value={employmentStatus} />

        <DetailInfoRow label="Hauptrolle" value={ROLE_LABELS[primaryRole]} />

        <DetailInfoRow

          label="Zusatzrollen"

          value={

            selectedRoles.filter((r) => r !== primaryRole).map((r) => ROLE_LABELS[r]).join(', ') || '—'

          }

        />

        <DetailInfoRow

          label="Module"

          value={tenantModules

            .filter((m) => m.isActive)

            .map((m) => m.productKey)

            .join(', ') || 'Office'}

        />

        <DetailInfoRow

          label="Zeiterfassungsmodus"

          value={describeEmployeeTimeTrackingMode(timeMode)}

        />

        <DetailInfoRow label="Portal aktiv" value={portalActive ? 'Ja' : 'Nein'} />

        <DetailInfoRow label="Letzter Login" value={lastLoginAt ?? '—'} />

        <DetailInfoRow label="Letzte Rechteänderung" value={lastPermissionChange ?? '—'} />

        {hasSpecialRights ? (

          <InfoBanner

            variant="warning"

            title="Sonderrechte aktiv"

            message="Individuelle Berechtigungs-Overrides oder Daten-Scopes sind hinterlegt."

          />

        ) : null}

      </View>



      <View style={styles.tabScroll}>

        <SegmentedTabs

          tabs={visibleTabs}

          activeKey={activeTab}

          onSelect={(key) => setActiveTab(key as RbacHubTabKey)}

          layout="wrap"

          rows={3}

        />

      </View>



      {activeTab === 'overview' ? (

        <View>

          <DetailInfoRow label="Effektive Rechte" value={`${desiredPermissions.length} Berechtigungen`} />

          <DetailInfoRow label="Rollen-Basis" value={`${roleBasePermissions.length} Berechtigungen`} />

          <DetailInfoRow label="Rollen (Union)" value={effective.roleKeys.map((r) => ROLE_LABELS[r]).join(', ')} />

          <InfoBanner

            variant="info"

            title="Mehrfachrollen"

            message="Bei mehreren Rollen werden alle Berechtigungen zusammengelegt (Union). Sonderrechte können einzelne Rechte ergänzen oder entziehen."

          />

        </View>

      ) : null}



      {activeTab === 'system_role' ? (

        <View style={styles.formBlock}>

          {canEdit ? (

            <>

              <Text style={styles.fieldLabel}>Rollen (Mehrfachauswahl)</Text>

              <View style={styles.chipRow}>

                {roleOptions.map((opt) => (

                  <FilterChip

                    key={opt.key}

                    label={opt.label}

                    selected={selectedRoles.includes(opt.key as RoleKey)}

                    onPress={() => toggleRole(opt.key)}

                  />

                ))}

              </View>

              <Text style={styles.fieldLabel}>Hauptrolle (Systemrolle)</Text>

              <FilterChipGroup

                options={roleOptions.filter((o) => selectedRoles.includes(o.key as RoleKey))}

                value={primaryRole}

                onChange={(key) => setAsPrimary(key)}

              />

              <Text style={styles.fieldLabel}>Zeiterfassungsmodus</Text>

              <FilterChipGroup

                options={EMPLOYEE_TIME_TRACKING_MODE_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}

                value={timeMode}

                onChange={(key) => setTimeMode(key as EmployeeTimeTrackingMode)}

              />

              {roleQualifiesForHomeOfficeSetting(primaryRole) ? (

                <InfoBanner

                  variant="info"

                  title="Homeoffice"

                  message="Homeoffice- und Hybrid-Modi aktivieren die Büro-/Homeoffice-Zeiterfassung."

                />

              ) : null}

            </>

          ) : null}

          <RbacTenantRolesPanel

            tenantId={tenantId}

            canManage={canManageTenantRoles}

            actorRoleKey={primaryRole}

            actorProfileId={actorProfileId}

          />

        </View>

      ) : null}



      {activeTab === 'module' ? (

        <View>

          {tenantModules

            .filter((m) => m.isActive)

            .map((m) => (

              <DetailInfoRow key={m.productKey} label={m.productKey} value="Freigeschaltet" />

            ))}

        </View>

      ) : null}



      {activeTab === 'preview' ? (

        <View>

          <InfoBanner

            variant="info"

            title="Union aus Rollen + Sonderrechten"

            message={`${roleBasePermissions.length} aus Rollen, ${desiredPermissions.length} effektiv.`}

          />

          {previewMatrix.slice(0, 40).map((row) => (

            <DetailInfoRow

              key={row.area}

              label={row.areaLabel}

              value={[

                row.read ? 'L' : '',

                row.create ? 'E' : '',

                row.edit ? 'B' : '',

                row.delete ? 'X' : '',

                row.approve ? 'F' : '',

                row.export ? 'Ex' : '',

              ].filter(Boolean).join(' · ') || '—'}

            />

          ))}

        </View>

      ) : null}



      {activeTab === 'special' ? (

        <RbacSpecialPermissionsPanel

          tenantId={tenantId}

          employeeId={employeeId}

          catalog={catalog}

          overrides={draftOverrides}

          dataScopes={draftScopes}

          effectivePermissionCount={desiredPermissions.length}

          rolePermissionCount={roleBasePermissions.length}

          canEdit={canEdit}

          onOverridesChange={setDraftOverrides}

          onDataScopesChange={setDraftScopes}

        />

      ) : null}



      {isModuleTab ? (

        <View style={styles.formBlock}>

          <PremiumInput

            label="Suche"

            value={search}

            onChangeText={setSearch}

            placeholder="Bereich oder Recht filtern…"

          />

          <FilterChipGroup

            options={RISK_FILTER_OPTIONS}

            value={riskFilter}

            onChange={setRiskFilter}

          />

          <RbacModulePermissionEditor

            tabKey={activeTab}

            catalog={catalog}

            desiredPermissions={desiredPermissions}

            onChange={setDesiredPermissions}

            canEdit={canEdit}

            search={search}

            riskFilter={riskFilter || null}

          />

        </View>

      ) : null}



      {canEdit ? (

        <View style={styles.formBlock}>

          <RbacCriticalReasonField

            catalog={catalog}

            before={initialEffectivePermissions}

            after={desiredPermissions}

            value={changeReason}

            onChange={setChangeReason}

          />

          <PremiumButton

            title="Rollen & Rechte speichern"

            loading={saving}

            onPress={handleSave}

          />

        </View>

      ) : null}

    </SectionPanel>

  );

}


