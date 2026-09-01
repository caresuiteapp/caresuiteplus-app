import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { EmployeeLogbookOfficePanel } from '@/components/office/EmployeeLogbookOfficePanel';
import { PersonalWorkspaceSurface } from '@/components/office/PersonalWorkspaceSurface';
import { EmptyState, ErrorState, LoadingState, PremiumBadge } from '@/components/ui';
import { useEmployeeList } from '@/hooks/useEmployeeList';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { spacing, typography } from '@/theme';

function employeeName(employee: EmployeeListItem) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export function EmployeeLogbookHubScreen() {
  const { width } = useWindowDimensions();
  const tenantId = useServiceTenantId();
  const { can } = usePermissions();
  const { allItems, loading, error, refresh } = useEmployeeList();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stacked = width < 1040;

  const employees = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de-DE');
    return allItems
      .filter((employee) => employee.status !== 'archiviert')
      .filter((employee) => {
        if (!needle) return true;
        return `${employee.firstName} ${employee.lastName} ${employee.jobTitle ?? ''} ${employee.department ?? ''}`
          .toLocaleLowerCase('de-DE')
          .includes(needle);
      });
  }, [allItems, search]);

  useEffect(() => {
    if (selectedId && employees.some((employee) => employee.id === selectedId)) return;
    setSelectedId(employees[0]?.id ?? null);
  }, [employees, selectedId]);

  const selectedEmployee = employees.find((employee) => employee.id === selectedId) ?? null;

  return (
    <C14vSubpageShell
      title="Fahrtenbuch"
      eyebrow="OFFICE · MOBILITÄT"
      subtitle="Fahrten, Kilometer, Fahrzeuge und Nachweise in einem eigenständigen Arbeitsbereich"
      moduleLabel="Office"
      showBack={false}
      scroll={false}
      actions={[{ key: 'refresh', label: 'Aktualisieren', onPress: () => void refresh(), variant: 'ghost' }]}
    >
      <PersonalWorkspaceSurface style={styles.workspace}>
        <View style={[styles.layout, stacked && styles.layoutStacked]} testID="employee-logbook-hub-screen">
          <View style={[styles.directory, stacked && styles.directoryStacked]}>
            <View style={styles.directoryHeader}>
              <View style={styles.directoryHeading}>
                <Text style={styles.kicker}>MITARBEITENDENAUSWAHL</Text>
                <Text style={styles.directoryTitle}>Fahrtenbücher</Text>
                <Text style={styles.directoryMeta}>{employees.length} aktive Mitarbeitende</Text>
              </View>
              <PremiumBadge label="EIGENES MODUL" variant="cyan" />
            </View>
            <TextInput
              accessibilityLabel="Mitarbeitende für das Fahrtenbuch suchen"
              onChangeText={setSearch}
              placeholder="Name, Funktion oder Team suchen …"
              placeholderTextColor="#71869B"
              style={styles.search}
              value={search}
            />
            <ScrollView
              contentContainerStyle={styles.employeeList}
              horizontal={stacked}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              {loading && !allItems.length ? <LoadingState message="Mitarbeitende werden geladen …" /> : null}
              {error && !allItems.length ? <ErrorState message={error} onRetry={refresh} /> : null}
              {!loading && !error && !employees.length ? (
                <EmptyState title="Keine Mitarbeitenden gefunden" message="Passen Sie die Suche an oder prüfen Sie die Personalstammdaten." />
              ) : null}
              {employees.map((employee) => {
                const selected = employee.id === selectedId;
                return (
                  <Pressable
                    accessibilityLabel={`Fahrtenbuch von ${employeeName(employee)} öffnen`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={employee.id}
                    onPress={() => setSelectedId(employee.id)}
                    style={({ pressed }) => [
                      styles.employeeCard,
                      stacked && styles.employeeCardStacked,
                      selected && styles.employeeCardSelected,
                      pressed && styles.employeeCardPressed,
                    ]}
                  >
                    <View style={[styles.avatar, selected && styles.avatarSelected]}>
                      <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>
                        {(employee.firstName[0] ?? '') + (employee.lastName[0] ?? '')}
                      </Text>
                    </View>
                    <View style={styles.employeeCopy}>
                      <Text numberOfLines={1} style={styles.employeeName}>{employeeName(employee)}</Text>
                      <Text numberOfLines={1} style={styles.employeeRole}>{employee.jobTitle || employee.department || 'Mitarbeitende:r'}</Text>
                    </View>
                    <Text style={[styles.chevron, selected && styles.chevronSelected]}>›</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            contentContainerStyle={styles.logbookContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.logbook}
          >
            {!can('office.employees.view') ? (
              <EmptyState title="Kein Zugriff" message="Für diesen Arbeitsbereich fehlt die Berechtigung zur Mitarbeitendenverwaltung." />
            ) : !tenantId ? (
              <ErrorState message="Das Fahrtenbuch kann ohne aktiven Mandanten nicht geladen werden." />
            ) : selectedEmployee ? (
              <>
                <View style={styles.selectionHero}>
                  <View>
                    <Text style={styles.kicker}>AUSGEWÄHLTES FAHRTENBUCH</Text>
                    <Text style={styles.selectionTitle}>{employeeName(selectedEmployee)}</Text>
                    <Text style={styles.selectionMeta}>GPS-Fahrten · manuelle Erfassung · Kilometererstattung · PDF-Nachweis</Text>
                  </View>
                  <PremiumBadge label={can('office.employees.edit') ? 'BEARBEITEN' : 'NUR LESEN'} variant={can('office.employees.edit') ? 'green' : 'muted'} />
                </View>
                <EmployeeLogbookOfficePanel
                  canEdit={can('office.employees.edit')}
                  employeeId={selectedEmployee.id}
                  employeeName={employeeName(selectedEmployee)}
                  tenantId={tenantId}
                />
              </>
            ) : (
              <EmptyState title="Fahrtenbuch auswählen" message="Wählen Sie links eine Mitarbeiterin oder einen Mitarbeiter aus." />
            )}
          </ScrollView>
        </View>
      </PersonalWorkspaceSurface>
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  workspace: { padding: spacing.md },
  layout: { flex: 1, minWidth: 0, minHeight: 0, flexDirection: 'row', gap: spacing.md },
  layoutStacked: { flexDirection: 'column' },
  directory: {
    width: 310,
    minHeight: 0,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C6DDF0',
    backgroundColor: '#F8FCFF',
    gap: spacing.md,
  },
  directoryStacked: { width: '100%', maxHeight: 250 },
  directoryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  directoryHeading: { flex: 1, gap: 2 },
  kicker: { ...typography.caption, color: '#0872D9', fontWeight: '900', letterSpacing: 0.9 },
  directoryTitle: { ...typography.h3, color: '#08213D', fontWeight: '900' },
  directoryMeta: { ...typography.caption, color: '#60758B' },
  search: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#C6DDF0',
    backgroundColor: '#FFFFFF',
    color: '#08213D',
    fontSize: 14,
  },
  employeeList: { gap: spacing.xs, paddingBottom: spacing.sm },
  employeeCard: {
    minHeight: 62,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E7F3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  employeeCardStacked: { width: 260 },
  employeeCardSelected: { borderColor: '#1784EA', backgroundColor: '#EAF4FF' },
  employeeCardPressed: { opacity: 0.82 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E2EDF7', alignItems: 'center', justifyContent: 'center' },
  avatarSelected: { backgroundColor: '#1784EA' },
  avatarText: { color: '#31597F', fontSize: 12, fontWeight: '900' },
  avatarTextSelected: { color: '#FFFFFF' },
  employeeCopy: { flex: 1, minWidth: 0, gap: 2 },
  employeeName: { ...typography.bodyStrong, color: '#08213D', fontWeight: '800' },
  employeeRole: { ...typography.caption, color: '#60758B' },
  chevron: { color: '#8AA1B7', fontSize: 22, fontWeight: '800' },
  chevronSelected: { color: '#0872D9' },
  logbook: { flex: 1, minWidth: 0, minHeight: 0 },
  logbookContent: { paddingBottom: spacing.xxl, gap: spacing.md },
  selectionHero: {
    padding: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#8BC4F5',
    backgroundColor: '#EAF5FF',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectionTitle: { ...typography.h2, color: '#08213D', fontWeight: '900' },
  selectionMeta: { ...typography.body, color: '#31597F', marginTop: 3 },
});
