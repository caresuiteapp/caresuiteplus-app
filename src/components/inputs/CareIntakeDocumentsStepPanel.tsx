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
  applySharedClientSignatureToDocuments,
  applyDocumentSignature,
  finalizeReadyIntakeDocuments,
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
    batchActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    signatureHero: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: careSuiteAuroraTheme.accent.cyan,
      backgroundColor: 'rgba(30, 144, 255, 0.10)',
    },
    signatureCount: {
      ...title,
      color: careSuiteAuroraTheme.accent.cyan,
      fontSize: 24,
    },
    selectionSummary: { ...body, color: careSuiteAuroraTheme.text.secondary },
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
  const [sharedSignatureModalVisible, setSharedSignatureModalVisible] = useState(false);
  const [sharedSignatureMessage, setSharedSignatureMessage] = useState<string | null>(null);

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
    const repaired = finalizeReadyIntakeDocuments(
      { ...form, intakeDocuments: synced },
      templates,
      tenantMeta,
    );
    if (JSON.stringify(repaired.intakeDocuments) !== JSON.stringify(form.intakeDocuments)) {
      onChange(repaired);
    }
  // Draft restoration is asynchronous. Re-run when its persisted documents
  // arrive, otherwise legacy signatures loaded after the templates never reach
  // the repair path and the contracts step remains marked as incomplete.
  // The generated document also depends on master data such as care level,
  // insurance number and service start. Re-run after those fields change so a
  // document that was already signed can be finalized as soon as the last
  // missing value has been supplied.
  }, [templates, form]);

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
  const assignmentDocument = form.intakeDocuments.find(
    (document) => document.templateKey === assignmentTemplate?.templateKey,
  );
  const selectedTemplates = useMemo(
    () => templates.filter((template) => (
      requiredDocs.some((required) => required.templateKey === template.templateKey)
      || (template.documentType === 'assignment_declaration' && form.intakeAssignmentEnabled)
      || (
        template.documentType === 'additional_consent'
        && form.intakeOptionalConsents.includes(template.templateKey)
      )
    )),
    [form.intakeAssignmentEnabled, form.intakeOptionalConsents, requiredDocs, templates],
  );

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

  const selectAllDocuments = useCallback(() => {
    onChange({
      ...form,
      intakeAssignmentEnabled: true,
      intakeOptionalConsents: [...OPTIONAL_CONSENT_TEMPLATE_KEYS],
    });
    setSharedSignatureMessage(null);
  }, [form, onChange]);

  const clearOptionalSelection = useCallback(() => {
    onChange({
      ...form,
      intakeAssignmentEnabled: false,
      intakeOptionalConsents: [],
    });
    setSharedSignatureMessage(null);
  }, [form, onChange]);

  const handleSharedSignature = useCallback((dataUrl: string) => {
    const result = applySharedClientSignatureToDocuments(
      form,
      templates,
      selectedTemplates.map((template) => template.templateKey),
      dataUrl,
      tenantMeta,
    );
    onChange(result.form);
    setSharedSignatureModalVisible(false);

    const parts = [`${result.signedTemplateKeys.length} Dokumente bestätigt.`];
    if (result.pendingTemplateKeys.length > 0) {
      parts.push(`${result.pendingTemplateKeys.length} warten noch auf eine Mitarbeitenden-Unterschrift.`);
    }
    if (result.errors.length > 0) {
      parts.push(`${result.errors.length} konnten wegen fehlender Angaben nicht bestätigt werden.`);
    }
    setSharedSignatureMessage(parts.join(' '));
  }, [form, onChange, selectedTemplates, templates, tenantMeta]);

  const previewHtml = activeDoc?.previewHtml;
  const signatureSlots = activeTemplate?.signatureSlots ?? [];

  return (
    <View style={styles.wrap}>
      {loadError ? <InfoBanner variant="warning" message={loadError} /> : null}

      <SectionPanel {...panelCtx} title="Vertragsart">
        <FilterChipGroup
          options={contractOptions}
          value={form.intakeContractType || contractOptions[0]?.key || ''}
          onChange={handleContractTypeChange}
        />
      </SectionPanel>

      <SectionPanel {...panelCtx} title="Pflichtdokumente">
        {requiredDocs.map((template) => {
          const doc = form.intakeDocuments.find((d) => d.templateKey === template.templateKey);
          const status = doc?.status ?? 'not_started';
          return (
            <PremiumCard key={template.templateKey} style={styles.docCard}>
              <View style={styles.docHeader}>
                <Text style={styles.toggleCheck}>☑</Text>
                <View style={styles.docTitleWrap}>
                  <Text style={styles.docTitle}>{template.title}</Text>
                  <Text style={styles.docMeta}>
                    Pflicht · {template.source === 'tenant' ? 'Eigene Vorlage' : 'CareSuite-Vorlage'} · v{template.version}
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
              </View>
            </PremiumCard>
          );
        })}
      </SectionPanel>

      <SectionPanel {...panelCtx} title="Zusätzliche Dokumente">
        <View style={styles.batchActions}>
          <PremiumButton title="Alle auswählen" variant="secondary" onPress={selectAllDocuments} />
          <PremiumButton title="Auswahl löschen" variant="ghost" onPress={clearOptionalSelection} />
        </View>
        <Pressable
          style={styles.toggleRow}
          onPress={() => onChange({ ...form, intakeAssignmentEnabled: !form.intakeAssignmentEnabled })}
        >
          <Text style={styles.toggleCheck}>{form.intakeAssignmentEnabled ? '☑' : '☐'}</Text>
          <Text style={styles.toggleLabel}>Abtretungserklärung / Direktabrechnung</Text>
        </Pressable>
        {form.intakeAssignmentEnabled && assignmentTemplate ? (
          <PremiumCard style={styles.docCard}>
            <View style={styles.docHeader}>
              <View style={styles.docTitleWrap}>
                <Text style={styles.docTitle}>{assignmentTemplate.title}</Text>
                {assignmentDocument?.signatures.client?.dataUrl ? (
                  <Text style={styles.docMeta}>Klienten-Unterschrift ist gespeichert.</Text>
                ) : null}
              </View>
              <Text style={[
                styles.badge,
                statusBadgeStyle(assignmentDocument?.status ?? 'not_started', styles),
              ]}>
                {INTAKE_DOCUMENT_STATUS_LABELS[assignmentDocument?.status ?? 'not_started']}
              </Text>
            </View>
            <PremiumButton
              title={assignmentDocument?.status === 'finalized' ? 'Dokument ansehen' : 'Vorschau öffnen'}
              variant="secondary"
              onPress={() => handleOpenPreview(assignmentTemplate)}
            />
            {(assignmentDocument?.missingPlaceholders.length ?? 0) > 0 ? (
              <Text style={styles.error}>
                Noch fehlende Angaben: {assignmentDocument!.missingPlaceholders.join(', ')}
              </Text>
            ) : null}
            {errors.intakeAssignment ? <Text style={styles.error}>{errors.intakeAssignment}</Text> : null}
          </PremiumCard>
        ) : null}

        <Text style={styles.subheading}>Einwilligungen</Text>
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

      <SectionPanel
        {...panelCtx}
        title="Dokumentenpaket"
      >
        <View style={styles.signatureHero}>
          <Text style={styles.signatureCount}>{selectedTemplates.length} Dokumente</Text>
          <Text style={styles.selectionSummary}>
            Eine Unterschrift bestätigt das gesamte ausgewählte Paket.
          </Text>
          <PremiumButton
            title="Jetzt gemeinsam unterschreiben"
            variant="primary"
            disabled={selectedTemplates.length === 0}
            onPress={() => {
              setSharedSignatureMessage(null);
              setSharedSignatureModalVisible(true);
            }}
          />
        </View>
        {sharedSignatureMessage ? (
          <InfoBanner
            variant={sharedSignatureMessage.includes('konnten') ? 'warning' : 'success'}
            message={sharedSignatureMessage}
          />
        ) : null}
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
          ) : null}

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
              ) : null}
              <PremiumButton
                title="Dokument abschließen und sperren"
                onPress={handleFinalize}
                disabled={activeDoc.missingPlaceholders.length > 0}
              />
            </View>
          ) : null}

          {activeDoc.status === 'finalized' ? (
            <InfoBanner variant="success" message="Dokument abgeschlossen und gesperrt." />
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

      {sharedSignatureModalVisible ? (
        <CareSignatureModal
          visible
          label={`Klient:in · ${selectedTemplates.length} Dokumente`}
          onConfirm={handleSharedSignature}
          onClose={() => setSharedSignatureModalVisible(false)}
        />
      ) : null}

      {validation.checklist.some((item) => !item.complete) ? (
        <SectionPanel {...panelCtx} title="Noch offen">
          {validation.checklist.filter((item) => !item.complete).map((item) => (
          <Text key={item.key} style={styles.checkItem}>
            ○ {item.label}
          </Text>
          ))}
        </SectionPanel>
      ) : null}
    </View>
  );
}

export { validateIntakeDocumentsStep };
