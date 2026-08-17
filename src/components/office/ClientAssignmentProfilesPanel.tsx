import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { AssistCatalogGroupedChipSelect } from '@/components/office/assistCatalog/AssistCatalogGroupedChipSelect';
import { AssistCatalogMultiSelect } from '@/components/office/assistCatalog/AssistCatalogMultiSelect';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useEmployeeList } from '@/hooks/useEmployeeList';
import { useAssistAssignmentOptions } from '@/hooks/assistCatalog/useAssistCatalog';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  archiveClientAssignmentProfile,
  listClientAssignmentProfiles,
  saveClientAssignmentProfile,
  validateClientAssignmentProfileInput,
} from '@/lib/office/clientAssignmentProfileService';
import { applyTaskPackageTasksToAssignmentProfile } from '@/lib/office/clientAssignmentProfileDuration';
import { confirmAction } from '@/lib/platform/confirmAction';
import { loadTaskPackageItems, mergeTaskDrafts } from '@/lib/assistCatalog';
import { fetchTenantServiceCatalog } from '@/lib/tenant/tenantServiceCatalogService';
import { subscribeToClientRecordChanges } from '@/lib/realtime';
import type {
  ClientAssignmentProfile,
  ClientAssignmentProfileInput,
} from '@/types/modules/clientAssignmentProfile';
import type { ClientFullDetail } from '@/types/modules/client';
import type { AssistAssignmentTaskDraft, CatalogItem } from '@/types/assistCatalog';
import { darkGlassSurfaceText } from '@/design/tokens/auroraGlass';
import { colors, spacing, typography } from '@/theme';

type Props = {
  clientId: string;
  fullClient?: ClientFullDetail | null;
};

function fullClientAddress(client?: ClientFullDetail | null): string {
  const address = client?.addresses.find((entry) => entry.isPrimary) ?? client?.addresses[0];
  if (!address) return '';
  return [address.street, address.zip, address.city].filter(Boolean).join(', ');
}

function emptyInput(clientId: string, address: string): ClientAssignmentProfileInput {
  return {
    clientId,
    employeeId: null,
    profileName: '',
    assignmentTitle: 'Betreuungseinsatz',
    description: '',
    durationMinutes: 60,
    taskTitles: [],
    taskDrafts: [],
    serviceKey: '',
    serviceName: '',
    subjectKey: '',
    assignmentTypeKey: '',
    serviceCategoryKey: '',
    taskPackageId: null,
    billingBudgetSourceKey: '',
    riskFlagKeys: [],
    documentationTemplateKey: '',
    proofTemplateKey: '',
    catalogSnapshotJson: {},
    locationAddress: address,
    locationNotes: '',
    notesForEmployee: '',
    internalNotes: '',
    clientVisibleNotes: '',
    billingRelevant: true,
    requiresSignature: true,
    requiresDocumentation: true,
    requiresRoute: true,
    clientPortalVisible: true,
    employeePortalVisible: true,
  };
}

function profileToInput(profile: ClientAssignmentProfile): ClientAssignmentProfileInput {
  return {
    clientId: profile.clientId,
    employeeId: profile.employeeId,
    profileName: profile.profileName,
    assignmentTitle: profile.assignmentTitle,
    description: profile.description,
    durationMinutes: profile.durationMinutes,
    taskTitles: [...profile.taskTitles],
    taskDrafts: profile.taskDrafts.map((task) => ({ ...task })),
    serviceKey: profile.serviceKey,
    serviceName: profile.serviceName,
    subjectKey: profile.subjectKey,
    assignmentTypeKey: profile.assignmentTypeKey,
    serviceCategoryKey: profile.serviceCategoryKey,
    taskPackageId: profile.taskPackageId,
    billingBudgetSourceKey: profile.billingBudgetSourceKey,
    riskFlagKeys: [...profile.riskFlagKeys],
    documentationTemplateKey: profile.documentationTemplateKey,
    proofTemplateKey: profile.proofTemplateKey,
    catalogSnapshotJson: { ...profile.catalogSnapshotJson },
    locationAddress: profile.locationAddress,
    locationNotes: profile.locationNotes,
    notesForEmployee: profile.notesForEmployee,
    internalNotes: profile.internalNotes,
    clientVisibleNotes: profile.clientVisibleNotes,
    billingRelevant: profile.billingRelevant,
    requiresSignature: profile.requiresSignature,
    requiresDocumentation: profile.requiresDocumentation,
    requiresRoute: profile.requiresRoute,
    clientPortalVisible: profile.clientPortalVisible,
    employeePortalVisible: profile.employeePortalVisible,
  };
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${minutes} Min.`;
  return remainder ? `${hours} Std. ${remainder} Min.` : `${hours} Std.`;
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

type Choice = { value: string; label: string };

function ChoiceChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Choice[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.choiceWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {options.length === 0 ? (
        <Text style={styles.catalogHint}>Keine aktiven Vorlagen verfügbar.</Text>
      ) : (
        <View style={styles.choiceGrid}>
          {options.map((option) => {
            const selected = value === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.choice, selected && styles.choiceSelected]}
                onPress={() => onChange(option.value)}
              >
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function optionalTaskDrafts(
  selectedKeys: string[],
  currentDrafts: AssistAssignmentTaskDraft[],
  taskItems: CatalogItem[],
): AssistAssignmentTaskDraft[] {
  const catalogKeys = new Set(taskItems.map((item) => item.itemKey));
  const packageOrManual = currentDrafts.filter((draft) => !catalogKeys.has(draft.itemKey));
  const additional = selectedKeys.map((key, index) => {
    const existing = currentDrafts.find((draft) => draft.itemKey === key);
    if (existing) return existing;
    const item = taskItems.find((candidate) => candidate.itemKey === key);
    return {
      catalogItemId: item?.id ?? null,
      itemKey: key,
      title: item?.label ?? key,
      isRequired: false,
      isOptional: true,
      sortOrder: packageOrManual.length + index,
      defaultDurationMinutes: item?.defaultDurationMinutes ?? null,
      requiresNoteIfNotDone: Boolean(item?.payloadJson?.requiresNote),
      notExecutable: Boolean(item?.payloadJson?.notExecutable),
    };
  });
  return mergeTaskDrafts(packageOrManual, additional, new Set());
}

export function ClientAssignmentProfilesPanel({ clientId, fullClient }: Props) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { isReadOnly } = usePermissions();
  const employees = useEmployeeList();
  const { options, loading: catalogsLoading, error: catalogsError } = useAssistAssignmentOptions();
  const address = useMemo(() => fullClientAddress(fullClient), [fullClient]);
  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listClientAssignmentProfiles(tenantId, clientId);
    },
    [tenantId, clientId],
    {
      enabled: Boolean(tenantId && clientId),
      live: {
        tenantId,
        subscribe: (liveTenantId, handler) =>
          subscribeToClientRecordChanges(liveTenantId, clientId, handler),
      },
    },
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [draft, setDraft] = useState<ClientAssignmentProfileInput>(() => emptyInput(clientId, address));
  const [tasksText, setTasksText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [services, setServices] = useState<Choice[]>([]);
  const [packageLoading, setPackageLoading] = useState(false);
  const taskDraftsFromText = useMemo<AssistAssignmentTaskDraft[]>(
    () =>
      tasksText
        .split('\n')
        .map((title) => title.trim())
        .filter(Boolean)
        .map((title, sortOrder) => {
          const existing = draft.taskDrafts.find((task) => task.title === title);
          return existing ?? {
            itemKey: `manual-${sortOrder}-${title.toLocaleLowerCase('de-DE').replace(/\s+/g, '-')}`,
            title,
            isRequired: true,
            isOptional: false,
            sortOrder,
            requiresNoteIfNotDone: true,
          };
        }),
    [draft.taskDrafts, tasksText],
  );
  const normalizedDraft = useMemo(
    () => ({
      ...draft,
      durationMinutes: Number(draft.durationMinutes),
      taskTitles: taskDraftsFromText.map((task) => task.title),
      taskDrafts: taskDraftsFromText,
    }),
    [draft, taskDraftsFromText],
  );
  const validationError = useMemo(
    () => validateClientAssignmentProfileInput(normalizedDraft),
    [normalizedDraft],
  );

  useEffect(() => {
    if (!editorOpen || editingId) return;
    setDraft(emptyInput(clientId, address));
    setTasksText('');
  }, [address, clientId, editingId, editorOpen]);

  useEffect(() => {
    if (!editorOpen || !tenantId) return;
    void fetchTenantServiceCatalog(tenantId, profile?.roleKey).then((result) => {
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setServices(
        result.data.items
          .filter((item) => item.isActive && item.moduleKey === 'assist')
          .map((item) => ({ value: item.serviceKey, label: item.name })),
      );
    });
  }, [editorOpen, profile?.roleKey, tenantId]);

  function openCreate() {
    setEditingId(undefined);
    setDraft(emptyInput(clientId, address));
    setTasksText('');
    setSaveError(null);
    setEditorOpen(true);
  }

  function openEdit(item: ClientAssignmentProfile) {
    setEditingId(item.id);
    setDraft(profileToInput(item));
    setTasksText(item.taskTitles.join('\n'));
    setSaveError(null);
    setEditorOpen(true);
  }

  async function handleTaskPackageSelect(packageId: string) {
    if (!tenantId) return;
    setPackageLoading(true);
    setSaveError(null);
    const result = await loadTaskPackageItems(tenantId, packageId, profile?.roleKey);
    setPackageLoading(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    const merged = mergeTaskDrafts(result.data, [], new Set());
    setDraft((current) => applyTaskPackageTasksToAssignmentProfile(current, packageId, merged));
    setTasksText(merged.map((task) => task.title).join('\n'));
  }

  async function handleSave() {
    if (!tenantId) return;
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const snapshot = {
      subjectKey: normalizedDraft.subjectKey,
      subjectLabel:
        options?.subjects.find((item) => item.itemKey === normalizedDraft.subjectKey)?.label ?? null,
      assignmentTypeKey: normalizedDraft.assignmentTypeKey,
      assignmentTypeLabel:
        options?.assignmentTypes.find((item) => item.itemKey === normalizedDraft.assignmentTypeKey)?.label ?? null,
      serviceCategoryKey: normalizedDraft.serviceCategoryKey,
      serviceCategoryLabel:
        options?.serviceCategories.find((item) => item.itemKey === normalizedDraft.serviceCategoryKey)?.label ?? null,
      serviceKey: normalizedDraft.serviceKey,
      serviceName: normalizedDraft.serviceName,
      taskPackageId: normalizedDraft.taskPackageId,
      taskPackageLabel:
        options?.taskPackages.find((item) => item.id === normalizedDraft.taskPackageId)?.label ?? null,
      plannedDurationMinutes: normalizedDraft.durationMinutes,
      durationSource: 'assignment_profile',
      riskFlagKeys: normalizedDraft.riskFlagKeys,
      riskFlagLabels: normalizedDraft.riskFlagKeys.map(
        (key) => options?.riskFlags.find((item) => item.itemKey === key)?.label ?? key,
      ),
      documentationTemplateKey: normalizedDraft.documentationTemplateKey || null,
      proofTemplateKey: normalizedDraft.proofTemplateKey || null,
    };
    const result = await saveClientAssignmentProfile(
      tenantId,
      { ...normalizedDraft, catalogSnapshotJson: snapshot },
      editingId,
      profile?.id,
    );
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setEditorOpen(false);
    await query.refresh();
  }

  async function handleArchive(item: ClientAssignmentProfile) {
    if (!tenantId) return;
    const confirmed = await confirmAction({
      title: 'Einsatzprofil entfernen',
      message: `„${item.profileName}“ aus der Planung entfernen? Bereits erzeugte Einsätze bleiben unverändert.`,
      confirmLabel: 'Profil entfernen',
      cancelLabel: 'Abbrechen',
    });
    if (!confirmed) return;
    const result = await archiveClientAssignmentProfile(tenantId, item.id, profile?.id);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    await query.refresh();
  }

  if (query.loading && !query.data) return <LoadingState message="Einsatzprofile werden geladen…" />;
  if (query.error && !query.data) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  const profiles = query.data ?? [];

  return (
    <>
      <SectionPanel
        title="Einsatzprofile"
        subtitle="Wiederverwendbare Einsatzvorlagen ohne Tag und Uhrzeit"

      >
        {profiles.length === 0 ? (
          <EmptyState
            title="Noch keine Einsatzprofile"
            message="Speichern Sie alle wiederkehrenden Einsatzdaten einmalig. Im Assist-Kalender wird später nur noch das Profil auf einen Tag gezogen und die Uhrzeit bestätigt."
            actionLabel={!isReadOnly ? 'Erstes Einsatzprofil erstellen' : undefined}
            onAction={!isReadOnly ? openCreate : undefined}
          />
        ) : (
          <View style={styles.cards}>
            {profiles.map((item) => (
              <PremiumCard key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{item.profileName}</Text>
                    <Text style={styles.cardSubtitle}>{item.assignmentTitle}</Text>
                  </View>
                  <PremiumBadge label={durationLabel(item.durationMinutes)} variant="cyan" />
                </View>
                <Text style={styles.meta}>{item.employeeName}</Text>
                <Text style={styles.meta}>
                  {item.taskTitles.length} Aufgabe{item.taskTitles.length === 1 ? '' : 'n'}
                  {item.locationAddress ? ` · ${item.locationAddress}` : ''}
                </Text>
                <View style={styles.badges}>
                  {item.requiresDocumentation ? <PremiumBadge label="Dokumentation" variant="muted" /> : null}
                  {item.requiresSignature ? <PremiumBadge label="Unterschrift" variant="muted" /> : null}
                  {item.billingRelevant ? <PremiumBadge label="Abrechnung" variant="muted" /> : null}
                </View>
                {!isReadOnly ? (
                  <View style={styles.actions}>
                    <PremiumButton title="Bearbeiten" size="sm" variant="secondary" onPress={() => openEdit(item)} />
                    <PremiumButton title="Entfernen" size="sm" variant="ghost" onPress={() => handleArchive(item)} />
                  </View>
                ) : null}
              </PremiumCard>
            ))}
          </View>
        )}
        {!isReadOnly && profiles.length > 0 ? (
          <PremiumButton title="Weiteres Einsatzprofil" variant="secondary" onPress={openCreate} />
        ) : null}
        {saveError && !editorOpen ? <Text style={styles.error}>{saveError}</Text> : null}
      </SectionPanel>

      <AppGlassModal
        visible={editorOpen}
        title={editingId ? 'Einsatzprofil bearbeiten' : 'Einsatzprofil erstellen'}
        subtitle="Kein Tag und keine Uhrzeit – diese werden erst im Kalender festgelegt."
        onClose={() => setEditorOpen(false)}
        maxWidth={980}
        isDirty={Boolean(editingId || draft.profileName.trim() || tasksText.trim())}
        footerActions={[
          { title: 'Abbrechen', variant: 'secondary', onPress: () => setEditorOpen(false) },
          {
            title: 'Einsatzprofil speichern',
            variant: 'primary',
            loading: saving,
            disabled: Boolean(validationError),
            onPress: handleSave,
          },
        ]}
      >
        <View style={styles.form}>
          <View style={styles.requiredNotice}>
            <Text style={styles.requiredNoticeTitle}>Pflichtangaben</Text>
            <Text style={styles.requiredNoticeText}>
              Profilname, Mitarbeitende Person und mindestens eine echte Aufgabe müssen ausgefüllt
              sein. Graue Beispieltexte sind nur Platzhalter und werden nicht gespeichert.
            </Text>
            {validationError ? (
              <Text style={styles.requiredNoticeError}>{validationError}</Text>
            ) : (
              <Text style={styles.requiredNoticeReady}>Alle Pflichtangaben vollständig.</Text>
            )}
          </View>
          <PremiumInput
            label="Profilname"
            value={draft.profileName}
            placeholder="z. B. Haushalt Montag"
            onChangeText={(profileName) => setDraft((current) => ({ ...current, profileName }))}

          />
          <PremiumInput
            label="Einsatzbezeichnung"
            value={draft.assignmentTitle}
            onChangeText={(assignmentTitle) => setDraft((current) => ({ ...current, assignmentTitle }))}

          />
          <PremiumInput
            label="Beschreibung"
            value={draft.description}
            onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
            multiline

          />
          <PremiumInput
            label="Dauer in Minuten"
            value={String(draft.durationMinutes)}
            keyboardType="number-pad"
            onChangeText={(value) =>
              setDraft((current) => ({ ...current, durationMinutes: Number(value.replace(/\D/g, '')) || 0 }))
            }
            hint="Verbindliche Gesamtdauer des Kalenderblocks. Aufgaben-Richtzeiten ändern diesen Wert nicht."

          />

          <Text style={styles.fieldLabel}>Mitarbeitende Person</Text>
          <View style={styles.employeeGrid}>
            {employees.allItems
              .filter((employee) => employee.status === 'aktiv')
              .map((employee) => (
                <PremiumButton
                  key={employee.id}
                  title={`${employee.firstName} ${employee.lastName}`}
                  size="sm"
                  variant={draft.employeeId === employee.id ? 'primary' : 'secondary'}
                  onPress={() => setDraft((current) => ({ ...current, employeeId: employee.id }))}
                />
              ))}
          </View>
          {employees.error ? <Text style={styles.error}>{employees.error}</Text> : null}

          <View style={styles.catalogSection}>
            <Text style={styles.catalogTitle}>Einsatzvorlagen & Leistungskatalog</Text>
            <Text style={styles.catalogHint}>
              Diese Auswahl stammt direkt aus den produktiven Assist-Vorlagen und wird beim
              Kalender-Drop vollständig in den Einsatz übernommen.
            </Text>
            {catalogsLoading ? <Text style={styles.catalogHint}>Vorlagen werden geladen…</Text> : null}
            {catalogsError ? <Text style={styles.error}>{catalogsError}</Text> : null}
            <ChoiceChips
              label="Einsatz-Betreff"
              options={(options?.subjects ?? []).map((item) => ({
                value: item.itemKey,
                label: item.label,
              }))}
              value={draft.subjectKey}
              onChange={(subjectKey) => {
                const label = options?.subjects.find((item) => item.itemKey === subjectKey)?.label;
                setDraft((current) => ({
                  ...current,
                  subjectKey,
                  assignmentTitle: label || current.assignmentTitle,
                }));
              }}
            />
            <AssistCatalogGroupedChipSelect
              label="Einsatzart"
              items={options?.assignmentTypes ?? []}
              value={draft.assignmentTypeKey}
              onChange={(assignmentTypeKey) =>
                setDraft((current) => ({ ...current, assignmentTypeKey }))
              }
            />
            <ChoiceChips
              label="Leistungskategorie"
              options={(options?.serviceCategories ?? []).map((item) => ({
                value: item.itemKey,
                label: item.label,
              }))}
              value={draft.serviceCategoryKey}
              onChange={(serviceCategoryKey) =>
                setDraft((current) => ({ ...current, serviceCategoryKey }))
              }
            />
            <ChoiceChips
              label="Leistung / Abrechnung"
              options={services}
              value={draft.serviceKey}
              onChange={(serviceKey) =>
                setDraft((current) => ({
                  ...current,
                  serviceKey,
                  serviceName: services.find((service) => service.value === serviceKey)?.label ?? serviceKey,
                }))
              }
            />
          </View>

          <View style={styles.catalogSection}>
            <Text style={styles.catalogTitle}>Aufgabenpaket & Aufgaben</Text>
            <Text style={styles.catalogHint}>
              Ein Aufgabenpaket übernimmt die Aufgaben und deren Richtzeiten. Die Einsatzdauer
              bleibt unabhängig davon ausschließlich die oben festgelegte Gesamtdauer.
            </Text>
            <View style={styles.packageGrid}>
              {(options?.taskPackages ?? []).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.packageCard,
                    draft.taskPackageId === item.id && styles.packageCardSelected,
                  ]}
                  onPress={() => void handleTaskPackageSelect(item.id)}
                  disabled={packageLoading}
                >
                  <Text style={styles.packageTitle}>{item.label}</Text>
                  {item.defaultDurationMinutes ? (
                    <Text style={styles.catalogHint}>
                      Aufgaben-Richtzeit: {item.defaultDurationMinutes} Min.
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
            <AssistCatalogMultiSelect
              items={options?.taskItems ?? []}
              label="Zusätzliche Einzelaufgaben"
              values={draft.taskDrafts
                .filter((task) => options?.taskItems.some((item) => item.itemKey === task.itemKey))
                .map((task) => task.itemKey)}
              loading={catalogsLoading}
              onChange={(keys) => {
                const next = optionalTaskDrafts(keys, draft.taskDrafts, options?.taskItems ?? []);
                setDraft((current) => ({
                  ...current,
                  taskDrafts: next,
                  taskTitles: next.map((task) => task.title),
                }));
                setTasksText(next.map((task) => task.title).join('\n'));
              }}
            />
          </View>

          <PremiumInput
            label="Aufgaben (vollständige Einsatzliste)"
            value={tasksText}
            onChangeText={setTasksText}
            placeholder={'Eine Aufgabe pro Zeile\nEinkaufen\nWohnung reinigen'}
            multiline
            style={styles.multiline}

          />
          <AssistCatalogMultiSelect
            items={options?.riskFlags ?? []}
            label="Risiken aus dem Assist-Katalog"
            values={draft.riskFlagKeys}
            loading={catalogsLoading}
            onChange={(riskFlagKeys) => setDraft((current) => ({ ...current, riskFlagKeys }))}
          />
          <PremiumInput
            label="Einsatzort"
            value={draft.locationAddress}
            onChangeText={(locationAddress) => setDraft((current) => ({ ...current, locationAddress }))}

          />
          <PremiumInput
            label="Hinweis zum Einsatzort / Zugang"
            value={draft.locationNotes}
            onChangeText={(locationNotes) => setDraft((current) => ({ ...current, locationNotes }))}
            multiline

          />
          <PremiumInput
            label="Hinweis für Mitarbeitende"
            value={draft.notesForEmployee}
            onChangeText={(notesForEmployee) => setDraft((current) => ({ ...current, notesForEmployee }))}
            multiline

          />
          <PremiumInput
            label="Interne Notiz"
            value={draft.internalNotes}
            onChangeText={(internalNotes) => setDraft((current) => ({ ...current, internalNotes }))}
            multiline

          />
          <PremiumInput
            label="Hinweis für Klientenportal"
            value={draft.clientVisibleNotes}
            onChangeText={(clientVisibleNotes) => setDraft((current) => ({ ...current, clientVisibleNotes }))}
            multiline

          />
          <ChoiceChips
            label="Budget-/Abrechnungsquelle"
            options={(options?.budgetSources ?? []).map((item) => ({
              value: item.itemKey,
              label: item.label,
            }))}
            value={draft.billingBudgetSourceKey}
            onChange={(billingBudgetSourceKey) =>
              setDraft((current) => ({ ...current, billingBudgetSourceKey }))
            }
          />
          <PremiumInput
            label="Dokumentationsvorlage"
            value={draft.documentationTemplateKey}
            onChangeText={(documentationTemplateKey) =>
              setDraft((current) => ({ ...current, documentationTemplateKey }))
            }
            placeholder="Vorlagen-Schlüssel"

          />
          <ChoiceChips
            label="Leistungsnachweis"
            options={[
              { value: 'einzel', label: 'Einzel-Einsatznachweis' },
              { value: 'monat', label: 'Monatsnachweis' },
            ]}
            value={draft.proofTemplateKey}
            onChange={(proofTemplateKey) =>
              setDraft((current) => ({ ...current, proofTemplateKey }))
            }
          />
          <View style={styles.toggles}>
            <ToggleRow
              label="Dokumentation erforderlich"
              value={draft.requiresDocumentation}
              onValueChange={(requiresDocumentation) => setDraft((current) => ({ ...current, requiresDocumentation }))}
            />
            <ToggleRow
              label="Unterschrift erforderlich"
              value={draft.requiresSignature}
              onValueChange={(requiresSignature) => setDraft((current) => ({ ...current, requiresSignature }))}
            />
            <ToggleRow
              label="Abrechnungsrelevant"
              value={draft.billingRelevant}
              onValueChange={(billingRelevant) => setDraft((current) => ({ ...current, billingRelevant }))}
            />
            <ToggleRow
              label="Anfahrt / Route erforderlich"
              value={draft.requiresRoute}
              onValueChange={(requiresRoute) => setDraft((current) => ({ ...current, requiresRoute }))}
            />
            <ToggleRow
              label="Im Mitarbeitendenportal anzeigen"
              value={draft.employeePortalVisible}
              onValueChange={(employeePortalVisible) => setDraft((current) => ({ ...current, employeePortalVisible }))}
            />
            <ToggleRow
              label="Im Klientenportal anzeigen"
              value={draft.clientPortalVisible}
              onValueChange={(clientPortalVisible) => setDraft((current) => ({ ...current, clientPortalVisible }))}
            />
          </View>
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
        </View>
      </AppGlassModal>
    </>
  );
}

const styles = StyleSheet.create({
  cards: { gap: spacing.sm },
  card: { gap: spacing.xs },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitleWrap: { flex: 1 },
  cardTitle: { ...typography.label },
  cardSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  meta: { ...typography.caption, color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  form: { gap: spacing.md },
  fieldLabel: { ...typography.label, color: darkGlassSurfaceText.primary },
  employeeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  multiline: { minHeight: 116, textAlignVertical: 'top' },
  toggles: { gap: spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  toggleLabel: { ...typography.body, color: darkGlassSurfaceText.primary, flex: 1 },
  requiredNotice: {
    gap: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(98, 243, 255, 0.35)',
    borderRadius: 12,
    backgroundColor: 'rgba(22, 131, 255, 0.08)',
  },
  requiredNoticeTitle: { ...typography.label, color: darkGlassSurfaceText.primary },
  requiredNoticeText: { ...typography.caption, color: darkGlassSurfaceText.secondary, lineHeight: 20 },
  requiredNoticeError: { ...typography.caption, color: '#FDE68A', fontWeight: '700' },
  requiredNoticeReady: { ...typography.caption, color: '#6EE7B7', fontWeight: '700' },
  catalogSection: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  catalogTitle: { ...typography.h3, color: darkGlassSurfaceText.primary },
  catalogHint: { ...typography.caption, color: darkGlassSurfaceText.secondary, lineHeight: 19 },
  choiceWrap: { gap: spacing.xs },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(35,136,255,0.2)',
  },
  choiceText: { ...typography.caption, color: darkGlassSurfaceText.primary },
  choiceTextSelected: { color: '#8ED8FF', fontWeight: '700' },
  packageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  packageCard: {
    minWidth: 170,
    flexGrow: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
  },
  packageCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(35,136,255,0.2)',
  },
  packageTitle: { ...typography.label, color: darkGlassSurfaceText.primary },
  error: { ...typography.caption, color: colors.error },
});
