import { StyleSheet, Text, View } from 'react-native';
import { TemplateDropdownSelect } from '@/components/templates';
import { FilterChipGroup, PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { OFFICE_RECIPIENT_TYPE_OPTIONS } from '@/types/office/officeCompose';
import type { OfficeRecipientType } from '@/types/office/officeCompose';
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
  recipientSelection?: {
    recipientType: OfficeRecipientType | null;
    setRecipientType: (value: OfficeRecipientType) => void;
    recipientId: string;
    setRecipientId: (value: string) => void;
    recipientSearch: string;
    setRecipientSearch: (value: string) => void;
    recipientOptions: Array<{ key: string; label: string }>;
    loadingRecipients: boolean;
    recipientLoadError: string | null;
  };
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
  recipientSelection,
}: ComposeMessageFormProps) {
  const showDemoHint = !isLiveServiceMode();

  return (
    <PremiumCard>
      {showDemoHint ? (
        <Text style={styles.hint}>Arbeitspaket {wpNumber} — Demo-Versand mit Persistenz.</Text>
      ) : recipientSelection ? (
        <Text style={styles.hint}>Empfänger wählen und Nachricht senden.</Text>
      ) : null}

      {recipientSelection ? (
        <View style={styles.recipientSection}>
          <Text style={styles.sectionLabel}>Empfängertyp *</Text>
          <FilterChipGroup
            options={OFFICE_RECIPIENT_TYPE_OPTIONS.map((option) => ({
              key: option.key,
              label: option.label,
            }))}
            value={recipientSelection.recipientType ?? ''}
            onChange={(value) => {
              recipientSelection.setRecipientType(value as OfficeRecipientType);
              recipientSelection.setRecipientSearch('');
            }}
          />

          {recipientSelection.recipientType ? (
            recipientSelection.recipientType === 'internal' ? (
              <Text style={styles.recipientHint}>
                Nachricht wird als interner Büro-Thread gespeichert.
              </Text>
            ) : (
              <>
                <PremiumInput
                  label="Empfänger *"
                  placeholder="Name suchen…"
                  value={recipientSelection.recipientSearch}
                  onChangeText={recipientSelection.setRecipientSearch}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {recipientSelection.loadingRecipients ? (
                  <Text style={styles.recipientHint}>Empfänger werden geladen…</Text>
                ) : recipientSelection.recipientLoadError ? (
                  <Text style={styles.error}>{recipientSelection.recipientLoadError}</Text>
                ) : recipientSelection.recipientOptions.length === 0 ? (
                  <Text style={styles.recipientHint}>Keine Empfänger gefunden.</Text>
                ) : (
                  <FilterChipGroup
                    options={recipientSelection.recipientOptions}
                    value={recipientSelection.recipientId}
                    onChange={recipientSelection.setRecipientId}
                  />
                )}
              </>
            )
          ) : null}
        </View>
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
      <PremiumInput
        label="Betreff"
        value={subject}
        onChangeText={setSubject}
        hint="Mindestens 3 Zeichen"
      />
      <PremiumInput
        label="Nachricht"
        value={body}
        onChangeText={setBody}
        multiline
        hint="Kurze Antworten wie „ok“ sind möglich"
      />
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
  sectionLabel: { ...typography.label, marginBottom: spacing.xs },
  recipientSection: { marginBottom: spacing.md, gap: spacing.sm },
  recipientHint: { ...typography.caption, marginBottom: spacing.sm },
  error: { ...typography.caption, color: '#B42318', marginBottom: spacing.sm },
});
