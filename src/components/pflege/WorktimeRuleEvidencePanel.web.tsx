import { Text, View } from 'react-native';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { buildWorktimeRuleEvidence } from '@/lib/pflege/worktimeRuleEvidence.web';
import { spacing, typography } from '@/theme';

export function WorktimeRuleEvidencePanel() {
  const evidence = buildWorktimeRuleEvidence();
  const { c } = useCareLightPalette();
  return (
    <PremiumCard>
      <Text style={{ ...typography.h3, color: c.text }}>Technischer Standard ist keine Rechtsfreigabe</Text>
      <Text style={{ ...typography.body, color: c.muted, marginTop: spacing.xs }}>
        Der aktuelle Code prüft zehn Stunden geplante Nettoarbeitszeit, 30/45 Minuten Pause,
        höchstens sechs Stunden ohne Pause und elf Stunden Standardruhezeit. Diese Werte sind
        technische Schutzgrenzen; sie belegen keine für den konkreten Betrieb geltende Regelversion.
      </Text>
      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
        {evidence.technicalRules.map((rule) => (
          <Text key={rule.key} style={{ ...typography.caption, color: c.text }}>• {rule.label}</Text>
        ))}
      </View>
      <InfoBanner
        variant="warning"
        title="Geltende Grundlage nicht gebunden"
        message="Schichten und Regelwarnungen speichern keine Rechts-/Tarifversion, keinen Gültigkeitszeitraum und keine autorisierte Ausnahme."
      />
      <Text style={{ ...typography.caption, color: c.muted, marginTop: spacing.sm }}>
        Amtliche Fundstellen am {evidence.reviewedOn} geprüft: §§ 3, 4, 5 und 7 ArbZG. Offen bleiben
        Ausgleich und Durchschnitt, betriebliche oder tarifliche Abweichungen, personenbezogene
        Anwendbarkeit, unveränderliche Regelhistorie sowie die rechtliche Freigabe. Eine Warnung oder
        ihr Bestätigen genehmigt keine Ausnahme.
      </Text>
    </PremiumCard>
  );
}
