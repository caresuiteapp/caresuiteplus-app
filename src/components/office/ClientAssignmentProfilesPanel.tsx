import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  archiveClientAssignmentProfile,
  listClientAssignmentProfiles,
  saveClientAssignmentProfile,
} from '@/lib/office/clientAssignmentProfileService';
import { confirmAction } from '@/lib/platform/confirmAction';
import { subscribeToClientRecordChanges } from '@/lib/realtime';
import type {
  ClientAssignmentProfile,
  ClientAssignmentProfileInput,
} from '@/types/modules/clientAssignmentProfile';
import type { ClientFullDetail } from '@/types/modules/client';
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
    durationMinutes: 60,
    taskTitles: [],
    locationAddress: address,
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
    durationMinutes: profile.durationMinutes,
    taskTitles: [...profile.taskTitles],
    locationAddress: profile.locationAddress,
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

export function ClientAssignmentProfilesPanel({ clientId, fullClient }: Props) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { isReadOnly } = usePermissions();
  const employees = useEmployeeList();
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

  useEffect(() => {
    if (!editorOpen || editingId) return;
    setDraft(emptyInput(clientId, address));
    setTasksText('');
  }, [address, clientId, editingId, editorOpen]);

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

  async function handleSave() {
    if (!tenantId) return;
    setSaving(true);
    setSaveError(null);
    const result = await saveClientAssignmentProfile(
      tenantId,
      {
        ...draft,
        durationMinutes: Number(draft.durationMinutes),
        taskTitles: tasksText.split('\n').map((task) => task.trim()).filter(Boolean),
      },
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
            message="Speichern Sie alle wiederkehrenden Einsatzdaten einmalig. Im Office-Kalender wird später nur noch das Profil auf einen Tag gezogen und die Uhrzeit bestätigt."
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
        maxWidth={760}
        isDirty
        footerActions={[
          { title: 'Abbrechen', variant: 'secondary', onPress: () => setEditorOpen(false) },
          { title: 'Einsatzprofil speichern', loading: saving, onPress: handleSave },
        ]}
      >
        <View style={styles.form}>
          <PremiumInput
            label="Profilname"
            value={draft.profileName}
            placeholder="z. B. Haushalt Montag"
            onChangeText={(profileName) => setDraft((current) => ({ ...current, profileName }))}
            onLightSurface
          />
          <PremiumInput
            label="Einsatzbezeichnung"
            value={draft.assignmentTitle}
            onChangeText={(assignmentTitle) => setDraft((current) => ({ ...current, assignmentTitle }))}
            onLightSurface
          />
          <PremiumInput
            label="Dauer in Minuten"
            value={String(draft.durationMinutes)}
            keyboardType="number-pad"
            onChangeText={(value) =>
              setDraft((current) => ({ ...current, durationMinutes: Number(value.replace(/\D/g, '')) || 0 }))
            }
            hint="Die Dauer wird gespeichert; Datum und Startzeit werden erst im Kalender gewählt."
            onLightSurface
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

          <PremiumInput
            label="Aufgaben"
            value={tasksText}
            onChangeText={setTasksText}
            placeholder={'Eine Aufgabe pro Zeile\nEinkaufen\nWohnung reinigen'}
            multiline
            style={styles.multiline}
            onLightSurface
          />
          <PremiumInput
            label="Einsatzort"
            value={draft.locationAddress}
            onChangeText={(locationAddress) => setDraft((current) => ({ ...current, locationAddress }))}
            onLightSurface
          />
          <PremiumInput
            label="Hinweis für Mitarbeitende"
            value={draft.notesForEmployee}
            onChangeText={(notesForEmployee) => setDraft((current) => ({ ...current, notesForEmployee }))}
            multiline
            onLightSurface
          />
          <PremiumInput
            label="Interne Notiz"
            value={draft.internalNotes}
            onChangeText={(internalNotes) => setDraft((current) => ({ ...current, internalNotes }))}
            multiline
            onLightSurface
          />
          <PremiumInput
            label="Hinweis für Klientenportal"
            value={draft.clientVisibleNotes}
            onChangeText={(clientVisibleNotes) => setDraft((current) => ({ ...current, clientVisibleNotes }))}
            multiline
            onLightSurface
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
  fieldLabel: { ...typography.label },
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
  toggleLabel: { ...typography.body, flex: 1 },
  error: { ...typography.caption, color: colors.error },
});
