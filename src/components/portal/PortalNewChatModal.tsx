import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
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
  onClose: () => void;
  onCreated: (threadId: string) => void;
};

export function PortalNewChatModal({
  visible,
  audience,
  variant = 'default',
  onClose,
  onCreated,
}: PortalNewChatModalProps) {
  const { c } = useCareLightPalette();
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
  const actorAudienceMatches = portalAudienceForRole(roleKey) === audience;
  const canSend = actorAudienceMatches && isLinkedReady && !submitting;

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

    const savedDraft = readPortalNewChatDraft(tenantId, audience, draftActorId);
    if (savedDraft) {
      setSubject(savedDraft.subject);
      setInitialMessage(savedDraft.initialMessage);
      setCategoryId(savedDraft.categoryId);
      setError(null);
    } else {
      setSubject('');
      setInitialMessage('');
      setCategoryId(null);
      setError(null);
    }
  }, [visible, tenantId, audience, draftActorId]);

  useEffect(() => {
    if (!visible || !tenantId) return;
    if (!subject.trim() && !initialMessage.trim() && !categoryId) return;
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
      const result = await fetchPortalOfficeCategories(tenantId, actorResult.data);
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
    if (!tenantId) {
      setError('Der Mandant konnte nicht geladen werden. Bitte melden Sie sich erneut an.');
      return;
    }
    if (!actorAudienceMatches) {
      setError('Diese Sitzung gehört zu einem anderen Portal.');
      return;
    }
    if (!isLinkedReady) {
      setError(
        isResolvingClientLink
          ? 'Klient:innen-Konto wird geladen… bitte kurz warten und erneut senden.'
          : 'Kein Klient:innen-Konto verknüpft. Bitte wenden Sie sich an die Verwaltung.',
      );
      return;
    }
    if (!subject.trim()) {
      setError('Bitte einen Betreff eingeben.');
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

    setSubmitting(true);
    setError(null);
    const result = await createPortalOfficeThread(tenantId, actorResult.data, {
      categoryId: categoryId ?? null,
      subject: subject.trim(),
      initialMessage: initialMessage.trim() || undefined,
    });
    setSubmitting(false);

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

  const title = 'Verwaltung anschreiben';

  const formBody = (
    <>
      <View style={styles.section}>
        <Text style={styles.label}>Thema</Text>
        <View style={styles.chips}>
          {categories.map((category) => {
            const active = category.id === categoryId;
            return (
              <Pressable
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
          {!categoriesLoading && categories.length === 0 ? (
            <View style={styles.fallbackChip}>
              <Text style={styles.chipTextActive}>Allgemeines Anliegen</Text>
            </View>
          ) : null}
        </View>
        {categoriesLoading ? <Text style={styles.warning}>Themen werden geladen…</Text> : null}
        {categoryWarning ? <Text style={styles.warning}>{categoryWarning}</Text> : null}
      </View>

      <PremiumInput label="Betreff *" value={subject} onChangeText={setSubject} />
      <PremiumInput
        label="Ihre Nachricht"
        value={initialMessage}
        onChangeText={setInitialMessage}
        multiline
        placeholder="Beschreiben Sie kurz Ihr Anliegen…"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>{PORTAL_EMERGENCY_DISCLAIMER}</Text>
    </>
  );

  if (variant === 'glass') {
    return (
      <PortalGlassModal
        visible={visible}
        title={title}
        onClose={onClose}
        primaryLabel="Nachricht senden"
        onPrimary={handleCreate}
        primaryLoading={submitting}
        primaryDisabled={!canSend}
      >
        {formBody}
      </PortalGlassModal>
    );
  }

  return (
    <PlatformModal
      visible={visible}
      title={title}
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'glass' },
        {
          title: 'Nachricht senden',
          onPress: handleCreate,
          loading: submitting,
          disabled: !canSend,
        },
      ]}
      maxWidth={560}
    >
      {formBody}
    </PlatformModal>
  );
}
