import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import type { ClientPortalFeatureKey } from '@/types/clientCore';
import type { ClientPortalSettingsResolved } from '@/types/clientCore';
import { canClientPortalSeeFeature } from '@/lib/client/clientPortalSettingsService';

type PortalSectionGateProps = {
  settings: ClientPortalSettingsResolved | null | undefined;
  feature: ClientPortalFeatureKey;
  lockedTitle?: string;
  lockedMessage?: string;
  children: ReactNode;
};

/** Hides portal sections unless Office/Akte settings allow them. */
export function PortalSectionGate({
  settings,
  feature,
  lockedTitle = 'Bereich nicht freigegeben',
  lockedMessage = 'Dieser Bereich ist für Ihr Portal derzeit nicht sichtbar.',
  children,
}: PortalSectionGateProps) {
  const text = useAuroraAdaptiveText();

  if (!settings || !canClientPortalSeeFeature(settings, feature)) {
    return (
      <GlassCard style={styles.card}>
        <EmptyState title={lockedTitle} message={lockedMessage} />
        {feature === 'visit_tracking' ? (
          <View style={styles.note}>
            <Text style={{ color: text.muted }}>
              GPS- und Fahrtenbuchdaten sind im Klient:innenportal nicht verfügbar.
            </Text>
          </View>
        ) : null}
      </GlassCard>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.md },
  note: { marginTop: careSpacing.sm },
});
