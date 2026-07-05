import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { InfoBanner, PremiumButton } from '@/components/ui';
import { sendAiTextMessage } from '@/ai/aiTextChatService';
import { applyDocumentationAiFallback } from '@/lib/portal/documentationAiFallback';
import { resolveDocumentationAiAvailability } from '@/lib/portal/documentationAiAvailability';
import {
  DOCUMENTATION_AI_FUNCTION_LABELS,
  type DocumentationAiFunction,
} from '@/lib/portal/documentationAiTypes';
import {
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { spacing, typography } from '@/theme';

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
  const text = employeePortalExecutionText;
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const [selectedFn, setSelectedFn] = useState<DocumentationAiFunction>('professional');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [usedLocalFallback, setUsedLocalFallback] = useState(false);

  const aiAvailability = useMemo(() => resolveDocumentationAiAvailability(tenantId), [tenantId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        fnList: { gap: spacing.xs, marginBottom: spacing.sm },
        fnLabel: { ...typography.body, color: text.primary },
        preview: {
          borderWidth: 1,
          borderColor: employeePortalExecutionSurface.border,
          borderRadius: 10,
          padding: spacing.sm,
          minHeight: 120,
          marginTop: spacing.sm,
          backgroundColor: employeePortalExecutionSurface.subtleBackground,
        },
        previewText: { ...typography.body, color: text.primary },
        previewHint: { ...typography.caption, color: text.muted, marginTop: spacing.xs },
        error: { ...typography.caption, color: '#EF4444', marginTop: spacing.xs },
        actions: { gap: spacing.sm, marginTop: spacing.md },
        actionRow: { gap: spacing.sm },
      }),
    [text],
  );

  const applyLocalFallback = () => {
    const fallback = applyDocumentationAiFallback(selectedFn, sourceText);
    if (!fallback.trim()) {
      setError('Aus dem eingegebenen Text konnte keine Vorlage erstellt werden.');
      return false;
    }
    setUsedLocalFallback(true);
    setSuggestion(fallback);
    return true;
  };

  const handleLocalFallback = () => {
    if (!sourceText.trim()) {
      setError('Bitte zuerst einen Text oder Stichpunkte eingeben — oder erledigte Aufgaben als Stichpunkte nutzen.');
      return;
    }
    setError(null);
    applyLocalFallback();
  };

  const handleGenerate = async () => {
    if (!sourceText.trim()) {
      setError(
        'Bitte zuerst in der Dokumentation Text eingeben. Alternativ erledigte Aufgaben als Stichpunkte verwenden.',
      );
      return;
    }

    if (!aiAvailability.available) {
      handleLocalFallback();
      return;
    }

    setLoading(true);
    setError(null);
    setUsedLocalFallback(false);
    const prompt = buildAiPrompt(selectedFn, sourceText);
    const result = await sendAiTextMessage({
      tenantId: tenantId!,
      sessionId: null,
      message: prompt,
      currentModule: 'portal.employee',
      currentRoute: '/portal/employee/assignments/execute',
    });
    setLoading(false);

    if (!result.ok) {
      if (applyLocalFallback()) {
        setError(
          `Cloud-KI nicht erreichbar (${result.error ?? 'unbekannter Fehler'}). Lokale Vorlage wurde erstellt.`,
        );
      } else {
        setError(result.error ?? 'KI-Vorschlag konnte nicht erstellt werden.');
      }
      return;
    }

    const reply = result.data.assistant_message?.trim() ?? '';
    if (!reply) {
      if (applyLocalFallback()) {
        setError('Kein KI-Vorschlag erhalten. Lokale Vorlage wurde erstellt.');
      } else {
        setError('Kein Vorschlag erhalten. Nutzen Sie die lokale Textvorlage.');
      }
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
        {!aiAvailability.available && aiAvailability.reason ? (
          <InfoBanner variant="warning" message={aiAvailability.reason} />
        ) : null}
        <View style={styles.fnList}>
          {(Object.keys(DOCUMENTATION_AI_FUNCTION_LABELS) as DocumentationAiFunction[]).map((fn) => (
            <PremiumButton
              key={fn}
              title={DOCUMENTATION_AI_FUNCTION_LABELS[fn]}
              variant={selectedFn === fn ? 'primary' : 'ghost'}
              size="sm"
              onPress={() => setSelectedFn(fn)}
            />
          ))}
        </View>
        <View style={styles.actionRow}>
          <PremiumButton
            title={aiAvailability.available ? 'Vorschlag erstellen' : 'Lokale Vorlage erstellen'}
            loading={loading}
            onPress={() => void handleGenerate()}
          />
          {aiAvailability.canUseLocalFallback && aiAvailability.available ? (
            <PremiumButton
              title="Lokale Vorlage"
              variant="secondary"
              onPress={handleLocalFallback}
            />
          ) : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {error && aiAvailability.canUseLocalFallback && !suggestion ? (
          <PremiumButton title="Lokale Vorlage nutzen" variant="ghost" onPress={handleLocalFallback} />
        ) : null}
        {suggestion ? (
          <View style={styles.preview}>
            <Text style={styles.previewText}>{suggestion}</Text>
            {usedLocalFallback ? (
              <Text style={styles.previewHint}>Lokale Textvorlage (ohne KI-Verbindung)</Text>
            ) : null}
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

export type { DocumentationAiFunction } from '@/lib/portal/documentationAiTypes';
