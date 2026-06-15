import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  InfoBanner,
  PremiumAvatar,
  PremiumBadge,
  PremiumDivider,
  PremiumListRow,
  SectionPanel,
} from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export function DesignSystemComponentsSection() {
  const [showBanner, setShowBanner] = useState(true);

  return (
    <SectionPanel
      title="WP 041–060 Komponenten"
      subtitle="Avatar, Divider, ListRow, InfoBanner"
    >
      <Text style={styles.groupLabel}>PremiumAvatar</Text>
      <View style={styles.avatarRow}>
        <PremiumAvatar name="Anna Müller" size="sm" accentColor={colors.orange} />
        <PremiumAvatar name="Anna Müller" size="md" accentColor={colors.cyan} showOnline />
        <PremiumAvatar name="Thomas Weber" size="lg" accentColor={colors.success} />
      </View>

      <PremiumDivider label="Trenner" style={styles.divider} />
      <PremiumDivider variant="strong" />

      <Text style={styles.groupLabel}>PremiumListRow</Text>
      <PremiumListRow
        leading={<PremiumAvatar name="Klara Schmidt" size="sm" accentColor={colors.orange} />}
        title="Klara Schmidt"
        subtitle="Pflegegrad 3 · Berlin"
        trailing={<PremiumBadge label="Aktiv" variant="green" dot />}
        showChevron
        showDivider
        onPress={() => {}}
      />
      <PremiumListRow
        leading={<PremiumAvatar name="Einsatzplan" size="sm" accentColor={colors.cyan} />}
        title="Heutige Einsätze"
        subtitle="3 Termine · nächster 09:30"
        showChevron
        onPress={() => {}}
      />

      <Text style={styles.groupLabel}>InfoBanner</Text>
      {showBanner ? (
        <InfoBanner
          title="Demo-Modus"
          message="Supabase ist nicht verbunden — es werden Demo-Daten angezeigt."
          variant="info"
          dismissible
          onDismiss={() => setShowBanner(false)}
        />
      ) : null}
      <InfoBanner message="Klient:in erfolgreich gespeichert." variant="success" />
      <InfoBanner
        title="Pflichtfeld fehlt"
        message="Bitte geben Sie einen Nachnamen ein."
        variant="warning"
      />
      <InfoBanner
        title="Speichern fehlgeschlagen"
        message="Die Verbindung zum Server konnte nicht hergestellt werden."
        variant="danger"
      />
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    ...typography.label,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  divider: {
    marginVertical: spacing.sm,
  },
});
