import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { GroupedTemplateSelect } from '@/components/templates';
import { ListFilterSelect, PremiumInput } from '@/components/ui';
import { PRIORITY_LABELS } from '@/features/communication/communication.constants';
import { createThread, sendMessage } from '@/features/communication/communication.service';
import type {
  CommunicationPriority,
  CommunicationThreadType,
} from '@/features/communication/communication.types';
import { useCommunicationPermissions } from '@/hooks/communication';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  COMPOSE_RECIPIENT_CATEGORIES,
  COMPOSE_RECIPIENT_TYPES,
  composeRecipientUsesPersonPicker,
  defaultCategoryForRecipient,
  mapComposeRecipientToOfficeType,
  type ComposeRecipientCategory,
  type ComposeRecipientType,
} from '@/lib/communication/composeRecipients';
import { getCommunicationTemplateByCareSuiteId } from '@/lib/communication/communicationTemplates';
import { fetchOfficeComposeRecipients } from '@/lib/office/officeComposeRecipientService';
import { useAuth } from '@/lib/auth/context';
import {
  getComposeVariableValues,
  renderTemplateWithVariables,
  validateComposePreview,
} from '@/lib/templates/templateVariables';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import { OFFICE_INTERNAL_RECIPIENT_ID } from '@/types/office/officeCompose';

type NewConversationModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (threadId: string) => void;
};

const PRIORITIES = Object.entries(PRIORITY_LABELS) as [CommunicationPriority, string][];

/** 2× PremiumInput default minHeight (48). */
const COMPOSE_MULTILINE_MIN_HEIGHT = 96;
const MODAL_MIN_HEIGHT = 800;

function mapRecipientToThreadType(type: ComposeRecipientType): CommunicationThreadType {
  if (
    type === 'client' ||
    type === 'relative' ||
    type === 'legal_guardian' ||
    type === 'billing_recipient' ||
    type === 'emergency_contact'
  ) {
    return 'client';
  }
  if (type === 'employee' || type === 'team' || type === 'pdl' || type === 'ward_leadership' || type === 'counseling_team') {
    return 'employee';
  }
  return 'internal';
}

function recipientKindForCompose(type: ComposeRecipientType): 'client' | 'employee' | 'contact' {
  if (type === 'employee') return 'employee';
  if (composeRecipientUsesPersonPicker(type)) {
    return type === 'client' ? 'client' : 'contact';
  }
  return 'contact';
}

export function NewConversationModal({ visible, onClose, onCreated }: NewConversationModalProps) {
  const { colors, typography } = useLegacyTheme();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const perms = useCommunicationPermissions();

  const [recipientCategory, setRecipientCategory] = useState<ComposeRecipientCategory>('organization');
  const [recipientType, setRecipientType] = useState<ComposeRecipientType>('internal');
  const [recipientId, setRecipientId] = useState<string>(OFFICE_INTERNAL_RECIPIENT_ID);
  const [recipientOptions, setRecipientOptions] = useState<{ key: string; label: string }[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<CommunicationPriority>('normal');
  const [messageTemplateId, setMessageTemplateId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewWarning, setPreviewWarning] = useState<string | null>(null);

  const officeRecipientType = useMemo(
    () => mapComposeRecipientToOfficeType(recipientType),
    [recipientType],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { gap: spacing.sm, marginBottom: spacing.md },
        label: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase' },
        subLabel: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        chip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: colors.borderSoft,
        },
        chipActive: { backgroundColor: `${colors.violet}22`, borderColor: colors.violet },
        chipText: { ...typography.caption, color: colors.textSecondary },
        chipTextActive: { color: colors.violet, fontWeight: '700' },
        error: { ...typography.caption, color: colors.danger },
        warning: { ...typography.caption, color: colors.orange },
        hint: { ...typography.caption, color: colors.textMuted },
      }),
    [colors, typography],
  );

  const reset = useCallback(() => {
    setRecipientCategory('organization');
    setRecipientType('internal');
    setRecipientId(OFFICE_INTERNAL_RECIPIENT_ID);
    setRecipientOptions([]);
    setTitle('');
    setPriority('normal');
    setMessageTemplateId('');
    setMessageBody('');
    setError(null);
    setPreviewWarning(null);
  }, []);

  useEffect(() => {
    if (!visible) return;
    reset();
  }, [visible, reset]);

  useEffect(() => {
    if (!visible || !tenantId) return;
    if (!composeRecipientUsesPersonPicker(recipientType)) {
      if (officeRecipientType === 'internal') {
        setRecipientOptions([{ key: OFFICE_INTERNAL_RECIPIENT_ID, label: 'Büro (alle)' }]);
        setRecipientId(OFFICE_INTERNAL_RECIPIENT_ID);
      } else {
        setRecipientOptions([]);
        setRecipientId('');
      }
      return;
    }

    void (async () => {
      const result = await fetchOfficeComposeRecipients(tenantId, officeRecipientType, profile?.roleKey);
      if (!result.ok) {
        setRecipientOptions([]);
        setError(result.error);
        return;
      }
      const options = result.data.map((item) => ({ key: item.id, label: item.label }));
      setRecipientOptions(options);
      setRecipientId(options[0]?.key ?? '');
    })();
  }, [visible, tenantId, recipientType, officeRecipientType, profile?.roleKey]);

  useEffect(() => {
    setMessageTemplateId('');
  }, [recipientType]);

  const selectedRecipientLabel = useMemo(
    () => recipientOptions.find((option) => option.key === recipientId)?.label ?? null,
    [recipientOptions, recipientId],
  );

  const templateVariables = useMemo(
    () =>
      getComposeVariableValues({
        recipientKind: recipientKindForCompose(recipientType),
        recipientName: composeRecipientUsesPersonPicker(recipientType) ? selectedRecipientLabel : null,
        senderName: profile?.displayName ?? profile?.email ?? undefined,
      }),
    [recipientType, selectedRecipientLabel, profile?.displayName, profile?.email],
  );

  const previewBody = messageBody
    ? renderTemplateWithVariables(messageBody, templateVariables)
    : '';
  const previewValidation = useMemo(
    () => validateComposePreview(messageBody, previewBody),
    [messageBody, previewBody],
  );

  useEffect(() => {
    if (!messageBody.trim()) {
      setPreviewWarning(null);
      return;
    }
    if (!previewValidation.minLengthOk) {
      setPreviewWarning('Nachricht muss mindestens 10 Zeichen haben.');
      return;
    }
    if (previewValidation.unresolvedPlaceholders.length > 0) {
      setPreviewWarning(
        `Nicht aufgelöste Platzhalter: ${previewValidation.unresolvedPlaceholders.map((key) => `{{${key}}}`).join(', ')}`,
      );
      return;
    }
    setPreviewWarning(null);
  }, [messageBody, previewValidation]);

  const effectiveTitle = title.trim() || previewBody.slice(0, 80).trim() || '';
  const canSubmit =
    Boolean(effectiveTitle) &&
    !loading &&
    perms.canCreateThread &&
    (!messageBody.trim() || previewValidation.ok);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCategoryChange = (category: ComposeRecipientCategory) => {
    setRecipientCategory(category);
    const firstType = COMPOSE_RECIPIENT_TYPES[category][0]?.key ?? 'internal';
    setRecipientType(firstType);
  };

  const handleSend = async () => {
    if (!tenantId) {
      setError('Kein Mandant.');
      return;
    }
    if (!effectiveTitle) {
      setError('Betreff oder Nachricht erforderlich.');
      return;
    }
    if (composeRecipientUsesPersonPicker(recipientType) && !recipientId.trim()) {
      setError('Bitte Empfänger auswählen.');
      return;
    }
    if (messageBody.trim() && !previewValidation.ok) {
      setError(previewWarning ?? 'Bitte Vorschau prüfen und Platzhalter auflösen.');
      return;
    }

    const threadType = mapRecipientToThreadType(recipientType);
    setLoading(true);
    setError(null);

    const result = await createThread(
      tenantId,
      {
        threadType,
        title: effectiveTitle,
        subject: title.trim() || null,
        priority,
        clientId:
          officeRecipientType === 'client' && recipientType === 'client' ? recipientId : null,
        employeeId: officeRecipientType === 'employee' ? recipientId : null,
        isInternalOnly: officeRecipientType === 'internal',
        isPortalVisible: officeRecipientType !== 'internal',
      },
      profile?.roleKey,
      profile?.id,
    );

    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const bodyText = previewBody.trim();
    if (bodyText.length >= 10) {
      const sendResult = await sendMessage(
        tenantId,
        { threadId: result.data.id, bodyText },
        profile?.roleKey,
        profile?.id,
      );
      if (!sendResult.ok) {
        setLoading(false);
        setError(sendResult.error);
        return;
      }
    }

    setLoading(false);
    onCreated?.(result.data.id);
    handleClose();
  };

  if (!perms.canCreateThread) {
    return null;
  }

  return (
    <PlatformModal
      visible={visible}
      title="Neue Nachricht"
      subtitle="Kommunikationszentrum"
      onClose={handleClose}
      maxWidth={1024}
      maxHeightRatio={0.9}
      sheetStyle={{ minHeight: MODAL_MIN_HEIGHT }}
      footerActions={[
        { title: 'Schließen', onPress: handleClose, variant: 'glass' },
        {
          title: 'Senden',
          onPress: () => void handleSend(),
          loading,
          disabled: !canSubmit,
        },
      ]}
    >
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: MODAL_MIN_HEIGHT - 160 }}>
        <View style={styles.section}>
          <Text style={styles.label}>Empfänger</Text>
          <View style={styles.chips}>
            {COMPOSE_RECIPIENT_CATEGORIES.map((item) => {
              const active = recipientCategory === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handleCategoryChange(item.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.subLabel}>Empfängerart</Text>
          <View style={styles.chips}>
            {COMPOSE_RECIPIENT_TYPES[recipientCategory].map((item) => {
              const active = recipientType === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setRecipientType(item.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {composeRecipientUsesPersonPicker(recipientType) && recipientOptions.length > 0 ? (
            <ListFilterSelect
              label="Empfänger auswählen"
              value={recipientId}
              options={recipientOptions}
              onChange={setRecipientId}
            />
          ) : null}
          {composeRecipientUsesPersonPicker(recipientType) && recipientOptions.length === 0 ? (
            <Text style={styles.hint}>Empfänger werden geladen…</Text>
          ) : null}
          {!composeRecipientUsesPersonPicker(recipientType) ? (
            <Text style={styles.hint}>
              Nachricht an{' '}
              {COMPOSE_RECIPIENT_TYPES[defaultCategoryForRecipient(recipientType)].find(
                (item) => item.key === recipientType,
              )?.label ?? recipientType}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Priorität</Text>
          <View style={styles.chips}>
            {PRIORITIES.map(([key, label]) => {
              const active = priority === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setPriority(key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <PremiumInput
          label="Betreff"
          value={title}
          onChangeText={setTitle}
          placeholder="Betreff oder Name"
          hint="Alternativ aus Vorlage ableiten"
        />

        <GroupedTemplateSelect
          recipientType={recipientType}
          value={messageTemplateId}
          onChange={(id, content, subject) => {
            setMessageTemplateId(id);
            setMessageBody(content);
            if (subject && !title.trim()) {
              setTitle(renderTemplateWithVariables(subject, templateVariables));
            }
            const templateDef = getCommunicationTemplateByCareSuiteId(id);
            if (templateDef) {
              setPriority(templateDef.priority_default);
            }
          }}
        />

        <PremiumInput
          label="Nachricht"
          value={messageBody}
          onChangeText={setMessageBody}
          placeholder="Ihre Nachricht…"
          multiline
          style={{ minHeight: COMPOSE_MULTILINE_MIN_HEIGHT }}
          hint="Mindestens 10 Zeichen bei Versand"
        />

        {messageBody.trim() ? (
          <PremiumInput
            label="Vorschau (Pflicht vor Versand)"
            value={previewBody}
            editable={false}
            multiline
            style={{ minHeight: COMPOSE_MULTILINE_MIN_HEIGHT }}
            hint={
              previewWarning ??
              (previewValidation.ok ? 'Vorschau geprüft — bereit zum Senden' : 'Variablen werden mit verfügbaren Werten ersetzt')
            }
          />
        ) : null}

        {previewWarning ? <Text style={styles.warning}>{previewWarning}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </PlatformModal>
  );
}
