import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CareDateInput, CareTimeInput } from '@/components/inputs';
import { AssistCatalogGroupedChipSelect } from '@/components/office/assistCatalog/AssistCatalogGroupedChipSelect';
import {
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import {
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassChipStyles,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { moduleColor } from '@/design/tokens/modules';
import { useAssistAssignmentOptions } from '@/hooks/assistCatalog/useAssistCatalog';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchAssignmentEmployeeList } from '@/lib/assist/assignmentEmployeeListService';
import { fetchTenantServiceCatalog } from '@/lib/tenant/tenantServiceCatalogService';
import {
  mapVisitDetailToEditForm,
  type VisitEditFormData,
} from '@/lib/assist/visitEditMappers';
import { updateVisitFromWizard } from '@/lib/assist/visitService';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { ASSIGNMENT_STATUS_LABELS, type AssignmentStatus } from '@/types/modules/assignmentStatus';
import { spacing, typography } from '@/theme';

type AssignmentEditFormProps = {
  visitId: string;
  initialVisit: VisitDispositionDetail;
  onCancel: () => void;
  onSaved?: (id: string) => void;
};

type SelectOption = { value: string; label: string };

const FORM_CTX = { viewContext: 'form' as const };

const EDITABLE_STATUS_OPTIONS: AssignmentStatus[] = [
  'geplant',
  'bestaetigt',
  'storniert',
  'abgeschlossen',
];

function ChipSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { isLight } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();
  const glassChips = useAuroraGlassChipStyles(FORM_CTX);
  const text = useAuroraAdaptiveText();
  const useGlass = isLight && auroraActive;
  const assistAccent = moduleColor('assist');

  return (
    <View style={chipStyles.wrap}>
      <Text style={[chipStyles.label, { color: text.primary }]}>{label}</Text>
      {options.length > 0 ? (
        <View style={chipStyles.row}>
          {options.map((opt) => {
            const selected = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  useGlass ? glassChips.chip : chipStyles.chip,
                  selected &&
                    (useGlass
                      ? glassChips.chipSelected
                      : { borderColor: assistAccent, backgroundColor: `${assistAccent}22` }),
                ]}
                onPress={() => onChange(opt.value)}
              >
                <Text
                  style={[
                    useGlass ? glassChips.label : [chipStyles.chipText, { color: text.primary }],
                    selected &&
                      (useGlass
                        ? glassChips.labelSelected
                        : { fontWeight: '600', color: assistAccent }),
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipText: { ...typography.caption },
});

export function AssignmentEditForm({
  visitId,
  initialVisit,
  onCancel,
  onSaved,
}: AssignmentEditFormProps) {
  const text = useAuroraAdaptiveText();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, isReadOnly } = usePermissions();
  const { options, loading: optionsLoading, error: optionsError } = useAssistAssignmentOptions();
  const canManage = can('assist.assignments.manage') && !isReadOnly;

  const [form, setForm] = useState<VisitEditFormData>(() => mapVisitDetailToEditForm(initialVisit));
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);
  const [services, setServices] = useState<SelectOption[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback((partial: Partial<VisitEditFormData>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    setForm(mapVisitDetailToEditForm(initialVisit));
  }, [initialVisit]);

  useEffect(() => {
    if (!tenantId) return;
    setListsLoading(true);
    void (async () => {
      const [clientRes, employeeRes, catalogRes] = await Promise.all([
        fetchClientList(tenantId, profile?.roleKey, { lifecycleFilter: 'active' }),
        fetchAssignmentEmployeeList(tenantId, profile?.roleKey),
        fetchTenantServiceCatalog(tenantId, profile?.roleKey),
      ]);
      if (clientRes.ok) {
        setClients(
          clientRes.data.map((client) => ({
            value: client.id,
            label: `${client.firstName} ${client.lastName}`.trim(),
          })),
        );
      }
      if (employeeRes.ok) {
        setEmployees(
          employeeRes.data.map((employee) => ({
            value: employee.id,
            label: `${employee.firstName} ${employee.lastName}`.trim(),
          })),
        );
      }
      if (catalogRes.ok) {
        setServices(
          catalogRes.data.items
            .filter((item) => item.isActive && item.moduleKey === 'assist')
            .map((item) => ({ value: item.serviceKey, label: item.name })),
        );
      }
      setListsLoading(false);
    })();
  }, [tenantId, profile?.roleKey]);

  const subjectOptions = useMemo(
    () => (options?.subjects ?? []).map((subject) => ({ value: subject.itemKey, label: subject.label })),
    [options],
  );

  const statusOptions = useMemo(() => {
    const keys = new Set<AssignmentStatus>([
      ...EDITABLE_STATUS_OPTIONS,
      initialVisit.assignmentStatus,
      form.assignmentStatus,
    ]);
    return [...keys].map((key) => ({
      key,
      label: ASSIGNMENT_STATUS_LABELS[key],
    }));
  }, [form.assignmentStatus, initialVisit.assignmentStatus]);

  const handleSave = async () => {
    if (!tenantId || !canManage || !form.title.trim() || !form.clientId) return;
    setSaving(true);
    setError(null);
    const result = await updateVisitFromWizard(tenantId, visitId, form, profile?.roleKey);
    setSaving(false);
    if (result.ok) {
      onSaved?.(result.data.id);
    } else {
      setError(result.error);
    }
  };

  if (!canManage) {
    return <InfoBanner message="Keine Berechtigung zum Bearbeiten von Einsätzen." variant="warning" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {error ? <ErrorState message={error} /> : null}

      <SectionPanel {...FORM_CTX} title="Basisdaten">
        <PremiumInput
          {...FORM_CTX}
          label="Bezeichnung *"
          value={form.title}
          onChangeText={(title) => patch({ title })}
          placeholder="Einsatzbezeichnung"
        />
        <PremiumInput
          {...FORM_CTX}
          label="Beschreibung"
          value={form.description}
          onChangeText={(description) => patch({ description })}
          multiline
        />
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Klient:in & Mitarbeitende:r">
        {listsLoading ? (
          <Text style={[styles.hint, { color: text.primary }]}>Klient:innen und Mitarbeitende werden geladen…</Text>
        ) : null}
        <ChipSelect
          label="Klient:in *"
          options={clients}
          value={form.clientId}
          onChange={(clientId) => patch({ clientId })}
        />
        <ChipSelect
          label="Mitarbeitende:r"
          options={employees}
          value={form.employeeId}
          onChange={(employeeId) => patch({ employeeId })}
        />
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Termin">
        <CareDateInput
          {...FORM_CTX}
          label="Datum *"
          value={form.assignmentDate}
          onChange={(assignmentDate) => patch({ assignmentDate })}
        />
        <CareTimeInput
          {...FORM_CTX}
          label="Beginn *"
          value={form.plannedStartTime}
          onChange={(plannedStartTime) => patch({ plannedStartTime })}
          showFormatHint={false}
        />
        <CareTimeInput
          {...FORM_CTX}
          label="Ende *"
          value={form.plannedEndTime}
          onChange={(plannedEndTime) => patch({ plannedEndTime })}
          showFormatHint={false}
        />
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Ort & Notizen">
        <PremiumInput
          {...FORM_CTX}
          label="Ort"
          value={form.addressSnapshot}
          onChangeText={(addressSnapshot) => patch({ addressSnapshot })}
          placeholder="Adresse oder Treffpunkt"
        />
        <PremiumInput
          {...FORM_CTX}
          label="Notizen"
          value={form.internalNotes}
          onChangeText={(internalNotes) => patch({ internalNotes })}
          multiline
        />
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Status">
        <FilterChipGroup
          options={statusOptions}
          value={form.assignmentStatus}
          onChange={(assignmentStatus) =>
            patch({ assignmentStatus: assignmentStatus as AssignmentStatus })
          }
          wrap
        />
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Einsatzart & Katalog">
        {optionsLoading ? (
          <Text style={[styles.hint, { color: text.primary }]}>Kataloge werden geladen…</Text>
        ) : null}
        {optionsError ? <InfoBanner message={optionsError} variant="danger" /> : null}
        <ChipSelect
          label="Einsatz-Betreff"
          options={subjectOptions}
          value={form.subjectKey}
          onChange={(subjectKey) => {
            const label = subjectOptions.find((option) => option.value === subjectKey)?.label ?? '';
            patch({ subjectKey, title: form.title.trim() ? form.title : label });
          }}
        />
        {(options?.assignmentTypes?.length ?? 0) > 0 ? (
          <AssistCatalogGroupedChipSelect
            label="Einsatzart"
            items={options?.assignmentTypes ?? []}
            value={form.assignmentTypeKey}
            onChange={(assignmentTypeKey) => patch({ assignmentTypeKey })}
          />
        ) : null}
        <ChipSelect
          label="Leistungskategorie"
          options={(options?.serviceCategories ?? []).map((category) => ({
            value: category.itemKey,
            label: category.label,
          }))}
          value={form.serviceCategoryKey}
          onChange={(serviceCategoryKey) => patch({ serviceCategoryKey })}
        />
        <ChipSelect
          label="Leistung (Abrechnung)"
          options={services}
          value={form.serviceKey}
          onChange={(serviceKey) => {
            patch({
              serviceKey,
              serviceName: services.find((service) => service.value === serviceKey)?.label ?? serviceKey,
            });
          }}
        />
      </SectionPanel>

      <View style={styles.actions}>
        <PremiumButton
          title="Speichern"
          fullWidth
          loading={saving}
          disabled={saving || !form.title.trim() || !form.clientId}
          onPress={() => void handleSave()}
        />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={onCancel} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  hint: { ...typography.caption, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
});
