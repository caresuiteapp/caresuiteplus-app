import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

type PolicySection = {
  number: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  notice?: string;
};

const CONTROLLER = {
  name: 'CareSuite HealthOS Software Technologie',
  owner: 'Kevin Reinhardt',
  address: 'Castroper Str. 81A, 44628 Herne, Deutschland',
  email: 'caresuiteapp@gmail.com',
  website: 'https://www.caresuiteplus.app',
};

const sections: PolicySection[] = [
  {
    number: '1',
    title: 'Geltungsbereich und Zweck dieser Erklärung',
    paragraphs: [
      'Diese Datenschutzerklärung informiert über die Verarbeitung personenbezogener Daten beim Besuch unserer Website, bei der Nutzung der webbasierten CareSuite-HealthOS-Plattform, der mobilen CareSuite-HealthOS-Anwendung sowie der damit verbundenen Portale, Support-, Kommunikations- und Integrationsfunktionen.',
      'CareSuite HealthOS ist eine mandantenfähige B2B-Software für Organisation, Einsatzplanung, Dokumentation, Kommunikation und weitere betriebliche Abläufe im Gesundheits-, Pflege-, Assistenz- und Sozialbereich. Welche Module tatsächlich verfügbar sind, hängt von Vertrag, Rolle, Mandant, Konfiguration und verwendeter App-Edition ab. Aussagen zu optionalen Funktionen gelten nur, wenn die betreffende Organisation diese aktiviert und die Funktion verwendet.',
      'Diese Erklärung beschreibt die Plattform auf Grundlage ihres vorgesehenen und technisch verfügbaren Funktionsumfangs. Der jeweilige Vertragspartner bleibt verpflichtet, seine eigenen Informationspflichten gegenüber Klient:innen, Beschäftigten, Angehörigen und sonstigen betroffenen Personen zu erfüllen.',
    ],
  },
  {
    number: '2',
    title: 'Verantwortlicher und Datenschutzkontakt',
    paragraphs: [
      `${CONTROLLER.name}, Einzelunternehmen, ${CONTROLLER.address}. Inhaber und vertretungsberechtigte Person: ${CONTROLLER.owner}. E-Mail: ${CONTROLLER.email}. Website: ${CONTROLLER.website}.`,
      'Für Verarbeitungen, die wir zu eigenen Zwecken vornehmen – insbesondere Websitebetrieb, Vertragsanbahnung, Kundenkonto- und Plattformverwaltung, Abrechnung, Support, IT-Sicherheit und rechtliche Nachweispflichten – sind wir Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO.',
    ],
    notice: 'Bitte senden Sie Gesundheits-, Pflege- oder andere besonders vertrauliche Falldaten nicht unverschlüsselt per E-Mail. Fordern Sie bei Bedarf einen geeigneten sicheren Übermittlungsweg an.',
  },
  {
    number: '3',
    title: 'Datenschutzbeauftragter',
    paragraphs: [
      `Derzeit ist für ${CONTROLLER.name} kein Datenschutzbeauftragter bestellt. Datenschutzanfragen können unmittelbar an ${CONTROLLER.email} gerichtet werden.`,
      'Wir überprüfen die gesetzlichen Voraussetzungen für eine Benennung regelmäßig und werden diese Erklärung aktualisieren, wenn eine Benennung erforderlich wird. Das Fehlen eines benannten Datenschutzbeauftragten berührt Ihre gesetzlichen Rechte nicht.',
    ],
  },
  {
    number: '4',
    title: 'Rollenverteilung: Plattformbetreiber und nutzende Organisation',
    paragraphs: [
      'Bei Mandanten-, Klienten-, Pflege-, Assistenz-, Angehörigen-, Beschäftigten- und Leistungsdaten entscheidet regelmäßig die Organisation, die CareSuite HealthOS einsetzt, über Zwecke und wesentliche Mittel der Verarbeitung. Diese Organisation ist insoweit Verantwortlicher. CareSuite verarbeitet solche Daten grundsätzlich weisungsgebunden als Auftragsverarbeiter nach Art. 28 DSGVO.',
      'Zwischen CareSuite und der nutzenden Organisation wird dafür ein Vertrag über Auftragsverarbeitung einschließlich technischer und organisatorischer Maßnahmen geschlossen. Die Organisation verwaltet Berechtigungen, Rollen, Löschkonzepte, Dokumentationspflichten, Rechtsgrundlagen und die Information ihrer betroffenen Personen.',
      'Wenn Sie Auskunft oder Löschung zu einer Klienten-, Personal- oder Pflegedokumentation wünschen, wenden Sie sich bitte vorrangig an die Organisation, in deren Auftrag die Daten verarbeitet werden. Wir unterstützen diese Organisation bei der Bearbeitung. Für unsere eigenen Verarbeitungen können Sie sich direkt an uns wenden.',
    ],
  },
  {
    number: '5',
    title: 'Kategorien betroffener Personen und Daten',
    bullets: [
      'Interessent:innen, Vertragspartner, Administrator:innen und registrierte Nutzer:innen: Stamm-, Kontakt-, Vertrags-, Rollen-, Authentifizierungs-, Support- und Abrechnungsdaten.',
      'Klient:innen, Patient:innen, Bewohner:innen und leistungsberechtigte Personen: Identitäts-, Kontakt-, Versicherungs-, Pflege-, Gesundheits-, Bedarfs-, Termin-, Leistungs-, Dokumentations- und Abrechnungsdaten.',
      'Angehörige, Bevollmächtigte, gesetzliche Betreuer:innen und Kontaktpersonen: Stamm-, Kontakt-, Beziehungs-, Einwilligungs- und Kommunikationsdaten.',
      'Beschäftigte, Bewerber:innen, freie Mitarbeitende und Einsatzkräfte: Personalstamm-, Qualifikations-, Rollen-, Dienstplan-, Zeit-, Einsatz-, Standort-, Kommunikations- und Nachweisdaten.',
      'Lieferanten, Kooperationspartner und sonstige Geschäftskontakte: Kontakt-, Kommunikations-, Vertrags-, Rechnungs- und Zahlungsdaten.',
      'Technische Nutzungsdaten: IP-Adresse, Zeitstempel, Geräte- und Browserinformationen, App-Version, Sitzungs- und Sicherheitsereignisse, Fehler- und Diagnoseinformationen sowie protokollierte Verwaltungsaktionen.',
    ],
  },
  {
    number: '6',
    title: 'Verarbeitungsgrundsätze',
    paragraphs: [
      'Wir verarbeiten personenbezogene Daten nach den Grundsätzen der Rechtmäßigkeit, Transparenz, Zweckbindung, Datenminimierung, Richtigkeit, Speicherbegrenzung, Integrität und Vertraulichkeit. Zugriffe sollen rollen- und mandantenbezogen auf das für die jeweilige Aufgabe erforderliche Maß begrenzt werden.',
      'Eine Funktion darf nicht allein deshalb genutzt werden, weil sie technisch verfügbar ist. Die nutzende Organisation muss vor Aktivierung prüfen, ob Zweck, Rechtsgrundlage, Berechtigungskonzept, Information der Betroffenen, Aufbewahrung und gegebenenfalls Mitbestimmung oder Datenschutz-Folgenabschätzung geklärt sind.',
    ],
  },
  {
    number: '7',
    title: 'Allgemeine Rechtsgrundlagen',
    bullets: [
      'Art. 6 Abs. 1 Buchst. b DSGVO für vorvertragliche Maßnahmen sowie die Durchführung von Verträgen mit betroffenen Personen.',
      'Art. 6 Abs. 1 Buchst. c DSGVO für rechtliche Pflichten, etwa handels-, steuer-, sozial-, berufs- oder aufsichtsrechtliche Anforderungen.',
      'Art. 6 Abs. 1 Buchst. f DSGVO für berechtigte Interessen, etwa sicheren, stabilen und wirtschaftlichen Plattformbetrieb, Missbrauchsabwehr, Rechtsverteidigung und sachgerechte Geschäftskommunikation; entgegenstehende Interessen werden abgewogen.',
      'Art. 6 Abs. 1 Buchst. a DSGVO, wenn eine freiwillige, informierte und widerrufliche Einwilligung erforderlich und geeignet ist.',
      'Art. 6 Abs. 1 Buchst. d DSGVO in seltenen Fällen zum Schutz lebenswichtiger Interessen.',
      'Für Beschäftigtendaten zusätzlich die jeweils anwendbaren nationalen Regelungen, insbesondere § 26 BDSG, sowie gegebenenfalls kollektivrechtliche Vereinbarungen.',
    ],
    notice: 'Eine Einwilligung wird nicht pauschal als Ersatz für eine andere notwendige Rechtsgrundlage verwendet. Ihr Widerruf wirkt für die Zukunft und lässt die Rechtmäßigkeit der vorherigen Verarbeitung unberührt.',
  },
  {
    number: '8',
    title: 'Gesundheits- und andere besondere Kategorien personenbezogener Daten',
    paragraphs: [
      'CareSuite HealthOS kann Gesundheitsdaten und weitere besondere Kategorien im Sinne von Art. 9 DSGVO verarbeiten. Dazu können Diagnosen, Medikation, Vitalwerte, Wunddokumentation, Pflegeanamnese, Risiken, Maßnahmen, Leistungsnachweise, Berichte, Verordnungen und Angaben zur körperlichen oder psychischen Situation gehören.',
      'Die nutzende Organisation bestimmt und dokumentiert die konkrete Ausnahme nach Art. 9 Abs. 2 DSGVO. Je nach Sachverhalt kommen insbesondere Buchst. h in Verbindung mit einschlägigem Unions- oder nationalem Recht, Buchst. b, f, g oder i sowie in geeigneten Fällen eine ausdrückliche Einwilligung nach Buchst. a in Betracht. CareSuite legt für Mandantendaten keine pauschale medizinische Rechtsgrundlage fest.',
      'Personen mit Zugriff auf Berufs- oder Gesundheitsgeheimnisse bleiben an ihre beruflichen, vertraglichen und gesetzlichen Verschwiegenheitspflichten gebunden. Berechtigungen sind durch den Mandanten eng zu vergeben und regelmäßig zu überprüfen.',
    ],
  },
  {
    number: '9',
    title: 'Websiteaufruf, Hosting und technische Protokolle',
    paragraphs: [
      'Beim Aufruf der Website oder Web-App werden technisch erforderliche Verbindungsdaten verarbeitet. Dazu gehören insbesondere IP-Adresse, Datum und Uhrzeit, angeforderte Ressource, Referrer soweit übermittelt, Browser, Betriebssystem, Geräteklasse, Antwortstatus und übertragene Datenmenge. Die Verarbeitung ist erforderlich, um Inhalte auszuliefern, Angriffe zu erkennen, Fehler zu analysieren und die Verfügbarkeit sicherzustellen.',
      'Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO. Unser berechtigtes Interesse liegt im sicheren und funktionsfähigen Betrieb. Für Hosting und Auslieferung können wir Vercel und dessen Unterauftragnehmer einsetzen. Durch globale Auslieferungsnetze können technische Verbindungsdaten auch außerhalb des Europäischen Wirtschaftsraums verarbeitet werden; hierzu gelten die Regelungen zu internationalen Übermittlungen in dieser Erklärung.',
    ],
  },
  {
    number: '10',
    title: 'Technisch erforderliche Speicherung auf Ihrem Gerät',
    paragraphs: [
      'Website und App verwenden technisch erforderliche lokale Speichermechanismen, beispielsweise für Anmeldung und Sitzungszustand, Mandanten- und Rollenbezug, Sicherheitsfunktionen, Sprache, Barrierefreiheit, Anzeigeeinstellungen und die Fortsetzung eines begonnenen Arbeitsablaufs. Ohne diese Speicherung sind zentrale angeforderte Funktionen nicht zuverlässig nutzbar.',
      'Soweit § 25 TDDDG anwendbar ist, stützen wir technisch unbedingt erforderliche Zugriffe auf § 25 Abs. 2 Nr. 2 TDDDG. Die anschließende Verarbeitung personenbezogener Daten richtet sich nach Art. 6 DSGVO. Nicht erforderliche Analyse-, Marketing- oder Werbetechnologien werden nicht allein durch diese Erklärung legitimiert und müssten vor einer Aktivierung gesondert geprüft und – soweit erforderlich – einwilligungsbasiert gesteuert werden.',
    ],
  },
  {
    number: '11',
    title: 'Registrierung, Anmeldung und Kontosicherheit',
    paragraphs: [
      'Für die Nutzung geschützter Bereiche werden insbesondere E-Mail-Adresse, interne Nutzerkennung, Mandantenzuordnung, Rolle, Berechtigungen, Authentifizierungsnachweise, Sitzungsinformationen und sicherheitsrelevante Ereignisse verarbeitet. Passwörter werden über den Authentifizierungsdienst verwaltet und nicht im Klartext angezeigt.',
      'Zwecke sind Kontoanlage, Identitäts- und Berechtigungsprüfung, Sitzungsverwaltung, Schutz vor unbefugtem Zugriff, Zurücksetzen von Zugangsdaten und Nachvollziehbarkeit sicherheitsrelevanter Vorgänge. Rechtsgrundlagen sind je nach Verhältnis Art. 6 Abs. 1 Buchst. b, c oder f DSGVO. Administrator:innen der nutzenden Organisation können Konten und Rollen verwalten.',
    ],
  },
  {
    number: '12',
    title: 'Mandanten-, Klienten- und Fallakten',
    paragraphs: [
      'Die Plattform ordnet Fachdaten einem Mandanten und – soweit erforderlich – einer Klienten-, Personal-, Einsatz- oder sonstigen Akte zu. Verarbeitet werden können Stammdaten, Adressen, Kontakte, Kostenträger, Versicherungen, Verträge, Einwilligungen, Vollmachten, Dokumente, Verlaufsinformationen, Aufgaben und Kommunikationshistorien.',
      'Zweck und Rechtsgrundlage werden durch den verantwortlichen Mandanten bestimmt. CareSuite verarbeitet die Inhalte nach dessen dokumentierten Weisungen. Daten verschiedener Mandanten sollen logisch getrennt und durch rollenbasierte Zugriffe geschützt werden.',
    ],
  },
  {
    number: '13',
    title: 'Pflege-, Assistenz- und Leistungsdokumentation',
    paragraphs: [
      'Je nach freigeschaltetem Modul können SIS, Assessments, Maßnahmen, Pflegepläne, Berichte, Übergaben, Risiken, Diagnosen, Verordnungen, Medikamenteninformationen, Vitalwerte, Wunden, Visiten, Evaluationen, Qualitätsnachweise, Einsatzleistungen und Abrechnungsgrundlagen verarbeitet werden.',
      'Diese Daten dienen der Planung, Durchführung, Dokumentation, Qualitätssicherung, Nachweisführung und Abrechnung der verantwortlichen Organisation. Die Plattform ersetzt keine fachliche Prüfung. Einträge, Warnungen, Vorschläge und automatisch aufbereitete Übersichten sind vor gesundheits- oder leistungsrelevanten Entscheidungen durch qualifizierte Personen zu kontrollieren.',
    ],
  },
  {
    number: '14',
    title: 'Personalakten, Dienstplanung und Arbeitsorganisation',
    paragraphs: [
      'Für Personal- und Einsatzverwaltung können Kontaktdaten, Beschäftigungsstatus, Qualifikationen, Nachweise, Verfügbarkeiten, Arbeitszeiten, Schichten, Abwesenheiten, Urlaube, Einsatzzuordnungen, Fahrzeug- oder Inventarzuordnungen sowie dokumentierte Arbeitsleistungen verarbeitet werden.',
      'Verantwortlicher ist regelmäßig der jeweilige Arbeitgeber oder Auftraggeber. Er muss insbesondere Beschäftigtendatenschutz, Erforderlichkeit, Aufbewahrung, Zugriffsrechte, Transparenz, Mitbestimmungsrechte und die Freiwilligkeit etwaiger Einwilligungen beachten. Leistungs- oder Verhaltenskontrollen dürfen nicht allein aufgrund technischer Verfügbarkeit eingerichtet werden.',
    ],
  },
  {
    number: '15',
    title: 'Touren, Einsätze und Standortdaten',
    paragraphs: [
      'Wenn Touren-, Karten- oder Live-Status-Funktionen aktiviert und am Endgerät freigegeben werden, können Start- und Zielorte, Einsatzadressen, geplante und tatsächliche Zeiten, Positionsdaten, Genauigkeit, Zeitstempel, Route und Status verarbeitet werden. Standortdaten können Rückschlüsse auf Beschäftigte und Klient:innen zulassen.',
      'Die Verarbeitung soll auf den dienstlichen Einsatzkontext und die erforderliche Dauer begrenzt werden. Der Mandant muss vor Aktivierung Rechtsgrundlage, Erforderlichkeit, Information, Zugriffsberechtigung, Löschfrist und gegebenenfalls Mitbestimmung klären. Eine Einwilligung im Beschäftigungsverhältnis ist nur geeignet, wenn sie tatsächlich freiwillig ist. Endgeräteberechtigungen können in den Systemeinstellungen verwaltet werden; deren Entzug kann Standortfunktionen verhindern.',
      'Bei Nutzung von Google Maps oder Routenfunktionen können Suchanfragen, Adressen, Koordinaten, IP-Adresse und Geräteinformationen an Google übermittelt werden. Die Kartenkomponente soll erst bei Aufruf der entsprechenden Funktion geladen werden.',
    ],
  },
  {
    number: '16',
    title: 'Kommunikation, Dateien, Fotos, Kamera und Signaturen',
    paragraphs: [
      'Die Plattform kann Nachrichten, Anhänge, PDFs, Formulare, Fotos, Scans, Audioinhalte und elektronische Nachweise verarbeiten. Kamera, Mikrofon, Foto- oder Dateizugriff erfolgen nur, wenn eine entsprechende Funktion genutzt und die Geräteberechtigung erteilt wird.',
      'Vor dem Hochladen muss die nutzende Person prüfen, ob das Material für den festgelegten Zweck erforderlich ist und Rechte Dritter berücksichtigt werden. Aufnahmen in privaten Räumen, von Ausweisdokumenten, Wunden oder anderen sensiblen Situationen erfordern besondere Sorgfalt. Elektronische Signaturen dokumentieren eine Erklärung oder Bestätigung; ihre konkrete rechtliche Wirkung hängt vom zugrunde liegenden Verfahren ab.',
    ],
  },
  {
    number: '17',
    title: 'Abrechnung, Verträge und Zahlungsinformationen',
    paragraphs: [
      'Für Angebot, Vertrag, Rechnungsstellung, Zahlungszuordnung, Buchhaltung, Leistungsabrechnung und Forderungsmanagement können Stamm-, Vertrags-, Leistungs-, Rechnungs-, Bank-, Steuer- und Zahlungsstatusdaten verarbeitet werden. Vollständige Kartendaten sollen – falls eine externe Zahlungsfunktion angeboten wird – unmittelbar vom jeweiligen Zahlungsdienst verarbeitet werden.',
      'Rechtsgrundlagen sind Art. 6 Abs. 1 Buchst. b und c DSGVO sowie Art. 6 Abs. 1 Buchst. f DSGVO für geordnete Geschäftsprozesse und Rechtsverteidigung. Fachliche Abrechnungsdaten innerhalb eines Mandanten werden regelmäßig in dessen Auftrag verarbeitet.',
    ],
  },
  {
    number: '18',
    title: 'Kontakt, Support und Fehleranalyse',
    paragraphs: [
      'Bei Kontakt oder Supportanfragen verarbeiten wir Kontaktdaten, Organisation, Inhalt der Anfrage, Anhänge, technische Diagnoseinformationen, Bearbeitungsverlauf und Ergebnis. Zweck ist die Beantwortung, Fehlerbehebung, Vertragserfüllung, Qualitätsverbesserung und Nachweisführung.',
      'Rechtsgrundlagen sind Art. 6 Abs. 1 Buchst. b oder f DSGVO. Soweit Support Zugriff auf Mandantendaten benötigt, erfolgt dies nur im erforderlichen Umfang und auf dokumentierter Grundlage. Sensible Inhalte sollten über den vereinbarten sicheren Supportkanal und nicht ungeschützt per E-Mail übermittelt werden.',
    ],
  },
  {
    number: '19',
    title: 'Supabase als Plattform- und Datenbankdienst',
    paragraphs: [
      'CareSuite HealthOS nutzt Supabase insbesondere für Authentifizierung, PostgreSQL-Datenbank, Dateispeicher, Echtzeitfunktionen und serverseitige Edge Functions. Die Produktionsumgebung wird nach der vorgesehenen Konfiguration in einer EU-Region betrieben. Gleichwohl können Support-, Sicherheits-, Telemetrie- oder Unterauftragnehmerprozesse internationale Bezüge haben.',
      'Supabase wird – abhängig vom Verarbeitungskontext – auf Grundlage eines Vertrags zur Auftragsverarbeitung und geeigneter Übermittlungsmechanismen eingebunden. Welche Daten verarbeitet werden, richtet sich nach der genutzten Funktion. Dazu können Konto-, Mandanten-, Fach-, Datei-, Sitzungs-, Protokoll- und technische Metadaten gehören.',
    ],
  },
  {
    number: '20',
    title: 'Vercel für Webhosting und Auslieferung',
    paragraphs: [
      'Für Bereitstellung, Skalierung, Auslieferung und Schutz der Webanwendung kann Vercel eingesetzt werden. Dabei werden insbesondere Verbindungs-, Anfrage-, Fehler-, Sicherheits- und Geräteinformationen verarbeitet. Globale Edge-Infrastruktur kann Daten an dem technisch geeigneten Standort verarbeiten.',
      'Rechtsgrundlage für unsere eigene Website ist Art. 6 Abs. 1 Buchst. f DSGVO. Bei mandantenbezogener Auslieferung kann Vercel als Unterauftragsverarbeiter eingebunden sein. Vertrags-, Sicherheits- und Drittlandanforderungen werden im Rahmen der Anbietersteuerung berücksichtigt.',
    ],
  },
  {
    number: '21',
    title: 'Google Maps und Google-Dienste',
    paragraphs: [
      'Google Maps wird nur für Karten-, Adress-, Geocodierungs- oder Routenfunktionen verwendet. Beim Laden können Google insbesondere IP-Adresse, Browser- und Geräteinformationen, Referrer, Suchanfrage, Adresse oder Koordinaten erhalten. Google kann bestimmte Daten für eigene Zwecke nach seinen Bedingungen verarbeiten.',
      'Optional kann eine Organisation Google Workspace verbinden. Nach einem OAuth-Verfahren können – abhängig von den ausdrücklich freigegebenen Berechtigungen – Daten aus Gmail, Kalender, Meet, Drive, Docs, Sheets, Slides, Tasks, Contacts oder Chat gelesen, erstellt oder synchronisiert werden. Zugriffstoken werden serverseitig geschützt verarbeitet; die Verbindung kann über die vorgesehenen Kontoeinstellungen getrennt werden.',
      'Die nutzende Organisation muss Umfang, Zweck und erforderliche Berechtigungen vor Freigabe prüfen. Daten werden nicht allein deshalb an Google übermittelt, weil ein Modulname angezeigt wird, sondern erst bei tatsächlicher Aktivierung oder Nutzung der Integration.',
    ],
  },
  {
    number: '22',
    title: 'Zoom und Videokommunikation',
    paragraphs: [
      'Wenn Zoom verbunden wird, können Kontokennung, Anzeigename, E-Mail-Adresse, Meeting-ID, Thema, Teilnehmerinformationen, Zeitangaben, Einladungen, Chat- oder Verbindungsdaten verarbeitet werden. Audio, Video, Transkripte oder Aufzeichnungen werden nur im Rahmen der aktivierten Funktionen und erforderlichen Freigaben verarbeitet.',
      'Besprechungen mit Pflege- oder Gesundheitsbezug sind besonders zu schützen. Der verantwortliche Mandant muss Teilnehmer:innen informieren, geeignete Meeting- und Aufzeichnungseinstellungen wählen und vor Aufzeichnungen eine tragfähige Rechtsgrundlage sicherstellen. Zoom verarbeitet Daten nach seinen eigenen Datenschutz- und Vertragsbedingungen und kann Unterauftragsverarbeiter einsetzen.',
    ],
  },
  {
    number: '23',
    title: 'KI-, Sprach- und Dokumentenanalysefunktionen',
    paragraphs: [
      'Optionale KI-Funktionen können Texte zusammenfassen, Eingaben strukturieren, Entwürfe erzeugen, Sprachinteraktion ermöglichen oder Dokumente auslesen. Hierfür können Eingabe, ausgewählter Seiten- oder Modulkontext, Mandanten- und Sitzungskennung, Prompt, Antwort, Feedback, technische Metadaten und – bei Sprachfunktionen – Audiodaten oder Transkripte verarbeitet werden.',
      'Für Text- und Sprachmodelle kann OpenAI über abgesicherte serverseitige Funktionen eingesetzt werden. Für OCR kann optional Azure Document Intelligence oder ein vergleichbarer konfigurierter Dienst verwendet werden. Anbieterseitige Sicherheits- und Missbrauchsprotokolle sowie vertraglich bestimmte Speicherfristen können gelten. API-Daten werden nach den veröffentlichten OpenAI-API-Regeln nicht zum Modelltraining verwendet, sofern keine ausdrückliche Freigabe zur Datenweitergabe erfolgt; konkrete Einstellungen und Vertragsbedingungen bleiben maßgeblich.',
      'KI-Ausgaben können falsch, unvollständig oder missverständlich sein. Sie sind Arbeitshilfen, keine Diagnose, Therapieentscheidung, Rechtsberatung oder automatische Freigabe. Besonders sensible Inhalte dürfen nur über eine vom Verantwortlichen freigegebene KI-Funktion und im erforderlichen Umfang verarbeitet werden. Ergebnisse müssen vor Verwendung fachlich geprüft werden.',
    ],
  },
  {
    number: '24',
    title: 'Weitere optionale Integrationen',
    paragraphs: [
      'Je nach Vertrag und Konfiguration können weitere Dienste, etwa Kommunikationsanbieter, Microsoft/Azure-Dienste, DATEV, Lexoffice, Export- oder Abrechnungssysteme eingebunden werden. Eine bloße technische Vorbereitung bedeutet nicht, dass Daten an diese Anbieter fließen.',
      'Vor Aktivierung werden Zweck, Datenumfang, Rollenverteilung, Vertrag, Berechtigungen, Drittlandbezug und Informationspflichten geprüft. Der Mandant entscheidet, welche Integration er nutzt, und erhält – soweit erforderlich – ergänzende Hinweise im Verbindungs- oder Einrichtungsprozess.',
    ],
  },
  {
    number: '25',
    title: 'Mobile App und Geräteberechtigungen',
    bullets: [
      'Internetzugriff: für Anmeldung, Synchronisierung, Dateiübertragung, Kommunikation und Abruf freigegebener Inhalte.',
      'Standort: nur für aktivierte Karten-, Touren-, Einsatz- oder Live-Status-Funktionen und nach Gerätefreigabe.',
      'Kamera/Fotos/Dateien: für Scans, Dokumentation, Nachweise, Profil- oder Fallanhänge nach Nutzeraktion.',
      'Mikrofon: für ausdrücklich gestartete Sprach- oder Kommunikationsfunktionen.',
      'Benachrichtigungen: für relevante Aufgaben, Termine, Nachrichten oder Sicherheitsinformationen, soweit freigegeben.',
    ],
    notice: 'Berechtigungen können in den Geräteeinstellungen entzogen werden. Einzelne Funktionen stehen dann nicht oder nur eingeschränkt zur Verfügung. Die App fordert Berechtigungen kontextbezogen an; der Mandant bleibt für die rechtmäßige fachliche Nutzung verantwortlich.',
  },
  {
    number: '26',
    title: 'App-Stores und Installation',
    paragraphs: [
      'Beim Bezug der App über Google Play oder einen anderen App-Store verarbeitet der jeweilige Store eigene Konto-, Geräte-, Download-, Zahlungs-, Lizenz- und Nutzungsinformationen. Auf diese eigenständige Verarbeitung des Store-Betreibers haben wir nur begrenzten Einfluss.',
      'Wir erhalten gegebenenfalls aggregierte Installations-, Versions-, Stabilitäts- und Bewertungsinformationen. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO für Bereitstellung, Kompatibilität, Sicherheit und Verbesserung der App. Es gelten ergänzend die Datenschutzhinweise des jeweiligen Store-Betreibers.',
    ],
  },
  {
    number: '27',
    title: 'Empfänger und Kategorien von Empfängern',
    bullets: [
      'Berechtigte Nutzer:innen, Administrator:innen und Fachkräfte innerhalb des zuständigen Mandanten.',
      'CareSuite-Mitarbeitende oder beauftragte Personen, soweit Zugriff für Betrieb, Support, Sicherheit oder Vertragserfüllung erforderlich und zulässig ist.',
      'Auftrags- und Unterauftragsverarbeiter für Hosting, Datenbank, Speicherung, Kommunikation, KI, Karten, Videokonferenzen, Support und technische Dienste.',
      'Vom Mandanten oder der betroffenen Person aktiv verbundene externe Systeme und deren Betreiber.',
      'Berater, Versicherer, Gerichte, Behörden oder sonstige Stellen, soweit dies gesetzlich vorgeschrieben, zur Rechtsverteidigung erforderlich oder wirksam angeordnet ist.',
      'Empfänger im Rahmen einer Unternehmensübertragung nur nach rechtlicher Prüfung, Vertraulichkeitsschutz und erforderlicher Information.',
    ],
  },
  {
    number: '28',
    title: 'Drittlandübermittlungen',
    paragraphs: [
      'Einige Anbieter oder Unterauftragnehmer haben Sitz oder Infrastruktur außerhalb des Europäischen Wirtschaftsraums, insbesondere in den USA oder anderen Drittländern. Dadurch kann ein von der EU abweichendes Datenschutzniveau bestehen und ein behördlicher Zugriff nach ausländischem Recht nicht vollständig ausgeschlossen werden.',
      'Soweit kein Angemessenheitsbeschluss nach Art. 45 DSGVO greift, stützen wir Übermittlungen insbesondere auf Standardvertragsklauseln nach Art. 46 DSGVO und ergänzende Schutzmaßnahmen. Soweit anwendbar, kann eine gültige Zertifizierung nach dem EU-US Data Privacy Framework berücksichtigt werden. Wir prüfen Anbieter, Verträge, technische Maßnahmen und die Erforderlichkeit der Übermittlung risikoorientiert.',
    ],
  },
  {
    number: '29',
    title: 'Speicherdauer, Löschung und Sicherungskopien',
    paragraphs: [
      'Wir speichern Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist oder gesetzliche Aufbewahrungs-, Nachweis- oder Verjährungsfristen bestehen. Es gibt keine einheitliche Frist für sämtliche Plattformdaten.',
      'Konto- und Vertragsdaten werden grundsätzlich für die Vertragsdauer und anschließend nach den anwendbaren handels-, steuer- und zivilrechtlichen Fristen gespeichert. Support- und Sicherheitsdaten werden nach Erledigung beziehungsweise Ablauf der festgelegten Sicherheitsfrist gelöscht oder anonymisiert. Der Mandant legt die fachlichen Aufbewahrungs- und Löschregeln für Pflege-, Klienten-, Personal- und Leistungsdaten entsprechend seinen gesetzlichen Pflichten fest.',
      'Nach Löschauftrag werden Daten aus aktiven Systemen nach dem vorgesehenen Verfahren entfernt oder anonymisiert. In rotierenden, zugriffsbeschränkten Sicherungskopien können sie bis zum Überschreiben beziehungsweise Ablauf des Backup-Zyklus fortbestehen und werden dort grundsätzlich nur für Wiederherstellungs- und Sicherheitszwecke verwendet. Gesetzliche Sperr- oder Aufbewahrungspflichten gehen einer Löschung vor.',
    ],
  },
  {
    number: '30',
    title: 'Technische und organisatorische Schutzmaßnahmen',
    bullets: [
      'Mandantenbezogene Datenzuordnung und rollenbasierte Zugriffskontrollen nach dem Prinzip der geringsten erforderlichen Berechtigung.',
      'Transportverschlüsselung, sichere Authentifizierung, Sitzungsverwaltung und Schutz von Zugangsdaten und serverseitigen Geheimnissen.',
      'Datenbankseitige Zugriffsbeschränkungen, Protokollierung sicherheits- und verwaltungsrelevanter Vorgänge sowie geregelte Supportzugriffe.',
      'Datensicherungen, Wiederherstellungsverfahren, Schwachstellen- und Aktualisierungsprozesse sowie Maßnahmen gegen Missbrauch und unbefugten Zugriff.',
      'Vertragliche Vertraulichkeits-, Auftragsverarbeitungs- und Unterauftragnehmerregelungen sowie risikoorientierte Anbieterprüfung.',
    ],
    notice: 'Kein technisches System kann absolute Sicherheit garantieren. Nutzer:innen müssen Zugangsdaten schützen, Mehrpersonen- oder Gerätefreigaben vermeiden, Rollen korrekt vergeben und Sicherheitsvorfälle unverzüglich melden.',
  },
  {
    number: '31',
    title: 'Minderjährige und besonders schutzbedürftige Personen',
    paragraphs: [
      'CareSuite HealthOS ist kein frei zugängliches Verbraucherangebot für Kinder. Dennoch können Minderjährige oder besonders schutzbedürftige Personen Gegenstand einer rechtmäßigen Pflege-, Assistenz- oder Betreuungsdokumentation sein. In diesem Fall muss der verantwortliche Mandant Vertretungsbefugnisse, Informationspflichten, Einwilligungsfähigkeit und besondere Schutzinteressen beachten.',
      'Konten für Minderjährige werden nur im Rahmen eines geeigneten Organisations- und Berechtigungskonzepts bereitgestellt. Öffentliches Profiling oder kindgerichtete Werbung findet durch CareSuite HealthOS nicht statt.',
    ],
  },
  {
    number: '32',
    title: 'Automatisierte Entscheidungen und Profiling',
    paragraphs: [
      'CareSuite HealthOS trifft nach dem vorgesehenen Plattformbetrieb keine ausschließlich automatisierte Entscheidung nach Art. 22 DSGVO, die gegenüber einer betroffenen Person rechtliche Wirkung entfaltet oder sie ähnlich erheblich beeinträchtigt. Priorisierungen, Warnhinweise, Qualitätskennzahlen oder KI-Vorschläge dienen der Unterstützung und müssen von einer berechtigten Person bewertet werden.',
      'Sollte ein Mandant eigene automatisierte Entscheidungsverfahren konfigurieren oder externe Systeme anbinden, muss er Zulässigkeit, Transparenz, menschliche Eingriffsmöglichkeit, Anfechtbarkeit und gegebenenfalls eine Datenschutz-Folgenabschätzung gesondert sicherstellen.',
    ],
  },
  {
    number: '33',
    title: 'Datenquellen und Informationspflichten',
    paragraphs: [
      'Daten stammen von den betroffenen Personen selbst, von Administrator:innen und Fachkräften des Mandanten, von gesetzlichen Vertreter:innen, Angehörigen, Kostenträgern, Kooperationspartnern, verbundenen Systemen, Endgeräten oder – soweit zulässig – öffentlich zugänglichen Quellen.',
      'Erheben wir Daten nicht unmittelbar bei Ihnen, muss der jeweils Verantwortliche die Informationspflichten nach Art. 14 DSGVO erfüllen, sofern keine gesetzliche Ausnahme greift. CareSuite unterstützt seine Mandanten technisch und vertraglich, ersetzt deren individuelle Information jedoch nicht.',
    ],
  },
  {
    number: '34',
    title: 'Ihre Datenschutzrechte',
    bullets: [
      'Auskunft nach Art. 15 DSGVO einschließlich einer Kopie der verarbeiteten personenbezogenen Daten.',
      'Berichtigung unrichtiger und Vervollständigung unvollständiger Daten nach Art. 16 DSGVO.',
      'Löschung nach Art. 17 DSGVO, soweit keine vorrangige Rechtsgrundlage oder Aufbewahrungspflicht besteht.',
      'Einschränkung der Verarbeitung nach Art. 18 DSGVO.',
      'Datenübertragbarkeit nach Art. 20 DSGVO, soweit die gesetzlichen Voraussetzungen erfüllt sind.',
      'Widerspruch nach Art. 21 DSGVO gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 Buchst. e oder f DSGVO aus Gründen Ihrer besonderen Situation.',
      'Widerruf einer Einwilligung nach Art. 7 Abs. 3 DSGVO mit Wirkung für die Zukunft.',
      'Beschwerde bei einer Datenschutzaufsichtsbehörde nach Art. 77 DSGVO.',
    ],
    notice: 'Zur Vermeidung einer unbefugten Offenlegung können wir einen angemessenen Identitätsnachweis verlangen. Anträge sind grundsätzlich unentgeltlich und werden innerhalb der gesetzlichen Fristen bearbeitet. Bei Mandantendaten leiten wir Anfragen erforderlichenfalls an den zuständigen Verantwortlichen weiter.',
  },
  {
    number: '35',
    title: 'Besonderer Hinweis zum Widerspruchsrecht',
    paragraphs: [
      'Soweit wir personenbezogene Daten auf Grundlage von Art. 6 Abs. 1 Buchst. f DSGVO verarbeiten, können Sie aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit Widerspruch einlegen. Wir verarbeiten die betreffenden Daten dann nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe nachweisen, die Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.',
      'Direktwerbung findet derzeit nicht als eigener Plattformzweck statt. Sollte sie künftig erfolgen, können Sie ihr jederzeit ohne Begründung widersprechen.',
    ],
  },
  {
    number: '36',
    title: 'Beschwerderecht und zuständige Aufsicht',
    paragraphs: [
      'Sie können sich bei jeder nach Art. 55 DSGVO zuständigen Aufsichtsbehörde beschweren. Für unseren Unternehmenssitz ist grundsätzlich die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW) zuständig.',
      'LDI NRW, Postfach 20 04 44, 40102 Düsseldorf, Deutschland. Internet: https://www.ldi.nrw.de. Das offizielle Online-Beschwerdeformular und aktuelle Kontaktangaben finden Sie auf der Website der Behörde.',
      'Wir begrüßen die Möglichkeit, ein Anliegen zuvor direkt zu klären; dies ist jedoch keine Voraussetzung für eine Beschwerde.',
    ],
  },
  {
    number: '37',
    title: 'Pflicht zur Bereitstellung von Daten',
    paragraphs: [
      'Die Bereitstellung bestimmter Konto-, Vertrags- und Sicherheitsdaten ist für Vertragsschluss und Nutzung geschützter Funktionen erforderlich. Ohne diese Daten können wir den betreffenden Dienst nicht oder nicht sicher bereitstellen.',
      'Welche fachlichen Angaben innerhalb eines Mandanten gesetzlich oder vertraglich erforderlich sind, entscheidet der zuständige Verantwortliche. Optionale Angaben und Einwilligungen werden als solche kenntlich gemacht, soweit dies im jeweiligen Kontext erforderlich ist.',
    ],
  },
  {
    number: '38',
    title: 'Datenschutzverletzungen und Sicherheitsmeldungen',
    paragraphs: [
      `Verdächtige Zugriffe, verlorene Geräte, versehentliche Offenlegungen oder andere Sicherheitsvorfälle sollten unverzüglich an ${CONTROLLER.email} und an die zuständige Organisation gemeldet werden. Bitte übermitteln Sie dabei nur die zur Ersteinschätzung erforderlichen Informationen.`,
      'Wir untersuchen Vorfälle, sichern Beweise, begrenzen Auswirkungen und unterstützen Verantwortliche bei der Prüfung von Melde- und Benachrichtigungspflichten nach Art. 33 und 34 DSGVO. Die Entscheidung über eine Meldung für Mandantendaten trifft der jeweilige Verantwortliche.',
    ],
  },
  {
    number: '39',
    title: 'Externe Links und fremde Angebote',
    paragraphs: [
      'Die Plattform kann Links zu externen Websites oder Diensten enthalten. Erst beim Aufruf gelten die Datenschutzregeln des jeweiligen Anbieters. Wir haben keinen vollständigen Einfluss auf dessen Verarbeitung und machen uns fremde Inhalte nicht allein durch Verlinkung zu eigen.',
    ],
  },
  {
    number: '40',
    title: 'Änderungen und maßgebliche Fassung',
    paragraphs: [
      'Wir aktualisieren diese Datenschutzerklärung, wenn sich Funktionen, Anbieter, Rechtslage oder Verarbeitungen wesentlich ändern. Die aktuelle Fassung wird unter https://www.caresuiteplus.app/datenschutz veröffentlicht. Bei wesentlichen Änderungen informieren wir registrierte Vertragspartner oder Nutzer:innen zusätzlich in geeigneter Form.',
      'Frühere Fassungen können aus Nachweisgründen archiviert werden. Maßgeblich ist die bei der jeweiligen Nutzung veröffentlichte Fassung, soweit nicht zwingendes Recht etwas anderes bestimmt.',
    ],
  },
];

const providerLinks = [
  ['DSGVO (EUR-Lex)', 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679'],
  ['LDI Nordrhein-Westfalen', 'https://www.ldi.nrw.de'],
  ['Supabase Datenschutz', 'https://supabase.com/privacy'],
  ['Supabase Auftragsverarbeitung', 'https://supabase.com/legal/customer-resources/data-processing-addendum'],
  ['Vercel Datenschutz', 'https://vercel.com/legal/privacy-notice'],
  ['Vercel Auftragsverarbeitung', 'https://vercel.com/legal/dpa'],
  ['OpenAI Datenschutz', 'https://openai.com/policies/privacy-policy/'],
  ['OpenAI API-Datenkontrollen', 'https://platform.openai.com/docs/models/default-usage-policies-by-endpoint'],
  ['Google Datenschutz', 'https://policies.google.com/privacy?hl=de'],
  ['Zoom Datenschutz', 'https://www.zoom.com/en/trust/privacy/privacy-statement/'],
] as const;

function openUrl(url: string) {
  void Linking.openURL(url);
}

function PolicyCard({ section }: { section: PolicySection }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.numberBadge}><Text style={styles.numberText}>{section.number}</Text></View>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
      </View>
      {section.paragraphs?.map((paragraph, index) => (
        <Text key={`${section.number}-p-${index}`} style={styles.paragraph}>{paragraph}</Text>
      ))}
      {section.bullets?.map((bullet, index) => (
        <View key={`${section.number}-b-${index}`} style={styles.bulletRow}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={styles.bulletText}>{bullet}</Text>
        </View>
      ))}
      {section.notice ? (
        <View style={styles.notice}><Text style={styles.noticeText}>{section.notice}</Text></View>
      ) : null}
    </View>
  );
}

export function CareSuitePrivacyPolicyScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 760;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Datenschutzerklärung | CareSuite HealthOS';
      const description = 'Datenschutzerklärung für CareSuite HealthOS Website, Web-App, mobile App und Portale.';
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
  }, []);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.brandButton}>
            <Text style={styles.brandCare}>CareSuite</Text><Text style={styles.brandHealth}> HealthOS</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.homeButton}>
            <Text style={styles.homeButtonText}>Zur Startseite</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CARESUITE HEALTHOS · RECHTLICHE INFORMATIONEN</Text>
          <Text accessibilityRole="header" style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Datenschutz{compact ? '\n' : ''}erklärung</Text>
          <Text style={styles.heroText}>Für Website, Web-App, mobile Anwendungen und verbundene Portale</Text>
          <View style={[styles.metaRow, compact && styles.metaRowCompact]}>
            <View style={styles.metaPill}><Text style={styles.metaText}>Stand: 13. August 2026</Text></View>
            <View style={styles.metaPill}><Text style={styles.metaText}>Version 1.0</Text></View>
            <View style={styles.metaPill}><Text style={styles.metaText}>DSGVO · BDSG · TDDDG</Text></View>
          </View>
        </View>

        <View style={[styles.content, compact && styles.contentCompact]}>
          <View style={[styles.summaryGrid, compact && styles.summaryGridCompact]}>
            <View style={[styles.summaryCard, compact && styles.summaryCardCompact]}>
              <Text style={styles.summaryLabel}>VERANTWORTLICHER</Text>
              <Text style={styles.summaryTitle}>{CONTROLLER.name}</Text>
              <Text style={styles.summaryText}>Einzelunternehmen · Inhaber {CONTROLLER.owner}</Text>
              <Text style={styles.summaryText}>{CONTROLLER.address}</Text>
            </View>
            <View style={[styles.summaryCard, compact && styles.summaryCardCompact]}>
              <Text style={styles.summaryLabel}>DATENSCHUTZKONTAKT</Text>
              <Pressable onPress={() => openUrl(`mailto:${CONTROLLER.email}`)}>
                <Text style={styles.linkText}>{CONTROLLER.email}</Text>
              </Pressable>
              <Text style={styles.summaryText}>Derzeit ist kein Datenschutzbeauftragter bestellt.</Text>
            </View>
          </View>

          <View style={styles.roleNotice}>
            <Text style={styles.roleTitle}>Wichtig zur Verantwortlichkeit</Text>
            <Text style={styles.roleText}>Für fachliche Klienten-, Pflege-, Assistenz- und Personaldaten ist regelmäßig Ihre Pflege-, Assistenz- oder sonstige nutzende Organisation verantwortlich. CareSuite verarbeitet diese Daten grundsätzlich als Auftragsverarbeiter. Für Plattformvertrag, Support, Sicherheit und eigenen Websitebetrieb ist CareSuite selbst verantwortlich.</Text>
          </View>

          {sections.map((section) => <PolicyCard key={section.number} section={section} />)}

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.numberBadge}><Text style={styles.numberText}>41</Text></View>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Weiterführende Informationen</Text>
            </View>
            <Text style={styles.paragraph}>Die nachfolgenden Links führen zu offiziellen Rechts- oder Anbieterinformationen. Für deren Inhalte und Aktualität sind die jeweiligen Stellen verantwortlich.</Text>
            <View style={styles.linkGrid}>
              {providerLinks.map(([label, url]) => (
                <Pressable key={url} accessibilityRole="link" onPress={() => openUrl(url)} style={styles.linkButton}>
                  <Text style={styles.linkButtonText}>{label} ↗</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>CareSuite HealthOS</Text>
            <Text style={styles.footerText}>Datenschutzkontakt: {CONTROLLER.email}</Text>
            <Text style={styles.footerText}>© 2026 {CONTROLLER.name}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F3F7FD' },
  scrollContent: { minHeight: '100%' },
  topBar: { minHeight: 78, paddingHorizontal: 24, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#DCE7F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandButton: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  brandCare: { color: '#0A1428', fontWeight: '900', fontSize: 23 },
  brandHealth: { color: '#087EEB', fontWeight: '800', fontSize: 23 },
  homeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#A9C7F9', backgroundColor: '#F8FBFF' },
  homeButtonText: { color: '#13345F', fontWeight: '800', fontSize: 15 },
  hero: { backgroundColor: '#0E55CB', paddingHorizontal: 24, paddingTop: 64, paddingBottom: 66, alignItems: 'center' },
  eyebrow: { color: '#CDE1FF', fontSize: 13, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 52, lineHeight: 60, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  heroTitleCompact: { fontSize: 40, lineHeight: 43 },
  heroText: { color: '#EAF3FF', fontSize: 19, lineHeight: 28, marginTop: 12, textAlign: 'center', maxWidth: 760 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 26 },
  metaRowCompact: { flexDirection: 'column', alignItems: 'center' },
  metaPill: { backgroundColor: '#FFFFFF18', borderWidth: 1, borderColor: '#FFFFFF55', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  metaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 54 },
  contentCompact: { paddingHorizontal: 14 },
  summaryGrid: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  summaryGridCompact: { flexDirection: 'column' },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#C9DCF9', padding: 22 },
  summaryCardCompact: { width: '100%' },
  summaryLabel: { color: '#1767D9', fontSize: 12, letterSpacing: 1, fontWeight: '900', marginBottom: 9 },
  summaryTitle: { color: '#0A1428', fontSize: 20, lineHeight: 27, fontWeight: '900', marginBottom: 8 },
  summaryText: { color: '#42536D', fontSize: 15, lineHeight: 23, marginTop: 3 },
  linkText: { color: '#096EE8', fontSize: 16, lineHeight: 24, fontWeight: '800', textDecorationLine: 'underline', marginBottom: 8 },
  roleNotice: { backgroundColor: '#EAF4FF', borderLeftWidth: 5, borderLeftColor: '#0B76F1', borderRadius: 16, padding: 20, marginBottom: 16 },
  roleTitle: { color: '#0B3973', fontSize: 17, fontWeight: '900', marginBottom: 7 },
  roleText: { color: '#244667', fontSize: 15, lineHeight: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#D3E1F4', padding: 22, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  numberBadge: { minWidth: 36, height: 36, borderRadius: 18, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5F0FF', borderWidth: 1, borderColor: '#B8D1FA', marginRight: 12 },
  numberText: { color: '#0D64D7', fontSize: 14, fontWeight: '900' },
  sectionTitle: { flex: 1, color: '#0A1428', fontSize: 21, lineHeight: 28, fontWeight: '900', paddingTop: 3 },
  paragraph: { color: '#263750', fontSize: 15, lineHeight: 25, marginBottom: 11 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9, paddingRight: 4 },
  bulletMark: { color: '#0A71E8', fontSize: 22, lineHeight: 24, fontWeight: '900', width: 20 },
  bulletText: { flex: 1, color: '#263750', fontSize: 15, lineHeight: 24 },
  notice: { marginTop: 8, backgroundColor: '#FFF8E8', borderRadius: 12, borderWidth: 1, borderColor: '#F0D28B', padding: 14 },
  noticeText: { color: '#674B0E', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  linkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  linkButton: { borderRadius: 12, borderWidth: 1, borderColor: '#A8C8FA', backgroundColor: '#F6FAFF', paddingHorizontal: 14, paddingVertical: 11 },
  linkButtonText: { color: '#095FCB', fontSize: 14, fontWeight: '800' },
  footer: { alignItems: 'center', paddingTop: 24, paddingBottom: 16 },
  footerBrand: { color: '#0A1428', fontSize: 19, fontWeight: '900', marginBottom: 7 },
  footerText: { color: '#63738B', fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
