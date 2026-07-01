import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { PremiumInput } from '@/components/ui';
import {
  createPortalOfficeThread,
  fetchPortalOfficeCategories,
  resolvePortalActor,
  type PortalOfficeAudience,
} from '@/lib/office/portalofficemessageservice';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuth } from '@/lib/auth/context';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing, radius } from '@/theme';
import type { OfficeMessageCategory } from '@/types/office/messaging';

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
  const { profile, portalSession } = useAuth();
  const tenantId = useServiceTenantId();
  const { clientId, employeeId, actorId, roleKey, displayName, isLinkedReady } = usePortalActor();
  const [subject, setSubject] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<OfficeMessageCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      }),
    [c, typography],
  );

  const reset = useCallback(() => {
    setSubject('');
    setInitialMessage('');
    setCategoryId(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!visible || !tenantId || !isLinkedReady) return;
    reset();
    void (async () => {
      const actorResult = resolvePortalActor(
        profile?.roleKey ?? roleKey ?? portalSession?.roleKey ?? null,
        portalSession,
        profile?.id ?? actorId ?? portalSession?.accountId,
        profile?.displayName ?? displayName,
        { clientId, employeeId },
      );
      if (!actorResult.ok) return;
      const result = await fetchPortalOfficeCategories(tenantId, actorResult.data);
      if (result.ok) {
        setCategories(result.data);
        setCategoryId(result.data[0]?.id ?? null);
      }
    })();
  }, [
    visible,
    tenantId,
    isLinkedReady,
    profile,
    portalSession,
    reset,
    roleKey,
    actorId,
    displayName,
    clientId,
    employeeId,
  ]);

  const handleCreate = async () => {
    if (!tenantId || !categoryId) return;
    if (!subject.trim()) {
      setError('Bitte einen Betreff eingeben.');
      return;
    }

    const actorResult = resolvePortalActor(
      profile?.roleKey ?? roleKey ?? portalSession?.roleKey ?? null,
      portalSession,
      profile?.id ?? actorId ?? portalSession?.accountId,
      profile?.displayName ?? displayName,
      { clientId, employeeId },
    );
    if (!actorResult.ok) {
      setError(actorResult.error);
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await createPortalOfficeThread(tenantId, actorResult.data, {
      categoryId,
      subject: subject.trim(),
      initialMessage: initialMessage.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
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
        </View>
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
        { title: 'Nachricht senden', onPress: handleCreate, loading: submitting },
      ]}
      maxWidth={560}
    >
      {formBody}
    </PlatformModal>
  );
}
