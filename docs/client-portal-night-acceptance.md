# Klientenportal: freigegebene Gestaltung und Prüfstand vom 23.11.2026

Der bestätigte Entwurf überträgt den dunklen Rahmen des Mitarbeitendenportals auf das Klientenportal: Originalmotive, gemeinsame Farben, helle Schrift, Uhr/Wetter, Profil und Schriftgrößensteuerung. Auf dem Smartphone stehen Übersicht, Einsätze, Postfach und Mehr unten. Das Bereichsmenü wird bei großer Schrift oder wenig Breite zu einer Liste.

Die gemeinsame Portalhülle und die Startseite sind echte React-Native/Web-Komponenten. Daten, Freigaben, Mandantentrennung und Angehörigenrechte bleiben an die vorhandenen Dienste gebunden. Das Budget erscheint ausschließlich bei entsprechender Freigabe. Die Akademie verwendet weiterhin ihre vorhandene Browsergrenze in der nativen App.

## Behobene Fehler

- Eine rasche zweite Anfrage konnte vor der ersten Zustandsaktualisierung erneut gesendet werden. Eine unmittelbar gesetzte Sperre verhindert das.
- Abgewiesene Netzwerkaufrufe konnten beim Formatieren der Fehlermeldung selbst einen Fehler werfen. Unbekannte Fehlerwerte führen jetzt zu einer verständlichen, wiederholbaren Fehlermeldung.
- Eine ältere Übersichtsabfrage konnte neuere Echtzeitdaten überschreiben. Veraltete Ergebnisse werden verworfen. Ein fehlgeschlagener erster Hintergrundabruf führt zu einem sichtbaren Fehlerzustand.
- Ein Fehler der Einsatzhistorie im Profil wurde verschluckt. Die Ansicht zeigt einen Wiederholungsweg.
- Allgemeine Chatnachrichten erhielten ohne Auswahl die erste Kategorie, im Testkonto „Einsatz absagen“. Neue Nachrichten bleiben nun allgemeine Anliegen, bis die Person eine Kategorie auswählt. Vorhandene Gespräche werden nicht umkategorisiert.
- Die Gerätebestätigung verglich den Sitzungstoken ohne das von `hashOpaqueToken` erzeugte Präfix `token-sha256:`. Die gezielte Datenbankmigration ergänzt dieses bestehende Format. Aktive Sitzung, Mandant, Kontoinhaber und Ablaufdatum werden weiterhin geprüft. Rechte und Funktionskonfiguration blieben unverändert.

## Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Automatisierte Portal-, Akademie-, Auth-, Geräte- und gemeinsame UI-Prüfungen | 583 Tests in 85 Dateien bestanden; ergänzende Merge-Prüfungen bestanden |
| TypeScript | Betroffene Quelldateien mit vollständigen Importabhängigkeiten geprüft; keine Fehler |
| Native-Generierung | Aus der Webquelle erzeugt; Konsistenzprüfung ohne veraltete Adapter |
| Originalmotive | Releaseprüfung bestanden; 166 eigene 3D-Originale und Web/Native-Zuordnung bestätigt |
| Webexport | Vollständiger Expo-Webexport erfolgreich; lokale QA-Konfiguration mit Beispieldaten |
| Originalkomponenten im Browser | Startseite und Menü bei 320, 390, 768, 1024, 1280 und 1440 px geprüft; 150 % Schrift bei 320, 390, 768 und 1440 px; keine horizontal herausragenden Hauptaktionen |
| Dialoge und Editor | Dunkle Web-Dialoghülle, Bereichsauswahl mit großer Schrift, Nachrichten-Themenwahl und Eingaben geprüft |
| Produktives Testkonto: Anmeldung | Über geschützte Eingabe angemeldet; Sitzung nach Neuladen wiederhergestellt |
| Nachricht | Als technischer Test gekennzeichnete Nachricht gesendet und nach Neuladen wiedergefunden |
| Einsätze | Kommend/Vergangen, vergangene Einträge, Vorschau und Detailseite geöffnet |
| Live-Anfahrt | Leerer Zustand bei fehlender laufender Anfahrt bestätigt |
| Dokumente/Nachweise | Vorhandene Leerzustände und Unterschriftennavigation geöffnet |
| Mitteilungen | Leerer Zustand geöffnet |
| Hilfe | Suche nach „Polizei“ geprüft; keine Telefonnummer angewählt |
| Akademie | Lernbereich und Navigation geöffnet; im Testkonto keine Schulung zugewiesen |
| Profil/Geräte | Stammdatenansicht geöffnet; Gerätefehler reproduziert, korrigiert und anschließend aktuelle Browserregistrierung im Portal bestätigt |

Die Browserbilder der neuen Oberfläche verwenden ausschließlich lokale Beispieldaten. Die produktiven Funktionstests erfolgten auf der noch bestehenden Oberfläche. Sie belegen die Dienste und vorhandenen Abläufe, nicht die Veröffentlichung der neuen Oberfläche.

## Offene Praxistests und Veröffentlichung

Der PDF-Test wurde bei der Dateiauswahl durch den Abbruch der Browsersitzung unterbrochen. Ein abschließender erfolgreicher Upload ist nicht bestätigt. Es lag kein offenes Testdokument beziehungsweise freigegebener Testnachweis zur Signatur vor. Die tatsächliche Signatur mit Speicherung und anschließender PDF-Ausgabe ist deshalb noch nicht durchgespielt. Für die Akademie fehlt eine zugewiesene Testschulung zur Prüfung des Lernabschlusses.

Die Migration `20261123103851_client_portal_device_token_format.sql` ist in der produktiven Datenbank angewendet und anhand des Testkontos bestätigt. Die neue Portaloberfläche ist noch nicht veröffentlicht. Der jüngste veröffentlichte Netlify-Stand enthält lokale Änderungen für NEO und Arbeitszeit, die nicht vollständig aus dem GitHub-Basiscommit hervorgehen. Die vorhandene Geräteverbindung zu diesem Quellordner ist offline.

Das Git-Bash-Paket erstellt aus dem gewählten vorhandenen App-Ordner eine getrennte Arbeitskopie. Es führt Änderungen gegen die mitgelieferte Basis zusammen, bricht bei Überschneidungen ab und prüft anschließend Funktionen, native Adapter, Motive und Typen. Der ursprüngliche Ordner bleibt erhalten. Das Paket veröffentlicht nichts. Nach der Zusammenführung ist der bestehende Netlify-Veröffentlichungsweg mit Erhalt der Funktionen zu verwenden.

## Befehle

`node scripts/verify-client-portal-night.mjs` führt die lokalen Freigabeprüfungen aus. `--types-only` begrenzt den Lauf auf TypeScript; `--skip-types` führt ausschließlich die übrigen Prüfungen aus.

Der vollständige projektweite TypeScript-Lauf überschritt das Speicherlimit dieser Arbeitsumgebung. Die geprüfte, reproduzierbare Prüfung umfasst sämtliche betroffenen Quelldateien und ihre vollständigen Importabhängigkeiten. Ein statischer DOM-Test ersetzt keine Layoutprüfung; die dokumentierten Browserprüfungen wurden getrennt durchgeführt.
