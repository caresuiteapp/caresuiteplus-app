import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import {
  completePermissionOnboardingBundle,
  EMPLOYEE_PERMISSION_EXPLANATIONS,
  getEmployeePermissionOverview,
  needsPermissionOnboarding,
  PERMISSION_KINDS,
  requestLocationPermissionOnce,
  type EmployeePermissionKind,
  type EmployeePermissionOverviewItem,
} from '@/features/employeePermissions';
import { saveEmployeeLocationConsent } from '@/features/liveTracking/saveEmployeeLocationConsent';
import {
  grantEmployeePortalLocationConsent,
  markEmployeePortalConsentExplained,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { colors, spacing, typography } from '@/theme';

type EmployeePermissionOnboardingProps = {
  tenantId: string;
  employeeId: string;
  profileId?: string | null;
  /** First assignment id for consent bridge — optional on dashboard login */
  assignmentId?: string | null;
  visible: boolean;
  onComplete: () => void;
  onDismiss?: () => void;
};

function statusLabel(status: string): string {
  switch (status) {
    case 'granted':
      return 'Erteilt';
    case 'denied':
      return 'Abgelehnt';
    case 'unavailable':
      return 'Nicht verfügbar';
    default:
      return 'Noch nicht angefragt';
  }
}

export function EmployeePermissionOnboarding({
  tenantId,
  employeeId,
  profileId,
  assignmentId,
  visible,
  onComplete,
  onDismiss,
}: EmployeePermissionOnboardingProps) {
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<EmployeePermissionOverviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationConsentGranted, setLocationConsentGranted] = useState(false);

  const refreshOverview = useCallback(async () => {
    const overview = await getEmployeePermissionOverview(tenantId, employeeId, {
      locationInternalConsentGranted: locationConsentGranted,
    });
    if (overview.ok) setItems(overview.data.items);
  }, [tenantId, employeeId, locationConsentGranted]);

  useEffect(() => {
    if (!visible) return;
    void refreshOverview();
  }, [visible, refreshOverview]);

  const currentKind = PERMISSION_KINDS[step] as EmployeePermissionKind | undefined;
  const currentItem = items.find((i) => i.kind === currentKind);
  const explanation = currentKind ? EMPLOYEE_PERMISSION_EXPLANATIONS[currentKind] : null;
  const isLastStep = step >= PERMISSION_KINDS.length - 1;

  const handleGrantLocationConsent = useCallback(async () => {
    if (!assignmentId) {
      markEmployeePortalConsentExplained(tenantId, 'onboarding');
      grantEmployeePortalLocationConsent(tenantId, 'onboarding');
      setLocationConsentGranted(true);
      return;
    }
    setLoading(true);
    setError(null);
    markEmployeePortalConsentExplained(tenantId, assignmentId);
    const local = grantEmployeePortalLocationConsent(tenantId, assignmentId);
    const saved = await saveEmployeeLocationConsent({
      tenantId,
      employeeId,
      routeParamId: assignmentId,
      profileId: profileId ?? employeeId,
      consentExplainedAt: local.explainedAt,
      localConsent: local,
    });
    setLoading(false);
    if (!saved.ok) {
      setError(saved.error ?? 'Einwilligung konnte nicht gespeichert werden.');
      return;
    }
    setLocationConsentGranted(true);
  }, [tenantId, employeeId, assignmentId, profileId]);

  const handleRequestBrowserPermission = useCallback(async () => {
    if (currentKind !== 'location') return;
    setLoading(true);
    await requestLocationPermissionOnce(tenantId, employeeId);
    setLoading(false);
    await refreshOverview();
  }, [currentKind, tenantId, employeeId, refreshOverview]);

  const handleNext = useCallback(async () => {
    if (currentKind === 'location' && !locationConsentGranted) {
      setError('Bitte zuerst die interne Standort-Einwilligung bestätigen.');
      return;
    }
    setError(null);
    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }

    setLoading(true);
    const now = new Date().toISOString();
    const result = await completePermissionOnboardingBundle(tenantId, employeeId, {
      locationInternalConsentAt: locationConsentGranted ? now : null,
      explainedKinds: [...PERMISSION_KINDS],
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Onboarding konnte nicht gespeichert werden.');
      return;
    }
    onComplete();
  }, [
    currentKind,
    locationConsentGranted,
    isLastStep,
    tenantId,
    employeeId,
    onComplete,
  ]);

  if (!visible || !currentKind || !explanation) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.kicker}>Willkommen im Mitarbeiterportal</Text>
          <Text style={styles.title}>Berechtigungen & Einwilligungen</Text>
          <Text style={styles.subtitle}>
            Schritt {step + 1} von {PERMISSION_KINDS.length} — einmalig beim ersten Einsatz
          </Text>

          <PremiumCard accentColor={colors.cyan}>
            <Text style={styles.permissionTitle}>{explanation.label}</Text>
            <Text style={styles.permissionDesc}>{explanation.description}</Text>
            {currentItem ? (
              <Text style={styles.status}>
                Gerätestatus: {statusLabel(currentItem.browserStatus)}
              </Text>
            ) : null}
          </PremiumCard>

          {currentKind === 'location' ? (
            <SectionPanel title="Interne Einwilligung (Pflicht für Tracking)">
              <Text style={styles.note}>
                Dies ist getrennt von der Browser-Berechtigung. Ohne interne Einwilligung startet
                kein Live-Tracking — Ankunft und Statuswechsel bleiben aber möglich.
              </Text>
              {!locationConsentGranted ? (
                <PremiumButton
                  title="Standort-Einwilligung erteilen"
                  fullWidth
                  loading={loading}
                  onPress={handleGrantLocationConsent}
                />
              ) : (
                <Text style={styles.success}>✓ Interne Einwilligung gespeichert</Text>
              )}
              <PremiumButton
                title="Browser-Standort anfragen (optional)"
                variant="secondary"
                fullWidth
                loading={loading}
                onPress={handleRequestBrowserPermission}
              />
            </SectionPanel>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            {onDismiss && step === 0 ? (
              <PremiumButton title="Später" variant="ghost" fullWidth onPress={onDismiss} />
            ) : null}
            {step > 0 ? (
              <PremiumButton
                title="Zurück"
                variant="secondary"
                fullWidth
                onPress={() => setStep((s) => s - 1)}
              />
            ) : null}
            <PremiumButton
              title={isLastStep ? 'Fertig — Portal nutzen' : 'Weiter'}
              fullWidth
              loading={loading}
              onPress={handleNext}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Hook — show onboarding on first portal use when bundle not completed. */
export function useEmployeePermissionOnboardingGate(
  tenantId: string | null | undefined,
  employeeId: string | null | undefined,
) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!tenantId || !employeeId) return;
    let cancelled = false;
    void needsPermissionOnboarding(tenantId, employeeId).then((needed) => {
      if (!cancelled) {
        setShowOnboarding(needed);
        setChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, employeeId]);

  const dismiss = useCallback(() => setShowOnboarding(false), []);
  const complete = useCallback(() => setShowOnboarding(false), []);

  return { showOnboarding, checked, dismiss, complete };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xl },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  kicker: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase' },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.sm },
  permissionTitle: { ...typography.h3, marginBottom: spacing.xs },
  permissionDesc: { ...typography.body, color: colors.textMuted },
  status: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  success: { ...typography.body, color: colors.green, marginBottom: spacing.sm },
  error: { ...typography.body, color: colors.red },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
