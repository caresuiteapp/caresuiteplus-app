# Pflege: aktuelle Rechte im Live-Arbeitsbereich bestätigen

Die gemeldeten Fehler in Vitalwerte und Medikation hatten zwei zusammenwirkende Ursachen. Die Anmeldung bildet den Datenbank-Rollenschlüssel `owner` auf die App-Rolle `business_admin` ab. Der klinische Reader verglich bisher die beiden unterschiedlichen Schlüssel direkt und suchte danach eine Rolle über den App-Schlüssel statt über die tatsächlich zugewiesene Rollen-ID. Die bereits ergänzten Rechte wurden dadurch nicht erreicht. Auf Production existiert keine eigene `business_admin`-Rollenzeile.

Außerdem hatten 26 der bereits bestehenden Pflege-Rechte der AVENTA-Eigentümerrolle keinen `tenant_id`. Die bestehende RLS-Policy blendete diese Zeilen beim normalen Lesen aus. Ein privilegierter Berechtigungshelfer sah sie trotzdem. Die vorherige Ergänzung auf 42 gespeicherte Rechte war daher noch kein vollständiger Nachweis für den tatsächlichen Leseweg.

## Umsetzung

Der gemeinsame Reader bestätigt das aktive eigene Profil mit Auth-Verknüpfung, Mandant und zugewiesener Rohrolle vor und nach dem vollständigen Lesen. Die vorhandene Rollennormalisierung bestätigt die App-Rolle; Rechte werden ausschließlich über die echte Profil-Rollen-ID gelesen. Ein Wechsel zwischen zwei Rohrollen mit derselben App-Rolle verwirft den Bestand ebenfalls. Unbekannte Rollen werden abgelehnt. Tenant-Replacements ersetzen weiterhin die Basisrechte. Es gibt keinen statischen Produktionsfallback und keine automatische Rechtevereinigung.

Der äußere Reader behält die bestehende Zeitgrenze, Abbruchkontrolle und sichere Prüfung aller Eigentümerfelder einschließlich Token/Ablauf bis zur asynchronen Rückgabe. Späte Antworten nach Abbruch starten keine weiteren Abfragen. Vitalwert-Liste und -Detail unterscheiden nun laufende Prüfungen, Bestätigungsfehler mit erneutem Versuch und tatsächlich fehlende Rechte. Vorhandene Daten- und Schreibsperren bleiben wirksam.

Der separat geprüfte operative Patch `supabase/patches/pflege_owner_permission_tenant_repair.sql` wurde einmal auf Production ausgeführt. Er ergänzt ausschließlich die Mandantenzuordnung der exakt geprüften 26 bestehenden AVENTA-Eigentümerrechte. Er fügt keine Rechte hinzu. Andere Rollen, Katalog, Überschreibungen, RLS und API-Rechte bleiben unverändert. Normale `updated_at`- und Audittrigger bleiben aktiv. 26 normale Zeilen-Audits und ein Wartungs-Auditeintrag mit leerer Personen-ID dokumentieren die Korrektur.

## Nachweise

Die schreibgeschützte SQL-Rollensimulation mit `authenticated` und anschließendem Rollback bestätigt nach dem Patch die eigene aktive Profil-/Mandantenauflösung sowie 42 durch RLS sichtbare Pflege-Rechte. Vitalwerte, Medikation und Pflegeplanung sind darin enthalten. Vor dem Patch waren nur 16 Rechte sichtbar. Die Hashvergleiche in `docs/audit/pflege-live-permission-confirmation-20261105.json` bestätigen unveränderte andere Rollen, Rechteinhalte, Katalogeinträge, Überschreibungen, Policies und Tabellenrechte.

Der vollständige Node-Regressionslauf bestand mit 15.208 Tests, 0 Fehlern und 0 übersprungenen Fällen. Die 13 gezielten Vitest-Suiten bestanden mit 159 Tests, darunter 22 Datenbank-Patchtests und 8 tatsächliche React-Screenprüfungen für Ladezustand, Bestätigungsfehler, Retry und echte Ablehnung. Die Roh-Eigentümer-Regression und die bisherigen falschen Vitalwert-Fehlerzustände scheiterten vor der Korrektur. Abhängige Node-Testaufbauten verwenden jetzt die tatsächliche Rollennormalisierung und aktive eigene Profil-/Rollenbeziehungen statt einer erfundenen App-Rollenzeile.

Der vollständige TypeScript-Lauf (`tsc --noEmit`) bestand für die endgültigen Quellen mit Exit 0. Web und Native werden aus denselben Quellen gepflegt. Der Generator bestätigt 1.170 Module, 274 Routen, 4 eigene/gesperrte Ausnahmen und 0 veraltete Dateien. Es wurde kein signiertes App-Paket erstellt.

Eine SQL-Rollensimulation und gemockte Screenprüfungen sind keine angemeldete visuelle HTTP-Abnahme oder klinische Ablaufabnahme. Diese Grenzen bleiben offen. Die bestehenden gestalteten Lade-/Fehlerkomponenten werden unverändert verwendet; eine neue Designfreigabe wird nicht behauptet.
