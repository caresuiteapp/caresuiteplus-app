import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
  SegmentedTabs,
} from '@/components/ui';
import { useEmployeePersonnelFile } from '@/hooks/useEmployeePersonnelFile';
import { usePermissions } from '@/hooks/usePermissions';
import {
  buildEmployeePersonnelOverview,
} from '@/lib/office/employeePersonnelFileService';
import {
  EMPLOYEE_PERSONNEL_TAB_LABELS,
} from '@/lib/office/employeePersonnelFieldRules';
import type { EmployeePersonnelTabKey } from '@/types/modules/employeePersonnelFile';
import { spacing } from '@/theme';

export function EmployeePersonnelRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { file, loading, error, refresh } = useEmployeePersonnelFile(id);
  const [activeTab, setActiveTab] = useState<EmployeePersonnelTabKey>('overview');

  const overview = useMemo(() => (file ? buildEmployeePersonnelOverview(file) : null), [file]);
  const tabs = useMemo(
    () =>
      (file?.tabs ?? ['overview']).map((key) => ({
        key,
        label: EMPLOYEE_PERSONNEL_TAB_LABELS[key],
      })),
    [file?.tabs],
  );

  if (!can('office.employees.view')) {
    return (
      <CareLightPageShell title="Personalakte" subtitle="Kein Zugriff">
        <LockedActionBanner
          message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (loading && !file) {
    return (
      <CareLightPageShell title="Personalakte" subtitle="Wird geladen…">
        <LoadingState message="Personalakte wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !file) {
    return (
      <CareLightPageShell title="Personalakte" subtitle="Fehler">
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  if (!file || !overview) {
    return (
      <CareLightPageShell title="Personalakte" subtitle="Nicht gefunden">
        <EmptyState title="Nicht gefunden" message="Personalakte nicht verfügbar." />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title={overview.fullName}
      subtitle="Personalakte · Mehr → Personal → Mitarbeitende"
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.badges}>
          <PremiumBadge label={overview.deployability} variant={overview.deployability === 'assignable' ? 'green' : overview.deployability === 'warning' ? 'orange' : 'red'} />
          <PremiumBadge label={overview.backgroundCheckStatus} variant="muted" />
          <PremiumBadge label={String(overview.qualificationStatus)} variant="muted" />
        </View>

        <SegmentedTabs
          tabs={tabs}
          activeKey={activeTab}
          onSelect={(key) => setActiveTab(key as EmployeePersonnelTabKey)}
        />

        {activeTab === 'overview' ? (
          <SectionPanel title="Übersicht">
            <DetailInfoRow label="Rolle" value={overview.roleTitle} />
            <DetailInfoRow label="Status" value={overview.employmentStatus} />
            <DetailInfoRow label="Portal aktiv" value={overview.portalActive ? 'Ja' : 'Nein'} />
            <DetailInfoRow label="Einsatzfähigkeit" value={overview.deployability} />
            {overview.openTasks.length > 0 ? (
              <Text style={styles.tasks}>Offene Aufgaben: {overview.openTasks.join(' · ')}</Text>
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
          </SectionPanel>
        ) : null}

        {activeTab === 'qualifications' ? (
          <SectionPanel title="Qualifikationen">
            {file.qualifications.map((q) => (
              <DetailInfoRow key={q.id} label={q.title} value={q.status} />
            ))}
          </SectionPanel>
        ) : null}

        {activeTab === 'background_check' ? (
          <SectionPanel title="Führungszeugnis">
            <DetailInfoRow label="Status" value={file.backgroundCheck.status} />
            <DetailInfoRow label="Ausstellungsdatum" value={file.backgroundCheck.issueDate} />
            {!file.backgroundCheck.documentId ? (
              <Text style={styles.hint}>Dokument nur für autorisierte Admin-Rollen sichtbar.</Text>
            ) : null}
          </SectionPanel>
        ) : null}

        {activeTab === 'deployability' ? (
          <SectionPanel title="Einsatzfähigkeit">
            {Object.entries(file.deployability)
              .filter(([key]) => typeof file.deployability[key as keyof typeof file.deployability] === 'boolean')
              .map(([key, value]) => (
                <DetailInfoRow key={key} label={key} value={value ? 'OK' : 'Nein'} />
              ))}
          </SectionPanel>
        ) : null}

        {activeTab === 'work_materials' ? (
          <SectionPanel title="Arbeitsmaterial">
            {file.workMaterials.map((item) => (
              <DetailInfoRow key={item.id} label={item.itemName} value={item.status} />
            ))}
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
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tasks: { marginTop: spacing.sm },
  hint: { marginTop: spacing.sm, fontStyle: 'italic' },
});
