import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { CatalogValueSelect, TemplateDropdownSelect } from '@/components/templates';
import { ListFilterSelect, PremiumInput } from '@/components/ui';
import { PRIORITY_LABELS } from '@/features/communication/communication.constants';
import { createThread, sendMessage } from '@/features/communication/communication.service';
import type {
  CommunicationPriority,
  CommunicationThreadType,
} from '@/features/communication/communication.types';
import { useCommunicationPermissions } from '@/hooks/communication';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchOfficeComposeRecipients } from '@/lib/office/officeComposeRecipientService';
import { useAuth } from '@/lib/auth/context';
import { renderTemplateWithVariables, getSampleVariableValues } from '@/lib/templates/templateVariables';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import type { OfficeRecipientType } from '@/types/office/officeCompose';
import { OFFICE_INTERNAL_RECIPIENT_ID } from '@/types/office/officeCompose';

type NewConversationModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (threadId: string) => void;
};

const RECIPIENT_TYPES: { key: OfficeRecipientType; label: string }[] = [
  { key: 'internal', label: 'Intern (Büro)' },
  { key: 'client', label: 'Klient:in' },
  { key: 'employee', label: 'Mitarbeiter:in' },
];

const PRIORITIES = Object.entries(PRIORITY_LABELS) as [CommunicationPriority, string][];

function mapRecipientToThreadType(type: OfficeRecipientType): CommunicationThreadType {
  if (type === 'client') return 'client';
  if (type === 'employee' || type === 'team') return 'employee';
  return 'internal';
}

export function NewConversationModal({ visible, onClose, onCreated }: NewConversationModalProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const perms = useCommunicationPermissions();

  const [recipientType, setRecipientType] = useState<OfficeRecipientType>('internal');
  const [recipientId, setRecipientId] = useState<string>(OFFICE_INTERNAL_RECIPIENT_ID);
  const [recipientOptions, setRecipientOptions] = useState<{ key: string; label: string }[]>([]);
  const [title, setTitle] = useState('');
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [priority, setPriority] = useState<CommunicationPriority>('normal');
  const [messageTemplateId, setMessageTemplateId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { gap: spacing.sm, marginBottom: spacing.md },
        label: { ...typography.caption, color: c.muted, textTransform: 'uppercase' },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        chip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: c.border,
        },
        chipActive: { backgroundColor: `${c.violet}22`, borderColor: c.violet },
        chipText: { ...typography.caption, color: c.muted },
        chipTextActive: { color: c.violet, fontWeight: '700' },
        error: { ...typography.caption, color: c.danger },
        hint: { ...typography.caption, color: c.muted },
      }),
    [c, typography],
  );

  const reset = useCallback(() => {
    setRecipientType('internal');
    setRecipientId(OFFICE_INTERNAL_RECIPIENT_ID);
    setRecipientOptions([]);
    setTitle('');
    setCategoryKey(null);
    setPriority('normal');
    setMessageTemplateId('');
    setMessageBody('');
    setError(null);
  }, []);

  useEffect(() => {
    if (!visible) return;
    reset();
  }, [visible, reset]);

  useEffect(() => {
    if (!visible || !tenantId) return;
    if (recipientType === 'internal') {
      setRecipientOptions([{ key: OFFICE_INTERNAL_RECIPIENT_ID, label: 'Büro (alle)' }]);
      setRecipientId(OFFICE_INTERNAL_RECIPIENT_ID);
      return;
    }

    void (async () => {
      const result = await fetchOfficeComposeRecipients(tenantId, recipientType, profile?.roleKey);
      if (!result.ok) {
        setRecipientOptions([]);
        setError(result.error);
        return;
      }
      const options = result.data.map((item) => ({ key: item.id, label: item.label }));
      setRecipientOptions(options);
      setRecipientId(options[0]?.key ?? '');
    })();
  }, [visible, tenantId, recipientType, profile?.roleKey]);

  const previewBody = messageBody
    ? renderTemplateWithVariables(messageBody, getSampleVariableValues())
    : '';
  const effectiveTitle = title.trim() || previewBody.slice(0, 80).trim() || '';
  const canSubmit = Boolean(effectiveTitle) && !loading && perms.canCreateThread;

  const handleClose = () => {
    reset();
    onClose();
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
    if (recipientType !== 'internal' && !recipientId.trim()) {
      setError('Bitte Empfänger auswählen.');
      return;
    }
    if (previewBody.trim().length > 0 && previewBody.trim().length < 10) {
      setError('Nachricht muss mindestens 10 Zeichen haben.');
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
        clientId: recipientType === 'client' ? recipientId : null,
        employeeId: recipientType === 'employee' ? recipientId : null,
        isInternalOnly: recipientType === 'internal',
        isPortalVisible: recipientType !== 'internal',
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
      footerActions={[
        { title: 'Schließen', onPress: handleClose, variant: 'glass' },
        {
          title: 'Senden',
          onPress: () => void handleSend(),
          loading,
          disabled: !canSubmit,
        },
      ]}
      maxWidth={620}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.label}>Empfänger</Text>
          <View style={styles.chips}>
            {RECIPIENT_TYPES.map((item) => {
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
          {recipientType !== 'internal' && recipientOptions.length > 0 ? (
            <ListFilterSelect
              label="Empfänger auswählen"
              value={recipientId}
              options={recipientOptions}
              onChange={setRecipientId}
            />
          ) : null}
          {recipientType !== 'internal' && recipientOptions.length === 0 ? (
            <Text style={styles.hint}>Empfänger werden geladen…</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <CatalogValueSelect
            catalogType="message_category"
            label="Nachrichtenkategorie"
            value={categoryKey ?? ''}
            onChange={(key) => setCategoryKey(key)}
          />
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

        <TemplateDropdownSelect
          label="Nachrichtenvorlage"
          filters={{ moduleKey: 'communication', templateType: 'message', status: 'active' }}
          value={messageTemplateId}
          onChange={(id, content) => {
            setMessageTemplateId(id);
            setMessageBody(content);
          }}
        />

        <PremiumInput
          label="Nachricht"
          value={messageBody}
          onChangeText={setMessageBody}
          placeholder="Ihre Nachricht…"
          multiline
          hint="Mindestens 10 Zeichen bei Versand"
        />

        {previewBody && previewBody !== messageBody ? (
          <PremiumInput
            label="Vorschau"
            value={previewBody}
            editable={false}
            multiline
            hint="Variablen mit Beispielwerten"
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </PlatformModal>
  );
}
