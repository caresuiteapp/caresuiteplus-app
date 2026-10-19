import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import type { ShiftScheduleListItem } from '@/lib/pflege/shiftScheduleDemo';
import { buildShiftReleaseBoundary } from '@/lib/pflege/shiftReleaseBoundary.web';
import { spacing, typography } from '@/theme';

export function ShiftReleaseEvidencePanel({ items }: { items: readonly ShiftScheduleListItem[] }) {
  const evidence = useMemo(() => buildShiftReleaseBoundary(items), [items]);
  const { c } = useCareLightPalette();
  return (
    <PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Freigabe ist nicht Planempfang</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        „Schicht freigeben“ prüft serverseitig Verfügbarkeit, Sperrzeiten, Abwesenheiten,
        Überschneidungen, Standardruhezeit, aktive Pflegekraft und den aktuellen Zeilenstand.
        Ein Konflikt lässt den Entwurf unveröffentlicht.
      </Text>
      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
        <Text style={{ ...typography.caption, color: c.text }}>
          Gelieferter Lesestand: {evidence.suppliedRows} Schichten · {evidence.drafts} Entwürfe · {evidence.released} freigegeben · {evidence.officeConfirmed} im Büro bestätigt
        </Text>
        {evidence.unresolvedEmployees > 0 ? (
          <InfoBanner
            variant="warning"
            title="Zuordnung ungeklärt"
            message={`${evidence.unresolvedEmployees} Schichtzuordnung(en) enthalten keine native Mitarbeiterkennung.`}
          />
        ) : null}
        {evidence.integrity === 'untrusted' ? (
          <InfoBanner
            variant="warning"
            title="Lesestand nicht eindeutig"
            message="Doppelte Kennungen, fehlender Mandant oder gemischte Mandanten verhindern eine belastbare Einordnung."
          />
        ) : null}
      </View>
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        „Geplant“ oder „bestätigt“ belegt nur den gespeicherten Schichtstatus. Die Liste enthält
        keine eindeutige Gesamtplanversion, keinen Gültigkeitszeitraum des Gesamtplans, keinen
        Empfangsbeleg der Pflegekraft und keine vollständig gebundene Originalhistorie. Daraus
        folgen weder tatsächlicher Dienst noch geleistete Arbeit.
      </Text>
    </PremiumCard>
  );
}
