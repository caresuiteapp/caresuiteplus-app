import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
export function AmbulatoryConfigurationScreen() {
  const router = useRouter(); const { c } = useCareLightPalette();
  const links = [
    ['Aufnahme & Versorgung', 'Vertrag, Kosteninformation, Kostenträger, Notfallkontakt und Versorgungsstatus.', '/pflege/aufnahme'],
    ['Leistungen & Vergütung', 'Leistungskomplexe, Einheiten, Preise, Kostenträgerbindung und Gültigkeitszeiträume.', '/pflege/leistungskatalog'],
    ['Pflegepersonal', 'Aktive Mitarbeitende, Pflegeprodukt-Zuordnung und dokumentierte Qualifikationen.', '/pflege/personal'],
    ['Dienstplanung', 'Schichten, geplante Pausen, Freigabe und Vertretungsbedarf.', '/pflege/dienstplaene'],
    ['Verordnungen & Genehmigungen', 'Ärztliche Angaben, Gültigkeit und Kostenträgerbescheide.', '/pflege/verordnungen'],
    ['Aufgaben & Wiedervorlagen', 'Fälligkeiten und dokumentierte Ergebnisse.', '/pflege/aufgaben'],
    ['Qualität & Abweichungen', 'Risikobewertung, Korrekturmaßnahmen und Wirksamkeitsprüfung.', '/pflege/abweichungen'],
  ];
  return <ScreenShell title="Ambulante Betriebsgrundlagen" subtitle="Konfiguration und verbindliche Abläufe"><View style={{ gap: 16, paddingBottom: 24 }}>
    {links.map(([title, description, route]) => <SectionPanel key={route} title={title}><Text style={{ color: c.text }}>{description}</Text><PremiumButton title={`${title} öffnen`} variant="secondary" onPress={() => router.push(route as never)} /></SectionPanel>)}
    <SectionPanel title="Nachweise & Berechtigungen"><Text style={{ color: c.text }}>Dokumentierte Versorgung, gespeicherte Unterschrift und Prüfung durch eine zweite berechtigte Person bilden den Freigabeablauf. Diese Nachweispflichten lassen sich hier nicht deaktivieren.</Text></SectionPanel>
    <SectionPanel title="Arbeitszeitplanung"><Text style={{ color: c.text }}>Der Standardablauf berücksichtigt höchstens zehn Stunden geplante Nettoarbeitszeit, erforderliche geplante Pausen und elf Stunden Ruhe zwischen freigegebenen Schichten. Tarifliche Ausnahmen und die durchschnittliche Arbeitszeit müssen zusätzlich über eure Personal- und Arbeitszeitverwaltung geprüft werden.</Text></SectionPanel>
    <SectionPanel title="Externe Anbindungen"><Text style={{ color: c.text }}>TI/eMP und Kassen-Datenaustausch benötigen eine tatsächlich eingerichtete und geprüfte Anbieteranbindung. Ein gespeicherter Nachweis oder Datenexport bestätigt keinen Versand an die Kasse.</Text></SectionPanel>
  </View></ScreenShell>;
}
