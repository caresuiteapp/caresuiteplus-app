# CareSuite HealthOS 0.8.1 – Anmeldung und Einsatzmeldungen

Gemeinsame Quelle für Web und native App, ausgehend von `d7cbc8cb4e45906a4af2548b115fa5566caac254`. Der Fahrtenbuch-Fix aus diesem Hauptzweig ist enthalten.

## Änderungen

- Aktive native Anmeldemasken für Verwaltung, Mitarbeitende und Klient:innen verwenden den vorhandenen verschlüsselten Gerätespeicher. Die Nutzung gespeicherter Zugangsdaten verlangt eine Betriebssystembestätigung und anschließend eine reguläre Serveranmeldung mit Prüfung der gespeicherten Konto-/Mandantenzuordnung. Einmalpasswörter werden nicht gespeichert.
- Die Gerätebestätigung und Speicherung erfolgen vor der Veröffentlichung der Sitzung. Für den Verwaltungszugang prüft ein isolierter, nicht persistierender Auth-Client Kennwort, Unternehmensfreigabe und eigene Mandantenzuordnung; erst danach wird die gemeinsame App-Sitzung aktiviert. Ein Seitenwechsel während der Gerätebestätigung verwirft die vorbereitete Sitzung.
- Face ID beziehungsweise Touch ID werden auf iOS passend bezeichnet; Android verwendet verfügbare Biometrie oder den Gerätecode. Eine fehlgeschlagene optionale Speicherung verhindert die normale Anmeldung nicht.
- Rollen erzwingen keine erstmalige Authenticator-Einrichtung mehr. Freiwillig verifizierte Faktoren behalten die zusätzliche Kontoprüfung. Anmeldung, Sitzungssperren, Widerruf und Mandantentrennung bleiben geprüft.
- Popup-Inhalte behalten ihre natürliche Höhe innerhalb der begrenzten Dialoghöhe. Einsatzmeldungen zeigen Änderungsart sowie Beschreibung beziehungsweise vorhandene Terminangaben, auch ohne Vorschautext. Lesebestätigung und aktuelle Einsatzberechtigung bleiben getrennt.
- Die seitliche Portalnavigation scrollt im verfügbaren Platz. Der Abmeldeknopf erhält einen eigenen, nicht schrumpfenden Bereich mit Geräteabständen.
- Klientenabfragen verwenden vorhandene Kontakt-, Adress- und Einsatzspalten. Der Zugriff auf operative Klientenhinweise ist auf eigene zugeordnete Einsätze begrenzt. Das Protokoll übernimmt die tatsächliche Identität aus der Sitzung; eine Mitarbeitenden-ID wird nicht als Profil-ID geschrieben. Push-Geräteregistrierungen erhalten ausschließlich die notwendigen Backend-Tabellenrechte.

## Datenbanknachweis

Die identische Patchquelle `supabase/patches/native_login_database_reliability.sql` wurde zunächst in Staging (`20261029092143`) und danach produktiv (`20261029092836`) angewendet. Funktionsdefinition, RLS, konkrete Policy, Trigger und getrennte Backend-/Clientrechte wurden nachgelesen. Keine bestehenden Konten, Faktoren oder Einsatzdaten wurden für die Prüfung verändert. Keine Nachrichten wurden versendet.

## Prüfungen und Grenzen

Die isolierten Datenbanktests prüfen optionale MFA, eigene/fremde Zuordnung, Entwürfe, fehlende/gesperrte Sitzungen, Audit-Fremdschlüssel und Backendrechte. Funktionstests prüfen die tatsächlich verwendeten Anmeldemasken einschließlich Abbruch, Kontoänderung und Speicherfehler. Der bestehende visuelle Browserlauf umfasst reale Popup- und Portalrahmen-Komponenten mit synthetischen Daten sowie kleine und große Fenster, vergrößerte Schrift und Geräteabstände. Browserprüfungen ersetzen keinen Face-ID-/Android-Gerätetest.

Die vollständige TypeScript-Prüfung ist im vorhandenen CI auszuführen; lokale Versuche wurden vom Arbeitsspeicherlimit beendet. Vorhandene allgemeine Supabase-Advisories außerhalb der genannten Korrekturen sind kein Nachweis weiterer behobener Fehler. Ein signiertes Paket wird erst aus dem geprüften Hauptzweig erzeugt. Eine Google-Play-Einreichung ist nicht Teil dieses Schritts.
