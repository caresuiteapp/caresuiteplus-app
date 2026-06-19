import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { AiStatusIndicator } from './AiStatusIndicator';
import { dispatchAiNavigation } from './aiNavigationBridge';
import { loadAiSessionMessages, sendAiTextMessage } from './aiTextChatService';
import type { AiChatMessage, AiPendingActionSummary, AiNavigationInstruction } from './aiToolTypes';
import { useAiStore } from './useAiStore';

type AiMiniPanelProps = {
  visible: boolean;
  onClose: () => void;
  tenantId: string;
  currentModule: string;
  currentRoute: string;
  pendingActions: AiPendingActionSummary[];
  messages: AiChatMessage[];
  lastGoal: string | null;
  lastStep: string | null;
  memorySummary: string | null;
  onStartVoice: () => void;
  onStopVoice: () => void;
  isListening: boolean;
  onReviewDraft: () => void;
};

export function AiMiniPanel({
  visible,
  onClose,
  tenantId,
  currentModule,
  currentRoute,
  pendingActions,
  messages,
  lastGoal,
  lastStep,
  onStartVoice,
  onStopVoice,
  isListening,
  onReviewDraft,
}: AiMiniPanelProps) {
  const {
    sessionId,
    setSessionId,
    status,
    isTextBusy,
    errorMessage,
    addMessage,
    setProgress,
    setMemorySummary,
    clearConversation,
    setTextBusy,
    setErrorMessage,
    addPendingAction,
  } = useAiStore();

  const [input, setInput] = useState('');

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isTextBusy) return;

    setInput('');
    setErrorMessage(null);
    setTextBusy(true);

    const userMessage: AiChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMessage);

    const response = await sendAiTextMessage({
      tenantId,
      sessionId,
      message: trimmed,
      currentModule,
      currentRoute,
    });

    setTextBusy(false);

    if (!response.ok) {
      setErrorMessage(response.error);
      return;
    }

    const data = response.data;
    if (data.session_id) setSessionId(data.session_id);
    if (data.assistant_message) {
      addMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.assistant_message,
        createdAt: new Date().toISOString(),
      });
    }
    if (data.last_goal || data.last_step) {
      setProgress(data.last_goal ?? lastGoal ?? '', data.last_step ?? lastStep ?? '');
    }
    if (data.memory_summary) setMemorySummary(data.memory_summary);

    const pending = Array.isArray(data.pending_actions) ? data.pending_actions : [];
    for (const action of pending) {
      if (action && typeof action === 'object' && 'pending_action_id' in action) {
        addPendingAction(action as AiPendingActionSummary);
      }
    }

    if (data.navigation && typeof data.navigation === 'object' && 'route' in data.navigation) {
      dispatchAiNavigation(data.navigation as AiNavigationInstruction);
    }
  }, [
    addMessage,
    addPendingAction,
    currentModule,
    currentRoute,
    input,
    isTextBusy,
    lastGoal,
    lastStep,
    sessionId,
    setErrorMessage,
    setMemorySummary,
    setProgress,
    setSessionId,
    setTextBusy,
    tenantId,
  ]);

  const resumeSession = useCallback(async () => {
    if (!sessionId) return;
    setTextBusy(true);
    await loadAiSessionMessages(sessionId, tenantId);
    setTextBusy(false);
  }, [sessionId, setTextBusy, tenantId]);

  const footerActions = useMemo(
    () => [
      {
        title: 'Neue Aufgabe',
        variant: 'glass' as const,
        onPress: () => clearConversation(),
      },
      {
        title: pendingActions.length > 0 ? 'Entwurf prüfen' : 'Schließen',
        variant: 'primary' as const,
        onPress: pendingActions.length > 0 ? onReviewDraft : onClose,
      },
    ],
    [clearConversation, onClose, onReviewDraft, pendingActions.length],
  );

  return (
    <PlatformModal
      visible={visible}
      title="CareSuite+ KI"
      subtitle="Text- und Sprachassistent"
      onClose={onClose}
      footerActions={footerActions}
      variant="bottomSheet"
      maxWidth={760}
      glowColor="rgba(255,255,255,0.25)"
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerRow}>
          <AiStatusIndicator status={status} />
          <Pressable onPress={resumeSession} style={styles.chipButton}>
            <Text style={styles.chipText}>Fortsetzen</Text>
          </Pressable>
          <Pressable
            onPress={isListening ? onStopVoice : onStartVoice}
            style={[styles.chipButton, isListening && styles.chipActive]}
          >
            <Text style={styles.chipText}>{isListening ? 'Stopp' : 'Mikro'}</Text>
          </Pressable>
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => setErrorMessage(null)} style={styles.errorDismiss}>
              <Text style={styles.errorDismissText}>Schließen</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
          {messages.length === 0 ? (
            <Text style={styles.emptyHint}>
              Stelle eine Frage oder gib eine Aufgabe ein. Änderungen werden immer als Entwurf
              vorbereitet.
            </Text>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text style={styles.messageText}>{message.content}</Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Nachricht an CareSuite+ KI…"
            placeholderTextColor={auroraGlass.text.muted}
            style={styles.input}
            editable={!isTextBusy}
            onSubmitEditing={() => void sendMessage()}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || isTextBusy) && styles.sendDisabled]}
            onPress={() => void sendMessage()}
            disabled={!input.trim() || isTextBusy}
          >
            <Text style={styles.sendLabel}>{isTextBusy ? '…' : 'Senden'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    marginBottom: careSpacing.md,
    flexWrap: 'wrap',
  },
  chipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: auroraGlass.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: auroraGlass.border,
  },
  chipActive: {
    backgroundColor: auroraGlass.chipActive,
  },
  chipText: {
    color: auroraGlass.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    marginBottom: careSpacing.md,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 90, 90, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 90, 90, 0.35)',
  },
  errorText: {
    color: auroraGlass.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  errorDismiss: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: auroraGlass.chip,
  },
  errorDismissText: {
    color: auroraGlass.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  messages: {
    maxHeight: 280,
    marginBottom: careSpacing.md,
  },
  messagesContent: {
    gap: 8,
    paddingBottom: 8,
  },
  emptyHint: {
    color: auroraGlass.text.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 12,
    maxWidth: '92%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: auroraGlass.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: auroraGlass.innerBorder,
  },
  messageText: {
    color: auroraGlass.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: auroraGlass.text.primary,
    backgroundColor: auroraGlass.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: auroraGlass.border,
  },
  sendButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: auroraGlass.borderStrong,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  sendLabel: {
    color: auroraGlass.text.primary,
    fontWeight: '700',
    fontSize: 13,
  },
});
