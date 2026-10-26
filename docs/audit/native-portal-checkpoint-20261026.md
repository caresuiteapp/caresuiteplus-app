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
