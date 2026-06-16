import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CareSignatureCanvas } from '@/components/inputs/CareSignatureCanvas';
import { FilterChipGroup, InfoBanner, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { getServiceMode } from '@/lib/services/mode';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import {
  listAvailableContractTypes,
  listApplicableIntakeTemplates,
  resolveContractTemplateKey,
} from '@/features/intakeDocuments/buildIntakeDocumentContext';
import {
  applyDocumentSignature,
  finalizeDocument,
  getTemplateForDocument,
  loadIntakeDocumentTemplates,
  openDocumentPreview,
  syncIntakeDocumentsWithTemplates,
  updateIntakeDocumentInForm,
} from '@/features/intakeDocuments/intakeDocumentService';
import {
  INTAKE_CONTRACT_TYPE_LABELS,
  INTAKE_DOCUMENT_STATUS_LABELS,
  OPTIONAL_CONSENT_TEMPLATE_KEYS,
  type IntakeContractTypeKey,
  type IntakeDocumentState,
  type IntakeDocumentTemplate,
  type IntakeSignatureRole,
} from '@/features/intakeDocuments/intakeDocumentTypes';
import { validateIntakeDocumentsStep } from '@/features/intakeDocuments/validateIntakeDocuments';
import { colors, spacing, typography } from '@/theme';

type Props = {
  form: ClientIntakeFormData;
  errors: ClientIntakeErrors;
  tenantId: string | null;
  onChange: (form: ClientIntakeFormData) => void;
};

const OPTIONAL_LABELS: Record<string, string> = {
  confidentiality_release_default: 'Schweigepflichtentbindung',
  communication_consent_default: 'Kommunikation',
  photo_media_consent_default: 'Foto / Medien',
  emergency_contact_consent_default: 'Notfallkontakt',
};

function statusBadgeStyle(status: IntakeDocumentState['status']) {
  if (status === 'finalized') return styles.badgeOk;
  if (status === 'skipped_optional') return styles.badgeMuted;
  if (status === 'pending_signature' || status === 'preview_open') return styles.badgeWarn;
  return styles.badgeNeutral;
}

export function CareIntakeDocumentsStepPanel({ form, errors, tenantId, onChange }: Props) {
  const tenantName = useTenantDisplayName();
  const [templates, setTemplates] = useState<IntakeDocumentTemplate[]>(() => listApplicableIntakeTemplates(form));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [signatureRole, setSignatureRole] = useState<IntakeSignatureRole>('client');

  const contractOptions = useMemo(
    () => listAvailableContractTypes(form.careContexts).map((key) => ({
      key,
      label: INTAKE_CONTRACT_TYPE_LABELS[key],
    })),
    [form.careContexts],
  );

  useEffect(() => {
    if (!tenantId || getServiceMode() !== 'supabase') {
      setTemplates(listApplicableIntakeTemplates(form));
      return;
    }
    void loadIntakeDocumentTemplates(tenantId, form).then((result) => {
      if (result.ok) {
        setTemplates(result.data);
        setLoadError(null);
      } else {
        setLoadError(result.error);
        setTemplates(listApplicableIntakeTemplates(form));
      }
    });
  }, [tenantId, form.careContexts, form.intakeContractType, form.intakeAssignmentEnabled, form.intakeOptionalConsents]);

  useEffect(() => {
    const synced = syncIntakeDocumentsWithTemplates(form, templates);
    if (JSON.stringify(synced) !== JSON.stringify(form.intakeDocuments)) {
      onChange({ ...form, intakeDocuments: synced });
    }
  }, [templates]);

  const validation = useMemo(() => validateIntakeDocumentsStep(form, templates), [form, templates]);

  const activeTemplate = activeKey ? getTemplateForDocument(templates, activeKey) : undefined;
  const activeDoc = activeKey
    ? form.intakeDocuments.find((d) => d.templateKey === activeKey)
    : undefined;

  const tenantMeta = { name: tenantName };

  const requiredDocs = useMemo(
    () => templates.filter(
      (t) => t.documentType === 'privacy_consent'
        || (t.documentType === 'client_contract' && t.templateKey === resolveContractTemplateKey(form)),
    ),
    [templates, form.intakeContractType, form.careContexts],
  );
  const optionalDocs = templates.filter((t) => t.documentType === 'additional_consent');
  const assignmentTemplate = templates.find((t) => t.documentType === 'assignment_declaration');

  const handleContractTypeChange = (key: string) => {
    onChange({
      ...form,
      intakeContractType: key as IntakeContractTypeKey,
      intakeDocuments: [],
    });
    setActiveKey(null);
  };

  const handleOpenPreview = useCallback(
    (template: IntakeDocumentTemplate) => {
      const opened = openDocumentPreview(form, template, tenantMeta);
      onChange(updateIntakeDocumentInForm(form, opened));
      setActiveKey(template.templateKey);
      setSignatureRole(template.signatureSlots[0]?.role ?? 'client');
    },
    [form, onChange, tenantMeta],
  );

  const handleSignDocument = useCallback(
    (template: IntakeDocumentTemplate) => {
      const doc = form.intakeDocuments.find((d) => d.templateKey === template.templateKey);
      if (!doc?.previewHtml) {
        handleOpenPreview(template);
        return;
      }
      setActiveKey(template.templateKey);
      setSignatureRole(template.signatureSlots[0]?.role ?? 'client');
    },
    [form.intakeDocuments, handleOpenPreview],
  );

  const handleSignature = useCallback(
    (dataUrl: string) => {
      if (!activeTemplate || !activeDoc) return;
      const updated = applyDocumentSignature(
        activeDoc,
        activeTemplate,
        form,
        signatureRole,
        { role: signatureRole, dataUrl, signedAt: new Date().toISOString() },
        tenantMeta,
      );
      onChange(updateIntakeDocumentInForm(form, updated));
    },
    [activeDoc, activeTemplate, form, onChange, signatureRole, tenantMeta],
  );

  const handleFinalize = useCallback(() => {
    if (!activeTemplate || !activeDoc) return;
    const result = finalizeDocument(activeDoc, activeTemplate, form, tenantMeta);
    if (!result.ok) return;
    onChange(updateIntakeDocumentInForm(form, result.document));
  }, [activeDoc, activeTemplate, form, onChange, tenantMeta]);

  const toggleOptionalConsent = (key: string) => {
    const has = form.intakeOptionalConsents.includes(key);
    onChange({
      ...form,
      intakeOptionalConsents: has
        ? form.intakeOptionalConsents.filter((k) => k !== key)
        : [...form.intakeOptionalConsents, key],
    });
  };

  const previewHtml = activeDoc?.previewHtml;
  const signatureSlots = activeTemplate?.signatureSlots ?? [];

  return (
    <View style={styles.wrap}>
      {loadError ? <InfoBanner variant="warning" message={loadError} /> : null}
      {getServiceMode() === 'supabase' ? (
        <InfoBanner variant="info" message="Systemvorlage — vom Mandanten prüfbar. Keine automatische Rechtsberatung." />
      ) : null}

      <SectionPanel title="Vertragsart" subtitle="Passend zur gewählten Leistungsart">
        <FilterChipGroup
          options={contractOptions}
          value={form.intakeContractType || contractOptions[0]?.key || ''}
          onChange={handleContractTypeChange}
        />
      </SectionPanel>

      <SectionPanel title="Pflichtdokumente">
        {requiredDocs.map((template) => {
          const doc = form.intakeDocuments.find((d) => d.templateKey === template.templateKey);
          const status = doc?.status ?? 'not_started';
          return (
            <PremiumCard key={template.templateKey} style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={styles.docTitleWrap}>
                  <Text style={styles.docTitle}>{template.title}</Text>
                  <Text style={styles.docMeta}>
                    {template.source === 'tenant' ? 'Mandantenvorlage' : 'Systemvorlage'} · v{template.version}
                  </Text>
                </View>
                <Text style={[styles.badge, statusBadgeStyle(status)]}>
                  {INTAKE_DOCUMENT_STATUS_LABELS[status]}
                </Text>
              </View>
              <View style={styles.docActions}>
                <PremiumButton
                  title={status === 'finalized' ? 'Dokument ansehen' : 'Vorschau öffnen'}
                  variant="secondary"
                  onPress={() => handleOpenPreview(template)}
                />
                {status !== 'finalized' && template.signatureSlots.length > 0 ? (
                  <PremiumButton
                    title="Unterschreiben"
                    variant="primary"
                    onPress={() => handleSignDocument(template)}
                  />
                ) : null}
              </View>
            </PremiumCard>
          );
        })}
        {errors.intakePrivacy ? <Text style={styles.error}>{errors.intakePrivacy}</Text> : null}
        {errors.intakeContract ? <Text style={styles.error}>{errors.intakeContract}</Text> : null}
      </SectionPanel>

      <SectionPanel title="Optionale Dokumente">
        <Pressable
          style={styles.toggleRow}
          onPress={() => onChange({ ...form, intakeAssignmentEnabled: !form.intakeAssignmentEnabled })}
        >
          <Text style={styles.toggleCheck}>{form.intakeAssignmentEnabled ? '☑' : '☐'}</Text>
          <Text style={styles.toggleLabel}>Abtretungserklärung / Direktabrechnung</Text>
        </Pressable>
        {form.intakeAssignmentEnabled && assignmentTemplate ? (
          <PremiumCard style={styles.docCard}>
            <Text style={styles.docTitle}>{assignmentTemplate.title}</Text>
            <PremiumButton title="Vorschau öffnen" variant="secondary" onPress={() => handleOpenPreview(assignmentTemplate)} />
            {errors.intakeAssignment ? <Text style={styles.error}>{errors.intakeAssignment}</Text> : null}
          </PremiumCard>
        ) : null}

        <Text style={styles.subheading}>Zusatz-Einwilligungen</Text>
        {OPTIONAL_CONSENT_TEMPLATE_KEYS.map((key) => (
          <Pressable key={key} style={styles.toggleRow} onPress={() => toggleOptionalConsent(key)}>
            <Text style={styles.toggleCheck}>{form.intakeOptionalConsents.includes(key) ? '☑' : '☐'}</Text>
            <Text style={styles.toggleLabel}>{OPTIONAL_LABELS[key] ?? key}</Text>
          </Pressable>
        ))}
        {optionalDocs.map((template) => {
          if (!form.intakeOptionalConsents.includes(template.templateKey)) return null;
          const doc = form.intakeDocuments.find((d) => d.templateKey === template.templateKey);
          return (
            <PremiumCard key={template.templateKey} style={styles.docCard}>
              <Text style={styles.docTitle}>{template.title}</Text>
              <Text style={[styles.badge, statusBadgeStyle(doc?.status ?? 'not_started')]}>
                {INTAKE_DOCUMENT_STATUS_LABELS[doc?.status ?? 'not_started']}
              </Text>
              <PremiumButton title="Vorschau öffnen" variant="secondary" onPress={() => handleOpenPreview(template)} />
            </PremiumCard>
          );
        })}
      </SectionPanel>

      {activeTemplate && activeDoc ? (
        <SectionPanel title="Live-Vorschau" subtitle={activeTemplate.title}>
          {activeDoc.missingPlaceholders.length > 0 ? (
            <InfoBanner
              variant="warning"
              message={`Fehlende Pflichtangaben: ${activeDoc.missingPlaceholders.join(', ')}`}
            />
          ) : null}

          {Platform.OS === 'web' && previewHtml ? (
            <View style={styles.previewFrame}>
              <iframe
                title="Dokumentvorschau"
                srcDoc={previewHtml}
                style={{
                  width: '100%',
                  height: 560,
                  border: 'none',
                  backgroundColor: '#e8e8e8',
                  display: 'block',
                }}
                sandbox="allow-same-origin"
              />
            </View>
          ) : previewHtml ? (
            <ScrollView style={styles.textPreview} nestedScrollEnabled>
              <Text style={styles.previewText}>
                {previewHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
              </Text>
            </ScrollView>
          ) : (
            <InfoBanner variant="info" message="Bitte „Vorschau öffnen" wählen, um das Dokument anzuzeigen." />
          )}

          {signatureSlots.length > 0 && activeDoc.status !== 'finalized' ? (
            <View style={styles.sigSection}>
              <Text style={styles.subheading}>Unterschrift</Text>
              {signatureSlots.length > 1 ? (
                <FilterChipGroup
                  options={signatureSlots.map((s) => ({
                    key: s.role,
                    label: s.role === 'client' ? 'Klient:in' : s.role === 'employee' ? 'Mitarbeitende:r' : 'Vertretung',
                  }))}
                  value={signatureRole}
                  onChange={(v) => setSignatureRole(v as IntakeSignatureRole)}
                />
              ) : null}
              <CareSignatureCanvas
                label="Bitte hier unterschreiben — erst nach vollständiger Dokumentenlektüre."
                onConfirm={handleSignature}
              />
              <PremiumButton
                title="Dokument abschließen und sperren"
                onPress={handleFinalize}
                disabled={activeDoc.missingPlaceholders.length > 0}
              />
            </View>
          ) : null}

          {activeDoc.status === 'finalized' ? (
            <InfoBanner variant="success" message="Dokument abgeschlossen — Inhalt und Unterschriften gesperrt." />
          ) : null}
        </SectionPanel>
      ) : null}

      <SectionPanel title="Abschlussstatus">
        {validation.checklist.map((item) => (
          <Text key={item.key} style={styles.checkItem}>
            {item.complete ? '✓' : '○'} {item.label}
          </Text>
        ))}
      </SectionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  docCard: { gap: spacing.sm, marginBottom: spacing.sm },
  docActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  docTitleWrap: { flex: 1 },
  docTitle: { ...typography.body, fontWeight: '600' },
  docMeta: { ...typography.caption, color: colors.textMuted },
  badge: { ...typography.caption, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  badgeOk: { backgroundColor: '#d4edda', color: '#155724' },
  badgeWarn: { backgroundColor: '#fff3cd', color: '#856404' },
  badgeNeutral: { backgroundColor: colors.bgElevated, color: colors.textMuted },
  badgeMuted: { backgroundColor: colors.bgElevated, color: colors.textMuted },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  toggleCheck: { fontSize: 18 },
  toggleLabel: { ...typography.body, flex: 1 },
  subheading: { ...typography.body, fontWeight: '600', marginTop: spacing.sm },
  previewFrame: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    overflow: 'hidden',
    maxWidth: 820,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: '#e8e8e8',
  },
  textPreview: { maxHeight: 480, backgroundColor: colors.bgElevated, padding: spacing.sm, borderRadius: 8 },
  previewText: { ...typography.caption, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined, lineHeight: 20 },
  sigSection: { gap: spacing.sm, marginTop: spacing.sm },
  checkItem: { ...typography.body, marginBottom: 4 },
  error: { ...typography.caption, color: colors.error },
});

export { validateIntakeDocumentsStep };
