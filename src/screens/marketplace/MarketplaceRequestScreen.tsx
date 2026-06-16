import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MarketplaceBetaBanner, MarketplaceDataSharingPanel } from '@/components/marketplace';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, InfoBanner, PremiumButton, PremiumInput } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import {
  MARKETPLACE_CONSENT_REQUIRED_NOTICE,
  MARKETPLACE_DATA_SHARING_SCOPES,
  buildDefaultDataSharingScope,
  createReferralDraft,
  getDataSharingScopeLabel,
  getMarketplaceCategory,
  getPartnerById,
  isPartnerSelectable,
  recordReferralConsent,
  sendReferralRequest,
} from '@/lib/marketplace';
import type { MarketplaceCategoryKey } from '@/types/marketplace';
import { spacing, typography } from '@/theme';

export function MarketplaceRequestScreen() {
  const { category: categoryKey, partnerId } = useLocalSearchParams<{
    category: string;
    partnerId: string;
  }>();
  const router = useRouter();
  const { can, check, roleLabel, roleKey, tenantId } = usePermissions();
  const partner = partnerId ? getPartnerById(partnerId) : undefined;
  const category = categoryKey
    ? getMarketplaceCategory(categoryKey as MarketplaceCategoryKey)
    : undefined;

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [referralId, setReferralId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scopeLabels = buildDefaultDataSharingScope().map(getDataSharingScopeLabel);
  const canSend = consentGiven && referralId !== null && isPartnerSelectable(partner ?? { status: 'draft' });

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Anfrage vorbereiten" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner
          message={check('connect.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (!partner || !category || !tenantId) {
    return (
      <ScreenShell title="Anfrage vorbereiten" subtitle="Nicht gefunden">
        <EmptyState title="Partner nicht gefunden" message="Anfrage kann nicht vorbereitet werden." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  async function handlePrepareDraft() {
    if (!isPartnerSelectable(partner!)) {
      setStatusMessage('Partner ist nicht aktiv.');
      return;
    }
    setLoading(true);
    const result = await createReferralDraft(
      tenantId!,
      { partnerId: partner!.id, requestSubject: subject, requestMessage: message },
      roleKey,
    );
    setLoading(false);
    if (!result.ok) {
      setStatusMessage(result.error);
      return;
    }
    setReferralId(result.data.referral.id);
    setStatusMessage('Entwurf erstellt — Einwilligung erforderlich.');
  }

  async function handleSend() {
    if (!referralId || !consentGiven) {
      setStatusMessage('Anfrage ohne Einwilligung blockiert.');
      return;
    }
    setLoading(true);
    const result = await sendReferralRequest(tenantId!, referralId, roleKey);
    setLoading(false);
    if (!result.ok) {
      setStatusMessage(result.error);
      return;
    }
    setStatusMessage('Anfrage gesendet (Demo — keine echte Übertragung).');
  }

  return (
    <ScreenShell title="Anfrage vorbereiten" subtitle={partner.name}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <MarketplaceBetaBanner />
        <InfoBanner title="Einwilligung" message={MARKETPLACE_CONSENT_REQUIRED_NOTICE} />

        <PremiumInput
          label="Betreff"
          value={subject}
          onChangeText={setSubject}
          placeholder="Kurzbeschreibung der Anfrage"
        />
        <PremiumInput
          label="Nachricht"
          value={message}
          onChangeText={setMessage}
          placeholder="Freitext — keine Diagnosen oder Medikamente"
          multiline
        />

        <MarketplaceDataSharingPanel categories={scopeLabels} />
        <View style={styles.scopeList}>
          {MARKETPLACE_DATA_SHARING_SCOPES.map((item) => (
            <Text key={item.category} style={styles.scopeItem}>
              {item.label}: {item.description}
              {item.includesSensitiveData ? ' (sensibel)' : ''}
            </Text>
          ))}
        </View>

        <PremiumButton
          title={referralId ? 'Entwurf aktualisieren' : 'Entwurf anlegen'}
          onPress={handlePrepareDraft}
          loading={loading}
          disabled={!subject.trim()}
        />

        <PremiumButton
          title={consentGiven ? 'Einwilligung widerrufen' : 'Einwilligung erteilen'}
          variant="secondary"
          disabled={!referralId}
          onPress={() => {
            const next = !consentGiven;
            setConsentGiven(next);
            if (!referralId || !tenantId) return;
            setLoading(true);
            void recordReferralConsent(tenantId, referralId, next, roleKey).then((result) => {
              setLoading(false);
              if (!result.ok) {
                setStatusMessage(result.error);
                setConsentGiven(!next);
                return;
              }
              setStatusMessage(next ? 'Einwilligung gespeichert.' : 'Einwilligung zurückgezogen.');
            });
          }}
        />

        <PremiumButton
          title="Anfrage senden"
          disabled={!canSend}
          loading={loading}
          onPress={handleSend}
        />

        {statusMessage ? <InfoBanner title="Status" message={statusMessage} /> : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  scopeList: { gap: spacing.xs },
  scopeItem: { ...typography.caption },
});
