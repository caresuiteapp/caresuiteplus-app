import { StyleSheet, Text } from 'react-native';
import { TemplateDropdownSelect } from '@/components/templates';
import {
  ListFilterSelect,
  PremiumButton,
  PremiumCard,
  PremiumInput,
} from '@/components/ui';
import { OFFICE_RECIPIENT_HINTS } from '@/lib/communication/officeComposeRouting';
import { spacing, typography } from '@/theme';
import {
  OFFICE_RECIPIENT_TYPE_OPTIONS,
  type OfficeRecipientOption,
  type OfficeRecipientType,
} from '@/types/office/officeCompose';

type ComposeMessageFormProps = {
  wpNumber: number;
  subject: string;
  setSubject: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  error: string | null;
  isSending: boolean;
  send: () => Promise<void>;
  messageTemplateId?: string | null;
  onMessageTemplateChange?: (id: string, content: string) => void;
  enableRecipientSelection?: boolean;
  recipientType?: OfficeRecipientType;
  setRecipientType?: (value: OfficeRecipientType) => void;
  recipientId?: string;
  setRecipientId?: (value: string) => void;
  recipientOptions?: OfficeRecipientOption[];
  recipientsLoading?: boolean;
};

export function ComposeMessageForm({
  wpNumber,
  subject,
  setSubject,
  body,
  setBody,
  error,
  isSending,
  send,
  messageTemplateId = null,
  onMessageTemplateChange,
  enableRecipientSelection = false,
  recipientType = 'internal',
  setRecipientType,
  recipientId = '',
  setRecipientId,
  recipientOptions = [],
  recipientsLoading = false,
}: ComposeMessageFormProps) {
  const recipientHint = OFFICE_RECIPIENT_HINTS[recipientType];

  return (
    <PremiumCard>
      <Text style={styles.hint}>Arbeitspaket {wpNumber} · sicherer, mandantengetrennter Versand.</Text>
      {enableRecipientSelection && setRecipientType && setRecipientId ? (
        <>
          <ListFilterSelect
            label="Empfängerart"
            value={recipientType}
            options={[...OFFICE_RECIPIENT_TYPE_OPTIONS]}
            onChange={(value) => setRecipientType(value as OfficeRecipientType)}
          />
          <ListFilterSelect
            label={recipientsLoading ? 'Empfänger werden geladen…' : 'Empfänger'}
            value={recipientId}
            options={recipientOptions.map((item) => ({ key: item.id, label: item.label }))}
            onChange={setRecipientId}
          />
          <Text style={styles.hint}>{recipientHint}</Text>
        </>
      ) : null}
      {onMessageTemplateChange ? (
        <TemplateDropdownSelect
          filters={{ moduleKey: 'communication', templateType: 'message', status: 'active' }}
          label="Nachrichtenvorlage"
          value={messageTemplateId ?? ''}
          onChange={(id, content) => {
            onMessageTemplateChange(id, content);
            if (!body.trim()) setBody(content);
          }}
        />
      ) : null}
      <PremiumInput label="Betreff" value={subject} onChangeText={setSubject} />
      <PremiumInput label="Nachricht" value={body} onChangeText={setBody} multiline hint="Mindestens 10 Zeichen" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PremiumButton
        title={isSending ? 'Senden…' : 'Senden'}
        fullWidth
        disabled={isSending}
        onPress={() => void send()}
      />
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, marginBottom: spacing.md },
  error: { ...typography.caption, color: '#B42318', marginBottom: spacing.sm },
});
