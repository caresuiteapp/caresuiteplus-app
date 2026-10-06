# Kostenlose CareSuite-Nutzung

Die aktuelle Produktvorgabe lautet: CareSuite HealthOS ist vollständig kostenlos.
Es gibt keine Tarife, buchbaren Zusatzpakete oder Plattformrechnungen. Eine
Premium-Version ist für später vorgesehen und derzeit nicht verfügbar; Preise
oder ein Einführungstermin sind nicht festgelegt.

## Verhalten der Web-Verwaltung

- Navigation, Übersicht und Mandantenakten enthalten keine Tarif-, Vertrags-,
  Zusatzpaket-, Rabatt- oder Plattformzahlungsverwaltung mehr.
- Alte direkte Seitenaufrufe zeigen die kostenlose Nutzung. Sie laden keine
  kommerziellen Katalogdaten und bieten keine Buchungs- oder Zuweisungsaktion.
- Funktionsbereiche und Freigaben, Anmeldung, E-Mail-Korrektur,
  Passwortwiederherstellung, Willkommensmail und genehmigter Support bleiben
  erhalten. Funktionsfreigaben steuern Zugriffe und sind keine Kaufoptionen.
- Die Suche und Mandantenauswahl zeigen verständliche deutsche Angaben zur
  kostenlosen Nutzung. Veraltete Testzeitraum- und Zahlungszieleinstellungen
  werden ausgeblendet; die kostenlose Nutzung ist kein umschaltbares Angebot.
- Die Abrechnung von Leistungen innerhalb eines Unternehmens gehört weiterhin
  zu dessen betrieblichen Abläufen und wird von dieser Korrektur nicht verändert.

## Bereits korrigierter Serverstand

Die Migration `20261006182606_platform_console_free_only.sql` wurde am
06.10.2026 produktiv angewendet und anhand der tatsächlichen Funktionsdefinitionen
und Datensätze geprüft. Die acht kommerziellen Les-/Schreibrechte sind auch für
den Plattforminhaber gesperrt. Die übrigen Rollenprüfungen und Berechtigungen
bleiben unverändert. Einstellungen für das frühere Gebührenmodell sind gesperrt.

Der in dieser Bearbeitung irrtümlich erzeugte 0-Euro-Katalogeintrag wurde gezielt
archiviert und aus dem öffentlichen Katalog genommen. Das ursprüngliche Protokoll
bleibt erhalten; eine neue Korrekturbuchung dokumentiert den Vorgang. Andere
historische Katalogeinträge und die kostenlosen Firmenregistrierungsdaten wurden
nicht verändert. Produktiv existierten bei der Nachprüfung keine Tarif- oder
Zusatzpaketzuweisungen.

Die bestehende Gmail-Versandkonfiguration, Konten und Support-Genehmigungen wurden
bei dieser Korrektur nicht geändert. Es wurden keine Testmails versandt und keine
Kundendaten für Prüfungen verändert.

## Prüfnachweise und verbleibende Lücken

`node --experimental-vm-modules --test scripts/verify-platform-free-console.test.mjs`
führt echte TypeScript-Funktionen mit ersetzten Netzwerkschnittstellen aus.
Alle zehn Fälle bestanden: Rechte einschließlich Inhaber, alte direkte Bereiche
ohne Datenabfrage oder Aktionen, Navigation, weiterhin mögliche Funktionspflege,
Freigabevalidierung, ehrliche Veröffentlichungsprüfstände und geschützte
Kostenlos-Einstellungen. `git diff --check` ist erfolgreich.

Die vorhandenen React-Interaktions- und Datenbanktests wurden an die neue Vorgabe
angepasst. Sie konnten in dieser Arbeitsumgebung mangels Projektabhängigkeiten
nicht ausgeführt werden. Eine echte Layoutprüfung der betroffenen Ansichten in
breiten und schmalen Fenstern ist ebenfalls offen, da kein ausführbarer Browser
vorhanden ist. Ein DOM-Test allein würde diese Lücke nicht schließen.

Das Veröffentlichungspaket verwendet vorhandene Projektabhängigkeiten für die
Interaktions-/Datenbanktests, sofern sie bereits vorhanden sind. Es installiert
keine Software. Vor einer Zusammenführung müssen die bestehenden vier
Vercel-Erstellungen für genau diesen Commit erfolgreich sein; danach werden der
produktive Erstellungsstand und die neue Kostenlos-Kennung an der Live-Adresse
geprüft. Das ist kein vollständiger Nachweis aller Abläufe mit echten Konten.

Die Android-App wird mit diesem Paket nicht veröffentlicht.
