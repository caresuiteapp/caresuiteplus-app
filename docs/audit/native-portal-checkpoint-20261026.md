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

Die vollständige Typprüfung auf CI 147 bestand auf Commit `9f58b4419af4c97d9a761e7bd18d3edf3d98051c`. Die nachfolgenden Willkommens- und Alias-Einstiegsänderungen sind davon noch nicht erfasst. Der breite Regressionstest ist nach Wiederherstellung noch nicht abschließend dokumentiert. Der lokale erste Typprüfungslauf wurde wegen Ressourcenbelastung beendet und zählt nicht als bestanden.

Offen bleiben insbesondere alle nicht ausgeführten Seiten-/Zustands-/Interaktionsfälle, echte Android-Navigation und Absturzprüfung, visuelle Abnahme sämtlicher Ansichten sowie kompatible serverseitige Freigaben und autorisierte Schreib-/Rückleseprüfungen. Die bisherigen Datenbankentwürfe sind keine produktiv freigegebenen Migrationen.
