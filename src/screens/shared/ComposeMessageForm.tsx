import { StyleSheet, Text } from 'react-native';
import { TemplateDropdownSelect } from '@/components/templates';
import { PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { spacing, typography } from '@/theme';

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
}: ComposeMessageFormProps) {
  return (
    <PremiumCard>
      {!isLiveServiceMode() ? (
        <Text style={styles.hint}>Arbeitspaket {wpNumber} — Demo-Versand mit Persistenz.</Text>
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
