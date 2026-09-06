import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumInput } from '@/components/ui';
import {
  createPortalOfficeThread,
  fetchPortalOfficeCategories,
  resolvePortalActor,
  type PortalOfficeAudience,
} from '@/lib/office/portalofficemessageservice';
import {
  clearPortalNewChatDraft,
  readPortalNewChatDraft,
  writePortalNewChatDraft,
} from '@/lib/portal/portalNewChatDraftStore';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuth } from '@/lib/auth/context';
import { ensurePortalWriteSession } from '@/lib/auth/portalSupabaseAuth';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing, radius } from '@/theme';
import type { OfficeMessageCategory } from '@/types/office/messaging';
import { PORTAL_EMERGENCY_DISCLAIMER } from '@/lib/office/messagecategoryconstants';
import { portalAudienceForRole } from '@/lib/portal/portalAudience';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

type PortalNewChatModalProps = {
  visible: boolean;
  audience: PortalOfficeAudience;
  variant?: 'default' | 'glass';
  presentation?: 'modal' | 'screen';
  onClose: () => void;
  onCreated: (threadId: string) => void;
  initialSubject?: string;
  initialMessage?: string;
};

export function PortalNewChatModal({
  visible,
  audience,
  presentation = 'modal',
  onClose,
  onCreated,
  initialSubject = '',
  initialMessage: initialMessageTemplate = '',
}: PortalNewChatModalProps) {
  const { c } = useCareLightPalette();
  const insets = useSafeAreaInsets();
  const { typography } = useLegacyTheme();
  const { portalSession } = useAuth();
  const tenantId = useServiceTenantId();
  const {
    clientId,
    employeeId,
    actorId,
    roleKey,
    displayName,
    isLinkedReady,
    isResolvingClientLink,
    isResolvingEmployeeLink,
  } = usePortalActor();
  const draftActorId = actorId ?? portalSession?.accountId ?? null;
  const [subject, setSubject] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<OfficeMessageCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedOpenRef = useRef(false);
  const skipDraftWriteRef = useRef(false);
  const sendLockRef = useRef(false);
  const [showDetails, setShowDetails] = useState(false);
  const actorAudienceMatches = portalAudienceForRole(roleKey) === audience;
  // Keep the action tappable so a missing account link produces an actionable
  // explanation instead of a permanently disabled, apparently broken button.
  const canSend = !submitting;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { gap: spacing.sm },
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
        warning: { ...typography.caption, color: c.muted },
        fallbackChip: {
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: `${c.violet}12`,
        },
      }),
    [c, typography],
  );

  useEffect(() => {
    if (!visible) {
      hydratedOpenRef.current = false;
      return;
    }
    if (!tenantId || hydratedOpenRef.current) return;
    hydratedOpenRef.current = true;
    skipDraftWriteRef.current = true;

    const savedDraft = readPortalNewChatDraft(tenantId, audience, draftActorId);
    if (savedDraft) {
      setSubject(savedDraft.subject);
      setInitialMessage(savedDraft.initialMessage);
      setCategoryId(savedDraft.categoryId);
      setError(null);
    } else {
      setSubject(initialSubject);
      setInitialMessage(initialMessageTemplate);
      setCategoryId(null);
      setError(null);
    }
  }, [visible, tenantId, audience, draftActorId, initialSubject, initialMessageTemplate]);

  useEffect(() => {
    if (!visible || !tenantId) return;
    if (skipDraftWriteRef.current) { skipDraftWriteRef.current = false; return; }
    if (!subject.trim() && !initialMessage.trim() && !categoryId) {
      clearPortalNewChatDraft(tenantId, audience, draftActorId);
      return;
    }
    writePortalNewChatDraft(tenantId, audience, draftActorId, {
      subject,
      initialMessage,
      categoryId,
    });
  }, [visible, tenantId, audience, draftActorId, subject, initialMessage, categoryId]);

  useEffect(() => {
    if (!visible || !tenantId || !isLinkedReady || !actorAudienceMatches) return;
    let active = true;
    void (async () => {
      setCategoriesLoading(true);
      setCategoryWarning(null);
      const actorResult = resolvePortalActor(
        roleKey,
        portalSession,
        actorId,
        displayName,
        { clientId, employeeId },
      );
      if (!actorResult.ok) {
        if (!active) return;
        setCategoriesLoading(false);
        setCategoryWarning(actorResult.error);
        return;
      }
      const result = await fetchPortalOfficeCategories(tenantId, actorResult.data).catch(() => ({
        ok: false as const, error: 'Themen konnten nicht geladen werden.',
      }));
      if (!active) return;
      if (result.ok) {
        setCategories(result.data);
        setCategoryId((current) => {
          if (current && result.data.some((category) => category.id === current)) {
            return current;
          }
          return result.data[0]?.id ?? null;
        });
        if (result.data.length === 0) {
          setCategoryWarning('Es sind noch keine Themen hinterlegt. Die Nachricht wird als allgemeines Anliegen gesendet.');
        }
      } else {
        // Kategorien verbessern die Sortierung im Büro, dürfen das Schreiben
        // einer Nachricht aber niemals vollständig blockieren.
        setCategories([]);
        setCategoryId(null);
        setCategoryWarning('Die Themen konnten nicht geladen werden. Sie können trotzdem eine allgemeine Nachricht senden.');
      }
      setCategoriesLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [
    visible,
    tenantId,
    isLinkedReady,
    portalSession,
    roleKey,
    actorId,
    displayName,
    clientId,
    employeeId,
    actorAudienceMatches,
  ]);

  const handleCreate = async () => {
    if (sendLockRef.current) return;
    if (!tenantId) {
      setError('Der Mandant konnte nicht geladen werden. Bitte melden Sie sich erneut an.');
      return;
    }
    if (!actorAudienceMatches) {
      setError('Diese Sitzung gehört zu einem anderen Portal.');
      return;
    }
    if (!isLinkedReady) {
      const resolvingLink =
        audience === 'employee' ? isResolvingEmployeeLink : isResolvingClientLink;
      setError(
        resolvingLink
          ? 'Ihre Kontoverknüpfung wird geladen… bitte kurz warten und erneut senden.'
          : audience === 'employee'
            ? 'Kein Mitarbeitendenkonto verknüpft. Bitte melden Sie sich erneut an oder wenden Sie sich an die Verwaltung.'
            : 'Kein Klient:innen-Konto verknüpft. Bitte wenden Sie sich an die Verwaltung.',
      );
      return;
    }
    if (!initialMessage.trim()) {
      setError('Bitte geben Sie eine Nachricht ein.');
      return;
    }

    const actorResult = resolvePortalActor(
      roleKey,
      portalSession,
      actorId,
      displayName,
      { clientId, employeeId },
    );
    if (!actorResult.ok) {
      setError(actorResult.error);
      return;
    }

    sendLockRef.current = true;
    setSubmitting(true);
    setError(null);
    let result: Awaited<ReturnType<typeof createPortalOfficeThread>>;
    try {
      const writableSession = await ensurePortalWriteSession(portalSession, 'messages');
      if (!writableSession.ok) {
        setError(writableSession.error);
        return;
      }

      result = await createPortalOfficeThread(tenantId, actorResult.data, {
        categoryId: categoryId ?? null,
        subject: subject.trim() || initialMessage.trim().replace(/\s+/g, ' ').slice(0, 80),
        initialMessage: initialMessage.trim() || undefined,
      });
    } catch {
      setError('Die Nachricht konnte nicht gesendet werden. Bitte Verbindung prüfen und erneut versuchen.');
      return;
    } finally {
      sendLockRef.current = false;
      setSubmitting(false);
    }

    if (!result.ok) {
      setError(
        toPortalUserFacingError(
          result.error,
          'Ihre Nachricht konnte gerade nicht gesendet werden. Bitte versuchen Sie es erneut.',
        ),
      );
      return;
    }
    clearPortalNewChatDraft(tenantId, audience, draftActorId);
    onCreated(result.data.id);
    onClose();
  };

  const closeComposer = () => {
    if (!sendLockRef.current) onClose();
  };
  useEffect(() => {
    if (!visible || presentation !== 'screen' || Platform.OS === 'web') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!sendLockRef.current) onClose();
      return true;
    });
    return () => listener.remove();
  }, [visible, presentation, onClose]);

  const content = (
    <KeyboardAvoidingView
      style={chatStyles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      testID="portal-new-chat-screen"
    >
      <View style={chatStyles.header}>
        <Pressable onPress={closeComposer} disabled={submitting} accessibilityRole="button"
          accessibilityLabel="Zurück zu Nachrichten" style={chatStyles.back}>
          <Text style={chatStyles.backText}>← Zurück</Text>
        </Pressable>
        <View style={chatStyles.recipient}>
          <Text style={chatStyles.title}>Verwaltung</Text>
          <Text style={chatStyles.subtitle}>Neues Gespräch</Text>
        </View>
      </View>
      <ScrollView style={chatStyles.conversation} contentContainerStyle={chatStyles.conversationContent}
        keyboardShouldPersistTaps="handled">
        <View style={chatStyles.introduction}>
          <Text style={chatStyles.introductionTitle}>Wie können wir Ihnen helfen?</Text>
          <Text style={chatStyles.introductionText}>
            Schreiben Sie Ihre Nachricht an die Verwaltung. Antworten erscheinen hier im Chat.
          </Text>
        </View>
        {initialSubject ? <Text style={chatStyles.context}>{initialSubject}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDetails }}
          onPress={() => setShowDetails((value) => !value)} style={chatStyles.detailsButton}>
          <Text style={chatStyles.backText}>{showDetails ? 'Thema ausblenden' : 'Thema hinzufügen (optional)'}</Text>
        </Pressable>
        {showDetails ? (
          <View style={chatStyles.details}>
            <PremiumInput label="Betreff (optional)" value={subject} onChangeText={setSubject} />
            <View style={styles.chips}>
              {categories.map((category) => (
                <Pressable key={category.id} accessibilityRole="button"
                  accessibilityState={{ selected: category.id === categoryId }}
                  onPress={() => setCategoryId(category.id)}
                  style={[styles.chip, category.id === categoryId && styles.chipActive]}>
                  <Text style={[styles.chipText, category.id === categoryId && styles.chipTextActive]}>{category.label}</Text>
                </Pressable>
              ))}
              {!categoriesLoading && categories.length === 0 ? (
                <Text style={chatStyles.subtitle}>Allgemeines Anliegen</Text>
              ) : null}
            </View>
            {categoriesLoading ? <Text style={chatStyles.subtitle}>Themen werden geladen…</Text> : null}
            {categoryWarning ? <Text style={chatStyles.subtitle}>{categoryWarning}</Text> : null}
          </View>
        ) : null}
        <Text style={chatStyles.disclaimer}>{PORTAL_EMERGENCY_DISCLAIMER}</Text>
      </ScrollView>
      <View style={chatStyles.composer}>
        {error ? <Text accessibilityRole="alert" style={chatStyles.error}>{error}</Text> : null}
        <TextInput
          accessibilityLabel="Ihre Nachricht an die Verwaltung"
          testID="portal-new-chat-message"
          value={initialMessage}
          onChangeText={setInitialMessage}
          editable={!submitting}
          multiline
          placeholder="Nachricht schreiben…"
          placeholderTextColor="#5B7187"
          textAlignVertical="top"
          style={chatStyles.input}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Nachricht senden"
          accessibilityState={{ disabled: !canSend, busy: submitting }}
          disabled={!canSend} onPress={handleCreate} style={[chatStyles.send, submitting && chatStyles.sending]}
          testID="portal-new-chat-send">
          <Text style={chatStyles.sendText}>{submitting ? 'Wird gesendet…' : 'Nachricht senden'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  if (!visible) return null;
  if (presentation === 'screen') return content;
  // Assignment compose uses one bounded native screen, without nested modal scroll sheets.
  return (
    <Modal visible animationType="slide" onRequestClose={closeComposer} presentationStyle="fullScreen">
      <View style={[chatStyles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {content}
      </View>
    </Modal>
  );
}

const chatStyles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#F5F9FE' },
  root: { flex: 1, minHeight: 0, width: '100%', backgroundColor: '#F5F9FE' },
  header: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#D3E3F5' },
  back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  backText: { color: '#0766C9', fontSize: 15, fontWeight: '700' },
  recipient: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: '#123251', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#456480', fontSize: 14, lineHeight: 20 },
  conversation: { flex: 1, minHeight: 0 },
  conversationContent: { flexGrow: 1, padding: 16, gap: 16 },
  introduction: { backgroundColor: '#E7F1FF', borderRadius: 18, padding: 18, gap: 8 },
  introductionTitle: { color: '#123251', fontSize: 18, fontWeight: '700' },
  introductionText: { color: '#355573', fontSize: 16, lineHeight: 24 },
  context: { color: '#123251', fontSize: 15, fontWeight: '600' },
  detailsButton: { minHeight: 44, justifyContent: 'center' },
  details: { gap: 12 },
  disclaimer: { color: '#5B7187', fontSize: 12, lineHeight: 18 },
  composer: { flexShrink: 0, padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#D3E3F5', backgroundColor: '#FFFFFF' },
  input: { minHeight: 64, maxHeight: 112, padding: 12, borderWidth: 1, borderColor: '#B9D2EF', borderRadius: 14, backgroundColor: '#F8FBFF', color: '#123251', fontSize: 16 },
  send: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0876E8', padding: 12 },
  sending: { opacity: 0.65 },
  sendText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  error: { color: '#A12832', fontSize: 14, lineHeight: 20 },
});
