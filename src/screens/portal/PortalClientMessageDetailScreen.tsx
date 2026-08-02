import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { PortalMessageDetailHero } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { usePortalMessageDetail } from '@/hooks/usePortalMessageDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { colors, spacing, typography } from '@/theme';
import { portalPremium } from '@/design/tokens/portalPremium';

export function PortalClientMessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('portal.client.messages.view');
  const canReply = can('portal.client.messages.reply');

  const [replyText, setReplyText] = useState('');
  const {
    data,
    loading,
    error,
    refresh,
    reply,
    replyLoading,
    replyError,
    successMessage,
    notFound,
  } = usePortalMessageDetail(id);

  if (!canView) {
    return (
      <PortalTabScreen title="Nachricht" subtitle={resolvePortalScreenSubtitle(roleLabel, 'client')}>
        <LockedActionBanner
          message={check('portal.client.messages.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </PortalTabScreen>
    );
  }

  if (loading) {
    return (
      <PortalTabScreen title="Nachricht" subtitle="Wird geladen…">
        <LoadingState message="Nachricht wird geladen…" />
      </PortalTabScreen>
    );
  }

  if (notFound || error) {
    return (
      <PortalTabScreen title="Nachricht" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Nachricht existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </PortalTabScreen>
    );
  }

  if (!data) return null;

  return (
    <PortalTabScreen
      title={data.subject}
      subtitle={`Von ${data.senderName}`}
      scroll={false}
      contentOwnsHero
      actionsSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {successMessage ? <SuccessState message={successMessage} /> : null}

        <PortalMessageDetailHero message={data} scope="client" />

        <View style={styles.bodyCard}>
          <Text style={styles.body}>{data.body}</Text>
        </View>

        {data.canReply && canReply ? (
          <View style={styles.replyBox}>
            <PremiumInput
              label="Antwort"
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Ihre Nachricht an das Pflegeteam…"
            />
            {replyError ? <Text style={styles.error}>{replyError}</Text> : null}
            <PremiumButton
              title="Antwort senden"
              onPress={() => reply(replyText).then((sent) => sent && setReplyText(''))}
              loading={replyLoading}
              disabled={!replyText.trim()}
            />
          </View>
        ) : data.canReply ? (
          <LockedActionBanner
            message={check('portal.client.messages.reply').reason ?? 'Keine Berechtigung.'}
            roleLabel={roleLabel}
          />
        ) : null}
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  bodyCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: portalPremium.radius.card,
    backgroundColor: portalPremium.surfaceRaised,
  },
  body: {
    ...typography.body,
    lineHeight: 22,
    color: portalPremium.text.primary,
  },
  replyBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: portalPremium.radius.card,
    backgroundColor: portalPremium.surfaceSoft,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
