import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlatformModal } from '@/components/layout/platform';
import {
  InfoBanner,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { CareTimeInput } from '@/components/inputs';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchTenantServiceCatalog } from '@/lib/tenant/tenantServiceCatalogService';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchAssignmentEmployeeList } from '@/lib/assist/assignmentEmployeeListService';
import { createVisitFromWizard } from '@/lib/assist/visitService';
import {
  EMPTY_VISIT_WIZARD_DATA,
  VISIT_CREATE_WIZARD_STEPS,
  type VisitCreateWizardData,
  type VisitCreateWizardStepKey,
} from '@/lib/assist/visitTypes';
import { spacing, typography } from '@/theme';

type AssignmentCreateWizardProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
};

type SelectOption = { value: string; label: string };

function StepIndicator({ current, total }: { current: number; total: number }) {
  const text = useAuroraAdaptiveText();
  return (
    <Text style={[stepStyles.indicator, { color: text.muted }]}>
      Schritt {current + 1} von {total}
    </Text>
  );
}

const stepStyles = StyleSheet.create({
  indicator: { ...typography.caption, marginBottom: spacing.sm },
});

export function AssignmentCreateWizard({ visible, onClose, onCreated }: AssignmentCreateWizardProps) {
  const assistAccent = moduleColor('assist');
  const text = useAuroraAdaptiveText();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const canManage = can('assist.assignments.manage');

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<VisitCreateWizardData>(EMPTY_VISIT_WIZARD_DATA);
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);
  const [services, setServices] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const step = VISIT_CREATE_WIZARD_STEPS[stepIndex];
  const isLastStep = stepIndex === VISIT_CREATE_WIZARD_STEPS.length - 1;

  const patch = useCallback((partial: Partial<VisitCreateWizardData>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    if (!visible || !tenantId) return;
    setStepIndex(0);
    setForm(EMPTY_VISIT_WIZARD_DATA);
    setError(null);
    setConflicts([]);

    void (async () => {
      const [clientRes, employeeRes, catalogRes] = await Promise.all([
        fetchClientList(tenantId, profile?.roleKey, { lifecycleFilter: 'active' }),
        fetchAssignmentEmployeeList(tenantId, profile?.roleKey),
        fetchTenantServiceCatalog(tenantId, profile?.roleKey),
      ]);
      if (clientRes.ok) {
        setClients(
          clientRes.data.map((c) => ({
            value: c.id,
            label: `${c.firstName} ${c.lastName}`.trim(),
          })),
        );
      }
      if (employeeRes.ok) {
        setEmployees(
          employeeRes.data.map((e) => ({
            value: e.id,
            label: `${e.firstName} ${e.lastName}`.trim(),
          })),
        );
      }
      if (catalogRes.ok) {
        setServices(
          catalogRes.data.items
            .filter((item) => item.isActive && item.moduleKey === 'assist')
            .map((item) => ({
              value: item.serviceKey,
              label: item.name,
            })),
        );
      }
    })();
  }, [visible, tenantId, profile?.roleKey]);

  const budgetPreview = useMemo(() => {
    if (!form.budgetAmountCents) return null;
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
      form.budgetAmountCents / 100,
    );
  }, [form.budgetAmountCents]);

  const durationMinutes = useMemo(() => {
    const start = new Date(`${form.assignmentDate}T${form.plannedStartTime}:00`);
    const end = new Date(`${form.assignmentDate}T${form.plannedEndTime}:00`);
    const diff = end.getTime() - start.getTime();
    if (diff <= 0) return 0;
    return Math.round(diff / 60000);
  }, [form.assignmentDate, form.plannedStartTime, form.plannedEndTime]);

  const handleNext = async () => {
    if (!isLastStep) {
      setStepIndex((i) => i + 1);
      return;
    }
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const result = await createVisitFromWizard(tenantId, form, profile?.roleKey);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConflicts(result.data.conflicts);
    onCreated?.(result.data.id);
    onClose();
  };

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else onClose();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { padding: careSpacing.md, gap: spacing.md },
        stepTitle: { ...typography.h3, color: text.primary, marginBottom: spacing.sm },
        footer: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: spacing.sm,
          padding: careSpacing.md,
          borderTopWidth: 1,
          borderTopColor: auroraGlass.border,
        },
        optionList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        hint: { ...typography.caption, color: text.muted },
        previewLine: { ...typography.body, color: text.primary, marginBottom: 4 },
      }),
    [text.muted, text.primary],
  );

  const renderStep = (key: VisitCreateWizardStepKey) => {
    switch (key) {
      case 'grunddaten':
        return (
          <SectionPanel title="Grunddaten">
            <PremiumInput
              label="Bezeichnung"
              value={form.title}
              onChangeText={(title) => patch({ title })}
              placeholder="z. B. Alltagsbegleitung"
            />
            <PremiumInput
              label="Beschreibung"
              value={form.description}
              onChangeText={(description) => patch({ description })}
              placeholder="Optional"
              multiline
            />
          </SectionPanel>
        );
      case 'klient':
        return (
          <SectionPanel title="Klient:in" subtitle="Aus Mandantenstamm (Supabase)">
            <PremiumInput
              label="Klient:in"
              value={form.clientId}
              onChangeText={(clientId) => patch({ clientId })}
              placeholder="Klienten-ID oder aus Liste wählen"
              hint={
                clients.length > 0
                  ? clients.map((c) => c.label).slice(0, 5).join(' · ')
                  : 'Klienten werden geladen…'
              }
            />
            {clients.length > 0 ? (
              <View style={styles.optionList}>
                {clients.slice(0, 8).map((c) => (
                  <PremiumButton
                    key={c.value}
                    title={c.label}
                    size="sm"
                    variant={form.clientId === c.value ? 'primary' : 'secondary'}
                    onPress={() => patch({ clientId: c.value })}
                  />
                ))}
              </View>
            ) : null}
          </SectionPanel>
        );
      case 'leistung':
        return (
          <SectionPanel title="Leistung & Aufgaben" subtitle="Aus Mandanten-Leistungskatalog">
            <PremiumInput
              label="Leistung"
              value={form.serviceKey}
              onChangeText={(serviceKey) => {
                const match = services.find((s) => s.value === serviceKey);
                patch({ serviceKey, serviceName: match?.label ?? serviceKey });
              }}
              placeholder="Leistungsschlüssel"
            />
            {services.length > 0 ? (
              <View style={styles.optionList}>
                {services.map((s) => (
                  <PremiumButton
                    key={s.value}
                    title={s.label}
                    size="sm"
                    variant={form.serviceKey === s.value ? 'primary' : 'secondary'}
                    onPress={() => patch({ serviceKey: s.value, serviceName: s.label })}
                  />
                ))}
              </View>
            ) : null}
            {form.tasks.map((task, index) => (
              <PremiumInput
                key={`task-${index}`}
                label={`Aufgabe ${index + 1}`}
                value={task}
                onChangeText={(value) => {
                  const tasks = [...form.tasks];
                  tasks[index] = value;
                  patch({ tasks });
                }}
              />
            ))}
            <PremiumButton
              title="Aufgabe hinzufügen"
              variant="ghost"
              size="sm"
              onPress={() => patch({ tasks: [...form.tasks, ''] })}
            />
          </SectionPanel>
        );
      case 'zeit':
        return (
          <SectionPanel title="Zeit">
            <PremiumInput
              label="Datum"
              value={form.assignmentDate}
              onChangeText={(assignmentDate) => patch({ assignmentDate })}
              placeholder="JJJJ-MM-TT"
            />
            <CareTimeInput
              label="Start"
              value={form.plannedStartTime}
              onChange={(plannedStartTime) => patch({ plannedStartTime })}
              showFormatHint={false}
            />
            <CareTimeInput
              label="Ende"
              value={form.plannedEndTime}
              onChange={(plannedEndTime) => patch({ plannedEndTime })}
              showFormatHint={false}
            />
            <Text style={styles.hint}>Dauer: {durationMinutes} Minuten</Text>
          </SectionPanel>
        );
      case 'mitarbeiter':
        return (
          <SectionPanel title="Mitarbeiter">
            {employees.length > 0 ? (
              <View style={styles.optionList}>
                {employees.map((e) => (
                  <PremiumButton
                    key={e.value}
                    title={e.label}
                    size="sm"
                    variant={form.employeeId === e.value ? 'primary' : 'secondary'}
                    onPress={() => patch({ employeeId: e.value })}
                  />
                ))}
              </View>
            ) : (
              <PremiumInput
                label="Mitarbeitende:r"
                value={form.employeeId}
                onChangeText={(employeeId) => patch({ employeeId })}
              />
            )}
          </SectionPanel>
        );
      case 'ort':
        return (
          <SectionPanel title="Ort">
            <PremiumInput
              label="Adresse"
              value={form.addressSnapshot}
              onChangeText={(addressSnapshot) => patch({ addressSnapshot })}
              placeholder="Einsatzadresse"
            />
            <PremiumInput
              label="Ortshinweise"
              value={form.locationNotes}
              onChangeText={(locationNotes) => patch({ locationNotes })}
              placeholder="z. B. 2. OG, Klingel Müller"
            />
          </SectionPanel>
        );
      case 'budget':
        return (
          <SectionPanel title="Budget" subtitle="Vorschau-Berechnung">
            <PremiumInput
              label="Budget (Cent)"
              value={form.budgetAmountCents?.toString() ?? ''}
              onChangeText={(raw) => {
                const cents = parseInt(raw.replace(/\D/g, ''), 10);
                patch({ budgetAmountCents: Number.isFinite(cents) ? cents : null });
              }}
              placeholder="z. B. 3800 = 38,00 €"
              keyboardType="numeric"
            />
            {budgetPreview ? (
              <Text style={styles.hint}>Vorschau: {budgetPreview} ({durationMinutes} Min.)</Text>
            ) : null}
          </SectionPanel>
        );
      case 'dokumentation':
        return (
          <SectionPanel title="Dokumentation">
            <PremiumInput
              label="Vorlage"
              value={form.documentationTemplate}
              onChangeText={(documentationTemplate) => patch({ documentationTemplate })}
            />
            <PremiumInput
              label="Interne Notizen"
              value={form.internalNotes}
              onChangeText={(internalNotes) => patch({ internalNotes })}
              multiline
            />
          </SectionPanel>
        );
      case 'benachrichtigungen':
        return (
          <SectionPanel title="Benachrichtigungen & Portal">
            <View style={styles.optionList}>
              <PremiumButton
                title={form.notifyEmployee ? '✓ Mitarbeiter benachrichtigen' : 'Mitarbeiter benachrichtigen'}
                variant={form.notifyEmployee ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => patch({ notifyEmployee: !form.notifyEmployee })}
              />
              <PremiumButton
                title={form.notifyClient ? '✓ Klient benachrichtigen' : 'Klient benachrichtigen'}
                variant={form.notifyClient ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => patch({ notifyClient: !form.notifyClient })}
              />
              <PremiumButton
                title={form.portalReleaseEnabled ? '✓ Portal-Freigabe' : 'Portal-Freigabe vormerken'}
                variant={form.portalReleaseEnabled ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => patch({ portalReleaseEnabled: !form.portalReleaseEnabled })}
              />
            </View>
            <Text style={styles.hint}>
              {/* TODO: Portal release integration */}
              Portal-Freigabe wird nach Anlage über Disposition gesteuert.
            </Text>
          </SectionPanel>
        );
      case 'vorschau':
        return (
          <SectionPanel title="Vorschau">
            <Text style={styles.previewLine}>Leistung: {form.serviceName || form.title}</Text>
            <Text style={styles.previewLine}>
              Klient: {clients.find((c) => c.value === form.clientId)?.label ?? form.clientId}
            </Text>
            <Text style={styles.previewLine}>
              Mitarbeiter: {employees.find((e) => e.value === form.employeeId)?.label ?? '—'}
            </Text>
            <Text style={styles.previewLine}>
              Zeit: {form.assignmentDate} {form.plannedStartTime}–{form.plannedEndTime}
            </Text>
            <Text style={styles.previewLine}>Dauer: {durationMinutes} Min.</Text>
            <Text style={styles.previewLine}>Ort: {form.addressSnapshot || '—'}</Text>
            <Text style={styles.previewLine}>
              Aufgaben: {form.tasks.filter((t) => t.trim()).length}
            </Text>
            {budgetPreview ? (
              <Text style={styles.previewLine}>Budget: {budgetPreview}</Text>
            ) : null}
            {conflicts.length > 0 ? (
              <InfoBanner message={conflicts.join(' · ')} variant="warning" />
            ) : null}
          </SectionPanel>
        );
      default:
        return null;
    }
  };

  if (!canManage) return null;

  return (
    <PlatformModal
      visible={visible}
      onClose={onClose}
      title="Neuer Einsatz"
      subtitle={step.label}
      onBack={handleBack}
      maxWidth={960}
      maxHeightRatio={0.92}
      glowColor={assistAccent}
      bodyStyle={{ backgroundColor: auroraGlass.modal }}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <StepIndicator current={stepIndex} total={VISIT_CREATE_WIZARD_STEPS.length} />
        <Text style={styles.stepTitle}>{step.label}</Text>
        {error ? <InfoBanner message={error} variant="danger" /> : null}
        {renderStep(step.key)}
      </ScrollView>
      <View style={styles.footer}>
        <PremiumButton title="Zurück" variant="ghost" onPress={handleBack} />
        <PremiumButton
          title={isLastStep ? 'Einsatz anlegen' : 'Weiter'}
          onPress={handleNext}
          loading={loading}
        />
      </View>
    </PlatformModal>
  );
}
