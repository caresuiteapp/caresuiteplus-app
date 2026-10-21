import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';

export const INTAKE_2027_REVIEW_DATE = '2026-10-21';
export const INTAKE_2027_VERSION = 4;
export type IntakeLegalField = { key: string; label: string; help?: string; choices?: readonly string[]; optional?: boolean };
const field = (key: string, label: string, help?: string, choices?: readonly string[]): IntakeLegalField => ({ key, label, help, choices });
export const INTAKE_2027_COMMON_FIELDS: IntakeLegalField[] = [
  field('provider.contact', 'Kontakt für Vertragsfragen und Widerruf', 'Erreichbare E-Mail-Adresse oder Telefonnummer des Unternehmens.'),
  field('provider.privacy', 'Datenschutzkontakt', 'Kontaktdaten der zuständigen Stelle; bei bestellter Datenschutzbeauftragtenstelle auch deren Kontakt.'),
  field('provider.basis', 'Tatsächliche Zwecke und Rechtsgrundlagen', 'Verarbeitung je Leistungsbereich konkret zuordnen: Art. 6 DSGVO und bei Gesundheitsdaten zusätzlich die tatsächlich einschlägige Ausnahme nach Art. 9 Abs. 2.'),
  field('provider.authority', 'Zuständige Datenschutzaufsicht', 'Name und Kontakt der für das Unternehmen zuständigen Aufsichtsbehörde.'),
  field('provider.recipients', 'Empfänger und eingesetzte Dienstleister', 'Tatsächlich eingesetzte Empfängerkategorien, Auftragsverarbeiter und mögliche Übermittlungen außerhalb des EWR konkret benennen.'),
  field('provider.retention', 'Aufbewahrung und Löschung', 'Fristen oder nachvollziehbare Kriterien nach Unterlagenart. Keine pauschale Frist für sämtliche Daten.'),
  field('employee.name', 'Unterzeichnende Person des Unternehmens', 'Vollständiger Name der zeichnungsberechtigten Person.'),
  field('signer.capacity', 'Wer unterschreibt für die betreute Person?', undefined, ['Die betreute Person selbst', 'Eine bevollmächtigte oder rechtliche Vertretung']),
  field('signer.name', 'Name der unterzeichnenden Person', 'Vollständiger Name. Bei Vertretung abweichend vom Namen der betreuten Person.'),
];
const agreements = (prefix: string): IntakeLegalField[] => [
  field(`${prefix}.services`, 'Vereinbarte Leistungen und Umfang', 'Konkrete Leistungen, Menge, Häufigkeit und Grenzen. Eine allgemeine Leistungsbeschreibung reicht nicht aus.'),
  field(`${prefix}.schedule`, 'Zeiten und Leistungsort', 'Vereinbarte Wochentage, Zeitfenster, Dauer und Ort.'),
  field(`${prefix}.prices`, 'Preise und voraussichtliche Gesamtkosten', 'Jede Leistung mit Abrechnungseinheit und Endpreis; Steuern beziehungsweise Befreiung, Häufigkeit und voraussichtliche Kosten pro Zeitraum.'),
  field(`${prefix}.extras`, 'Weitere Kosten und Eigenanteile', 'Fahrtkosten, Zuschläge, Material und private Anteile ausdrücklich beziffern; andernfalls „Keine weiteren Kosten“.', ['Keine weiteren Kosten']),
  field(`${prefix}.annexes`, 'Ausgehändigte Anlagen', 'Titel, Datum und Fassung der Leistungs-, Preis- und sonstigen einbezogenen Anlagen; ohne Anlagen „Keine zusätzlichen Anlagen“.', ['Keine zusätzlichen Anlagen']),
];
export const INTAKE_2027_FIELDS: Record<string, IntakeLegalField[]> = {
  privacy_consent_default: [],
  client_contract_assist: agreements('assist'),
  client_contract_ambulatory_care: [...agreements('ambulatory'), field('ambulatory.approval', 'Zulassung und Abrechnungsgrundlage', 'Leistungserbringer, Zulassung/IK und einschlägige Vereinbarungen; Behandlungspflege und SGB-XI-Leistungen unterscheiden.')],
  client_contract_stationary_care: [...agreements('stationary'),
    field('stationary.accommodation', 'Wohnraum und Ausstattung', 'Einrichtung, Anschrift, Zimmer, Fläche, Ausstattung, Gemeinschaftsflächen und mitgebrachte Gegenstände.'),
    field('stationary.charges', 'Getrennte Entgeltbestandteile', 'Pflege/Betreuung, Unterkunft, Verpflegung, Investitionskosten, weitere Leistungen, Gesamtentgelt und Eigenanteil einzeln beziffern.'),
    field('stationary.precontract', 'Vorvertragliche Informationen', 'Titel, Fassung, Aushändigungsdatum und erkennbare Abweichungen nach § 3 WBVG.'),
    field('stationary.disputes', 'Verbraucherstreitbeilegung', 'Teilnahmebereitschaft oder -pflicht und gegebenenfalls zuständige Verbraucherschlichtungsstelle nach § 36 VSBG.'),
    field('stationary.adjustment', 'Versorgungsanpassung und Landesrecht', 'Konkrete Leistungsgrenzen, Anpassungsverfahren, zuständige Aufsicht und einschlägige landesrechtliche Vorgaben.')],
  client_contract_care_consulting: [...agreements('consulting'), field('consulting.basis', 'Rechtsgrundlage und Auftragsart', undefined,
    ['Beratungsbesuch nach § 37 Abs. 3 SGB XI', 'Pflegeberatung nach § 7a SGB XI', 'Individuelle häusliche Schulung nach § 45 SGB XI', 'Privat beauftragte Beratung']),
    field('consulting.authorization', 'Berechtigung und Kostenübernahme', 'Beauftragung/Anerkennung und Vergütungsvereinbarung oder ausdrücklicher privater Auftrag. Keine automatische Privatabrechnung bei Ablehnung der Kasse.')],
  client_contract_day_care: [...agreements('daycare'), field('daycare.transport', 'Notwendige Beförderung', 'Abholung, Rückfahrt, Zuständigkeit und vereinbarte Beförderungskosten beschreiben.')],
  client_contract_relief_services: [...agreements('relief'), field('relief.recognition', 'Anerkennung und Leistungsgrundlage', 'Landesrechtliche Anerkennung oder andere einschlägige Berechtigung, Bundesland und genehmigter Leistungsumfang.')],
  assignment_declaration_care_health_insurance: [field('assignment.claim', 'Abtretbarer Erstattungsanspruch', 'Konkrete Geldforderung und Rechtsgrundlage. Sachleistungsansprüche werden nicht abgetreten.'),
    field('assignment.period', 'Leistungszeitraum und Begrenzung', 'Zeitraum sowie Höchstbetrag oder eindeutige Berechnungsgrundlage.'),
    field('assignment.debtor', 'Schuldner und Zuordnung', 'Genaue Kasse/Stelle, Anschrift und Versicherungs- oder Aktenzeichen.'),
    field('assignment.approval', 'Prüfung der Abtretbarkeit', 'Kostenträgervorgaben und gegebenenfalls Feststellung nach § 53 SGB I; kein pauschaler Verzicht auf Einwendungen.')],
  confidentiality_release_default: [field('confidentiality.people', 'Entbundene Personen und Empfänger', 'Beide Seiten namentlich mit Praxis/Einrichtung benennen.'),
    field('confidentiality.purpose', 'Zweck und benötigte Gesundheitsinformationen', 'Welche Angaben dürfen für welchen konkreten Versorgungsschritt übermittelt werden?'),
    field('confidentiality.duration', 'Geltungsdauer und Grenzen', 'Konkreter Zeitraum oder Ende des bezeichneten Versorgungszwecks; mögliche Ausnahmen festhalten.')],
  communication_consent_default: [],
  photo_media_consent_default: [field('media.purpose', 'Konkreter Aufnahmezweck', 'Beispielsweise dokumentierter Verlauf einer bestimmten Wunde oder Anpassung eines Hilfsmittels.'),
    field('media.scope', 'Aufnahmeumfang, Zugriff und Dauer', 'Was wird aufgenommen, wer darf darauf zugreifen, wann endet die Nutzung?')],
  emergency_contact_consent_default: [field('emergency.scope', 'Informationen und Anlass der Kontaktaufnahme', 'Erforderliche Informationen und etwaige Einschränkungen; die Kontaktperson wird dadurch nicht zur rechtlichen Vertretung.')],
};
export const COMMUNICATION_CHOICES = [
  { key: 'communication.phone', label: 'Telefonische organisatorische Mitteilungen' },
  { key: 'communication.email', label: 'E-Mail ohne Gesundheitsdaten', help: 'Unverschlüsselte E-Mail kann von Dritten mitgelesen oder fehlgeleitet werden. Eine sichere Alternative bleibt verfügbar.' },
  { key: 'communication.sms', label: 'SMS ohne Gesundheitsdaten', help: 'Nur kurze organisatorische Hinweise. Nachrichten können auf dem Endgerät sichtbar sein.' },
  { key: 'communication.portal', label: 'Nachrichten im geschützten Klientenportal' },
] as const;
export const MEDIA_CHOICES = [
  { key: 'media.photo', label: 'Fotos zum beschriebenen Dokumentationszweck' },
  { key: 'media.video', label: 'Videoaufnahmen zum beschriebenen Dokumentationszweck' },
] as const;
export function getIntake2027Fields(keys: readonly string[], form: ClientIntakeFormData): IntakeLegalField[] {
  const all = [...INTAKE_2027_COMMON_FIELDS];
  if (form.intakeLegalDetails?.['signer.capacity'] === 'Eine bevollmächtigte oder rechtliche Vertretung') all.push(field('signer.authority', 'Nachgewiesene Vertretungsbefugnis', 'Art, Datum, Umfang und Ablageort der Vollmacht oder des Betreuernachweises.'));
  if (keys.some(key => key.startsWith('client_contract_'))) all.push(field('contract.conclusion', 'Art des Vertragsschlusses', undefined,
    ['In den Geschäftsräumen', 'Außerhalb der Geschäftsräume', 'Im Fernabsatz']));
  for (const key of keys) all.push(...(INTAKE_2027_FIELDS[key] ?? []));
  return [...new Map(all.map(item => [item.key, item])).values()];
}
export function validIntakeLegalDetails(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length <= 100 && Object.entries(value).every(([key, content]) => /^[a-z]+\.[a-z]+$/.test(key)
      && typeof content === 'string' && content.length <= 10000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content));
}
