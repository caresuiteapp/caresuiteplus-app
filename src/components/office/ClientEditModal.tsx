import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { CareMultiCatalogSelect } from '@/components/inputs';
import { GradientModalHeader } from '@/components/layout/platform';
import { GlassSurface } from '@/components/ui/effects';
import { useAuth } from '@/lib/auth/context';
import { fetchClientIntakeEditData } from '@/lib/clients/clientIntakeEditService';
import {
  createEmptyIntakeForm,
  getRequiredFieldsForServiceTypes,
  submitClientIntakeUpdate,
} from '@/lib/clients/clientIntakeService';
import {
  type ClientCareContext,
} from '@/lib/clients/clientIntakeFieldRules';
import {
  careContextsToServiceTypeKeys,
  listClientServiceProfiles,
} from '@/lib/client/clientServiceTypeService';
import { computeRecordCompleteness } from '@/lib/client/clientRecordMappingService';
import { listClientBudgetSettings } from '@/lib/client/clientBudgetSettingsService';
import { fetchClientPortalSettingsResolved } from '@/lib/client/clientPortalSettingsService';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useModalStack } from '@/hooks/useModalStack';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { ClientServiceTypeKey } from '@/types/clientCore';
import { CLIENT_SERVICE_TYPE_LABELS } from '@/types/clientCore';
import { careRadius } from '@/design/tokens/radius';
import { careSuiteModalScrimStrong } from '@/design/tokens/lightTheme';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { colors, spacing, typography } from '@/theme';

export type ClientEditModalProps = {
  clientId: string;
  visible?: boolean;
  onClose: () => void;
  onSaved?: (clientId: string) => void;
  embeddedInModal?: boolean;
};

const MODAL_MAX_WIDTH = 720;

export function ClientEditModal({
  clientId,
  visible = true,
  onClose,
  onSaved,
  embeddedInModal = false,
}: ClientEditModalProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const isBottomSheet = !isDesktop && !embeddedInModal;
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const { isReadOnly } = usePermissions();
  const officeAccent = moduleColor('office');

  const [form, setForm] = useState<ClientIntakeFormData>(createEmptyIntakeForm());
  const [primaryKey, setPrimaryKey] = useState<ClientServiceTypeKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completenessPct, setCompletenessPct] = useState<number | null>(null);

  useEffect(() => {
    if (!tenantId || !clientId) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadError(null);
      const [editResult, profilesResult] = await Promise.all([
        fetchClientIntakeEditData(clientId, tenantId, profile?.roleKey),
        listClientServiceProfiles(tenantId, clientId),
      ]);
      if (cancelled) return;

      if (!editResult.ok) {
        setLoadError(editResult.error);
        setLoading(false);
        return;
      }

      setForm(editResult.data);
      const primary = profilesResult.ok
        ? profilesResult.data.find((p) => p.isPrimary && p.status === 'active')
        : undefined;
      setPrimaryKey(
        primary?.serviceTypeKey ?? careContextsToServiceTypeKeys(editResult.data.careContexts)[0] ?? null,
      );

      const [budgets, portal] = await Promise.all([
        listClientBudgetSettings(tenantId, clientId),
        fetchClientPortalSettingsResolved(tenantId, clientId),
      ]);
      if (!cancelled) {
        const completeness = computeRecordCompleteness(editResult.data, editResult.data.careContexts, {
          configuredServiceTypes: profilesResult.ok
            ? profilesResult.data.filter((p) => p.status === 'active').length
            : 0,
          hasBudgetSettings: budgets.ok ? budgets.data.length > 0 : false,
          hasPortalSettings: portal.ok
            ? portal.data.portalEnabled || portal.data.inheritTenantDefaults
            : false,
        });
        setCompletenessPct(completeness.scorePct);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, tenantId, profile?.roleKey]);

  const serviceTypeOptions = useMemo(
    () => careContextsToServiceTypeKeys(form.careContexts),
    [form.careContexts],
  );

  const toggleCareContext = useCallback((contexts: ClientCareContext[]) => {
    setForm((prev) => ({ ...prev, careContexts: contexts }));
  }, []);

  const updateField = useCallback(<K extends keyof ClientIntakeFormData>(key: K, value: ClientIntakeFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!tenantId || isReadOnly || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const keys = careContextsToServiceTypeKeys(form.careContexts);
    if (keys.length === 0) {
      setSubmitError('Mindestens eine Leistungsart auswählen.');
      setSubmitting(false);
      return;
    }

    const required = getRequiredFieldsForServiceTypes(keys);
    if (required.includes('firstName') && !form.firstName.trim()) {
      setSubmitError('Vorname ist erforderlich.');
      setSubmitting(false);
      return;
    }
    if (required.includes('lastName') && !form.lastName.trim()) {
      setSubmitError('Nachname ist erforderlich.');
      setSubmitting(false);
      return;
    }

    const result = await submitClientIntakeUpdate(tenantId, clientId, form, {
      actorProfileId: profile?.id ?? user?.id ?? null,
      actorRoleKey: profile?.roleKey ?? user?.roleKey ?? null,
    });

    setSubmitting(false);
    if (result.ok) {
      onSaved?.(clientId);
      onClose();
      return;
    }
    setSubmitError(result.error);
  }, [clientId, form, isReadOnly, onClose, onSaved, profile, submitting, tenantId, user]);

  if (loading) {
    return <LoadingState message="Stammdaten werden geladen…" />;
  }
  if (loadError) {
    return <ErrorState message={loadError} onRetry={onClose} />;
  }

  const body = (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {completenessPct != null ? (
        <SectionPanel title="Akte-Vollständigkeit" subtitle={`${completenessPct}%`}>
          <Text style={styles.hint}>
            Leistungsbereiche, Budget und Portal werden beim Speichern mit der Akte synchronisiert.
          </Text>
        </SectionPanel>
      ) : null}

      <SectionPanel title="Leistungsarten" subtitle="Multi-Select — Primärbereich markieren">
        <CareMultiCatalogSelect
          catalogKey="leistungsart"
          label="Leistungsarten"
          values={form.careContexts}
          onChange={(vals) => toggleCareContext(vals as ClientCareContext[])}
        />
        {serviceTypeOptions.length > 0 ? (
          <FilterChipGroup
            options={serviceTypeOptions.map((key) => ({
              key,
              label: CLIENT_SERVICE_TYPE_LABELS[key],
            }))}
            value={primaryKey ?? serviceTypeOptions[0]}
            onChange={(key) => setPrimaryKey(key as ClientServiceTypeKey)}
            wrap
          />
        ) : (
          <Text style={styles.hint}>Primärbereich nach Auswahl der Leistungsarten wählbar.</Text>
        )}
      </SectionPanel>

      <SectionPanel title="Stammdaten">
        <PremiumInput label="Vorname *" value={form.firstName} onChangeText={(v) => updateField('firstName', v)} />
        <PremiumInput label="Nachname *" value={form.lastName} onChangeText={(v) => updateField('lastName', v)} />
        <PremiumInput
          label="Geburtsdatum"
          value={form.dateOfBirth}
          onChangeText={(v) => updateField('dateOfBirth', v)}
          placeholder="TT.MM.JJJJ"
        />
        <PremiumInput label="Straße" value={form.street} onChangeText={(v) => updateField('street', v)} />
        <PremiumInput label="PLZ" value={form.zip} onChangeText={(v) => updateField('zip', v)} />
        <PremiumInput label="Ort" value={form.city} onChangeText={(v) => updateField('city', v)} />
        <PremiumInput label="Telefon" value={form.phone} onChangeText={(v) => updateField('phone', v)} />
        <PremiumInput label="E-Mail" value={form.email} onChangeText={(v) => updateField('email', v)} />
        <PremiumInput
          label="Leistungsbeginn"
          value={form.serviceStart}
          onChangeText={(v) => updateField('serviceStart', v)}
        />
      </SectionPanel>

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <View style={styles.actions}>
        <PremiumButton title="Abbrechen" variant="secondary" onPress={onClose} />
        {!isReadOnly ? (
          <PremiumButton title="Speichern" loading={submitting} onPress={handleSave} />
        ) : null}
      </View>
    </ScrollView>
  );

  if (embeddedInModal) {
    return body;
  }

  const sheetWidth = isBottomSheet
    ? undefined
    : Math.min(screenWidth - spacing.lg * 2, MODAL_MAX_WIDTH);
  const sheetMaxHeight = isBottomSheet ? screenHeight * 0.92 : Math.min(screenHeight * 0.9, screenHeight - spacing.lg * 2);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType={isBottomSheet ? 'slide' : 'fade'} onRequestClose={onClose}>
      <View style={[modalStyles.backdrop, isBottomSheet && modalStyles.backdropBottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
        <View style={[modalStyles.sheetHost, { width: sheetWidth, maxHeight: sheetMaxHeight }]}>
          <GlassSurface radius={careRadius.lg} glowColor={officeAccent} glowOpacity={0.12} elevated style={styles.root}>
            <GradientModalHeader title="Klient:in bearbeiten" onClose={onClose} />
            {body}
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: careSuiteModalScrimStrong,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  backdropBottom: { justifyContent: 'flex-end', padding: 0 },
  sheetHost: {
    ...Platform.select({
      web: { boxShadow: '0 24px 64px rgba(0,0,0,0.35)' as unknown as undefined },
      default: {},
    }),
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  scrollContent: { gap: careSpacing.md, padding: spacing.md, paddingBottom: spacing.xxl },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.error },
});

/** Modal-stack screen wrapper for prep.client.edit */
export function ClientEditModalScreen({
  payload,
  embeddedInModal,
}: {
  payload?: { clientId?: string };
  embeddedInModal?: boolean;
}) {
  const clientId = String(payload?.clientId ?? '');
  const { closeTopModal } = useModalStack();

  if (!clientId) {
    return <EmptyState title="Kein Datensatz" message="Klient:innen-ID fehlt." />;
  }

  return (
    <ClientEditModal
      clientId={clientId}
      embeddedInModal={embeddedInModal}
      onClose={() => closeTopModal()}
      onSaved={() => closeTopModal()}
    />
  );
}
