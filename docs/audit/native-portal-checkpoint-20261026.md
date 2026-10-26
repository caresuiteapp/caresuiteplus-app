# Portalprüfung am 26.10.2026 – keine Releasefreigabe

Der Android-Bau bleibt in `.github/workflows/android-aab.yml` durch `if: ${{ false }}` gesperrt. Keine Veröffentlichung, keine produktive Datenbankänderung.

## Wiederhergestellter Stand

Die lokale Arbeitsumgebung wurde zurückgesetzt. Der gesicherte Quellstand `dfebc68897dbe66b05e13a9573ae9ed5e2618c80` wurde aus GitHub wiederhergestellt. Frühere ungesicherte Änderungen und lokale Nachweise dürfen nicht als vorhanden oder bestanden gelten.

## Erneut geprüfte Änderungen

- PDF-Schnittstelle wird erst bei einer angeforderten PDF-Aktion aufgelöst. Fehlende/unvollständige Erweiterungen scheitern vor temporären Dateien mit verständlichem Fehler. Sechs ausführende Tests bestehen; sie belegen keinen Android-PDFBox-Lauf und keine Ursache des ausgelieferten Absturzes.
- Dokument-Download nutzt einen konstanten, exakt typisierbaren SELECT. 15 echte Serviceprüfungen bestehen, einschließlich normaler Dokumente ohne Nachweis-Einstellungszugriff.
- Vier alte Erwartungen wurden gegen die aktuellen Menü- und Schutzgrenzen abgeglichen. Zusammen mit den Serviceprüfungen: 35 Prüfungen bestanden.
- Willkommensdialog verwendet explizit eine helle Firmenfläche und dazu passende Textfarben statt außerhalb des Dialogs bestimmter Hintergrundfarben. Alte Produktbezeichnung ersetzt. Komponentenprüfung mit nativen Hostgrenzen bestanden; sichtbares Layout noch nicht abgenommen.
- Alte Angehörigen-Einstiege erreichen das bestehende Klient:innenportal. Bekannte Bereichslinks behalten das kanonische Nachrichten-, Dokument- oder Fahrtenbuchziel. Sieben ausgeführte Layout-Weiterleitungsprüfungen bestanden. Zielseitige Rollen-/Freigabeprüfungen bleiben bestehen.

## Oberflächenprüfung und offene Grenzen

Die stabile Inventur enthält 692 Android-Seiten und 44 Layouts, 0 strukturelle Dateiauswahlfehler und 0 ungültige Katalogziele. 31 statisch nicht sicher ausgewertete Redirectketten und 461 nicht aufgelöste Navigationsausdrücke bleiben Untersuchungsaufträge, keine Laufzeitfehlerbeweise und keine Freigaben.

Der vollständige Portal-Prüfadapter umfasst weiterhin nur 65 Fälle. CI 146 erreichte vor der nativen Kartenbibliothek keine React-Oberfläche. CI 147 erreichte React, scheiterte dann am unvollständigen Realtime-Prüfvertrag und am fehlenden Browseralias für `global`. Diese Läufe belegen keine Designfreigabe. Gerätegrenzen werden exakt bezeichnet und bei einer angeforderten Operation abgewiesen; es werden keine Karten- oder PDF-Ergebnisse vorgetäuscht. Realtime-Abonnements sind in diesen isolierten Browserfixtures deaktiviert.

Die vollständige Typprüfung auf CI 147 bestand auf Commit `9f58b4419af4c97d9a761e7bd18d3edf3d98051c`. Die nachfolgenden Willkommens- und Alias-Einstiegsänderungen sind davon noch nicht erfasst. Der breite Lauf beendete 4.961 Prüfungen: 4.960 bestanden, eine Artefaktprüfung überschritt unter Last die gesetzte 15-Sekunden-Grenze. Genau dieser Fall bestand isoliert in 1,7 Sekunden. Der kombinierte Lauf bleibt als Lauf mit einer Abweichung dokumentiert. Der lokale erste Typprüfungslauf wurde wegen Ressourcenbelastung beendet und zählt nicht als bestanden.

Offen bleiben insbesondere alle nicht ausgeführten Seiten-/Zustands-/Interaktionsfälle, echte Android-Navigation und Absturzprüfung, visuelle Abnahme sämtlicher Ansichten sowie kompatible serverseitige Freigaben und autorisierte Schreib-/Rückleseprüfungen. Die bisherigen Datenbankentwürfe sind keine produktiv freigegebenen Migrationen.

## Erste vollständige Verwaltungsoberflächen in CI 148

Das SHA-256-geprüfte Verwaltungsartefakt `12661360900` (5.400.941 Byte, `d1bebbfc6356980079a9480075d5b6945e2bd0adbeaac97a93c46d6e80eacafd`) enthält 27 tatsächlich aufgebaute Seitenaufnahmen: 18 ohne spezielle Zieltextprüfung und neun mit bestandener Zieltextprüfung. Alle erwarteten Empfänger und Navigator-Ebenen wurden erreicht; kein Renderfehler/keine Seitenüberbreite in diesen 27 Fällen. Dies ist weiterhin keine vollständige Funktions- oder Designfreigabe.

Die Akte wurde bei 320 und 1280 Pixeln manuell angesehen. Bei 320 Pixeln drückte der Zurück-Knopf die Überschrift in einen zu schmalen Restbereich, sodass die letzte Letter allein umbrach. Der gemeinsame native ScreenHeader gibt der Überschrift auf schmalen Flächen nun eine volle Zeile; die geänderte Darstellung muss erneut gerendert werden. Im Aktivitätenfall fehlen weiterhin genaue Vorschau-Datenverträge; die sichtbare Fehleranzeige bleibt offen.

Im Klient:innen-/Angehörigenartefakt von CI 148 wurden 96 Fälle ohne spezielle Zieltextprüfung aufgenommen, 33 scheiterten und drei erreichten eine absichtlich nicht ausgeführte Gerätegrenze. Die Fehler betreffen noch unvollständige direkte Realtime-Prüfverträge und eine im Adapter fehlende reine Beschriftungsfunktion. Die 102 Mitarbeitendenfälle scheiterten vor der Zielseite am fehlenden Vertrag für den dort ausdrücklich deaktivierten Klient:innen-Einstellungshook. Diese Ursachen wurden im Adapter eingegrenzt; neue Aufnahmen stehen aus. Kein vollständiges Portal gilt damit als abgenommen.

Bei den aufgebauten Klient:innen-Einsatzansichten waren die normalen Beschriftungen in der unteren 320-Pixel-Navigation unnötig mitten im Wort umgebrochen. Sichtbare Kurzbezeichnungen (Start, Dateien, Chats) ersetzen dort die langen Texte; zugängliche vollständige Bezeichnungen und Seitenziele bleiben unverändert. 14 bestehende Prüfungen für Portalnavigation, Zugriff und Viewport bestehen danach. Neue Bildprüfung steht aus.

Die aufgebaute Angehörigennavigation bot außerdem Budget an, obwohl die direkte Budgetansicht für Angehörige mangels definierter Freigabe gesperrt ist. Die Navigation blendet dieses Ziel nun ebenfalls aus; für freigegebene Klient:innen bleibt es verfügbar. 13 Prüfungen von Navigation und direkter Budgetgrenze bestehen. Technische Breadcrumb-Segmente billing, service-records, timeline und personnel erhalten verständliche Beschriftungen.

## CI 149

Verwaltung erneut erfolgreich; die korrigierte Aktenüberschrift wurde bei 320 Pixeln und 360 Pixeln mit 1,6-facher Schrift manuell kontrolliert. Das Klient:innen-/Angehörigen-Prüfprogramm beendet seinen Lauf erfolgreich; dies bedeutet weiterhin nur aufgebaute synthetische Empfänger, keine vollständige Interaktions-, Datenbank- oder Geräteabnahme. Der Mitarbeitendenlauf enthält 72 aufgenommene Fälle ohne spezielle Zieltextprüfung, drei mit bestandener Zieltextprüfung, drei Gerätegrenzen, sechs unvollständige Datenverträge, sechs noch falsch als blockiert eingestufte erlaubte Aliasse und zwölf Fehlerfälle.

Die Einsatzvorschau-Fiktion fehlte am vorgeschriebenen tasks-Array; der Unterschriftsfiktion fehlten captures/nextSignerRole. Die Präsentationsverträge wurden am tatsächlichen Komponentenbedarf ergänzt. Das defekte Begleiterbild war eine CJS/ESM-Assetgrenze des Browseradapters (Metro liefert native Assetreferenzen); der Adapter übernimmt nun beide Importformen richtig. Standort-/Ausführungsaktionen bleiben ungeprüfte Gerätegrenzen. Erlaubte Schedule-/Signatures-Aliasse werden gegen ihren konkreten kanonischen Empfänger und dessen Layoutanzahl geprüft, nicht gegen einen unmöglichen unveränderten Aliasempfänger. Neue Ausführung steht aus.

Das Klient:innen-/Angehörigenartefakt 149 wurde anschließend SHA-geprüft: 126 aufgebaute Fälle ohne spezielle Zieltextprüfung und sechs nicht ausgeführte Biometrie-Gerätegrenzen, keine fehlgeschlagenen Fälle. SHA-256 `986d2551dcacb7681459578d385211444c698de16ca61fd675df57bde774431e`, 18.334.691 Byte.

## Fortsetzung nach dem Verbindungsabbruch: CI 150 und Standort-Start

CI 150 auf `5210a87e42cc8ce8ddb372b4e1f701cd0091e0f8` ist beendet. Der bisherige native Web-Abgleich einschließlich TypeScript besteht; Verwaltung und Klient:innen-/Angehörigenansichten werden erfolgreich aufgebaut. Der Mitarbeitendenlauf scheitert weiterhin. Sein SHA-256-geprüftes Artefakt `12663082695` enthält 102 Fälle: 78 Aufnahmen ohne Zieltextprüfung, drei mit bestandener Zieltextprüfung, neun nicht ausgeführte Gerätegrenzen, sechs fehlende Datenverträge und sechs fehlgeschlagene Fälle. ZIP: 14.540.586 Byte, SHA-256 `7b4e16efb48455df6cfdef1182ca04dd9b0cbc37c9d27873e48a7e420c917ca0`.

Die tatsächliche Standort-Initialisierung der Einsatzansicht hatte zwei unbehandelte Promise-Ablehnungen: Geräteberechtigung und Einwilligungsabfrage. Ein gemeinsamer Starthelfer behandelt beide unabhängig. Nicht verfügbare Standortberechtigung bleibt als nicht verfügbar erkennbar; eine fehlgeschlagene Einwilligungsprüfung gibt keine Einwilligung frei und erscheint als Hinweis. Verspätete Ergebnisse verändern nach Einsatz-/Kontowechsel weder aktuellen Status noch Einwilligungsspeicher. Mitarbeitenden-Einwilligung wird im Hook ihrem vollständigen aktuellen Kontext zugeordnet.

Sieben ausführende Tests dieses Helfers bestanden lokal vor dem Ausfall der Arbeitsumgebung. Sie prüfen native Ablehnung, synchronen/asynchronen Transportfehler, den bestätigten Einwilligungs-Fallback, verspätete Ergebnisse und fehlgeschlagene Bestätigung. Der danach begonnene vollständige Typprüflauf hat wegen des Umgebungsausfalls kein belegtes Ergebnis.

Die isolierten Präsentationsdaten für Arbeitszeit, Zeitkonto, Einsatzzeiten, Einsatzdurchführung und persönliche Dokumentunterschrift werden anhand ihrer echten Verbraucherverträge ergänzt. GPS, Kamera, PDFBox und serverseitige Speicherung werden weiterhin nicht als erfolgreich simuliert. Die neue Ausführung steht aus. Fehlende Prüfdaten und nicht erreichte Zielseiten lassen den Prüfjob künftig fehlschlagen. Sein Name bezeichnet vorbereitete Portalansichten, da die 65 Fälle weiterhin keine vollständige Abdeckung aller 692 Seiten darstellen.

Der neue Helfertest ist in die bestehende CI-Kette aufgenommen. Android-Bau und Veröffentlichung bleiben gesperrt. Keine produktiven Daten wurden geändert.

Beim manuellen Aktualisieren wird auch die optionale Standort-Initialisierung erneut angestoßen. Alte Hinweise werden vor der neuen Prüfung verworfen.

Die Mobilitätsauswahl nutzt bei abgewiesenem Serverlesen weiterhin ihren nach Mandant, Mitarbeitenden und Einsatz getrennten lokalen Speicher. Ein abgewiesener Server-Schreibaufruf meldet eine lokal bereits gesicherte Auswahl ausdrücklich als noch nicht synchronisiert. Scheitert der lokale Schreibvorgang selbst, wird weiterhin kein Speichererfolg gemeldet. Sieben weitere ausführende Regressionstests sind vorbereitet; ihre Ausführung erfolgt im bestehenden CI-Lauf. Vier isolierte Prüfungen der Methoden mit ersetzten Speicher-/Transportgrenzen bestanden zusätzlich, ohne TypeScript- oder Gerätenachweis zu ersetzen.

Die Oberflächenprüfung gibt Fallzahlen und konkrete ungelöste Fälle jetzt auch im Jobprotokoll aus. Dadurch bleibt der Prüfstand bei einem erneuten Ausfall der lokalen Arbeitsumgebung lesbar.

## CI 152 und zusätzliche Rollenprüfung

Auf `03df9091e99be362f9a30f7afa9e912ff6e6f6d5` bestehen die 14 neuen ausführenden Standort-/Mobilitätstests sowie die beiden bestehenden Gruppen mit 186 und 210 Prüfungen. TypeScript findet zwei Aufrufstellen eines bei der Aufteilung zu früh entfernten Imports; der gemeinsame Import wird wiederhergestellt. Dieser Lauf zählt deshalb nicht als bestandene vollständige Prüfung.

Verwaltung: 27 Fälle ohne ungelöste Befunde. Klient:innen/Angehörige: 132 Fälle, davon 126 gerendert und sechs nicht ausgeführte Biometriegrenzen, ohne ungelöste Befunde. Mitarbeitende: 102 Fälle, davon 78 ohne spezielle Zieltextprüfung, zwölf mit bestandener Zieltextprüfung, neun Gerätegrenzen und drei fehlgeschlagene Zieltextprüfungen. Letztere erwarten in der Einsatzdurchführung einen dort nicht angezeigten Leistungstitel. Tatsächlich gerendert sind Klient:in, Einsatzvorschau, Mobilitätsauswahl und Anfahrtaktion; keine unbehandelte Ablehnung und keine fehlenden Datenverträge. Die Prüfung erhält dafür konkrete Erwartungen auf diese vorhandenen Inhalte. Die drei Größen bleiben unverändert Teil des nächsten Laufs.

Read-only-Katalogprüfung: Produktion hat beide Tabellen `employee_location_consents` und `employee_visit_mobility_selections` mit RLS, Policies und authentifizierten Rollengrants. In Staging fehlt die Mobilitätstabelle; die Katalogprüfung beweist keine benutzerbezogene Speicherung oder Portal-Authentifizierung.

Die Produktionsdefinition von `employee_logbook_own_employee` erlaubt jeden gleichmandantigen Kontext, der nicht als aktiver Mitarbeitendenportal-Kontext erkannt wird. Die vorbereitete SQL-Korrektur schließt Klient:innen- und Angehörigenrollen ausdrücklich aus und lässt inaktive Mitarbeitendenportal-Kontexte nicht in den Geschäftskontenzweig fallen. Die zusätzliche Office-Lesepolicy für Standort-Einwilligungen schließt auch Angehörige aus. Der Quellpatch liegt in `supabase/patches/employee_logbook_portal_role_boundary.sql`; er ist keine generierte Migration und wurde nicht produktiv angewendet.

Zehn vorbereitete PGlite-Prüfungen führen die echten SQL-Funktionen und RLS-Policies in einer isolierten PostgreSQL-Instanz aus. Sie reproduzieren die alte Rollenlücke und prüfen anschließend Lesen/Schreiben, eigene Mitarbeitendenzeilen, Mandantengrenze und Mitgliedschaft. Deren Ausführung und die korrigierte Gesamtprüfung stehen aus. Keine produktiven Datensätze, Policies oder Migrationen wurden geändert.

Die anschließende Katalogprüfung fand denselben negativen Rollenvergleich auch in direkten Fahrzeug-, GPS-Punkt-, Beleg- und weiteren Fahrtenbuchpolicies. Der SQL-Entwurf ergänzt daher restriktive Zugriffspolicies für zehn Tabellen mit Mitarbeitendenbezug und eine Geschäftskontengrenze für interne Auditereignisse. Bestehende permissive Status-/Eigentumsregeln müssen eine Aktion weiterhin erlauben; die zusätzlichen Policies erteilen keine neue Aktionsfreigabe. Geschäftskonten behalten Firmenfahrzeuge ohne persönliche Mitarbeitendenzuordnung.

Die isolierten SQL-Prüfungen werden auf 20 Fälle erweitert. Direkte permissive Altregeln werden im Test bewusst mitgeführt, damit eine reine Änderung des gemeinsamen Helpers die Prüfung nicht bestehen könnte. Geprüft werden alle zusätzlichen Tabellengrenzen, abgewiesenes Lesen/Schreiben, inaktive Mitarbeitendenzugänge und weiterhin erlaubte berechtigte Zugriffe. Auch dieser erweiterte Entwurf ist nicht produktiv angewendet. Die Anwendungsquellen bleiben gegenüber `f6550427e6fd93b75a62563e5be9ac9d94945574` unverändert.
