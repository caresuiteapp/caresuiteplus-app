import { useCallback, useEffect, useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuroraSegmentedControl } from '@/components/aurora';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useDocumentModuleTemplates } from '@/hooks/documents/useDocumentModuleTemplates';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchEmployeeList } from '@/lib/office/employeeListService';
import {
  inferSignatureRequirementFromFields,
  insertSignatureFieldIntoHtml,
  parseSignatureFieldsFromHtml,
} from '@/lib/portal/portalSignatureFieldParser';
import type { ComposeOfficeSignatureDocumentInput } from '@/lib/portal/officeSignatureDocumentComposerService';
import type { DocumentEngineTemplateListItem } from '@/types/documents/documentEngine';
import type {
  PortalSignatureDocumentType,
  PortalSignaturePriority,
  PortalSignatureRecipientType,
  PortalSignatureRequirement,
} from '@/types/portal/documentSignatures';
import {
  PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS,
  PORTAL_SIGNATURE_PRIORITY_LABELS,
} from '@/types/portal/documentSignatures';
import { SYSTEM_DOCUMENT_CATALOG_TEMPLATES } from '@/data/seeds/documentCatalog';
import { buildDocumentPreview } from '@/features/documents/templateEngine';
import { buildDocumentContext } from '@/features/documents/templateEngine/documentContext';
import type { DocumentEntityType, DocumentTemplateTypeKey } from '@/features/documents/templateEngine/types';
import { runLivePreview } from '@/lib/documents/documentTemplateService';
import { fetchTenantDocumentSettings, mergeTenantSettingsIntoContext } from '@/lib/documents/tenantDocumentSettingsService';
import { spacing, typography } from '@/theme';

const DOCUMENT_TYPES = Object.keys(PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS) as PortalSignatureDocumentType[];

type SourceTab = ComposeOfficeSignatureDocumentInput['sourceType'];

type Props = {
  accentColor: string;
  onCancel: () => void;
  onSubmit: (
    input: Omit<ComposeOfficeSignatureDocumentInput, 'tenantId' | 'creatorName' | 'creatorProfileId'>,
  ) => Promise<{ ok: boolean; error?: string }>;
};

async function buildTemplateHtml(
  tenantId: string,
  template: DocumentEngineTemplateListItem,
  actorRoleKey: string | null | undefined,
  entityType: DocumentEntityType,
  entityId: string,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  if (!template.id.startsWith('catalog-')) {
    const live = await runLivePreview(
      { tenantId, templateId: template.id, sampleId: 'sample-demo' },
      actorRoleKey,
    );
    if (live.ok) return { ok: true, html: live.data.html };
    return live;
  }

  const catalogEntry = SYSTEM_DOCUMENT_CATALOG_TEMPLATES.find((t) => t.templateKey === template.templateKey);
  if (!catalogEntry) return { ok: false, error: 'Katalogvorlage nicht gefunden.' };

  const contextResult = await buildDocumentContext(entityType, entityId, tenantId);
  if (!contextResult.ok) return { ok: false, error: contextResult.error };

  const settingsResult = await fetchTenantDocumentSettings(tenantId, actorRoleKey);
  const settings = settingsResult.ok ? settingsResult.data : null;
  const context = settings
    ? mergeTenantSettingsIntoContext(contextResult.context, settings)
    : contextResult.context;

  const preview = buildDocumentPreview({
    templateVersion: {
      htmlTemplate: catalogEntry.htmlTemplate,
      cssTemplate: catalogEntry.cssTemplate,
      requiredFields: (catalogEntry.manualFields ?? []).map((f) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        dataPath: `manual.${f.fieldKey}`,
        isRequired: false,
      })),
    },
    context,
    documentType: (catalogEntry.templateType as DocumentTemplateTypeKey) ?? 'generic',
    tenantDocumentSettings: settings,
    showDraftWatermark: true,
  });

  return { ok: true, html: preview.html };
}

const DEFAULT_WRITE_HTML = `<h1>Dokumenttitel</h1>
<p>Bitte lesen Sie dieses Dokument vollständig und unterschreiben Sie an der markierten Stelle.</p>`;

export function OfficeSignatureDocumentComposer({ accentColor, onCancel, onSubmit }: Props) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const [sourceTab, setSourceTab] = useState<SourceTab>('template');
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<PortalSignatureDocumentType>('sonstiges');
  const [recipientType, setRecipientType] = useState<PortalSignatureRecipientType>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [clientId, setClientId] = useState('');
  const [signatureRequirement, setSignatureRequirement] =
    useState<PortalSignatureRequirement>('employee');
  const [priority, setPriority] = useState<PortalSignaturePriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [requiredBeforeAssignment, setRequiredBeforeAssignment] = useState(false);
  const [htmlContent, setHtmlContent] = useState(DEFAULT_WRITE_HTML);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { templates, loading: templatesLoading } = useDocumentModuleTemplates({
    tenantId,
    targetModule: 'office',
    targetArea: 'hr',
  });

  const employeesQuery = useAsyncQuery(
    () => fetchEmployeeList(tenantId!, profile?.roleKey, profile),
    [tenantId, profile?.roleKey, profile?.id],
    { enabled: !!tenantId },
  );
  const clientsQuery = useAsyncQuery(
    () => fetchClientList(tenantId!, profile?.roleKey, { lifecycleFilter: 'active' }),
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const employeeOptions = useMemo(
    () =>
      (employeesQuery.data ?? []).map((employee) => ({
        key: employee.id,
        label: `${employee.firstName} ${employee.lastName}`.trim(),
      })),
    [employeesQuery.data],
  );
  const clientOptions = useMemo(
    () =>
      (clientsQuery.data ?? []).map((client) => ({
        key: client.id,
        label: `${client.firstName} ${client.lastName}`.trim(),
      })),
    [clientsQuery.data],
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? templates[0] ?? null,
    [templates, selectedTemplateId],
  );

  const signatureFields = useMemo(() => parseSignatureFieldsFromHtml(htmlContent), [htmlContent]);

  useEffect(() => {
    if (signatureFields.length > 0) {
      setSignatureRequirement(inferSignatureRequirementFromFields(signatureFields));
    }
  }, [signatureFields]);

  const loadTemplatePreview = useCallback(async () => {
    if (!tenantId || !selectedTemplate) return;
    setTemplateLoading(true);
    setError(null);
    const entityType: DocumentEntityType = recipientType === 'client' && clientId ? 'client' : 'client';
    const entityId = clientId || 'client-001';
    const built = await buildTemplateHtml(
      tenantId,
      selectedTemplate,
      profile?.roleKey,
      entityType,
      entityId,
    );
    setTemplateLoading(false);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setHtmlContent(built.data);
  }, [tenantId, selectedTemplate, recipientType, clientId, profile?.roleKey]);

  useEffect(() => {
    if (sourceTab === 'template' && selectedTemplate && tenantId) {
      void loadTemplatePreview();
    }
  }, [sourceTab, selectedTemplate?.id, tenantId, loadTemplatePreview]);

  const handlePickPdf = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: 'application/pdf',
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const filename = asset.name ?? 'dokument.pdf';
    if (!asset.uri) {
      setError('PDF konnte nicht gelesen werden.');
      return;
    }

    try {
      const response = await fetch(asset.uri);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
      setPdfBase64(btoa(binary));
      setPdfFileName(filename);
      if (!title.trim()) setTitle(filename.replace(/\.pdf$/i, ''));
    } catch {
      setError('PDF konnte nicht gelesen werden.');
      setPdfBase64(null);
      setPdfFileName(null);
    }
  };

  const insertSignatureField = (role: 'employee' | 'client') => {
    setHtmlContent((current) => insertSignatureFieldIntoHtml(current, role));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Bitte einen Dokumenttitel eingeben.');
      return;
    }
    if (!employeeId) {
      setError('Bitte einen Mitarbeitenden für die Portal-Zustellung wählen.');
      return;
    }
    if (recipientType === 'client' && !clientId) {
      setError('Bitte eine Klient:in auswählen.');
      return;
    }
    if (sourceTab === 'pdf_upload' && !pdfBase64) {
      setError('Bitte eine PDF-Datei hochladen.');
      return;
    }
    if (sourceTab !== 'pdf_upload' && !htmlContent.trim()) {
      setError('Bitte Dokumentinhalt erstellen oder Vorlage laden.');
      return;
    }

    setSubmitting(true);
    const selectedClient = (clientsQuery.data ?? []).find((c) => c.id === clientId);
    const result = await onSubmit({
      title: title.trim(),
      documentType,
      sourceType: sourceTab,
      recipientType,
      employeeId,
      clientId: recipientType === 'client' ? clientId : null,
      clientName: selectedClient
        ? `${selectedClient.firstName} ${selectedClient.lastName}`.trim()
        : null,
      signatureRequirement,
      dueDate: dueDate.trim() ? new Date(dueDate).toISOString() : null,
      priority,
      requiredBeforeAssignment,
      allowDownload: true,
      htmlContent: sourceTab === 'pdf_upload' ? htmlContent : htmlContent,
      pdfBase64: sourceTab === 'pdf_upload' ? pdfBase64 : null,
      pdfFileName: sourceTab === 'pdf_upload' ? pdfFileName : null,
      template: sourceTab === 'template' ? selectedTemplate : null,
      templateEntityType: recipientType === 'client' && clientId ? 'client' : 'client',
      templateEntityId: clientId || undefined,
    });
    setSubmitting(false);
    if (!result.ok) setError(result.error ?? 'Senden fehlgeschlagen.');
  };

  const templateOptions = templates.map((t) => ({ key: t.id, label: t.name }));

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.heading}>Dokument zur Unterschrift senden</Text>

      <Text style={styles.label}>Quelle</Text>
      <AuroraSegmentedControl
        options={[
          { key: 'template', label: 'Vorlage' },
          { key: 'pdf_upload', label: 'PDF' },
          { key: 'office_write', label: 'Schreiben' },
        ]}
        value={sourceTab}
        onChange={(key) => setSourceTab(key as SourceTab)}
      />

      <PremiumInput label="Dokumenttitel" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Dokumenttyp</Text>
      <AuroraSegmentedControl
        options={DOCUMENT_TYPES.slice(0, 4).map((type) => ({
          key: type,
          label: PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS[type],
        }))}
        value={documentType}
        onChange={(key) => setDocumentType(key as PortalSignatureDocumentType)}
      />

      <Text style={styles.label}>Empfänger</Text>
      <AuroraSegmentedControl
        options={[
          { key: 'employee', label: 'Mitarbeiter' },
          { key: 'client', label: 'Klient' },
        ]}
        value={recipientType}
        onChange={(key) => setRecipientType(key as PortalSignatureRecipientType)}
      />

      <Text style={styles.label}>Zustellung an Mitarbeiter (Portal)</Text>
      <AuroraSegmentedControl
        options={
          employeeOptions.length > 0
            ? employeeOptions.slice(0, 6)
            : [{ key: '', label: 'Keine MA geladen' }]
        }
        value={employeeId}
        onChange={setEmployeeId}
      />

      {recipientType === 'client' ? (
        <>
          <Text style={styles.label}>Klient:in</Text>
          <AuroraSegmentedControl
            options={
              clientOptions.length > 0
                ? clientOptions.slice(0, 6)
                : [{ key: '', label: 'Keine Klient:innen geladen' }]
            }
            value={clientId}
            onChange={setClientId}
          />
        </>
      ) : null}

      {sourceTab === 'template' ? (
        <View style={styles.section}>
          <Text style={styles.label}>Vorlage wählen</Text>
          {templatesLoading ? (
            <Text style={styles.hint}>Vorlagen werden geladen…</Text>
          ) : templateOptions.length > 0 ? (
            <AuroraSegmentedControl
              options={templateOptions.slice(0, 5)}
              value={selectedTemplate?.id ?? ''}
              onChange={setSelectedTemplateId}
            />
          ) : (
            <Text style={styles.hint}>Keine Office-Vorlagen verfügbar.</Text>
          )}
          {templateLoading ? <Text style={styles.hint}>Vorschau wird erzeugt…</Text> : null}
        </View>
      ) : null}

      {sourceTab === 'pdf_upload' ? (
        <View style={styles.section}>
          <PremiumButton title="PDF auswählen" variant="ghost" onPress={() => void handlePickPdf()} />
          {pdfFileName ? <Text style={styles.hint}>Datei: {pdfFileName}</Text> : null}
        </View>
      ) : null}

      {sourceTab === 'office_write' ? (
        <View style={styles.section}>
          <Text style={styles.label}>Dokumentinhalt (HTML)</Text>
          <TextInput
            style={styles.editor}
            multiline
            value={htmlContent}
            onChangeText={setHtmlContent}
            textAlignVertical="top"
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.label}>Signaturfelder</Text>
        <View style={styles.fieldActions}>
          <PremiumButton
            title="Mitarbeiter-Signatur einfügen"
            variant="ghost"
            onPress={() => insertSignatureField('employee')}
          />
          <PremiumButton
            title="Klient:innen-Signatur einfügen"
            variant="ghost"
            onPress={() => insertSignatureField('client')}
          />
        </View>
        {signatureFields.length > 0 ? (
          <Text style={styles.hint}>
            {signatureFields.length} Signaturfeld(er):{' '}
            {signatureFields.map((f) => f.label).join(', ')}
          </Text>
        ) : (
          <Text style={styles.hint}>
            Fügen Sie Signaturfelder ein oder markieren Sie sie im Dokument.
          </Text>
        )}
      </View>

      {sourceTab !== 'pdf_upload' || signatureFields.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.label}>Vorschau</Text>
          <DocumentHtmlPreview
            title={title || 'Dokument'}
            previewHtml={htmlContent || '<p>Keine Vorschau.</p>'}
          />
        </View>
      ) : null}

      <Text style={styles.label}>Unterschrift erforderlich</Text>
      <AuroraSegmentedControl
        options={[
          { key: 'employee', label: 'Mitarbeiter' },
          { key: 'client', label: 'Klient' },
          { key: 'both_sequential', label: 'Beide' },
        ]}
        value={signatureRequirement}
        onChange={(key) => setSignatureRequirement(key as PortalSignatureRequirement)}
      />

      <Text style={styles.label}>Priorität</Text>
      <AuroraSegmentedControl
        options={Object.entries(PORTAL_SIGNATURE_PRIORITY_LABELS).map(([key, label]) => ({
          key,
          label,
        }))}
        value={priority}
        onChange={(key) => setPriority(key as PortalSignaturePriority)}
      />

      <PremiumInput
        label="Fälligkeitsdatum (YYYY-MM-DD)"
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="2026-07-15"
      />

      <PremiumButton
        title={requiredBeforeAssignment ? 'Pflicht vor Einsatz: Ja' : 'Pflicht vor Einsatz: Nein'}
        variant="ghost"
        onPress={() => setRequiredBeforeAssignment((value) => !value)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PremiumButton title="Abbrechen" variant="ghost" onPress={onCancel} />
        <PremiumButton
          title="An Portal senden"
          loading={submitting}
          onPress={() => void handleSubmit()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, paddingBottom: spacing.lg },
  heading: { ...typography.body, fontWeight: '700' },
  label: { ...typography.caption, marginTop: spacing.xs },
  hint: { ...typography.caption, color: '#64748b' },
  section: { gap: spacing.xs },
  editor: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.12)',
    borderRadius: 8,
    padding: spacing.sm,
    ...typography.body,
    backgroundColor: '#fff',
  },
  fieldActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  error: { ...typography.caption, color: '#ef4444' },
});
