import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LockedActionBanner } from '@/components/permissions';
import { PortalRequestFormModal } from '@/components/portal/assist/PortalRequestFormModal';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
} from '@/components/ui';
import { useClientPortalProfile } from '@/hooks/useClientPortalProfile';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalContext } from '@/hooks/usePortalContext';
import {
  buildPortalRequestDescription,
  createPortalRequest,
  isPortalFormRequestType,
  resolvePortalRequestTypeLabel,
  serializePortalRequestPayload,
} from '@/lib/portal/assist';
import {
  PORTAL_MODULE_ICONS,
  PORTAL_MODULE_LABELS,
  resolvePortalActorRole,
} from '@/lib/portal/engine';
import { profileSectionHasContent } from '@/lib/portal/clientPortalProfileProjection';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import { PORTAL_ACCESS_STATUS_LABELS } from '@/types/modules/client/clientPortal';
import type { PortalStructuredRequestPayload } from '@/types/portal/requestPayloads';
import type { PortalClientContactSummary, PortalClientProfile } from '@/types/portal/client';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';

const PORTAL_ROLE_LABELS: Record<import('@/lib/portal/types').PortalActorRole, string> = {
  client: 'Klient:in',
  relative: 'Angehörige:r',
  guardian: 'Betreuer:in',
  invoice_recipient: 'Rechnungsempfänger:in',
};

const CONTACT_ROLE_LABELS: Record<PortalClientContactSummary['role'], string> = {
  emergency: 'Notfall',
  representative: 'Bevollmächtigt',
  relative: 'Angehörige:r',
  doctor: 'Arzt / Ärztin',
  other: 'Kontakt',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function ProfileInfoRow({ label, value }: { label: string; value: string }) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={styles.infoRow}>
      <Text style={[type.caption, { color: text.muted }]}>{label}</Text>
      <Text style={[type.body, { color: text.primary }]}>{value}</Text>
    </View>
  );
}

function ProfileSectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <GlassCard>
      <Text style={[type.caption, { color: text.muted, marginBottom: careSpacing.sm }]}>
        {title}
      </Text>
      {children}
    </GlassCard>
  );
}

function ContactCard({ contact }: { contact: PortalClientContactSummary }) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={styles.contactBlock}>
      <View style={styles.contactHeader}>
        <Text style={[type.bodyStrong, { color: text.primary }]}>{contact.name}</Text>
        <PremiumBadge label={CONTACT_ROLE_LABELS[contact.role]} variant="cyan" />
      </View>
      {contact.relationship ? (
        <Text style={[type.caption, { color: text.muted }]}>{contact.relationship}</Text>
      ) : null}
      {contact.phone ? (
        <Text style={[type.body, { color: text.secondary }]}>{contact.phone}</Text>
      ) : null}
      {contact.email ? (
        <Text style={[type.body, { color: text.secondary }]}>{contact.email}</Text>
      ) : null}
    </View>
  );
}

function renderProfileSections(profile: PortalClientProfile, isWide: boolean, textMuted: string, textPrimary: string) {
  const sections: ReactNode[] = [];

  if (profileSectionHasContent(profile, 'contact')) {
    sections.push(
      <ProfileSectionCard key="contact" title="KONTAKT & ERREICHBARKEIT">
        {profile.email ? <ProfileInfoRow label="E-Mail" value={profile.email} /> : null}
        {profile.mobile ? <ProfileInfoRow label="Mobil" value={profile.mobile} /> : null}
        {profile.phone && profile.phone !== profile.mobile ? (
          <ProfileInfoRow label="Telefon" value={profile.phone} />
        ) : null}
        {!profile.mobile && !profile.phone && profile.primaryContactPhone ? (
          <ProfileInfoRow label="Telefon" value={profile.primaryContactPhone} />
        ) : null}
        {profile.preferredContactLabel ? (
          <ProfileInfoRow label="Bevorzugter Kontaktweg" value={profile.preferredContactLabel} />
        ) : null}
        {profile.dateOfBirth ? (
          <ProfileInfoRow label="Geburtsdatum" value={profile.dateOfBirth} />
        ) : null}
      </ProfileSectionCard>,
    );
  }

  if (profileSectionHasContent(profile, 'address')) {
    sections.push(
      <ProfileSectionCard key="address" title="ADRESSE">
        {profile.street ? <ProfileInfoRow label="Straße" value={profile.street} /> : null}
        {profile.zip || profile.city ? (
          <ProfileInfoRow
            label="Ort"
            value={[profile.zip, profile.city].filter(Boolean).join(' ')}
          />
        ) : null}
        {profile.floor ? <ProfileInfoRow label="Etage" value={profile.floor} /> : null}
        {profile.apartmentNumber ? (
          <ProfileInfoRow label="Wohnung" value={profile.apartmentNumber} />
        ) : null}
        {profile.doorbellName ? (
          <ProfileInfoRow label="Klingelschild" value={profile.doorbellName} />
        ) : null}
        {profile.country ? <ProfileInfoRow label="Land" value={profile.country} /> : null}
      </ProfileSectionCard>,
    );
  }

  if (profileSectionHasContent(profile, 'insurance')) {
    sections.push(
      <ProfileSectionCard key="insurance" title="VERSICHERUNG / KOSTENTRÄGER">
        {profile.healthInsurance ? (
          <ProfileInfoRow label="Krankenkasse" value={profile.healthInsurance} />
        ) : null}
        {profile.careFundName ? (
          <ProfileInfoRow label="Pflegekasse" value={profile.careFundName} />
        ) : null}
        {profile.costBearer ? (
          <ProfileInfoRow label="Kostenträger" value={profile.costBearer} />
        ) : null}
        {profile.insuranceNumberMasked ? (
          <ProfileInfoRow label="Versichertennummer" value={profile.insuranceNumberMasked} />
        ) : null}
      </ProfileSectionCard>,
    );
  }

  if (profileSectionHasContent(profile, 'care')) {
    sections.push(
      <ProfileSectionCard key="care" title="BETREUUNG & PFLEGE">
        {profile.careLevel ? (
          <ProfileInfoRow label="Pflegegrad" value={formatCareLevel(profile.careLevel)} />
        ) : null}
        {profile.careLevelSince ? (
          <ProfileInfoRow label="Pflegegrad seit" value={profile.careLevelSince} />
        ) : null}
        {profile.careStartDate ? (
          <ProfileInfoRow label="Betreuungsbeginn" value={profile.careStartDate} />
        ) : null}
        {profile.careModels.length > 0 ? (
          <View style={styles.moduleWrap}>
            <Text style={[styles.captionMuted, { color: textMuted }]}>Betreuungsmodell</Text>
            <View style={styles.badgeRow}>
              {profile.careModels.map((label) => (
                <PremiumBadge key={label} label={label} variant="green" />
              ))}
            </View>
          </View>
        ) : null}
      </ProfileSectionCard>,
    );
  }

  if (profileSectionHasContent(profile, 'representatives')) {
    sections.push(
      <ProfileSectionCard key="representatives" title="ANSPRECHPARTNER / BEVOLLMÄCHTIGTE">
        {profile.emergencyContact ? (
          <ProfileInfoRow label="Notfallkontakt" value={profile.emergencyContact} />
        ) : null}
        {profile.representativeContacts.map((contact) => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </ProfileSectionCard>,
    );
  }

  if (profileSectionHasContent(profile, 'portalHints')) {
    sections.push(
      <ProfileSectionCard key="hints" title="PORTAL-HINWEISE">
        <Text style={[styles.hintBody, { color: textPrimary }]}>{profile.portalHints}</Text>
      </ProfileSectionCard>,
    );
  }

  if (isWide && sections.length > 1) {
    const pairs: ReactNode[] = [];
    for (let i = 0; i < sections.length; i += 2) {
      pairs.push(
        <View key={`row-${i}`} style={styles.twoColRow}>
          <View style={styles.twoColItem}>{sections[i]}</View>
          {sections[i + 1] ? <View style={styles.twoColItem}>{sections[i + 1]}</View> : null}
        </View>,
      );
    }
    return pairs;
  }

  return sections;
}

export function ClientPortalProfileScreen() {
  const { can, check, roleLabel } = usePermissions();
  const canViewProfile = can('portal.client.profile.view');
  const canViewCarePlan = can('portal.client.careplan.view');
  const text = useAuroraAdaptiveText();
  const { colors } = useLegacyTheme();
  const { width, isTablet, isDesktop } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const insets = useSafeAreaInsets();
  const { showBottomTabs } = usePlatformLayout();
  const { tenantId, actorId } = usePortalActor();
  const { context } = usePortalContext();
  const {
    profile,
    portalAccess,
    carePlans,
    loading,
    error,
    refresh,
    isReady,
    missingClientLink,
  } = useClientPortalProfile();
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const isWide = isTablet || isDesktop;

  const contentPadding = useMemo(
    () => ({
      paddingHorizontal: careSpacing.md,
      paddingBottom: showBottomTabs
        ? PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm)
        : careSpacing.xl + insets.bottom,
    }),
    [insets.bottom, showBottomTabs],
  );

  const portalRole = context?.portalRole ?? resolvePortalActorRole('client_portal');
  const moduleLabels = (context?.activeModuleKeys ?? []).map(
    (key) => `${PORTAL_MODULE_ICONS[key]} ${PORTAL_MODULE_LABELS[key]}`,
  );
  const releaseLabel = context?.hasModuleAssignments
    ? 'Module freigegeben'
    : 'Warten auf Modulfreigabe';
  const accessStatusLabel = portalAccess?.status
    ? PORTAL_ACCESS_STATUS_LABELS[portalAccess.status]
    : portalAccess?.portalEnabled
      ? 'Aktiv'
      : 'Unbekannt';

  const handleStammdatenRequest = useCallback(
    async (payload: PortalStructuredRequestPayload) => {
      if (!tenantId || !profile?.clientId || !actorId) return;
      setSubmitting(true);
      const result = await createPortalRequest({
        tenantId,
        clientId: profile.clientId,
        portalUserId: actorId,
        moduleKey: context?.primaryModule ?? 'assist',
        requestType: 'stammdaten',
        title: resolvePortalRequestTypeLabel('stammdaten'),
        description: buildPortalRequestDescription('stammdaten', payload),
        payload: serializePortalRequestPayload('stammdaten', payload),
      });
      setSubmitting(false);
      if (result.ok) {
        setRequestModalOpen(false);
        setRequestSuccess(true);
        setTimeout(() => setRequestSuccess(false), 2500);
      }
    },
    [tenantId, profile?.clientId, actorId, context?.primaryModule],
  );

  if (!canViewProfile) {
    return (
      <PortalTabScreen title="Profil" hideHeaderOnPhone>
        <LockedActionBanner
          message={check('portal.client.profile.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </PortalTabScreen>
    );
  }

  if (!isReady || (loading && !profile)) {
    return (
      <PortalTabScreen title="Profil" scroll={false} hideHeaderOnPhone>
        <LoadingState message="Profil wird geladen…" />
      </PortalTabScreen>
    );
  }

  if (missingClientLink) {
    return (
      <PortalTabScreen title="Profil" scroll={false} hideHeaderOnPhone>
        <ErrorState
          title="Profil nicht verfügbar"
          message="Kein Klient:innenprofil mit diesem Portal verknüpft."
          onRetry={refresh}
        />
      </PortalTabScreen>
    );
  }

  if (error && !profile) {
    return (
      <PortalTabScreen title="Profil" scroll={false} hideHeaderOnPhone>
        <ErrorState title="Profil nicht verfügbar" message={error} onRetry={refresh} />
      </PortalTabScreen>
    );
  }

  if (!profile) return null;

  return (
    <PortalTabScreen title="Profil" scroll={false} hideHeaderOnPhone>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={[styles.scroll, contentPadding]}
      >
        <PortalGlassHero
          eyebrow="KLIENT:INNENPORTAL · PROFIL"
          title={profile.displayName}
          subtitle={context?.tenantName ?? 'Ihr persönlicher Portalbereich'}
          badge={releaseLabel}
        />

        {requestSuccess ? (
          <GlassCard>
            <Text style={[type.body, { color: text.primary }]}>
              Ihre Stammdaten-Anfrage wurde übermittelt.
            </Text>
          </GlassCard>
        ) : null}

        <GlassCard>
          <Text style={[type.caption, { color: text.muted, marginBottom: careSpacing.sm }]}>
            PORTAL & FREIGABE
          </Text>
          <ProfileInfoRow label="Portalrolle" value={PORTAL_ROLE_LABELS[portalRole]} />
          <ProfileInfoRow label="Zugangsstatus" value={accessStatusLabel} />
          <ProfileInfoRow label="Freigabe" value={releaseLabel} />
          {portalAccess?.lastLoginAt ? (
            <ProfileInfoRow
              label="Letzte Anmeldung"
              value={formatDate(portalAccess.lastLoginAt)}
            />
          ) : null}
          {moduleLabels.length > 0 ? (
            <View style={styles.moduleWrap}>
              <Text style={[type.caption, { color: text.muted }]}>Module</Text>
              <View style={styles.badgeRow}>
                {moduleLabels.map((label) => (
                  <PremiumBadge key={label} label={label} variant="cyan" />
                ))}
              </View>
            </View>
          ) : (
            <Text style={[type.caption, { color: text.muted, marginTop: careSpacing.sm }]}>
              Noch keine Module freigegeben. Bitte wenden Sie sich an Ihr Pflegebüro.
            </Text>
          )}
        </GlassCard>

        {renderProfileSections(profile, isWide, text.muted, text.primary)}

        <GlassCard>
          <PremiumButton
            title="Stammdaten ändern"
            variant="secondary"
            size="sm"
            onPress={() => setRequestModalOpen(true)}
            style={styles.editButton}
          />
        </GlassCard>

        {canViewCarePlan ? (
          <GlassCard>
            <Text style={[type.caption, { color: text.muted, marginBottom: careSpacing.sm }]}>
              PFLEGEPLÄNE
            </Text>
            {carePlans.length === 0 ? (
              <EmptyState
                title="Keine Pflegepläne"
                message="Aktuell sind keine Pflegepläne für Sie freigegeben."
              />
            ) : (
              carePlans.map((plan) => (
                <View key={plan.id} style={styles.planBlock}>
                  <Text style={[type.bodyStrong, { color: text.primary }]}>{plan.title}</Text>
                  <Text style={[type.caption, { color: text.muted }]}>
                    {plan.validUntil
                      ? `Gültig bis ${formatDate(plan.validUntil)} · `
                      : ''}
                    {plan.taskCount} Maßnahmen
                  </Text>
                  <Text style={[type.body, { color: text.secondary }]}>{plan.summary}</Text>
                  <PremiumBadge
                    label={WORKFLOW_STATUS_LABELS[plan.status]}
                    variant="green"
                  />
                </View>
              ))
            )}
          </GlassCard>
        ) : (
          <LockedActionBanner
            message={check('portal.client.careplan.view').reason ?? 'Keine Berechtigung.'}
            roleLabel={roleLabel}
          />
        )}
      </ScrollView>

      <PortalRequestFormModal
        visible={requestModalOpen}
        requestType="stammdaten"
        submitting={submitting}
        onClose={() => setRequestModalOpen(false)}
        onSubmit={(payload) => {
          if (isPortalFormRequestType('stammdaten')) {
            void handleStammdatenRequest(payload);
          }
        }}
      />
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: careSpacing.md,
    paddingTop: careSpacing.sm,
  },
  infoRow: {
    gap: 2,
    marginBottom: careSpacing.sm,
  },
  moduleWrap: {
    gap: careSpacing.xs,
    marginTop: careSpacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
  },
  editButton: {
    alignSelf: 'flex-start',
  },
  planBlock: {
    gap: careSpacing.xs,
    marginBottom: careSpacing.md,
  },
  contactBlock: {
    gap: careSpacing.xs,
    marginBottom: careSpacing.md,
    paddingBottom: careSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: careSpacing.md,
    alignItems: 'stretch',
  },
  twoColItem: {
    flex: 1,
    gap: careSpacing.md,
  },
  hintBody: {
    lineHeight: 22,
  },
  captionMuted: {
    opacity: 0.7,
    fontSize: 12,
    marginBottom: careSpacing.xs,
  },
});
