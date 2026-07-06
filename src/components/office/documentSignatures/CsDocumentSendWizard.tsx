import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuroraSegmentedControl } from '@/components/aurora';
import { CsDocumentPreviewPanel } from './CsDocumentPreviewPanel';
import {
  CsDocumentClientRecipientPicker,
  CsDocumentEmployeeRecipientPicker,
} from '@/components/office/documentSignatures/CsDocumentRecipientPicker';
import {
  InfoBanner,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useAuth } from '@/lib/auth/context';
import { previewCsDocumentSend } from '@/lib/documents/csTemplates';
import { validateRecipients } from '@/lib/documents/csTemplates/csTemplateValidation';
import type { RoleKey } from '@/types';
import type { CsDocumentTemplate, CsRecipientScope, CsTemplateSignatureField } from '@/types/documents/csTemplateDatabase';
import { CS_SIGNATURE_REQUIREMENT_LABELS } from '@/types/documents/csTemplateDatabase';
import type {
  CsDocumentClientRecipient,
  CsDocumentEmployeeRecipient,
} from '@/types/documents/csDocumentRecipients';
import { spacing, typography } from '@/theme';

type Props = {
  tenantId: string;
  templates: CsDocumentTemplate[];
  onSend: (input: {
    templateKey: string;
    recipientScope: CsRecipientScope;
    employeeId?: string;
    clientId?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
  officeUserName?: string | null;
};

const RECIPIENT_OPTIONS: { key: CsRecipientScope; label: string }[] = [
  { key: 'employee', label: 'Mitarbeiter' },
  { key: 'client', label: 'Klient' },
  { key: 'both', label: 'Beide' },
];

export function CsDocumentSendWizard({
  tenantId,
  templates,
  onSend,
  onClose,
  officeUserName,
}: Props) {
  const text = useAuroraAdaptiveText();
  const { profile } = useAuth();
  const actorRoleKey = profile?.roleKey as RoleKey | null | undefined;

  const [step, setStep] = useState<'pick' | 'context' | 'preview'>('pick');
  const [templateKey, setTemplateKey] = useState('');
  const [recipientScope, setRecipientScope] = useState<CsRecipientScope>('client');
  const [selectedEmployee, setSelectedEmployee] = useState<CsDocumentEmployeeRecipient | null>(null);
  const [selectedClient, setSelectedClient] = useState<CsDocumentClientRecipient | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [signatureFields, setSignatureFields] = useState<CsTemplateSignatureField[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = templates.find((t) => t.templateKey === templateKey);

  const recipientIssues = useMemo(
    () =>
      validateRecipients({
        recipientScope,
        employeeId: selectedEmployee?.id ?? null,
        clientId: selectedClient?.id ?? null,
      }).map((i) => i.message),
    [recipientScope, selectedEmployee?.id, selectedClient?.id],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: { ...typography.caption, color: text.muted, marginBottom: spacing.xs },
        templateRow: { marginBottom: spacing.sm },
        templateTitle: { ...typography.body, fontWeight: '600', color: text.primary },
        templateMeta: { ...typography.caption, color: text.muted },
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
        sectionGap: { gap: spacing.md },
      }),
    [text],
  );

  const employeeFieldError = recipientIssues.find((m) => m.includes('Mitarbeitenden')) ?? null;
  const clientFieldError = recipientIssues.find((m) => m.includes('Klient')) ?? null;

  const handlePreview = async () => {
    if (!templateKey) {
      setError('Bitte wählen Sie zuerst eine Vorlage.');
      return;
    }
    if (recipientIssues.length > 0) {
      setError(recipientIssues.join(' '));
      return;
    }

    setWorking(true);
    setError(null);
    const result = await previewCsDocumentSend({
      tenantId,
      templateKey,
      recipientScope,
      employeeId: selectedEmployee?.id ?? null,
      clientId: selectedClient?.id ?? null,
      actorRoleKey,
      officeUser: { name: officeUserName },
    });
    setWorking(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPreviewHtml(result.data.renderedHtml);
    setPreviewTitle(selected?.title ?? 'Dokument');
    setSignatureFields(result.data.signatureFields);
    setIssues(result.data.issues);
    setStep('preview');
  };

  const handleSend = async () => {
    if (!templateKey || issues.length > 0 || recipientIssues.length > 0) return;
    setWorking(true);
    setError(null);
    const result = await onSend({
      templateKey,
      recipientScope,
      employeeId: selectedEmployee?.id,
      clientId: selectedClient?.id,
    });
    setWorking(false);
    if (!result.ok) {
      setError(result.error ?? 'Senden fehlgeschlagen.');
      return;
    }
    onClose();
  };

  return (
    <ScrollView>
      <SectionPanel title="Neues Dokument senden" subtitle="Vorlage wählen, Empfänger suchen, Vorschau prüfen">
        {step === 'pick' ? (
          <>
            <Text style={styles.label}>Vorlage</Text>
            {templates.length === 0 ? (
              <InfoBanner
                variant="warning"
                message="Keine Vorlagen geladen. Migration 0226 prüfen oder Aktualisieren wählen."
              />
            ) : null}
            {templates.map((t) => (
              <View key={t.id} style={styles.templateRow}>
                <PremiumCard>
                  <PremiumButton
                    title={t.title}
                    variant={templateKey === t.templateKey ? 'primary' : 'ghost'}
                    onPress={() => {
                      setTemplateKey(t.templateKey);
                      const scope =
                        t.recipientScope === 'both'
                          ? 'both'
                          : t.recipientScope === 'employee'
                            ? 'employee'
                            : t.recipientScope === 'client'
                              ? 'client'
                              : recipientScope;
                      setRecipientScope(scope);
                      setPreviewHtml(null);
                      setIssues([]);
                    }}
                  />
                  <Text style={styles.templateMeta}>
                    {t.documentType} · {CS_SIGNATURE_REQUIREMENT_LABELS[t.defaultSignatureRequirement]}
                  </Text>
                </PremiumCard>
              </View>
            ))}
            <View style={styles.actions}>
              <PremiumButton title="Weiter" disabled={!templateKey} onPress={() => setStep('context')} />
              <PremiumButton title="Abbrechen" variant="ghost" onPress={onClose} />
            </View>
          </>
        ) : null}

        {step === 'context' ? (
          <View style={styles.sectionGap}>
            {selected ? (
              <InfoBanner
                variant="info"
                message={`${selected.title} — Vorlage für: ${selected.recipientScope}`}
              />
            ) : null}
            <AuroraSegmentedControl
              options={RECIPIENT_OPTIONS}
              value={recipientScope}
              onChange={(key) => {
                setRecipientScope(key as CsRecipientScope);
                setPreviewHtml(null);
              }}
            />
            {(recipientScope === 'employee' || recipientScope === 'both') && (
              <CsDocumentEmployeeRecipientPicker
                tenantId={tenantId}
                actorRoleKey={actorRoleKey}
                selectedId={selectedEmployee?.id ?? null}
                onSelect={setSelectedEmployee}
                errorMessage={employeeFieldError}
              />
            )}
            {(recipientScope === 'client' || recipientScope === 'both') && (
              <CsDocumentClientRecipientPicker
                tenantId={tenantId}
                actorRoleKey={actorRoleKey}
                selectedId={selectedClient?.id ?? null}
                onSelect={setSelectedClient}
                errorMessage={clientFieldError}
              />
            )}
            {error ? <InfoBanner variant="danger" message={error} /> : null}
            <View style={styles.actions}>
              <PremiumButton title="Zurück" variant="ghost" onPress={() => setStep('pick')} />
              <PremiumButton
                title="Vorschau prüfen"
                loading={working}
                disabled={recipientIssues.length > 0}
                onPress={() => void handlePreview()}
              />
            </View>
          </View>
        ) : null}

        {step === 'preview' ? (
          <>
            {issues.length > 0 ? (
              <InfoBanner variant="danger" message={issues.join('\n')} />
            ) : (
              <InfoBanner variant="success" message="Kontext vollständig — bereit zum Senden." />
            )}
            <CsDocumentPreviewPanel
              title={previewTitle}
              previewHtml={previewHtml}
              signatureFields={signatureFields}
            />
            {error ? <InfoBanner variant="danger" message={error} /> : null}
            <View style={styles.actions}>
              <PremiumButton title="Zurück" variant="ghost" onPress={() => setStep('context')} />
              <PremiumButton
                title="Senden"
                loading={working}
                disabled={issues.length > 0 || recipientIssues.length > 0}
                testID="cs-document-send-confirm"
                onPress={() => void handleSend()}
              />
            </View>
          </>
        ) : null}
      </SectionPanel>
    </ScrollView>
  );
}
