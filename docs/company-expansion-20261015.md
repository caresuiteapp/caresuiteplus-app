# Unternehmen: Organisation, Ressourcen und Inventar

Arbeitsstand auf Basis von `d6d20d92f4a4c02b0753cf473d589198535bd09e` und der Inventar-Integration `93f952de466726746125279fe4bbbcf2e65244ac`. Umsetzung im bestehenden Entwurf PR #89. Keine Veröffentlichung und keine produktiven Datenbankänderungen.

## Nutzbare Bereiche

| Unternehmensbereich | Enthaltene Abläufe |
| --- | --- |
| Organisation | Gesellschaften mit Hierarchie, Standorte, Abteilungen, Leitungsverantwortung, Kontakt/Anschrift und Kostenstellen |
| Personalzuordnung | Mitarbeitende mit Gesellschaft, Standort, Abteilung, Funktion, Gültigkeitszeitraum und Hauptzuordnung verbinden |
| Franchise und Beziehungen | Holding, Tochtergesellschaft, Franchise und Kooperation mit Partner, Gebiet, Zeitraum, Beteiligung und Vertragsreferenz dokumentieren |
| Versicherungen | Mehrere Policen mit Anbieter, Nummer, Deckung, Selbstbehalt, Prämie, Laufzeit, Kündigung und verknüpften Unterlagen |
| Verträge und Fristen | Vertragsregister, Kosten, Zuständigkeit, explizite Kündigungs-/Prüftermine und Fristenübersicht |
| Fuhrpark | Zentrale Fahrzeuge, Eigentum/Leasing, HU/Wartung, Kilometerstand, Versicherungs-/Vertragsbezug, Ausgabe und Rückgabe |
| Fahrtenbuch | Bestehendes Firmenfahrzeug ausdrücklich mit zentralem Fahrzeug verbinden; Fahrzeugidentität synchronisieren, Fahrthistorie erhalten |
| Inventarzuordnung | Bestehende Inventarposten mit Gesellschaft, Standort, Abteilung und optional zentralem Fahrzeug verbinden |
| Zugriffsbereiche | Administrierte Freigabe auf echte Gesellschaften/Standorte/Abteilungen; bewusste Sperre bei leerer begrenzter Auswahl |
| Einstellungen | Vorhandene Kostenstellen live verwalten; Werte aktiver eigener Felder typgerecht bearbeiten |
| Dokumente | Kanonische Unternehmensdaten, Hauptbankkonto, Vertretung, Logo und freigegebene eigene Angaben übernehmen; vorhandenes Dokumentenarchiv verknüpfen |

Gesellschaften und Franchisebeziehungen sind Organisationsdatensätze innerhalb des angemeldeten Unternehmens. Sie schalten keine fremden Mandanten frei. Fristen werden anhand erfasster Termine angezeigt; es wurde kein automatischer E-Mail-Versand eingerichtet.

## Navigation und Gestaltung

Die bestehenden Profil-, Steuer-, Abrechnungs- und Historienansichten bleiben Teil von Unternehmen. Neue Hauptbereiche Organisation und Verträge & Ressourcen ergänzen Inventar. Die bisherigen Leistungsbereiche, Felddefinitionen und Import-/Exportlinks stehen unter Einstellungen.

Die direkten Webrouten `/unternehmen/standorte`, `/abteilungen`, `/gesellschaften`, `/franchise`, `/personalzuordnung`, `/zugriffe`, `/ressourcen`, `/versicherungen`, `/vertraege`, `/fuhrpark` und `/zuordnungen` erhalten den Unternehmenskontext, einschließlich Anmeldung und Rücknavigation. Letztere Pfade sind jeweils unter `/unternehmen` zu lesen. Alte Inventarlinks sowie das bestehende Inventarwidget bleiben erhalten.

Neue Formulare verwenden den vorhandenen dunklen Unternehmensauftritt. Listen, Details, Filter und Formulare berücksichtigen die tatsächliche Containerbreite. Leere, ladende und fehlerhafte Zustände haben konkrete Rückmeldungen. Ungespeicherte Entwürfe schützen Tab-, Dialog- und Seitenwechsel. Nach unbestätigtem Speichern oder Versionskonflikt ist ein erneutes Laden erforderlich.

## Datenintegrität und Zugriff

- Neue Organisations- und Ressourcenänderungen laufen über geprüfte Datenbankfunktionen mit Versionsvergleich, tenantgebundenen Referenzen und transaktionalem Änderungsverlauf.
- Gesellschafts-/Abteilungshierarchien vermeiden Zyklen. Archivierung erhält Historie und berücksichtigt aktive Verknüpfungen.
- Hauptzuordnungen und Fahrzeugausgaben prüfen überlappende Zeiträume. Rückgaben prüfen den Kilometerstand.
- Rollenrechte werden aus der authentifizierten Identität abgeleitet. Mandantenspezifische Rollenlisten, Vorlagen und Einzelrechte werden ausgewertet; explizite Ablehnung gewinnt.
- Bereichsbeschränkungen basieren auf administrierten IDs statt auf frei bearbeitbaren Ortsbezeichnungen. Datensatzänderungen prüfen sowohl bisherige als auch neue Zuordnungen.
- Begrenzte Zugänge erhalten gefilterte Personalauswahl. Globale Stammdaten, Kostenstellen, eigene Angaben, Inventarkataloge, Gesamt-Austrittsprüfung und globale Änderungsprotokolle bleiben ihnen verschlossen.
- Ergänzende Inventarrichtlinien begrenzen bestehende Business-Zugriffe auf zugeordnete Bestände. Portal-Zugriffe behalten ihre eigenen Regeln.
- Berechtigungsquellen können nur Rollenadministratoren verändern. Normale autorisierte Personaldatenpflege und sichere erstmalige Profilverknüpfung bleiben möglich; Identitätsänderungen dürfen keine fremden Sonderrechte übernehmen.

## Release und Prüfung

Die neue Oberfläche benötigt die mitgelieferten Datenbankmigrationen. Vor deren Anwendung zeigt sie bei fehlendem Zugriffsdienst einen verständlichen Fehler; sie fällt nicht auf Demo- oder statische Rechte zurück.

Die Migrationen sind für den aktuellen Repository-Schemastand vorbereitet. Die bestehende Staging-Datenbank lag bei der rein lesenden Kontrolle hinter diesem Stand, unter anderem bei Fahrtenbuch und Dokumentenarchiv. Sie wurde nicht verändert. Die SQL-Funktionsprüfungen verwenden den bereits installierten PostgreSQL-Kern PGlite und ausschließlich isolierte synthetische Daten.

Die Prüfungen belegen Datenverarbeitung, Rechte, Speicherung und Interaktionen. Eine echte visuelle Browserprüfung bei breiten und schmalen Fenstern sowie der End-to-End-Durchlauf mit angemeldetem Zugang auf dem migrierten Zielsystem bleiben gesondert erforderlich. Die lokale Browseransicht war in dieser Sitzung durch die Browserrichtlinie blockiert. Es wird keine visuelle Abnahme behauptet.

### Geordnete Migrationen

1. `20261015085833_company_access.sql`
2. `20261015085834_company_organization.sql`
3. `20261015085835_company_scope_access.sql`
4. `20261015085836_company_resources.sql`
5. `20261015085837_company_inventory_scope.sql`
6. `20261015085838_company_custom_values.sql`
7. `20261015085839_company_cost_centers.sql`

Die Versionsdateien wurden mit UTC-Zeitstempeln aus den geprüften SQL-Quellen erzeugt. Die Supabase-CLI ist hier nicht installiert; es wurde keine Software nachinstalliert. Die Datenbanktests lesen exakt diese Migrationsdateien.

`npm run verify:company:release` prüft die Unternehmensabläufe und die isolierten SQL-Szenarien. Diese Prüfung ist zusätzlich im bestehenden Produktionsbuild eingebunden.

### Ergebnis der lokalen Prüfung

- Produktionsbuild einschließlich vollständiger TypeScript-Prüfung, bestehendem Release-Gate, Expo-Webexport und Export-/Navigationsaudits erfolgreich.
- Neues Unternehmens-Release-Gate: 43 Testsuiten mit 465 erfolgreichen Tests; zusätzlich 25 kombinierte SQL-Sicherheitstests erfolgreich. Die 465 Tests enthalten bereits 19 weitere isolierte SQL-Transaktionsprüfungen.
- ESLint für alle 94 geänderten/neuen TypeScript-Dateien erfolgreich; `git diff --check` ohne Befund.
- Der Schemakompatibilitätsabgleich verwendet die tatsächlichen Repository-DDLs. Dabei wurden unter anderem der Personalstatus `aktiv` und die bestehende Semantik exakter Berechtigungsschlüssel berücksichtigt.
- Keine visuellen Browsernachweise, kein angemeldeter Zielsystem-Smoke-Test, keine Remote-Migration und kein Produktionsdeploy in diesem Arbeitsgang.
