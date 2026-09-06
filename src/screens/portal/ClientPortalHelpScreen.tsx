import { CLIENT_PORTAL_HELP } from '@/lib/portal/clientPortalHelp';
import { PortalKeyboardScrollView } from '@/components/keyboard/PortalKeyboard';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { liquidRadius } from '@/liquid-command/foundation/tokens';
import { portalPremium } from '@/design/tokens/portalPremium';

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
  const [openHelp, setOpenHelp] = useState<string | null>(CLIENT_PORTAL_HELP[0].title);
  const normalized = search.trim().toLocaleLowerCase('de-DE');
  const filtered = useMemo(
    () => CLIENT_HELP_CONTACTS.filter((item) => !normalized || `${item.name} ${item.description} ${item.displayNumber ?? ''}`.toLocaleLowerCase('de-DE').includes(normalized)),
    [normalized],
  );
  const wide = isDesktop || isTablet;

  return (
    <PortalTabScreen title="Hilfe & Notfallnummern" subtitle="Verlässliche Hilfe in ganz Deutschland" scroll={false}>
      <PortalKeyboardScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
        <ClientPortalGuide
          title="Welche Hilfe brauchen Sie?"
          message="Tippen Sie auf eine Telefonnummer, um direkt anzurufen. Bei Lebensgefahr, Feuer oder einem schweren medizinischen Notfall wählen Sie immer 112."
        />

        <View style={styles.section}>
          <Text style={[type.h2, styles.sectionTitle]}>So nutzen Sie Ihr Klientenportal</Text>
          {CLIENT_PORTAL_HELP.map((help) => (
            <View key={help.title} style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: openHelp === help.title }}
                onPress={() => setOpenHelp(openHelp === help.title ? null : help.title)} style={{ minHeight: 48, justifyContent: 'center' }}>
                <Text style={[type.bodyStrong, styles.cardTitle]}>{help.title} {openHelp === help.title ? '−' : '+'}</Text>
              </Pressable>
              {openHelp === help.title ? <Text style={[type.body, styles.description]}>{help.text}</Text> : null}
            </View>
          ))}
        </View>

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
          placeholderTextColor={portalPremium.text.muted}
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
      </PortalKeyboardScrollView>
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
  emergencyText: { color: portalPremium.text.onStrong },
  emergencyCall: { minHeight: 46, paddingHorizontal: 18, borderRadius: liquidRadius.control, backgroundColor: portalPremium.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  emergencyCallText: { color: '#8B1A2E' },
  search: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    borderRadius: liquidRadius.card,
    backgroundColor: portalPremium.surfaceRaised,
    color: portalPremium.text.primary,
  },
  section: { gap: careSpacing.sm },
  sectionTitle: { color: portalPremium.text.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.md },
  card: {
    width: '100%',
    padding: careSpacing.lg,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: liquidRadius.panel,
    backgroundColor: portalPremium.surfaceRaised,
    gap: careSpacing.sm,
  },
  cardWide: { flexBasis: '48%', flexGrow: 1 },
  cardEmergency: { borderColor: 'rgba(197,58,82,0.42)', backgroundColor: '#FFF5F7' },
  cardTitle: { color: portalPremium.text.primary },
  callButton: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, borderRadius: liquidRadius.control, backgroundColor: portalPremium.surfaceMuted, justifyContent: 'center' },
  callButtonEmergency: { backgroundColor: 'rgba(197,58,82,0.10)' },
  number: { color: portalPremium.accent.blueDark },
  callLabel: { color: portalPremium.accent.blue, fontWeight: '800' },
  availability: { color: portalPremium.accent.success, fontWeight: '700' },
  description: { color: portalPremium.text.secondary },
  sourceLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  sourceText: { color: portalPremium.accent.blueDark, textDecorationLine: 'underline' },
  footnote: { color: portalPremium.text.secondary, paddingBottom: careSpacing.lg },
  pressed: { opacity: 0.74 },
});
