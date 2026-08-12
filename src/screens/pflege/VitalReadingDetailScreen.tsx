import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { VitalReadingDetailHero } from '@/components/pflege/VitalReadingDetailHero';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { ScreenShell } from '@/components/layout';
import { ErrorState, InfoBanner, LoadingState, PremiumCard, SectionPanel } from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useVitalReadingDetail } from '@/hooks/useVitalReadingDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}
function formatMeasuredAt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

export function VitalReadingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: reading, loading, error, refresh, notFound } = useVitalReadingDetail(id);
  if (loading) return <ScreenShell title="Vitalwert" subtitle="Live-Daten werden geladen…"><LoadingState message="Messung wird geladen…" /></ScreenShell>;
  if (notFound || error) return <ScreenShell title="Vitalwert" subtitle="Fehler"><ErrorState title={notFound?'Nicht gefunden':'Fehler'} message={error??'Die Messung existiert nicht.'} onRetry={refresh}/></ScreenShell>;
  if (!reading) return null;
  return (
    <ScreenShell title="Vitalwert" subtitle={`${reading.typeLabel} · Live-Dokumentation`} scroll>
      <ScrollView contentContainerStyle={styles.scroll}>
        <VitalReadingDetailHero reading={reading} roleKey={profile?.roleKey??'nurse'} isReadOnly={isReadOnly}/>
        <InfoBanner presentation="inline" variant="success" title="Produktiv protokolliert"
          message="Messzeitpunkt und Mitarbeiterzuordnung stammen aus der serverseitigen, authentifizierten Speicherung." />
        {isReadOnly?<LockedActionBanner title="Lesemodus" message="Sie können Vitalwerte einsehen, aber nicht bearbeiten." roleLabel={roleLabel}/>:null}
        <SectionPanel title="Messung" subtitle="Wert & Kontext">
          <SummaryRow label="Messwert" value={`${reading.value}${reading.unit?` ${reading.unit}`:''}`}/>
          <SummaryRow label="Messart" value={reading.typeLabel}/><SummaryRow label="Klient:in" value={reading.clientName}/>
          {Object.entries(reading.context??{}).map(([key,value])=><SummaryRow key={key} label={key} value={value}/>) }
          <SummaryRow label="Bemerkung" value={reading.note}/>
        </SectionPanel>
        <SectionPanel title="Revisionsspur" subtitle="Automatisch und nachvollziehbar">
          <SummaryRow label="Gemessen am" value={formatMeasuredAt(reading.measuredAt)}/>
          <SummaryRow label="Erfasst durch" value={reading.recordedByName??'—'}/>
          <SummaryRow label="Quelle" value={reading.source==='device'?'Medizingerät':reading.source==='import'?'Import':'Manuelle Erfassung'}/>
          <SummaryRow label="Datensatz-ID" value={reading.id}/>
        </SectionPanel>
        {reading.isAlert?<PremiumCard accentColor={colors.danger}><Text style={styles.hintLabel}>Prüfhinweis</Text>
          <Text style={styles.hint}>Der Wert liegt außerhalb eines für diese Klient:in konfigurierten Bereichs. Pflegefachlich prüfen und weitere Schritte dokumentieren.</Text></PremiumCard>:null}
        <PflegeCrossModuleLinksPanel context="vital-reading" />
      </ScrollView>
    </ScreenShell>
  );
}
const styles=StyleSheet.create({scroll:{paddingBottom:spacing.xxl,gap:spacing.md},row:{marginBottom:spacing.sm},rowLabel:{...typography.caption,color:colors.textMuted,marginBottom:2},rowValue:{...typography.body},hintLabel:{...typography.label,color:colors.danger,marginBottom:spacing.xs},hint:{...typography.body}});
