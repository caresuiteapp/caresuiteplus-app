# CareSuite: Einrichtung der zentralen Betriebserfassung

Stand: 7. Oktober 2026. Geltungsbereich: Website, Web und Desktop auf caresuiteplus.app. Freigabe: ausdrücklicher Nutzerauftrag „ja einrichten und aktivieren“.

## Ergebnis und Veröffentlichungsstand

Die zusätzliche Erfassung ist auf dem produktiven Server eingerichtet. Der öffentliche Bereitschaftsendpunkt meldet `inventoryReady: true` und `observationReady: true`. Die Erfassungsfunktion ist aktiv; die Registrierung bestätigt erfolgreiche Kontoanlagen jetzt serverseitig. Der Webstand wird mit diesem Paket zur Veröffentlichung bereitgestellt. Bis diese Veröffentlichung an der Live-Adresse bestätigt ist, enthält die bisherige Website keine neue Meldungsanbindung; es werden deshalb keine erfundenen Live-Zahlen ausgegeben.

Die frühere automatische Ablehnung betraf die inzwischen ausdrücklich freigegebene sitzungsbezogene Erfassung. Ein erster erneuter Einrichtungsversuch erhielt einen ungültigen Verbindungszustand; eine Prüfung bestätigte, dass keine Änderung erfolgt war. Der anschließende Versuch war erfolgreich.

## Produktiv eingerichtete Serverbestandteile

| Bestandteil | Bestätigter Stand |
| --- | --- |
| Bestands- und Betriebsübersicht | `caresuite-platform-operations-20261007`, zusätzliche Erfassung bereit |
| Hauptmigration | `20261007151456_platform_operations_observations` |
| Begrenzte interne Leserechte | `20261007152902_platform_observation_service_reads` |
| Öffentliche Erfassungsfunktion | `platform-observation`, Version 1, ACTIVE |
| Registrierungsserver | `register-business-tenant`, Version 21, ACTIVE |
| Bestehender Versanddienst | `registration-welcome-dispatch`, Version 4; nicht erneut veröffentlicht |
| Webanbindung dieses Pakets | `caresuite-platform-observation-web-20261007`; Veröffentlichung noch zu bestätigen |

Die Prüfung fand fehlende Leserechte für den internen Erfassungsdienst. Ergänzt wurden ausschließlich `user_id`/`status` in `platform_users` und `tenant_id`/`status` in `platform_tenants`. Vollständiger Tabellenzugriff, E-Mail-Adressen, Kontaktdaten und Plattformrollen wurden dem Dienst dadurch nicht zusätzlich freigegeben. Die Schreibfunktionen bleiben ausschließlich vom internen Serverdienst aufrufbar. Alle sechs neuen Tabellen liegen in einem privaten Schema, haben Zeilenschutz und sind weder für Besucher noch angemeldete Softwarekonten direkt lesbar.

## Anzeige und Bearbeitung

- Live-Nutzung zählt sichtbare Websitefenster sowie serverseitig bestätigte Software- und Plattformkonten. Ein Konto wird einmal gezählt; Websitefenster sind keine sichere Anzahl einzelner Personen. Meldungen werden etwa alle 30 Sekunden gesendet, die Live-Grenze beträgt 90 Sekunden, die Plattformansicht aktualisiert etwa alle 15 Sekunden.
- Registrierungen zeigen Schritte, Zeitpunkte, technische Hinweise und den bestätigten Abschluss. Der erste Schritt wird auch erfasst, wenn das Formular bereits während der Bereitschaftsabfrage geöffnet wurde. Erfolgreiche Kontoanlage und Unternehmenszuordnung bestätigt ausschließlich der Registrierungsserver.
- Verlassene und inaktive Versuche unterscheiden sich. Inaktivität ist ein möglicher Abbruch; der persönliche Abbruchgrund wird nicht behauptet. Vor der Kontoanlage stehen keine Formularnamen in der Übersicht.
- Fehler werden nach Bereich, Vorgangsart, Kategorie und Antwortstatus zusammengefasst. Berechtigte Plattformkonten können Gruppen mit Begründung erledigen oder wieder öffnen; erneutes Auftreten öffnet eine erledigte Gruppe erneut. Gleichzeitige Änderungen werden über den letzten Ereigniszeitpunkt abgefangen.

Zufällige Fensterkennungen bleiben nur im Arbeitsspeicher. Bereits angemeldete Meldungen können mit dem geprüften Konto und Unternehmen verbunden sein. Es gibt dafür keine neuen Analyse-Cookies, keinen lokalen Analysespeicher und keinen Gerätefingerabdruck. Passwörter, Formularinhalte, vollständige Adressen aufgerufener Seiten, Klienten- und Personalakteninhalte werden nicht in die neue Erfassung übernommen. Kurzlebige, täglich wechselnde geschützte IP-Prüfwerte begrenzen Anfragen; Roh-IP-Adressen werden nicht in den neuen Tabellen gespeichert. Do Not Track und Global Privacy Control stoppen diese zusätzliche Erfassung. Vorschau- und Demoseiten erfassen nicht.

Aufbewahrung: nicht verknüpfte Seitenmeldungen ein Tag, Registrierungsversuche und verknüpfte Schritte 14 Tage, Fehlergruppen 30 Tage, Anfragezähler eine Stunde. Die Bereinigung läuft bei weiteren Betriebsmeldungen; bei ausbleibenden Meldungen erfolgt sie erst mit der nächsten Bereinigung. Die Web-Datenschutzerklärung beschreibt jetzt die aktivierte Verarbeitung einschließlich möglicher Kontozuordnung. Die Android-Fassung bleibt unverändert.

## Versandfunktion

Der produktive Versanddienst wurde vor der Einrichtung gelesen und mit dem vorhandenen Quellstand verglichen. Die neue Registrierung verwendet denselben Versandstand einschließlich Empfängerprüfung und `delivery_revision`, damit korrigierte Empfänger nicht durch einen älteren Versandbezeichner übergangen werden. Vorlage, Bilder und SMTP-Verarbeitung entsprechen dem vorhandenen Versanddienst. Es wurde keine Testregistrierung angelegt und keine Testmail versendet.

## Nachweise

- 51 ausführbare Node-Prüfungen bestanden: Zugriffszustände, kostenlose Nutzung, Rechte, Betriebsabfragen, Datenbegrenzung, Bereitschaft, Registrierungsschritte, Fehlertransport und öffentliche Seiten.
- Die neue Datenbankfunktion wurde mit der echten Dienstrolle ausgeführt. Neue Prüfbeobachtungen wurden in einer Untertransaktion vollständig zurückgerollt. Geprüft wurden tatsächliche Annahme und Gruppierung, falsches Fenstergeheimnis, unbestätigte Kontozuordnung, gefälschter Abschluss, fehlende und unbekannte Anmeldeidentität, geschützte Tabellen sowie die berechtigten Leseabfragen. Sieben erwartete Verweigerungen bestätigt; keine Prüfbeobachtung blieb gespeichert.
- Öffentliche HTTP-Prüfung: Bereitschaft und Erfassungszustand liefern 200; ungültige Meldung 400; nicht bestätigtes Anmeldetoken 401; gefälschter Registrierungsabschluss 400; leere Registrierung 400. Keine gültige Meldung wurde für diese HTTP-Prüfung künstlich erzeugt.
- Bereitgestellte Funktionsdateien zurückgelesen: alle drei Erfassungsdateien und alle neun Registrierungsdateien stimmen exakt mit den vorgesehenen Inhalten überein. Kundendatensätze und Mailwarteschlange unverändert: 3 Unternehmen, 94 Klientendatensätze, 32 Mitarbeitendendatensätze, 3 Verwaltungskonten, 1 Mailvorgang.
- Sicherheitsprüfung: keine zusätzliche anonym ausführbare Funktion mit erhöhten Rechten und keine neue veränderliche Namensauflösung. Sechs zusätzliche Hinweise zu bewusst ohne öffentliche Richtlinie geschützten privaten Tabellen; drei zusätzliche Hinweise zu angemeldet ausführbaren, separat rollenprüfenden Lesefunktionen bzw. Fehlerbearbeitung. Bestehende Hinweise bleiben offen und werden nicht als gelöst behauptet.

Weitere technische Prüfung und der endgültige Paketstand werden in `PRUEFSTAND.json` festgehalten. Eine vollständige Erstellung und die angemeldete Bedienung in breiten und schmalen Fenstern wurden hier nicht ausgeführt, weil die dafür vorhandene Projektumgebung fehlt. Das Veröffentlichungsskript prüft die vorhandenen passenden Prüfreihen und die vier bestehenden Vercel-Erstellungen. Es installiert keine neuen Komponenten.

## Verbleibende Grenzen

Die Erfassung beginnt mit der neuen Webveröffentlichung. Frühere Besuche und Registrierungsabbrüche werden nicht rekonstruiert. Android bleibt unverändert. Direkte Sonderverbindungen und Hintergrunddienste wie Versand, Push und OCR sind durch diese Browseranbindung nicht vollständig zentral erfasst. Die bestehenden Einsatz-Zeitüberschreitungen, die durchgängige Wartungs- und Registrierungsfreigabe, allgemeine Funktionsschalter und ein zentraler Websiteeditor bleiben separate Befunde des ursprünglichen Plattformprüfberichts.

Sicherheitshinweise und erläuterte Gegenmaßnahmen: [Private Tabellen mit Zeilenschutz ohne öffentliche Richtlinien](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [angemeldet ausführbare Funktionen mit erhöhten Rechten](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Diese Hinweise sind kein Nachweis eines anonymen Zugriffs; die tatsächlichen Rechte wurden separat geprüft.
