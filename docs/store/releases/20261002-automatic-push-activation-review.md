# Freigabevorschlag: automatischer Push-Dienst

Projekt: `caresuiteplus-production` (`euagyyztvmemuaiumvxm`). Konkrete Umsetzung: `scripts/sql/enable_portal_push_dispatch.sql`.

Die Datenbankmigrationen und Edge-Funktionen sind installiert. Versand und Erinnerungen sind ausgeschaltet. Die lesende Prüfung am 2. Oktober 2026 fand keine registrierten Geräte und keine Outbox-Einträge. Der vorhandene Mandanten-Hauptschalter ist ausgeschaltet.

## Zur Freigabe vorbereitete Änderung

1. `pg_cron` und `pg_net` im vorhandenen Supabase-Projekt aktivieren; den bestehenden Vault verwenden.
2. Einen zufälligen 256-Bit-Schlüssel ausschließlich für den Dispatcher im Vault anlegen, falls noch keiner existiert. Nur dessen SHA-256-Prüfwert wird in der Laufzeitkonfiguration gespeichert. Der SQL-Aufruf gibt keine Schlüssel aus.
3. Die globale Versandlaufzeit und Einsatz-Erinnerungen aktivieren. Den ersten Aktivierungszeitpunkt als Grenze für zukünftige Einsatz-Erinnerungen speichern. Standard: 15 Minuten vor Beginn sowie 5 Minuten nach nicht erfolgtem Beginn; keine nachträglichen Erinnerungen für den alten Einsatzbestand.
4. Eine nur serverseitig ausführbare Scheduler-Funktion einrichten. Der Job `caresuite-portal-push-minute` ruft sie einmal pro Minute auf. Sie sendet eine authentifizierte Anfrage an den installierten Dispatcher im selben Supabase-Projekt.

Die Aktivierung ändert keine Mandanten- oder Geräteeinstellungen. Der Mandanten-Hauptschalter muss anschließend bewusst durch eine berechtigte Person eingeschaltet werden. Die jeweiligen Ereignisschalter und eine gültige Geräteanmeldung mit App-Berechtigung bleiben erforderlich. Die Aktivierung allein sendet mit dem derzeitigen Datenbestand keine Nachricht; nach Freigabe und Geräteanmeldung können die dokumentierten Ereignisse automatisch echte Benachrichtigungen auslösen.

Der Dispatcher sendet an Expo eine Geräteadresse, neutrale Texte und ausschließlich eine zufällige `notificationId` als Nutzdaten. Konto, Mandant, Zielroute und interne Ereigniskennungen werden erst innerhalb authentifizierter Anfragen an das eigene Supabase-Projekt aufgelöst. Es werden keine Testnachrichten an echte Nutzer versendet.

## Begrenzung und Rücknahme

Der Aktivierungsvorschlag enthält keine automatische Löschung alter Outbox-Einträge. Eine spätere Aufbewahrungsregel wäre eine eigene Änderung. Er veröffentlicht keinen Google-Play-Release und schaltet keinen Mandanten automatisch frei.

Für eine sofortige Versandpause kann ein Projektadministrator `public.portal_push_runtime.enabled` und `reminders_enabled` auf `false` setzen. Dann kehren Scheduler und Dispatcher ohne Versand zurück; die Mandantenpräferenzen bleiben erhalten. Der Job kann anschließend separat deaktiviert werden. Bereits an Expo übergebene Benachrichtigungen können dadurch nicht zurückgerufen werden.

## Warum die Zustimmung aussteht

Die automatische Freigabeprüfung hat die produktive Aktivierung wegen globaler Laufzeitfreigabe, wiederkehrendem Produktionsjob, Vault-Schlüssel und der damals zusätzlich enthaltenen Outbox-Löschung abgelehnt und ausdrückliche Zustimmung verlangt. Die Löschung wurde aus dem konkreten Vorschlag entfernt. Die verbleibende Aktivierung wurde nicht erneut versucht; sie wird erst nach Zustimmung ausgeführt.
