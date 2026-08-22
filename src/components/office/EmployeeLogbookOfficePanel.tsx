import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  buildLogbookPdf,
  loadEmployeeLogbook,
  saveLogbookProfile,
  saveLogbookVehicle,
} from '@/lib/employeeLogbook';
import type { LogbookVehicleOwnership } from '@/types/modules/employeeLogbook';
import { careSpacing } from '@/design/tokens/spacing';
import { portalPremium } from '@/design/tokens/portalPremium';
import { typography } from '@/theme';

type Props = {
  tenantId: string;
  employeeId: string;
  employeeName: string;
  canEdit: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

export function EmployeeLogbookOfficePanel({ tenantId, employeeId, employeeName, canEdit }: Props) {
  const query = useAsyncQuery(
    useCallback(async () => {
      try {
        return { ok: true as const, data: await loadEmployeeLogbook(tenantId, employeeId) };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : 'Fahrtenbuch konnte nicht geladen werden.',
        };
      }
    }, [tenantId, employeeId]),
    [tenantId, employeeId],
  );
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [ownership, setOwnership] = useState<LogbookVehicleOwnership>('private');
  const [rate, setRate] = useState('0,30');
  const [from, setFrom] = useState(`${today().slice(0, 8)}01`);
  const [to, setTo] = useState(today());
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const vehicle = query.data.vehicles.find((item) => item.active) ?? query.data.vehicles[0];
    setPlate(vehicle?.plate ?? '');
    setMake(vehicle?.make ?? '');
    setModel(vehicle?.model ?? '');
    setOwnership(vehicle?.ownership ?? 'private');
    setRate((query.data.profile.mileageRateCents / 100).toFixed(2).replace('.', ','));
  }, [query.data]);

  const totals = useMemo(() => {
    const completed = (query.data?.trips ?? []).filter((trip) => trip.status !== 'recording');
    return {
      count: completed.length,
      distance: completed.reduce((sum, trip) => sum + trip.distanceFinalKm, 0),
      amount: completed.reduce((sum, trip) => sum + trip.mileageAmountCents, 0),
    };
  }, [query.data?.trips]);

  async function saveVehicleSettings() {
    if (!query.data) return;
    if (plate.trim().length < 2) {
      setFeedback('Bitte ein gültiges Kennzeichen eintragen.');
      return;
    }
    const parsedRate = Number(rate.replace(',', '.'));
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setFeedback('Bitte einen gültigen Kilometersatz eintragen.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const vehicle = query.data.vehicles.find((item) => item.active) ?? query.data.vehicles[0];
      await saveLogbookVehicle({
        id: vehicle?.id,
        tenantId,
        employeeId,
        ownership,
        plate,
        make: make.trim() || null,
        model: model.trim() || null,
        active: true,
      });
      await saveLogbookProfile({
        ...query.data.profile,
        mileageRateCents: Math.round(parsedRate * 100),
      });
      await query.refresh();
      setFeedback('Fahrzeug und Kilometersatz wurden durch die Verwaltung gespeichert.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  if (query.loading && !query.data) return <LoadingState message="Fahrtenbuch wird geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;
  if (!query.data) return <ErrorState message="Fahrtenbuchdaten sind nicht verfügbar." />;

  return (
    <View style={styles.stack} testID="employee-logbook-office-panel">
      <InfoBanner
        message="Verwaltungsbereich: Fahrzeugstammdaten, Kilometersatz und vollständige PDF-Nachweise sind im Mitarbeitendenportal nicht sichtbar."
        variant="info"
      />
      {feedback ? <InfoBanner message={feedback} variant={feedback.includes('gültig') || feedback.includes('fehl') ? 'warning' : 'info'} /> : null}

      <View style={styles.metrics}>
        <PremiumCard style={styles.metricCard}><Text style={styles.metricLabel}>Fahrten</Text><Text style={styles.metricValue}>{totals.count}</Text></PremiumCard>
        <PremiumCard style={styles.metricCard}><Text style={styles.metricLabel}>Kilometer</Text><Text style={styles.metricValue}>{totals.distance.toFixed(2).replace('.', ',')} km</Text></PremiumCard>
        <PremiumCard style={styles.metricCard}><Text style={styles.metricLabel}>Kilometererstattung</Text><Text style={styles.metricValue}>{(totals.amount / 100).toFixed(2).replace('.', ',')} EUR</Text></PremiumCard>
      </View>

      <SectionPanel title="Fahrzeug & Kilometersatz" subtitle="Ausschließlich durch die Verwaltung bearbeitbar">
        <View style={styles.chips}>
          {(['private', 'company'] as const).map((key) => (
            <PremiumButton
              key={key}
              title={key === 'private' ? 'Privatfahrzeug' : 'Firmenfahrzeug'}
              size="sm"
              variant={ownership === key ? 'primary' : 'secondary'}
              disabled={!canEdit}
              onPress={() => setOwnership(key)}
            />
          ))}
          <PremiumBadge label={canEdit ? 'VERWALTUNG' : 'NUR LESEN'} variant="cyan" />
        </View>
        <View style={styles.cols}>
          <PremiumInput label="Kennzeichen" value={plate} onChangeText={setPlate} editable={canEdit} style={styles.grow} />
          <PremiumInput label="Hersteller" value={make} onChangeText={setMake} editable={canEdit} style={styles.grow} />
          <PremiumInput label="Modell" value={model} onChangeText={setModel} editable={canEdit} style={styles.grow} />
          <PremiumInput label="EUR je km" value={rate} onChangeText={setRate} editable={canEdit} style={styles.grow} />
        </View>
        {canEdit ? <PremiumButton title="Fahrzeugdaten speichern" loading={saving} onPress={() => void saveVehicleSettings()} /> : null}
      </SectionPanel>

      <SectionPanel title="Zeitraum & PDF" subtitle="Vollständigen Fahrtenbuchnachweis für die Personal- und Abrechnungsverwaltung erstellen">
        <View style={styles.cols}>
          <PremiumInput label="Von" value={from} onChangeText={setFrom} style={styles.grow} />
          <PremiumInput label="Bis" value={to} onChangeText={setTo} style={styles.grow} />
        </View>
        <PremiumButton
          title="Fahrtenbuch als PDF erstellen"
          onPress={() => buildLogbookPdf({ employeeName, from, to, trips: query.data!.trips, vehicles: query.data!.vehicles })}
        />
      </SectionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: careSpacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  metricCard: { flex: 1, minWidth: 190 },
  metricLabel: { ...typography.caption, color: portalPremium.text.muted },
  metricValue: { ...typography.h3, color: portalPremium.text.primary, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, alignItems: 'center' },
  cols: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  grow: { flex: 1, minWidth: 220 },
});
