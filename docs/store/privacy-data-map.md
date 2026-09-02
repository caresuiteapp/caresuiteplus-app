# Privacy & Data Map – CareSuite HealthOS Android 0.3.0

**Paket-ID:** `app.caresuitehealthos`

**Edition:** Portal-only

**Stand:** 2026-09-02

**Zweck:** Google Play Data Safety, Berechtigungserklärung und DSGVO-Abgleich

Diese Datei beschreibt den geprüften App-Code. Die endgültigen Antworten in der Play Console müssen zusätzlich mit Produktions-Backend, Auftragsverarbeitern, Verträgen, Löschkonzept und öffentlicher Datenschutzerklärung abgeglichen werden.

## Datenverarbeitung

| Datentyp | Erhebung/Verarbeitung | Zweck | Auslöser | Speicher/Übertragung | Hinweise für Play |
|---|---|---|---|---|---|
| Name, E-Mail, Konto-/Mandanten-ID | Ja | Anmeldung, Rollen, Kontoverwaltung | Anmeldung/Portalnutzung | Geschützte Sitzung und Supabase über TLS/RLS | Personal info, User IDs |
| Klient:innen-, Versorgungs- und Gesundheitsdaten | Ja | Einsatzanzeige und Pflegedokumentation | Berechtigter Portalzugriff | Supabase, mandanten- und rollenbezogen | Health info |
| Einsatzereignisse, Aufgabenstatus, Dokumentation, Signaturen | Ja | Leistungserbringung, Nachweis, Compliance | Eingabe/Abschluss durch Mitarbeitende oder Klient:innen | Supabase/Storage, TLS/RLS | App activity, Health info, Files |
| Präziser Standort und GPS-Verlauf | Ja | Anfahrt, Zwischenfahrten, Rückfahrt, Fahrtenbuch, Live-/Ankunftsnachweis | Vom Mitarbeitenden gestartete Fahrt bzw. Einsatztag; explizite Android-Rechte | Lokale Offline-Warteschlange, anschließend Supabase; Hintergrund nur im aktiven Aufzeichnungszeitraum | Precise location; background location declaration |
| Fotos und Videos | Optional, nutzerinitiiert | Einsatzdokumentation und Nachweise | Kamera, Galerie oder Datei-Auswahl | Gerätepuffer/Cache, anschließend geschützter Storage | Photos and videos |
| Audiodaten | Optional | Tonspur einer Videoaufnahme und freigegebene Sprachfunktionen | Mikrofonberechtigung und aktive Nutzeraktion | Gerätepuffer/Cache bzw. geschützter Dienst/Storage | Audio files/Voice or sound recordings prüfen |
| Dokumente/PDFs | Optional, nutzerinitiiert | Nachweise und Dokumentation | Datei-Auswahl | Geschützter Storage | Files and docs |
| Push-Token und Plattform/App-Version | Ja nach Push-Freigabe | Zustellung wichtiger Einsatzänderungen/Mitteilungen, Registrierung/Abmeldung des Geräts | Nutzer aktiviert Benachrichtigungen | Lokal verschlüsselt gespeichert; Expo Push und Backend-Edge-Funktion | Device or other IDs; App info/performance prüfen |
| Gerätebiometrie | Nein | Nur lokale Entsperrentscheidung | Nutzer aktiviert lokale Biometrie | Biometrische Merkmale verlassen das Gerät nicht | Nicht als biometrische Datenerhebung der App deklarieren; lokale Authentifizierung erläutern |
| Login-/Sicherheitsereignisse | Ja | Kontoschutz, Audit und Missbrauchsprävention | Anmeldung/Sicherheitsaktion | Supabase, rollen- und mandantenbezogen | App activity/Security |

## Hintergrundstandort – Kernfunktion

- Die Aufzeichnung beginnt nicht beim bloßen Öffnen der App, sondern mit einer dienstlichen, vom Mitarbeitenden gestarteten Fahrt bzw. Tagesaufzeichnung.
- Sie muss Anfahrt, Einsatzbezug, mehrere Zwischenfahrten und die abschließende Heim-/Weiterfahrt auch bei gesperrtem Display vollständig erfassen.
- Android zeigt währenddessen eine dauerhafte Vordergrunddienst-Mitteilung: „CareSuite GPS-Aufzeichnung aktiv“.
- Die native Aufgabe wird beendet, sobald weder ein Fahrtenbuch- noch ein aktiver Assist-Kontext besteht.
- Standortdaten werden lokal robust zwischengespeichert, falls die Verbindung unterbrochen ist, und danach an das mandantenbezogene Backend übertragen.
- Sichtbarkeit ist rollen- und zustandsabhängig; Klient:innen erhalten keine allgemeine dauerhafte Mitarbeiterortung.

## Berechtigungen

| Android-Berechtigung | Funktion | Zeitpunkt |
|---|---|---|
| `POST_NOTIFICATIONS` | Einsatzänderungen, Mitteilungen, sichtbare GPS-Service-Mitteilung | Nach Erklärung/Nutzeraktion bzw. für den laufenden Standortdienst |
| `CAMERA` | Direkte Foto-/Videoaufnahme | Beim Öffnen der Kamera |
| `RECORD_AUDIO` | Video mit Ton/freigegebene Sprachfunktion | Bei Funktion mit Audio |
| `ACCESS_COARSE_LOCATION` | Standortgrundlage | Beim Start einer GPS-Funktion |
| `ACCESS_FINE_LOCATION` | Fahrten-/Ankunftsnachweis | Beim Start einer GPS-Funktion |
| `ACCESS_BACKGROUND_LOCATION` | Vollständige aktive Tages-/Fahrtaufzeichnung bei Hintergrund/Display aus | Nach Vordergrundfreigabe und deutlicher Erklärung |
| `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_LOCATION` | Sichtbarer Android-Dienst während der Aufzeichnung | Nur während aktiver GPS-Aufzeichnung |

## Datenweitergabe und Zwecke

- Keine Nutzung für Werbung, Profiling oder Verkauf von Daten.
- Backend- und Push-Dienstleister verarbeiten Daten als technische Dienstleister/Auftragsverarbeiter. Ob dies in der Play-Console-Definition als „geteilt“ gilt, muss anhand der aktuellen Verträge und Ausnahmen final bestätigt werden.
- Primäre Zwecke: App-Funktionalität, Kontoverwaltung sowie Sicherheit/Compliance.
- Zugriff innerhalb des Kundenmandanten ist rollenbasiert und keine öffentliche Weitergabe.

## Sicherheit und Aufbewahrung

- Transportverschlüsselung über HTTPS/TLS.
- Datenbank- und Storage-Zugriff mit Mandanten-/Rollenregeln; sensible Sitzungsschlüssel im sicheren Gerätespeicher.
- Offline-GPS-Warteschlangen liegen lokal auf dem Gerät und werden nach erfolgreicher Übertragung abgearbeitet.
- Aufbewahrung richtet sich nach Vertrags-, Dokumentations- und gesetzlichen Pflichten; konkrete Fristen müssen in Datenschutzerklärung und Löschkonzept übereinstimmen.
- Auskunft, Berichtigung, Löschung oder Einschränkung erfolgen über den verantwortlichen Mandanten und die veröffentlichten Kontaktwege, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.

## Öffentliche Links

- Datenschutz: https://caresuiteplus.de/datenschutz
- Hilfe: https://caresuiteplus.de/hilfe
- Kontakt: support@caresuiteplus.de
