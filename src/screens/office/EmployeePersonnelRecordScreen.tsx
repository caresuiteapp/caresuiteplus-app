import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SegmentedTabs,
  SuccessState,
} from '@/components/ui';
import { useEmployeePersonnelFile } from '@/hooks/useEmployeePersonnelFile';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { deleteEmployee } from '@/lib/office/employeeDeleteService';
import {
  buildEmployeePersonnelOverview,
} from '@/lib/office/employeePersonnelFileService';
import {
  EMPLOYEE_PERSONNEL_TAB_LABELS,
  QUALIFICATION_TYPE_LABELS,
} from '@/lib/office/employeePersonnelFieldRules';
import {
  employeeEditRoute,
  labelBackgroundCheckStatus,
  labelEmployeeDeployability,
  labelEmploymentStatus,
  labelQualificationStatus,
  resolvePersonnelBlockerActions,
} from '@/lib/office/employeePersonnelLabels';
import {
  updateEmployeeBackgroundCheck,
  updateEmployeeQualificationFlags,
  uploadEmployeePersonnelDocument,
} from '@/lib/office/employeePersonnelUpdateService';
import type { EmployeePersonnelTabKey } from '@/types/modules/employeePersonnelFile';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing } from '@/theme';

export function EmployeePersonnelRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const content = useAdaptiveContentStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        error: content.error,
      }),
    [content],
  );
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const { file, loading, error, refresh } = useEmployeePersonnelFile(id);
  const [activeTab, setActiveTab] = useState<EmployeePersonnelTabKey>('overview');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [hasFirstAid, setHasFirstAid] = useState(false);
  const [hasDriverLicense, setHasDriverLicense] = useState(false);
  const [hasPoliceClearance, setHasPoliceClearance] = useState(false);
  const [policeClearanceDate, setPoliceClearanceDate] = useState('');
  const [policeClearanceValidUntil, setPoliceClearanceValidUntil] = useState('');

  const overview = useMemo(() => (file ? buildEmployeePersonnelOverview(file) : null), [file]);
  const tabs = useMemo(
    () =>
      (file?.tabs ?? ['overview']).map((key) => ({
        key,
        label: EMPLOYEE_PERSONNEL_TAB_LABELS[key],
      })),
    [file?.tabs],
  );
  const blockerActions = useMemo(
    () => (file ? resolvePersonnelBlockerActions(file.deployability) : []),
    [file],
  );

  const canEdit = can('office.employees.edit');
  const canDelete = can('office.employees.delete');

  function syncFormFromFile() {
    if (!file) return;
    const rowHasFirstAid = file.qualifications.some((q) => q.qualificationType === 'first_aid');
    const rowHasDriver = file.qualifications.some((q) => q.qualificationType === 'driving_license');
    setHasFirstAid(rowHasFirstAid);
    setHasDriverLicense(rowHasDriver);
    setHasPoliceClearance(file.backgroundCheck.present || file.backgroundCheck.status === 'verified');
    setPoliceClearanceDate(file.backgroundCheck.issueDate ?? '');
    setPoliceClearanceValidUntil(file.backgroundCheck.followUpDueAt ?? '');
  }

  useEffect(() => {
    syncFormFromFile();
  }, [file]);

  async function runAction(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (!tenantId || !id) return;
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
    if (!tenantId || !id) return;
    await runAction(
      () =>
        updateEmployeeQualificationFlags(
          tenantId,
          id,
          {
            hasFirstAidCertificate: hasFirstAid,
            hasDriverLicense: hasDriverLicense,
          },
          profile?.roleKey,
        ),
      'Qualifikationen gespeichert.',
    );
  }

  async function handleSaveBackgroundCheck() {
    if (!tenantId || !id) return;
    await runAction(
      () =>
        updateEmployeeBackgroundCheck(
          tenantId,
          id,
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

  async function handleUploadDocument() {
    if (!tenantId || !id || !canEdit) return;
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
            id,
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

  if (!can('office.employees.view')) {
    return (
      <ScreenShell title="Personalakte" subtitle="Kein Zugriff">
        <LockedActionBanner
          message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && !file) {
    return (
      <ScreenShell title="Personalakte" subtitle="Wird geladen…">
        <LoadingState message="Personalakte wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !file) {
    return (
      <ScreenShell title="Personalakte" subtitle="Fehler">
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!file || !overview || !id) {
    return (
      <ScreenShell title="Personalakte" subtitle="Nicht gefunden">
        <EmptyState title="Nicht gefunden" message="Personalakte nicht verfügbar." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={overview.fullName}
      subtitle="Personalakte · Mehr → Personal → Mitarbeitende"
      rightSlot={
        canEdit || canDelete ? (
          <View style={styles.headerActions}>
            {canEdit ? (
              <PremiumButton
                title="Stammdaten bearbeiten"
                size="sm"
                variant="secondary"
                onPress={() => router.push(employeeEditRoute(id) as never)}
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
        ) : (
          <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
        )
      }
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
          <PremiumBadge
            label={labelBackgroundCheckStatus(overview.backgroundCheckStatus)}
            variant="muted"
          />
          <PremiumBadge
            label={labelQualificationStatus(overview.qualificationStatus)}
            variant="muted"
          />
        </View>

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
          tabs={tabs}
          activeKey={activeTab}
          onSelect={(key) => setActiveTab(key as EmployeePersonnelTabKey)}
        />

        {activeTab === 'overview' ? (
          <SectionPanel title="Übersicht">
            <DetailInfoRow label="Rolle" value={overview.roleTitle} />
            <DetailInfoRow
              label="Status"
              value={labelEmploymentStatus(overview.employmentStatus)}
            />
            <DetailInfoRow label="Portal aktiv" value={overview.portalActive ? 'Ja' : 'Nein'} />
            <DetailInfoRow
              label="Einsatzfähigkeit"
              value={labelEmployeeDeployability(overview.deployability)}
            />
            {overview.openTasks.length > 0 ? (
              <View style={styles.tasksBlock}>
                <Text style={styles.tasksTitle}>Offene Aufgaben</Text>
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
                    onPress={() => setActiveTab(action.tab)}
                  />
                ))}
              </View>
            ) : null}
            {overview.nextExpiryDates.slice(0, 3).map((item) => (
              <DetailInfoRow key={`${item.type}-${item.date}`} label={item.label} value={item.date} />
            ))}
          </SectionPanel>
        ) : null}

        {activeTab === 'master_data' ? (
          <SectionPanel title="Stammdaten">
            <DetailInfoRow label="Personalnummer" value={file.masterData.employeeNumber} />
            <DetailInfoRow label="E-Mail" value={file.masterData.email} />
            <DetailInfoRow label="Telefon" value={file.masterData.phone} />
            <DetailInfoRow label="Kostenstelle" value={file.masterData.costCenter} />
            {canEdit ? (
              <PremiumButton
                title="Stammdaten bearbeiten"
                variant="secondary"
                onPress={() => router.push(employeeEditRoute(id) as never)}
              />
            ) : null}
          </SectionPanel>
        ) : null}

        {activeTab === 'qualifications' ? (
          <SectionPanel title="Qualifikationen">
            {file.qualifications.length === 0 ? (
              <EmptyState title="Keine Qualifikationen" message="Noch keine Qualifikationen hinterlegt." />
            ) : (
              file.qualifications.map((q) => (
                <DetailInfoRow
                  key={q.id}
                  label={q.title}
                  value={labelQualificationStatus(q.status)}
                />
              ))
            )}
            {canEdit ? (
              <View style={styles.formBlock}>
                <Text style={styles.formHint}>Qualifikationen erfassen oder aktualisieren</Text>
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
          </SectionPanel>
        ) : null}

        {activeTab === 'employment' ? (
          <SectionPanel title="Anstellung">
            <DetailInfoRow label="Vertragsart" value={file.employment.contractType ?? '—'} />
            <DetailInfoRow
              label="Anstellungsstatus"
              value={labelEmploymentStatus(file.employment.employmentStatus)}
            />
            <DetailInfoRow label="Wochenstunden" value={file.employment.weeklyHours?.toString() ?? '—'} />
            <DetailInfoRow label="Eintrittsdatum" value={file.masterData.entryDate ?? '—'} />
            {canEdit ? (
              <PremiumButton
                title="Stammdaten bearbeiten"
                variant="secondary"
                onPress={() => router.push(employeeEditRoute(id) as never)}
              />
            ) : null}
          </SectionPanel>
        ) : null}

        {activeTab === 'documents' ? (
          <SectionPanel title="Dokumente">
            {file.documents.length === 0 ? (
              <EmptyState title="Keine Dokumente" message="Noch keine Personalakten-Dokumente hinterlegt." />
            ) : (
              file.documents.map((doc) => (
                <DetailInfoRow key={doc.id} label={doc.title} value={doc.fileName} />
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

        {activeTab === 'background_check' ? (
          <SectionPanel title="Führungszeugnis">
            <DetailInfoRow
              label="Status"
              value={labelBackgroundCheckStatus(file.backgroundCheck.status)}
            />
            <DetailInfoRow label="Ausstellungsdatum" value={file.backgroundCheck.issueDate ?? '—'} />
            {!file.backgroundCheck.documentId ? (
              <Text style={styles.hint}>Dokument nur für autorisierte Admin-Rollen sichtbar.</Text>
            ) : null}
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

        {activeTab === 'roles_permissions' ? (
          <SectionPanel title="Rollen & Rechte">
            <DetailInfoRow label="Portal aktiv" value={file.portalAccess.portalActive ? 'Ja' : 'Nein'} />
            <DetailInfoRow label="Rolle" value={file.portalAccess.roleKey ?? '—'} />
            <DetailInfoRow label="Letzter Login" value={file.portalAccess.lastLoginAt ?? '—'} />
          </SectionPanel>
        ) : null}

        {activeTab === 'personnel_file' ? (
          <SectionPanel title="Personalakte">
            <DetailInfoRow label="Mitarbeitende:r" value={overview.fullName} />
            <DetailInfoRow label="Personalnummer" value={file.masterData.employeeNumber ?? '—'} />
            <DetailInfoRow
              label="Einsatzfähigkeit"
              value={labelEmployeeDeployability(overview.deployability)}
            />
          </SectionPanel>
        ) : null}

        {activeTab === 'deployability' ? (
          <SectionPanel title="Einsatzfähigkeit">
            <DetailInfoRow
              label="Ergebnis"
              value={labelEmployeeDeployability(file.deployability.result)}
            />
            {file.deployability.blockers.map((issue) => (
              <DetailInfoRow key={issue.code} label="Blocker" value={issue.message} />
            ))}
            {file.deployability.warnings.map((issue) => (
              <DetailInfoRow key={issue.code} label="Hinweis" value={issue.message} />
            ))}
          </SectionPanel>
        ) : null}

        {activeTab === 'work_materials' ? (
          <SectionPanel title="Arbeitsmaterial">
            {file.workMaterials.length === 0 ? (
              <EmptyState title="Kein Material" message="Noch keine Arbeitsmaterialien hinterlegt." />
            ) : (
              file.workMaterials.map((item) => (
                <DetailInfoRow key={item.id} label={item.itemName} value={item.status} />
              ))
            )}
          </SectionPanel>
        ) : null}

        {activeTab === 'audit' ? (
          <SectionPanel title="Verlauf">
            {file.auditEvents.length === 0 ? (
              <EmptyState title="Keine Einträge" message="Noch keine Audit-Ereignisse." />
            ) : (
              file.auditEvents.map((event) => (
                <DetailInfoRow key={event.id} label={event.action} value={event.summary} />
              ))
            )}
          </SectionPanel>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}
