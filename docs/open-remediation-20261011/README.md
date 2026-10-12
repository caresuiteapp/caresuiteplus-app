# Nachprüfung Web und App – 12.10.2026

Die Änderungen schließen reproduzierte Fehler im aktuellen Quellstand. Bodymap und Modulauswahl bleiben aus den produktiven Web- und App-Zugängen entfernt. Aktuelle PDF-Wiederherstellung, Schutz gespeicherter Originale und monatlicher Einsatzverlauf sind in der übernommenen Main-Version enthalten.

## Korrigierte Abläufe

- Aufnahmeunterlagen: Ein bereits gespeichertes signiertes Original bleibt bei veralteten Abschluss-Metadaten erhalten. Neue Signaturen, neue Finalisierungen und ein bloß behaupteter Status `signed` werden ohne verifizierten atomaren Serverabschluss abgewiesen. Optimistische Versionskontrolle bleibt erhalten.
- Dokumentanforderungen: Fehler beim Lesen von Signaturstatus, Pflichtdokumenten oder Verbindung werden als Fehler weitergegeben. Die Prüfung meldet bei einem fehlgeschlagenen Abruf keinen freien Einsatzstart.
- Verwaltung/Finanzen: Rechnungsläufe, echte gespeicherte Zahlungen und Mahnfälle werden nach Mandant und Berechtigung geladen. Bezahlte Rechnungen erzeugen keine erfundenen Zahlungseingänge. Budgets verwenden im Live-Modus den echten Budgetservice; Fehler werden nicht als Nullwerte oder Demobudgets dargestellt. Die Monatsübersicht liest alle Rechnungsseiten und zählt Entwürfe und stornierte Vorgänge nachvollziehbar.
- Web-Registrierung: Die bestätigte Einwilligung wird auch der abschließenden Validierung übergeben. Fehler erhalten den Entwurf; Doppelübermittlung wird gesperrt und Passwörter werden nicht im Entwurf gespeichert.
- Desktop Web/App: Gemeinsam erreichbare freigegebene Arbeitsbereiche, Einstellungen pro Mandant und Person, Übernahme bisheriger Office-/Assist-Favoriten ohne Modulauswahl. Die App speichert die Übernahme dauerhaft und erlaubt bei Schreibfehlern einen erneuten Versuch. Beschädigte gespeicherte Daten werden nicht überschrieben. Auch die Modul-Filterchips im Klientenportal und die Modul-Tableiste in Arbeitsbereichs-Unterseiten sind entfernt. Die alten Einstiege `/command-center` und `/business/modules` leiten zum heutigen Desktop weiter. Fachliche Berechtigungen und Arbeitsbereichs-Navigation bleiben wirksam.
- Google Workspace: Der selbstreferenzierende Web-Import ist entfernt. Der gemeinsame Datenservice wird tatsächlich aufgelöst.
- Lint: Tote Importe und Variablen sowie instabile Hook-Abhängigkeiten wurden korrigiert. Browser- und Worker-Skripte erhalten ihre passenden Umgebungsdefinitionen. Generierte Landingpage-Dateien und das eigenständige Marketingpaket gehören nicht in den App-Linterlauf.

## Verifikation

- Abschließender vollständiger Vitest-Lauf: 8.731 Tests, 8.728 bestanden, keine fehlgeschlagen, drei bestehende ausstehend. Keine neue Testüberspringung. Zusätzlich 1.353 Portalprüfungen bestanden.
- Die angepasste Bodymap-Rechteprüfung besteht zusätzlich sieben Tests; die Änderung betrifft nur die Typkorrektheit der Testargumente.
- TypeScript-Gesamtprüfung: bestanden.
- App-Lint: 6.345 Dateien ohne Fehler oder Warnungen. Neu erfasste PostgreSQL-Testdatei zusätzlich geprüft.
- Funktionaler Auditor: elf Bereiche bestanden, einschließlich geschlossener Bodymap-Einstiege und kanonischer Assist-Durchführung.
- PostgreSQL-Härtung: sechs isolierte PGlite-Tests prüfen tatsächliche Rollen-/Spaltenrechte und RLS trotz bestehender permissiver Mandantenregeln. Diese Tests schreiben ausschließlich in lokale Testdatenbanken.
- Separates Marketingpaket: die drei Warnungen sind korrigiert. 24 `import/no-unresolved`-Diagnosen bleiben wegen der getrennten Paket-/Aliasauflösung und fehlenden Marketing-Abhängigkeiten offen; kein erfolgreicher Marketingbuild wird behauptet.
- Web-Produktionsexport: bestanden. 4.233 Projektquellen in den Source Maps stimmen mit den aktuellen Quellbytes überein. Der unveränderte Navigationsauditor bestätigt sechs identische initiale React-Wurzeln.
- Android-Hermesexport der vollständigen Ausgabe: bestanden. Der unveränderte Auditor prüft 701 ausgewählte Android-Routen, 4.160 ausgewählte native Quellen, alle drei Zugänge, Rollen-/Sicherheitsgrenzen, unveränderte Intro-/Font-Assets und fehlende erreichbare Web-Implementierungen/WebViews. 4.186 abgebildete Projektquellen stimmen nach der ausdrücklich im Auditor festgelegten BOM-/Zeilenenden-Normalisierung mit dem aktuellen Text überein. Dies ist kein signierter AAB oder Geräte-/Speichernachweis.
- Laufzeitquellen-Fingerprint: 5.039 Dateien; SHA-256 `2a6484498803d40a66115f7be6f943a89b5a2f931d0a6a7c9211f196ab26f340`. Algorithmus: sortierter relativer Pfad, NUL, unveränderte Quellbytes, NUL; `app/src`, TS/TSX/JS/JSX, ohne Tests und Deklarationen.

## Datenbank-Härtung noch nicht angewendet

`profile-and-portal-security.sql` enthält die überprüfte Änderung, noch keine online wirksame Migration. Die Stage-Anwendung scheiterte dreimal an `Invalid or expired requestState`. Kein Umgehen über eine andere SQL-Schreibschnittstelle.

Die letzte Metadatenabfrage bestätigt in Produktion und Stage weiterhin `UPDATE` auf `profiles.role_id` und `profiles.tenant_id`; das Schema `care_security` fehlt. Produktion hat die Tabellen `payments` und `dunning_cases`, Stage hat sie noch nicht. Es wurden keine produktiven Testkonten oder Testdatensätze angelegt.

Die SQL-Datei entzieht Tabellen- und explizite Spaltenrechte für geschützte Identitätsfelder, erhält Kontakt-/Darstellungsfelder und setzt restriktive Leseregeln für Klienten, Mitarbeitende und Mitarbeiterdokumente sowie Schreibregeln für Mitarbeiterdokumente. Vor Freigabe muss sie erfolgreich in Stage angewendet, dort mit vorhandenen freigegebenen Rollen geprüft und anschließend kontrolliert übernommen werden. Die sechs lokalen Tests ersetzen diesen Nachweis nicht.

## Weiterhin fehlende Funktion und Nachweise

- Der vertrauenswürdige atomare Serverabschluss für neue Aufnahmeunterlagen/Signaturen einschließlich Originaldatei, Signaturbeleg und zusammengehöriger Aktivierung fehlt weiterhin. Die Schutzsperre bleibt aktiv. Ein grüner Testlauf ist keine Behauptung, dass diese Funktion verfügbar ist.
- Die neue Monatsansicht ist eine geprüfte Rechnungsübersicht. Sie bucht keinen Abschluss, sperrt keine Buchungsperiode und erzeugt keinen Rechnungslauf. Für einen verbindlichen Monatsabschluss fehlt weiterhin ein vorhandener sicherer Serverablauf.
- Der Browser lässt wegen des Anmelde-/Sitzungsschutzes keine Sichtprüfung zu, auch nach einem neuen Dokument. Angemeldete End-to-End-Abläufe, echte Geräte, Größen/Schrift, Originaluploads, Signaturen, signierter AAB und Update über die bestehende Play-Installation sind damit weiterhin nicht vollständig belegt.
- Die Datenbank-Härtung und andere noch fehlende Server-Abschluss-/Attestierungsfunktionen bleiben ein Freigabehindernis. Diese Korrektur ist keine vollständige Sicherheits- oder Produktionsfreigabe.


## Nachkorrektur vom 12.10.2026 nach der Layoutmeldung

Der Korrekturstand baut auf `1973e822` auf und erhält beide inzwischen veröffentlichten Scroll-Hotfixes. Es wurden keine älteren Gesamtdateien oder Branch-Stände darübergelegt.

- Gespeicherte Widget-Listen werden nicht mehr bei zwölf Einträgen abgeschnitten. Weitere Einträge bleiben über Folgeseiten erreichbar. Eine Wiederherstellung früherer Favoriten erfolgt nur über eine eigene Aktion und überschreibt die aktuelle Auswahl nicht.
- Der Web-Desktop verwendet einen kompakteren Kopfbereich ohne wiederholte Markenüberschrift. Aufgabenbereiche werden in der linken Navigation zusammengeführt; Berechtigungen und Ziele bleiben erhalten. Bei normaler Schrift können auf schmalen Fenstern zwei Widget-Spalten erscheinen. Die vorhandenen Assets und das aktuelle native Layout bleiben erhalten.
- Ältere freigegebene Leistungsnachweise werden gemeinsam mit aktuellen Nachweisen geladen, anhand ihrer Verknüpfung dedupliziert und als Original geöffnet bzw. heruntergeladen. Entzogene Freigaben werden vor dem Download erneut geprüft. Für ältere Nachweise wird keine neue Unterschrift angeboten.
- Die PDF-Speicherung verifiziert Anmeldung, aktives Profil, Rolle, Mandant und Berechtigung. Sie verarbeitet echte Rendererbytes statt eines HTML-Platzhalters, verwendet das bestehende Storage-Pfadformat und überschreibt keine gespeicherte PDF. Ein Wiederholungsversuch bestätigt die tatsächlichen Bytes und denselben Speicherauftrag. Fehler werden nicht als Erfolg ausgegeben.
- Die PDF-Funktion prüft vor jedem Upload `care_security_pdf_upload_ready()`. Bis die geprüfte Rechtemigration tatsächlich online wirksam ist, antwortet sie mit einem verständlichen Fehler und legt keine neue PDF an. Die SQL-Datei enthält die Prüfung, die restriktiven Regeln für erzeugte PDFs und eine beschränkte Rollenänderungsfunktion. Die kompatible Rollenbrücke fällt ausschließlich bei noch fehlender RPC auf den bisherigen Ablauf zurück; eine Serverablehnung wird nicht umgangen.
- Die normale Vorlagen-Finalisierung liest das gespeicherte Dokument, bestätigt die tatsächlich gespeicherte PDF und prüft den Archivschritt, bevor sie Erfolg meldet. Archivdatensätze verwenden vorhandene Spalten und zulässige Kategorien. Derselbe Dokumentabschluss erzeugt keine zweite Ablage. Die Personalaktenablage erfolgt ebenfalls tatsächlich und ohne automatische Portal-Freigabe.
- Die App kann Vorlagen mit dem bereits vorhandenen `expo-print` rendern. Der Druckinhalt erhält eine beschränkte Inhaltsrichtlinie; die Quelldatei bleibt unverändert. Dieser Ablauf ist lokal mit echten PDF-Testbytes und simuliertem Geräteadapter geprüft, noch nicht auf einem echten Gerät.

Verifikation des Korrekturstands:

- Vollständiger Vitest-Lauf: 1.134 Dateien, 8.782 bestanden, 0 fehlgeschlagen, 3 bestehende übersprungen.
- 408 gezielte Dokument-/Desktop-/Nachweisprüfungen bestanden. Nach den letzten Anpassungen zusätzlich 20 Desktop-/Rollenprüfungen sowie 20 PDF-Endpunktprüfungen bestanden; vier neue Rollenprüfungen sind im früheren vollständigen Lauf noch nicht enthalten.
- Gesamt-TypeScript und Hauptprojekt-Lint bestanden. Zuletzt berührte TypeScript-Dateien nochmals geprüft.
- Zehn lokale PostgreSQL-Tests prüfen echte Spaltenrechte, Portalgrenzen, erlaubte Rollenänderung, unveränderliche PDF-Objekte und den Bereitschaftsnachweis. Stage ohne Payroll-Tabelle und ohne `roles.tenant_id` wird dabei berücksichtigt.
- Die visuelle Browserprüfung konnte nicht abgeschlossen werden: auch die Navigation zum lokalen Prüflauf scheiterte im Browserwerkzeug; dieses verlangt eine manuelle Übergabe. Ein DOM-Test wird nicht als optische Abnahme ausgegeben.

Weiter offen: Online-Rechtemigration (Migrationshandler meldet weiterhin `Invalid or expired requestState`), angemeldete Portal-/Geräteprüfung, atomarer Abschluss neuer Originalsignaturen und Uploadfreigaben, verbindlicher Monatsabschluss, fehlende Stage-Finanztabellen, getrennte Marketing-Abhängigkeiten und signierter App-/Play-Updatenachweis. Die normale Vorlagenablage ist kein atomarer Abschluss aller Signatur- und Aktivierungsdatensätze. Der konkrete Veröffentlichungsstand wird im Nachprüfungsbericht separat festgehalten.
