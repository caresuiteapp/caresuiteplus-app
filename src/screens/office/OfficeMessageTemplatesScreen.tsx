import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  deactivateQuickReplyTemplate,
  listQuickReplyTemplates,
  saveQuickReplyTemplate,
  type QuickReplyTemplateRecord,
} from '@/lib/office/messageQuickReplyTemplateService';
import { colors, spacing, typography } from '@/theme';

export function OfficeMessageTemplatesScreen() {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<QuickReplyTemplateRecord[]>([]);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    const result = await listQuickReplyTemplates(tenantId, profile?.roleKey);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTemplates(result.data.filter((item) => item.isActive));
    setError(null);
  }, [profile?.roleKey, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    if (!tenantId) return;
    setBusy(true);
    const result = await saveQuickReplyTemplate(
      tenantId,
      {
        key: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label,
        body,
        sortOrder: templates.length + 1,
      },
      profile?.roleKey,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLabel('');
    setBody('');
    await refresh();
  };

  const deactivate = async (templateId: string) => {
    if (!tenantId) return;
    setBusy(true);
    const result = await deactivateQuickReplyTemplate(tenantId, templateId, profile?.roleKey);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh();
  };

  return (
    <ScreenShell
      title="Schnellantwort-Vorlagen"
      subtitle="Wiederverwendbare Antworten für Office- und Portal-Nachrichten"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <PremiumCard>
          <Text style={styles.sectionTitle}>Neue Schnellantwort</Text>
          <PremiumInput label="Bezeichnung" value={label} onChangeText={setLabel} />
          <PremiumInput label="Antworttext" value={body} onChangeText={setBody} multiline />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PremiumButton
            title={busy ? 'Speichern…' : 'Vorlage speichern'}
            disabled={busy || !label.trim() || !body.trim()}
            onPress={() => void save()}
          />
        </PremiumCard>

        <View style={styles.list}>
          {templates.map((template) => (
            <PremiumCard key={template.id}>
              <Text style={styles.templateLabel}>{template.label}</Text>
              <Text style={styles.templateBody}>{template.body}</Text>
              <PremiumButton
                title="Deaktivieren"
                variant="secondary"
                disabled={busy}
                onPress={() => void deactivate(template.id)}
              />
            </PremiumCard>
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  templateLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  templateBody: { ...typography.body, color: colors.textMuted, marginVertical: spacing.sm },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
});
