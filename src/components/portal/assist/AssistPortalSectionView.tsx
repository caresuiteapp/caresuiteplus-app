import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssistPortalShell } from '@/components/portal/assist/AssistPortalShell';
import { PortalEmptyState } from '@/components/portal/assist/PortalEmptyState';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { ASSIST_PORTAL_SECTIONS, getFeatureLabel, resolvePortalTerminology } from '@/lib/portal/engine';
import type { PortalContext } from '@/lib/portal/types';
import { PremiumButton } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/ui';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import { ClientPortalAssignmentCard } from '@/components/portal/ClientPortalAssignmentCard';
import { ClientPortalAssignmentPreviewSheet } from '@/components/portal/ClientPortalAssignmentPreviewSheet';
import { groupPortalAppointmentsByTime } from '@/lib/portal/groupPortalAppointmentsByTime';
import { resolvePortalUpcomingCareTeam, selectPortalSectionAppointments } from '@/lib/portal/portalSectionAppointments';

type AssistPortalSectionViewProps = {
  context: PortalContext;
  section: string;
};

/** Released Assist sections reuse the actor-scoped live appointments. */
export function AssistPortalSectionView({ context, section }: AssistPortalSectionViewProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const terminology = resolvePortalTerminology('assist');
  const featureKey = ASSIST_PORTAL_SECTIONS[section];
  const title = featureKey ? getFeatureLabel('assist', featureKey) : section;
  const { items, loading, error, refresh, refreshError } = usePortalAppointments('client');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const visible = selectPortalSectionAppointments(items, section);
  const groups = groupPortalAppointmentsByTime(visible);
  const team = resolvePortalUpcomingCareTeam(items);

  if (loading && items.length === 0) return <LoadingState message={`${title} werden geladen…`} />;
  if (error && items.length === 0) return <ErrorState title={`${title} nicht verfügbar`} message={error} onRetry={refresh} />;

  return (
    <AssistPortalShell>
      <View style={styles.container}>
        <GlassCard>
          <Text style={[type.caption, { color: text.muted }]}>{terminology.moduleLabel.toUpperCase()}</Text>
          <Text style={[type.cardTitle, { color: text.primary }]}>{title}</Text>
          <Text style={[type.body, { color: text.secondary }]}>
            {section === 'betreuung' ? 'Diese Betreuungskräfte sind Ihren kommenden Einsätzen zugeordnet.' : 'Ihre geplanten und vergangenen Begleitungen mit den freigegebenen Einsatzdetails.'}
          </Text>
        </GlassCard>
        {refreshError ? <ErrorState title="Aktualisieren nicht möglich" message={refreshError} onRetry={refresh} /> : null}
        {section === 'betreuung' ? (
          team.length > 0 ? <GlassCard>
            {team.map((member) => <Text key={member.id} style={[type.body, { color: text.primary }]}>{member.name}</Text>)}
          </GlassCard> : <PortalEmptyState title="Noch keine Betreuungskraft zugeordnet" message="Die Namen erscheinen, sobald Ihr Pflegebüro eine Betreuungskraft für einen kommenden Einsatz einteilt." />
        ) : null}
        {visible.length === 0 ? <PortalEmptyState
          title={section === 'begleitungen' ? 'Keine Begleitungen vorhanden' : 'Keine Einsätze vorhanden'}
          message="Für Ihr persönliches Profil liegen hier derzeit keine Einsätze vor. Die übrigen Einsätze finden Sie in Ihrer Einsatzübersicht."
        /> : groups.map((group) => <View key={group.key}>
          <Text style={[type.label, { color: text.primary, marginBottom: careSpacing.sm }]}>{group.label}</Text>
          {group.items.map((appointment) => <ClientPortalAssignmentCard key={appointment.id} appointment={appointment} onPreview={() => setPreviewId(appointment.id)} />)}
        </View>)}
        <PremiumButton title="Alle Einsätze öffnen" variant="secondary" onPress={() => router.replace('/portal/client/appointments' as never)} fullWidth />
        <PremiumButton
          title="Zur Übersicht"
          variant="secondary"
          onPress={() => router.replace('/portal/client' as never)}
          fullWidth
        />
        <ClientPortalAssignmentPreviewSheet assignmentId={previewId} visible={previewId !== null} onClose={() => setPreviewId(null)} />
      </View>
    </AssistPortalShell>
  );
}

export function AssistPortalSectionBlocked({ section }: { section: string }) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const featureKey = ASSIST_PORTAL_SECTIONS[section];
  const title = featureKey ? getFeatureLabel('assist', featureKey) : section;

  return (
    <AssistPortalShell>
      <View style={styles.container}>
        <PortalEmptyState
          title={`${title} nicht freigegeben`}
          message="Dieser Bereich ist für Ihr Profil nicht aktiv. Bitte wenden Sie sich an Ihr Pflegebüro."
        />
        <PremiumButton
          title="Zur Übersicht"
          onPress={() => router.replace('/portal/client' as never)}
          fullWidth
        />
        <Text style={[type.caption, { color: text.muted, textAlign: 'center' }]}>
          Bereich: {title}
        </Text>
      </View>
    </AssistPortalShell>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    padding: careSpacing.md,
    paddingBottom: careSpacing.xl,
  },
});
