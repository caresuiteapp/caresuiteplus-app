# Automatische App-Benachrichtigungen – Stand 2. Oktober 2026

Die vollständige Android-Ausgabe kann Verwaltung, Mitarbeiterportal und Klientenportal öffnen. Die hier dokumentierte System-Push-Kette unterstützt Mitarbeiter- und Klientenkonten. Die Erreichbarkeit der Verwaltung erweitert diese Empfängerliste nicht automatisch.

## Ereignisse nach Serverinstallation und Freigabe

| Ereignis | Empfänger | Voraussetzung / Ziel |
| --- | --- | --- |
| Neuer sichtbarer Einsatz oder Änderung einschließlich Absage eines zukünftigen Einsatzes | Zugeordnete Mitarbeitende und zugehöriger Klient | Kein Entwurf; Portal-Freigabe und bestehende Kontozuordnung; Einsatzansicht |
| Baldiger Einsatzbeginn | Zugeordnete Mitarbeitende | Einmal pro Gerät und geplantem Beginn, innerhalb der 15 Minuten vor dem Start |
| Geplanter Beginn überschritten | Zugeordnete Mitarbeitende | Einmal pro Gerät und geplantem Beginn, ab 5 Minuten nach Start; bis zum geplanten Ende, höchstens 2 Stunden |
| Empfangene ungelesene Nachricht | Betroffenes Mitarbeiter- oder Klientenkonto | Gesendete Nachricht; keine interne Notiz oder eigene Nachricht; zugehöriger Chat |
| Leistungsnachweis benötigt Klientenunterschrift | Zugehöriger Klient | Sichtbarer Nachweis mit `pending_client_signature`; Nachweisansicht |
| Freigegebener Leistungsnachweis verfügbar | Zugehöriger Klient | Sichtbarer Nachweis mit `released`; Nachweisansicht |
| Gültige Klientenunterschrift eingegangen | Zugeordnete Mitarbeitende | Tatsächlich gültige Signatur für denselben Mandanten und Einsatz; Einsatzansicht |
| Dokumentenanfrage zur Unterschrift | Angefragte Mitarbeitende und/oder Klient | Sichtbare aktive Anfrage und passender Empfängerkreis; Signaturansicht |
| Systemhinweis oder ausdrücklich als Push versendete Office-Mitteilung | Ausgewählte Mitarbeiter- oder Klientenkonten | Ungelesene, kontozugeordnete Mitteilung; Mitteilungsansicht |
| Veröffentlichtes Android-Update | Mitarbeiter- oder Klientenkonten auf älterem Build | Release muss nach tatsächlicher Play-Veröffentlichung explizit verfügbar markiert werden; Profil |

Der Minutenjob arbeitet serverseitig auch bei geschlossener App. Für Pushs sind die App-Berechtigung, gültige Geräte- und Kontoanmeldung sowie der Mandanten-Hauptschalter erforderlich. Die Ereignisschalter für Einsatzänderungen, Nachrichten, Unterschriften und freigegebene Nachweise werden ebenfalls geprüft. Installation und Aktivierung überschreiben keine ausgeschalteten Mandanten- oder Gerätepräferenzen.

Erinnerungen berücksichtigen nur Einsätze, deren geplanter Beginn nach der erstmaligen Erinnerungseinrichtung liegt. Bereits gestartete, pausierte, abgeschlossene, abgesagte und nicht erschienene Einsätze werden ausgeschlossen. Start-/Endzeiten, gespeicherte Zeitereignisse und Workflow-Spiegel werden gemeinsam geprüft. Umplanung, Start, Abmeldung, gelesene Nachricht, fertige Unterschrift oder Entzug der Freigabe können eine wartende Benachrichtigung vor dem Versand ungültig machen.

Auf dem Sperrbildschirm stehen neutrale Texte ohne Klientennamen oder Dokumentinhalt. Expo erhält neben Geräteadresse und neutralem Text nur eine zufällige Benachrichtigungsreferenz. Konto, Mandant, Portalroute und interne Einsatz-, Nachrichten- oder Dokumentkennungen werden nicht als Push-Daten an Expo übertragen. Das Ziel wird erst beim Antippen innerhalb einer authentifizierten Anfrage an das eigene Supabase-Projekt ermittelt. Die Prüfung vergleicht die serverseitigen Konto- und Mandantenangaben mit dem Empfänger und berücksichtigt weiterhin Freigaben, Geräteanmeldung, Ablauf und Benachrichtigungseinstellungen. Die App muss das angemeldete Konto auch nach dieser asynchronen Anfrage erneut prüfen, bevor sie navigiert.

Expo-Tickets und Zustellbelege werden getrennt behandelt; ein angenommenes Ticket wird bei fehlendem Zustellbeleg nicht erneut gesendet. Betriebssystem, Netzverbindung und FCM können den tatsächlichen Empfang verzögern oder verhindern.

## Nicht als automatische System-Pushs implementiert

Verwaltungsalarme, unzugeordnete offene Einsatzangebote an alle Mitarbeitenden, jede gewöhnliche Dokumentablage, Abrechnungs-/Mahnungs-/Lizenz-/Supportereignisse sowie Akademieereignisse sind nicht durch diese Push-Kette abgedeckt. Ein konfigurierter Ereigniskatalog oder eine In-App-Meldung allein ist kein Nachweis für System-Push.

## Produktionsbefund vor diesem Update

Die nur lesende Prüfung von `caresuiteplus-production` fand `portal-push-register`, `office-push-send` und `office-push-receipts`, aber keinen automatischen Dispatcher, keine automatische Outbox-/Runtime-Migration und keine `pg_cron`-/`pg_net`-Einrichtung. Geräte- und manuelle Zustelltabellen enthielten keine Einträge. Der vorhandene Mandanten-Hauptschalter war ausgeschaltet. Dieser Befund beweist fehlende Installation; er ist kein FCM-Gerätetest.

## Produktionsstand nach der Installation

Am 2. Oktober wurden die Push-Grundlage, Einsatz-Erinnerungen und authentifizierte Zielauflösung installiert. Aktiv bereitgestellt sind `portal-push-register` Version 5, `office-push-send` Version 5 und der datensparsame `portal-push-dispatch` Version 1. Die anschließende lesende Prüfung bestätigt die Zielauflösung für angemeldete Konten und deren Sperre für anonyme Aufrufe.

Der automatische Versand ist weiterhin ausgeschaltet: Laufzeitfreigabe und Erinnerungsfreigabe sind `false`, der Worker-Schlüssel und Erinnerungsbeginn sind noch nicht eingerichtet, die Scheduler-Funktion und der Cron-Katalog fehlen. `pg_cron` und `pg_net` sind nicht aktiviert. Geräte- und Outbox-Tabellen sind leer; der vorhandene Mandanten-Hauptschalter bleibt ausgeschaltet.

Die automatische Freigabeprüfung hat die produktive Aktivierung abgelehnt und eine ausdrückliche Zustimmung verlangt. Der Aktivierungsvorschlag ist in [20261002-automatic-push-activation-review.md](./20261002-automatic-push-activation-review.md) beschrieben. Die zuvor enthaltene automatische Löschung alter Outbox-Einträge wurde daraus entfernt. Der abgelehnte Aktivierungsaufruf wurde nicht erneut ausgeführt.

Die Supabase-Beraterprüfung meldet im neuen Push-Bereich absichtlich gesperrte interne Tabellen ohne Portal-RLS-Regeln sowie die absichtlich für angemeldete Konten zugängliche, intern begrenzte `SECURITY DEFINER`-Zielauflösung. Sie meldet außerdem Leistungsoptimierungen für bestehende Geräte-RLS-Regeln und einige Fremdschlüsselindizes. Daraus folgt kein Nachweis realer Push-Zustellung; diese Beraterhinweise wurden nicht durch pauschale Rechteänderungen behoben. Siehe [RLS ohne Regeln](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [authentifizierte Definer-Aufrufe](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS-Auswertungen](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) und [Fremdschlüsselindizes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Installation und Prüfung

1. Vorhandene Push-Grundlage prüfen; `20260906160000_portal_automatic_push.sql` nur installieren, wenn sie fehlt. Anschließend die additiven Migrationen `20261002132149_portal_assignment_push_reminders.sql` und `20261002134559_portal_push_opaque_navigation.sql` installieren. Diese Schemaänderungen starten keine echten Pushs.
2. Aktuelle Funktionen `portal-push-dispatch`, `portal-push-register` und `office-push-send` installieren. Der Dispatcher muss mit `verify_jwt=false` und seiner eigenen 256-Bit-Vault-Tokenprüfung laufen. Seine Supabase-Servicezugänge sind eingebaute Servervariablen.
3. `scripts/sql/verify_portal_push_installation.sql` prüft Schema, Rechte und Status ohne vertrauliche Daten. Nach ausdrücklicher Zustimmung aktiviert `scripts/sql/enable_portal_push_dispatch.sql` den geschützten Minutenjob und die zukünftig beginnenden Erinnerungen; ausgeschaltete Mandantenpräferenzen bleiben ausgeschaltet.
4. FCM-v1-Konfiguration im zugehörigen EAS-Projekt und passende Android-Firebase-Konfiguration getrennt prüfen. Ein zusätzlicher `EXPO_ACCESS_TOKEN` ist nur erforderlich, wenn das EAS-Projekt zusätzlichen Expo-Push-Zugriffsschutz verwendet. Keinen Serverzugang in öffentliche App-Variablen schreiben.
5. Auf einem autorisierten Testgerät Berechtigung, Registrierung, kontogebundene Navigation und reale Zustellung prüfen. Es wurden keine Testnachrichten an echte Nutzer gesendet.

Lokal ausgeführt: bestehende und ergänzte PostgreSQL-Verhaltensprüfungen über die vorhandene PGlite-Prüfung, sowie Worker-/Navigationsprüfungen über Vitest. Diese Prüfungen ersetzen keine produktive Bereitstellung und keinen Android-FCM-Gerätetest.
