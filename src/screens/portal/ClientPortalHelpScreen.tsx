import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import {
  CLIENT_HELP_CATEGORY_LABELS,
  CLIENT_HELP_CONTACTS,
  type ClientHelpCategory,
  type ClientHelpContact,
} from '@/lib/portal/clientHelpContacts';
import { liquidColors, liquidRadius } from '@/liquid-command/foundation/tokens';

const CATEGORY_ORDER: ClientHelpCategory[] = ['emergency', 'medical', 'crisis', 'violence', 'family', 'daily'];

function HelpContactCard({ item, wide }: { item: ClientHelpContact; wide: boolean }) {
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  return (
    <View style={[styles.card, wide && styles.cardWide, item.emergency && styles.cardEmergency]}>
      <Text style={[type.bodyStrong, styles.cardTitle]}>{item.name}</Text>
      {item.displayNumber && item.dialNumber ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} unter ${item.displayNumber} anrufen`}
          onPress={() => void Linking.openURL(`tel:${item.dialNumber}`)}
          style={({ pressed }) => [styles.callButton, item.emergency && styles.callButtonEmergency, pressed && styles.pressed]}
        >
          <Text style={[type.h2, styles.number]}>☎ {item.displayNumber}</Text>
          <Text style={[type.caption, styles.callLabel]}>JETZT ANRUFEN</Text>
        </Pressable>
      ) : null}
      <Text style={[type.caption, styles.availability]}>{item.availability}</Text>
      <Text style={[type.body, styles.description]}>{item.description}</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(item.sourceUrl)} style={styles.sourceLink}>
        <Text style={[type.caption, styles.sourceText]}>Offizielle Information: {item.sourceLabel} ↗</Text>
      </Pressable>
    </View>
  );
}

export function ClientPortalHelpScreen() {
  const { width, isDesktop, isTablet } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const [search, setSearch] = useState('');
  const normalized = search.trim().toLocaleLowerCase('de-DE');
  const filtered = useMemo(
    () => CLIENT_HELP_CONTACTS.filter((item) => !normalized || `${item.name} ${item.description} ${item.displayNumber ?? ''}`.toLocaleLowerCase('de-DE').includes(normalized)),
    [normalized],
  );
  const wide = isDesktop || isTablet;

  return (
    <PortalTabScreen title="Hilfe & Notfallnummern" subtitle="Verlässliche Hilfe in ganz Deutschland" scroll={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
        <ClientPortalGuide
          title="Welche Hilfe brauchen Sie?"
          message="Tippen Sie auf eine Telefonnummer, um direkt anzurufen. Bei Lebensgefahr, Feuer oder einem schweren medizinischen Notfall wählen Sie immer 112."
        />

        <View style={styles.emergencyBar}>
          <Text style={[type.bodyStrong, styles.emergencyText]}>Akute Gefahr?</Text>
          <Pressable accessibilityRole="button" onPress={() => void Linking.openURL('tel:112')} style={({ pressed }) => [styles.emergencyCall, pressed && styles.pressed]}>
            <Text style={[type.bodyStrong, styles.emergencyCallText]}>112 anrufen</Text>
          </Pressable>
        </View>

        <TextInput
          accessibilityLabel="Hilfen und Telefonnummern durchsuchen"
          clearButtonMode="while-editing"
          onChangeText={setSearch}
          placeholder="Suchen, z. B. Gift, Polizei, Pflege, Gewalt …"
          placeholderTextColor={liquidColors.white56}
          style={[type.body, styles.search]}
          value={search}
        />

        {filtered.length === 0 ? (
          <ClientPortalGuide compact title="Kein passender Eintrag gefunden" message="Versuchen Sie einen allgemeineren Suchbegriff oder wählen Sie bei akuter Gefahr direkt 112." />
        ) : (
          CATEGORY_ORDER.map((category) => {
            const items = filtered.filter((item) => item.category === category);
            if (items.length === 0) return null;
            return (
              <View key={category} style={styles.section}>
                <Text style={[type.h2, styles.sectionTitle]}>{CLIENT_HELP_CATEGORY_LABELS[category]}</Text>
                <View style={styles.grid}>
                  {items.map((item) => <HelpContactCard key={item.id} item={item} wide={wide} />)}
                </View>
              </View>
            );
          })
        )}
        <Text style={[type.caption, styles.footnote]}>
          Stand: 1. August 2026. Öffnungszeiten und Kosten können sich ändern; die verlinkten offiziellen Stellen enthalten die aktuellen Angaben.
        </Text>
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: careSpacing.lg, paddingBottom: careSpacing.xxl },
  emergencyBar: {
    minHeight: 64,
    paddingHorizontal: careSpacing.lg,
    paddingVertical: careSpacing.sm,
    borderRadius: liquidRadius.card,
    backgroundColor: 'rgba(139,26,46,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.md,
  },
  emergencyText: { color: liquidColors.white },
  emergencyCall: { minHeight: 46, paddingHorizontal: 18, borderRadius: liquidRadius.control, backgroundColor: liquidColors.white, alignItems: 'center', justifyContent: 'center' },
  emergencyCallText: { color: '#8B1A2E' },
  search: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    borderRadius: liquidRadius.card,
    backgroundColor: 'rgba(8,39,75,0.86)',
    color: liquidColors.white,
  },
  section: { gap: careSpacing.sm },
  sectionTitle: { color: liquidColors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.md },
  card: {
    width: '100%',
    padding: careSpacing.lg,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    borderRadius: liquidRadius.panel,
    backgroundColor: 'rgba(8,39,75,0.82)',
    gap: careSpacing.sm,
  },
  cardWide: { flexBasis: '48%', flexGrow: 1 },
  cardEmergency: { borderColor: 'rgba(255,91,110,0.55)' },
  cardTitle: { color: liquidColors.white },
  callButton: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, borderRadius: liquidRadius.control, backgroundColor: liquidColors.blue500Alpha16, justifyContent: 'center' },
  callButtonEmergency: { backgroundColor: 'rgba(255,91,110,0.18)' },
  number: { color: liquidColors.white },
  callLabel: { color: liquidColors.blue200, fontWeight: '800' },
  availability: { color: liquidColors.success, fontWeight: '700' },
  description: { color: liquidColors.white88 },
  sourceLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  sourceText: { color: liquidColors.blue200, textDecorationLine: 'underline' },
  footnote: { color: liquidColors.white56, paddingBottom: careSpacing.lg },
  pressed: { opacity: 0.74 },
});
