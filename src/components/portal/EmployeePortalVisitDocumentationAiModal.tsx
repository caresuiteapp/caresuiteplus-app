import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton } from '@/components/ui';
import { sendAiTextMessage } from '@/ai/aiTextChatService';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { spacing, typography } from '@/theme';

export type DocumentationAiFunction =
  | 'from_bullets'
  | 'professional'
  | 'grammar'
  | 'summarize'
  | 'neutral_care'
  | 'short'
  | 'detailed';

const AI_FUNCTION_LABELS: Record<DocumentationAiFunction, string> = {
  from_bullets: 'Aus Stichpunkten erstellen',
  professional: 'Professioneller formulieren',
  grammar: 'Grammatik korrigieren',
  summarize: 'Einsatz zusammenfassen',
  neutral_care: 'Neutrale Pflegeformulierung',
  short: 'Kurze Version',
  detailed: 'Ausführliche Version',
};

function buildAiPrompt(fn: DocumentationAiFunction, sourceText: string): string {
  const base = sourceText.trim();
  switch (fn) {
    case 'from_bullets':
      return `Erstelle aus folgenden Stichpunkten eine professionelle Einsatzdokumentation für die Pflege/Betreuung. Nur den Vorschlagstext ausgeben, keine Einleitung:\n\n${base}`;
    case 'professional':
      return `Formuliere den folgenden Einsatztext professioneller und sachlich für eine Pflegedokumentation. Nur den Vorschlagstext ausgeben:\n\n${base}`;
    case 'grammar':
      return `Korrigiere Grammatik und Rechtschreibung im folgenden Einsatztext, Inhalt unverändert lassen. Nur den korrigierten Text ausgeben:\n\n${base}`;
    case 'summarize':
      return `Fasse den folgenden Einsatzbericht kurz und neutral zusammen. Nur den Vorschlagstext ausgeben:\n\n${base}`;
    case 'neutral_care':
      return `Formuliere den folgenden Text in neutraler Pflege-/Betreuungssprache um. Nur den Vorschlagstext ausgeben:\n\n${base}`;
    case 'short':
      return `Erstelle eine kurze Version (max. 3 Sätze) der folgenden Einsatzdokumentation. Nur den Vorschlagstext ausgeben:\n\n${base}`;
    case 'detailed':
      return `Erstelle eine ausführlichere, aber sachliche Version der folgenden Einsatzdokumentation. Nur den Vorschlagstext ausgeben:\n\n${base}`;
    default:
      return base;
  }
}

type EmployeePortalVisitDocumentationAiModalProps = {
  visible: boolean;
  tenantId: string | null;
  sourceText: string;
  onClose: () => void;
  onAccept: (text: string) => void;
};

export function EmployeePortalVisitDocumentationAiModal({
  visible,
  tenantId,
  sourceText,
  onClose,
  onAccept,
}: EmployeePortalVisitDocumentationAiModalProps) {
  const text = useAuroraAdaptiveText();
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const [selectedFn, setSelectedFn] = useState<DocumentationAiFunction>('professional');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        fnList: { gap: spacing.xs, marginBottom: spacing.sm },
        fnRow: {
          borderWidth: 1,
          borderColor: auroraGlass.innerBorder,
          borderRadius: 10,
          padding: spacing.sm,
        },
        fnRowActive: { borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.08)' },
        fnLabel: { ...typography.body, color: text.primary },
        preview: {
          borderWidth: 1,
          borderColor: auroraGlass.innerBorder,
          borderRadius: 10,
          padding: spacing.sm,
          minHeight: 120,
          marginTop: spacing.sm,
        },
        previewText: { ...typography.body, color: text.primary },
        error: { ...typography.caption, color: '#EF4444', marginTop: spacing.xs },
        actions: { gap: spacing.sm, marginTop: spacing.md },
      }),
    [text],
  );

  const handleGenerate = async () => {
    if (!tenantId) {
      setError('KI-Hilfe ist derzeit nicht verfügbar.');
      return;
    }
    if (!sourceText.trim()) {
      setError('Bitte zuerst einen Text oder Stichpunkte eingeben.');
      return;
    }
    setLoading(true);
    setError(null);
    const prompt = buildAiPrompt(selectedFn, sourceText);
    const result = await sendAiTextMessage({
      tenantId,
      sessionId: null,
      message: prompt,
      currentModule: 'portal.employee',
      currentRoute: '/portal/employee/assignments/execute',
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'KI-Vorschlag konnte nicht erstellt werden.');
      return;
    }
    const reply = result.data.assistant_message?.trim() ?? '';
    if (!reply) {
      setError('Kein Vorschlag erhalten. Bitte erneut versuchen.');
      return;
    }
    setSuggestion(reply);
  };

  return (
    <PlatformModal
      visible={visible}
      title="KI-Hilfe"
      subtitle="Vorschlag erstellen und prüfen"
      onClose={onClose}
      variant={isMobile ? 'bottomSheet' : 'center'}
      animationType={isMobile ? 'slide' : 'fade'}
      maxWidth={560}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.fnList}>
          {(Object.keys(AI_FUNCTION_LABELS) as DocumentationAiFunction[]).map((fn) => (
            <PremiumButton
              key={fn}
              title={AI_FUNCTION_LABELS[fn]}
              variant={selectedFn === fn ? 'primary' : 'ghost'}
              size="sm"
              onPress={() => setSelectedFn(fn)}
            />
          ))}
        </View>
        <PremiumButton
          title="Vorschlag erstellen"
          loading={loading}
          onPress={() => void handleGenerate()}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {suggestion ? (
          <View style={styles.preview}>
            <Text style={styles.previewText}>{suggestion}</Text>
          </View>
        ) : null}
        {suggestion ? (
          <View style={styles.actions}>
            <PremiumButton title="Übernehmen" onPress={() => onAccept(suggestion)} />
            <PremiumButton title="Verwerfen" variant="ghost" onPress={() => setSuggestion(null)} />
          </View>
        ) : null}
      </ScrollView>
    </PlatformModal>
  );
}
