import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { FilterChipGroup, InfoBanner, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { legacyColorsFromPalette, useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { useTenantDisplayMeta } from '@/hooks/useTenantDisplayMeta';
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
import { spacing } from '@/theme';

type Props = {
  form: ClientIntakeFormData;
  errors: ClientIntakeErrors;
  tenantId: string | null;
  onChange: (form: ClientIntakeFormData) => void;
  panelViewContext?: LlganViewContext;
};

const OPTIONAL_LABELS: Record<string, string> = {
  confidentiality_release_default: 'Schweigepflichtentbindung',
  communication_consent_default: 'Kommunikation',
  photo_media_consent_default: 'Foto / Medien',
  emergency_contact_consent_default: 'Notfallkontakt',
};

function statusBadgeStyle(
  status: IntakeDocumentState['status'],
  styles: ReturnType<typeof buildStyles>,
) {
  if (status === 'finalized') return styles.badgeOk;
  if (status === 'skipped_optional') return styles.badgeMuted;
  if (status === 'pending_signature' || status === 'preview_open') return styles.badgeWarn;
  return styles.badgeNeutral;
}

function buildStyles(
  content: ReturnType<typeof useAdaptiveContentStyles> | undefined,
  colors: ReturnType<typeof useLegacyTheme>['colors'] | undefined,
) {
  const safeColors = colors ?? legacyColorsFromPalette('dark');
  const title = content?.title ?? { color: careSuiteAuroraTheme.text.primary, fontWeight: '600' as const };
  const body = content?.body ?? { color: careSuiteAuroraTheme.text.primary };
  const caption = content?.caption ?? { color: careSuiteAuroraTheme.text.secondary };
  const subheading = content?.subheading ?? { ...body, marginTop: spacing.sm, fontWeight: '600' as const };
  const error = content?.error ?? { color: safeColors.error };

  return StyleSheet.create({
    wrap: { gap: spacing.md },
    docCard: { gap: spacing.sm, marginBottom: spacing.sm },
    docActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
    docTitleWrap: { flex: 1 },
    docTitle: { ...title },
    docMeta: { ...caption, color: careSuiteAuroraTheme.text.secondary },
    badge: { ...caption, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
    badgeOk: { backgroundColor: 'rgba(16, 185, 129, 0.22)', color: '#6EE7B7' },
    badgeWarn: { backgroundColor: 'rgba(236, 72, 153, 0.18)', color: '#F9A8D4' },
    badgeNeutral: { backgroundColor: 'rgba(255,255,255,0.08)', color: careSuiteAuroraTheme.text.secondary },
    badgeMuted: { backgroundColor: 'rgba(255,255,255,0.06)', color: careSuiteAuroraTheme.text.muted },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: careSuiteAuroraTheme.glass.border,
      backgroundColor: careSuiteAuroraTheme.glass.background,
      marginBottom: spacing.xs,
    },
    toggleCheck: { fontSize: 18, color: careSuiteAuroraTheme.accent.cyan },
    toggleLabel: { ...body, flex: 1, color: careSuiteAuroraTheme.text.primary },
    subheading,
    previewFrame: {
      borderWidth: 1,
      borderColor: safeColors.borderSoft,
      borderRadius: 8,
      overflow: 'hidden',
      maxWidth: 820,
      alignSelf: 'center',
      width: '100%',
      backgroundColor: '#e8e8e8',
    },
    textPreview: { maxHeight: 480, backgroundColor: safeColors.bgElevated, padding: spacing.sm, borderRadius: 8 },
    previewText: {
      ...caption,
      fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined,
      lineHeight: 20,
      color: safeColors.textPrimary,
    },
    sigSection: { gap: spacing.sm, marginTop: spacing.sm },
    checkItem: { ...body, marginBottom: 4 },
    error,
  });
}

export function CareIntakeDocumentsStepPanel({ form, errors, tenantId, onChange, panelViewContext }: Props) {
  const panelCtx = panelViewContext ? { viewContext: panelViewContext } : {};
  const tenantMeta = useTenantDisplayMeta();
  const content = useAdaptiveContentStyles();
  const { colors } = useLegacyTheme();
  const styles = useMemo(() => buildStyles(content, colors), [content, colors]);
  const [templates, setTemplates] = useState<IntakeDocumentTemplate[]>(() => listApplicableIntakeTemplates(form));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [signatureRole, setSignatureRole] = useState<IntakeSignatureRole>('client');
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);

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
      setSignatureModalVisible(false);
    },
    [activeDoc, activeTemplate, form, onChange, signatureRole, tenantMeta],
  );

  const signatureRoleLabel = useMemo(() => {
    if (signatureRole === 'client') return 'Klient:in';
    if (signatureRole === 'employee') return 'Mitarbeitende:r';
    return 'Vertretung';
  }, [signatureRole]);

  const hasRoleSignature = Boolean(activeDoc?.signatures[signatureRole]?.dataUrl);

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

      <SectionPanel {...panelCtx} title="Vertragsart" subtitle="Passend zur gewählten Leistungsart">
        <FilterChipGroup
          options={contractOptions}
          value={form.intakeContractType || contractOptions[0]?.key || ''}
          onChange={handleContractTypeChange}
        />
      </SectionPanel>

      <SectionPanel {...panelCtx} title="Pflichtdokumente">
        {validation.warnings.intakePrivacy || validation.warnings.intakeContract ? (
          <InfoBanner
            variant="info"
            message="Pflichtdokumente können auch nach dem Speichern von Mitarbeitenden im Portal gelesen, unterschrieben und abgeschlossen werden."
          />
        ) : null}
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
                <Text style={[styles.badge, statusBadgeStyle(status, styles)]}>
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
      </SectionPanel>

      <SectionPanel {...panelCtx} title="Optionale Dokumente">
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
              <Text style={[styles.badge, statusBadgeStyle(doc?.status ?? 'not_started', styles)]}>
                {INTAKE_DOCUMENT_STATUS_LABELS[doc?.status ?? 'not_started']}
              </Text>
              <PremiumButton title="Vorschau öffnen" variant="secondary" onPress={() => handleOpenPreview(template)} />
            </PremiumCard>
          );
        })}
      </SectionPanel>

      {activeTemplate && activeDoc ? (
        <SectionPanel {...panelCtx} title="Live-Vorschau" subtitle={activeTemplate.title}>
          {activeDoc.missingPlaceholders.length > 0 ? (
            <InfoBanner
              variant="warning"
              message={`Fehlende Pflichtangaben: ${activeDoc.missingPlaceholders.join(', ')}`}
            />
          ) : null}
          {(activeDoc.unresolvedKeys?.length ?? 0) > 0 ? (
            <InfoBanner
              variant="warning"
              message={`Unvollständige optionale Angaben (im Dokument ausgelassen): ${activeDoc.unresolvedKeys!.join(', ')}`}
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
            <InfoBanner
              variant="info"
              message={'Bitte „Vorschau öffnen" wählen, um das Dokument anzuzeigen.'}
            />
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
              <PremiumButton
                title={hasRoleSignature ? 'Unterschrift erneut erfassen' : 'Unterschrift erfassen'}
                variant="primary"
                onPress={() => setSignatureModalVisible(true)}
              />
              {hasRoleSignature ? (
                <InfoBanner variant="success" message={`Unterschrift (${signatureRoleLabel}) erfasst.`} />
              ) : (
                <InfoBanner
                  variant="info"
                  message="Bitte erst nach vollständiger Dokumentenlektüre unterschreiben."
                />
              )}
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

      {signatureModalVisible && activeTemplate && activeDoc ? (
        <CareSignatureModal
          visible
          label={`${signatureRoleLabel} — Bitte im großen Feld unterschreiben.`}
          onConfirm={handleSignature}
          onClose={() => setSignatureModalVisible(false)}
        />
      ) : null}

      <SectionPanel {...panelCtx} title="Abschlussstatus">
        {validation.checklist.map((item) => (
          <Text key={item.key} style={styles.checkItem}>
            {item.complete ? '✓' : '○'} {item.label}
          </Text>
        ))}
      </SectionPanel>
    </View>
  );
}

export { validateIntakeDocumentsStep };
