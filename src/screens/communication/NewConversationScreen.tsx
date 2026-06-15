import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CommunicationComposeHero } from '@/components/communication/CommunicationComposeHero';
import { CatalogValueSelect, TemplateDropdownSelect } from '@/components/templates';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { PremiumButton, PremiumCard, PremiumInput, SuccessState } from '@/components/ui';
import { createThread } from '@/features/communication/communication.service';
import { useCommunicationPermissions } from '@/hooks/communication';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { renderTemplateWithVariables, getSampleVariableValues } from '@/lib/templates/templateVariables';
import { spacing, typography } from '@/theme';

export function NewConversationScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const perms = useCommunicationPermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const [title, setTitle] = useState('');
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [messageTemplateId, setMessageTemplateId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);

  if (!perms.canCreateThread) {
    return (
      <ScreenShell title="Neue Nachricht">
        <LockedActionBanner message="Keine Berechtigung zum Anlegen von Threads." />
      </ScreenShell>
    );
  }

  if (createdThreadId) {
    return (
      <ScreenShell title="Neue Nachricht" subtitle="Kommunikationszentrum">
        <CommunicationComposeHero roleKey={roleKey} />
        <SuccessState message="Thread wurde angelegt." />
        <PremiumButton
          title="Zum Thread"
          fullWidth
          onPress={() => router.replace(`/business/messages/${createdThreadId}` as never)}
        />
        <PremiumButton title="Zurück zur Übersicht" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const previewBody = messageBody
    ? renderTemplateWithVariables(messageBody, getSampleVariableValues())
    : '';
  const effectiveTitle =
    title.trim() || previewBody.slice(0, 80).trim() || '';
  const canSubmit = Boolean(effectiveTitle) && !loading;

  const handleCreate = async () => {
    if (!tenantId) {
      setError('Kein Mandant.');
      return;
    }
    if (!effectiveTitle) {
      setError('Titel oder Vorlage erforderlich.');
      return;
    }
    if (previewBody.trim().length > 0 && previewBody.trim().length < 10) {
      setError('Vorschau muss mindestens 10 Zeichen haben.');
      return;
    }

    setLoading(true);
    setError(null);
    const result = await createThread(
      tenantId,
      {
        threadType: 'internal',
        title: effectiveTitle,
        isInternalOnly: false,
        isPortalVisible: false,
      },
      profile?.roleKey,
      profile?.id,
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreatedThreadId(result.data.id);
  };

  return (
    <ScreenShell title="Neue Nachricht" subtitle="Kommunikationszentrum">
      <View style={styles.container}>
        <CommunicationComposeHero roleKey={roleKey} />

        <PremiumCard>
          <Text style={styles.hint}>
            WP 133 — Thread anlegen mit Demo-Persistenz (analog Office Compose Sprint 24).
          </Text>

          <CatalogValueSelect
            catalogType="message_category"
            label="Nachrichtenkategorie"
            value={categoryKey ?? ''}
            onChange={(key) => {
              setCategoryKey(key);
            }}
          />
          <PremiumInput
            label="Titel"
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
          {previewBody ? (
            <PremiumInput
              label="Vorschau"
              value={previewBody}
              editable={false}
              multiline
              hint="Mindestens 10 Zeichen bei Vorlageninhalt"
            />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PremiumButton
            title={loading ? 'Erstellen…' : 'Thread erstellen'}
            fullWidth
            loading={loading}
            disabled={!canSubmit}
            onPress={() => void handleCreate()}
          />
          <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
        </PremiumCard>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  hint: { ...typography.caption, marginBottom: spacing.sm },
  error: { ...typography.caption, color: '#B42318', marginBottom: spacing.sm },
});
