import { StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import {
  EMPLOYEE_ROUTE_END_TYPE_LABELS,
  EMPLOYEE_ROUTE_START_TYPE_LABELS,
  EMPLOYEE_TRANSPORT_MODE_ICONS,
  EMPLOYEE_TRANSPORT_MODE_LABELS,
  type EmployeeMobilitySettings,
  type EmployeeRouteEndType,
  type EmployeeRouteStartType,
  type EmployeeTransportMode,
} from '@/types/modules/employeeMobility';
import { formatGermanAddress } from '@/lib/maps/employeeRouteEndpointResolver';
import { useEmployeeMobilitySettings } from '@/hooks/useEmployeeMobilitySettings';
import { colors, spacing, typography } from '@/theme';

const TRANSPORT_OPTIONS = (Object.keys(EMPLOYEE_TRANSPORT_MODE_LABELS) as EmployeeTransportMode[]).map(
  (key) => ({
    key,
    label: `${EMPLOYEE_TRANSPORT_MODE_ICONS[key]} ${EMPLOYEE_TRANSPORT_MODE_LABELS[key]}`,
  }),
);

const START_OPTIONS = (Object.keys(EMPLOYEE_ROUTE_START_TYPE_LABELS) as EmployeeRouteStartType[]).map(
  (key) => ({ key, label: EMPLOYEE_ROUTE_START_TYPE_LABELS[key] }),
);

const END_OPTIONS = (Object.keys(EMPLOYEE_ROUTE_END_TYPE_LABELS) as EmployeeRouteEndType[]).map(
  (key) => ({ key, label: EMPLOYEE_ROUTE_END_TYPE_LABELS[key] }),
);

type EmployeeMobilitySettingsFormProps = {
  tenantId: string;
  employeeId: string;
  readOnly?: boolean;
  showSuccessBanner?: boolean;
};

export function EmployeeMobilitySettingsForm({
  tenantId,
  employeeId,
  readOnly = false,
  showSuccessBanner = true,
}: EmployeeMobilitySettingsFormProps) {
  const { settings, addressContext, loading, error, saving, saveError, save, refresh } =
    useEmployeeMobilitySettings(tenantId, employeeId);

  const [draft, setDraft] = useState<EmployeeMobilitySettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const previewStart = useMemo(() => {
    if (!draft || !addressContext) return '—';
    if (draft.routeStartType === 'custom') return draft.routeStartAddress?.trim() || '—';
    if (draft.routeStartType === 'home') {
      return formatGermanAddress(addressContext.employeeHome) ?? '—';
    }
    if (draft.routeStartType === 'office') {
      return formatGermanAddress(addressContext.tenantOffice) ?? '—';
    }
    return 'Vorheriger Einsatz';
  }, [draft, addressContext]);

  const previewEnd = useMemo(() => {
    if (!draft || !addressContext) return '—';
    if (draft.routeEndType === 'custom') return draft.routeEndAddress?.trim() || '—';
    if (draft.routeEndType === 'home') {
      return formatGermanAddress(addressContext.employeeHome) ?? '—';
    }
    return formatGermanAddress(addressContext.tenantOffice) ?? '—';
  }, [draft, addressContext]);

  if (loading && !draft) {
    return <Text style={styles.loading}>Mobilitätseinstellungen werden geladen…</Text>;
  }

  if (error && !draft) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  if (!draft) return null;

  async function handleSave() {
    setSaved(false);
    const result = await save(draft!);
    if (result.ok) setSaved(true);
  }

  return (
    <View style={styles.wrap}>
      {showSuccessBanner && saved ? <SuccessState message="Mobilitätseinstellungen gespeichert." /> : null}
      {saveError ? <ErrorState message={saveError} /> : null}

      <InfoBanner
        message="Fahrzeiten zu Einsätzen werden über Google Maps berechnet. Ohne API-Schlüssel erscheint eine Schätzung oder „—“."
        variant="info"
      />

      <SectionPanel title="Verkehrsmittel">
        <FilterChipGroup
          multiple
          options={TRANSPORT_OPTIONS}
          value={draft.transportModes}
          onChange={(value) =>
            setDraft({ ...draft, transportModes: value as EmployeeTransportMode[] })
          }
          wrap
        />
        {draft.transportModes.includes('escooter') ? (
          <Text style={styles.hint}>
            E-Scooter: Google kennt keinen eigenen Modus — Kurzstrecken als Fußweg, sonst als Radstrecke.
          </Text>
        ) : null}
      </SectionPanel>

      <SectionPanel title="Routenstart (Von)">
        <Text style={styles.fieldLabel}>Startpunkt zur nächsten Tour</Text>
        <FilterChipGroup
          options={START_OPTIONS}
          value={draft.routeStartType}
          onChange={(value) =>
            setDraft({ ...draft, routeStartType: value as EmployeeRouteStartType })
          }
          wrap
        />
        {draft.routeStartType === 'custom' ? (
          <PremiumInput
            label="Eigene Startadresse"
            value={draft.routeStartAddress ?? ''}
            onChangeText={(value) => setDraft({ ...draft, routeStartAddress: value })}
            placeholder="Straße, PLZ Ort"
            editable={!readOnly}
          />
        ) : null}
        <Text style={styles.preview}>Aktuell: {previewStart}</Text>
      </SectionPanel>

      <SectionPanel title="Routenziel (Nach)">
        <Text style={styles.fieldLabel}>Ziel nach dem Einsatz</Text>
        <FilterChipGroup
          options={END_OPTIONS}
          value={draft.routeEndType}
          onChange={(value) => setDraft({ ...draft, routeEndType: value as EmployeeRouteEndType })}
          wrap
        />
        {draft.routeEndType === 'custom' ? (
          <PremiumInput
            label="Eigene Zieladresse"
            value={draft.routeEndAddress ?? ''}
            onChangeText={(value) => setDraft({ ...draft, routeEndAddress: value })}
            placeholder="Straße, PLZ Ort"
            editable={!readOnly}
          />
        ) : null}
        <Text style={styles.preview}>Aktuell: {previewEnd}</Text>
      </SectionPanel>

      {!readOnly ? (
        <PremiumButton title="Speichern" onPress={handleSave} loading={saving} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  loading: { ...typography.body, color: colors.textSecondary },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  preview: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
