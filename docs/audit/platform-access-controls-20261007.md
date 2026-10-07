# Unternehmen und Konten deaktivieren und löschen

Stand: 07.10.2026. Ausgangspunkt: main 906746e7d11ce1eb4607adde0543658d740c743e.

Die Web-Mandantenakte bietet getrennte Aktionen für Sperren, Deaktivieren und
Löschen. Deaktivierte Unternehmen können reaktiviert werden. Gelöschte
Unternehmen erscheinen nur im entsprechenden Filter; Wiederherstellen holt
sie zunächst deaktiviert zurück. Die Löschung ist eine nachvollziehbare,
wiederherstellbare Entfernung aus der Verwaltung, keine endgültige Vernichtung
von Unternehmensdaten oder Nachweisen.

Einzelne Verwaltungskonten erhalten Deaktivieren, Reaktivieren, Löschen und
Wiederherstellen. Der vorherige Zustand bleibt erhalten. Ein gesonderter Filter
zeigt gelöschte Konten. Diese Vorgänge betreffen nur den Zugang zum gewählten
Unternehmen; Auth-Identitäten anderer Unternehmen werden nicht gelöscht oder
global gesperrt. Das letzte aktive Geschäftsführungskonto eines aktiven
Unternehmens wird geschützt. Plattformrollen ohne Schreibrecht erhalten keine
entsprechenden Schaltflächen und werden serverseitig abgewiesen.

Jede Änderung benötigt eine Begründung und den tatsächlich angezeigten
Datenstand. Deaktivieren und Löschen haben eine zusätzliche Texteingabe zur
Bestätigung. Laufende oder ungeklärte Kontoänderungen und laufender Mailversand
verhindern konkurrierende Änderungen. Ausstehende Willkommensmails des
deaktivierten/gelöschten Zugangs werden abgebrochen; der Versanddienst wird nicht
neu eingerichtet. Alle Änderungen werden mit Vorher/Nachher im Audit erfasst.

## Prüfstand

- 14 neue ausführbare Prüfungen der tatsächlichen TypeScript-Modelle,
  Verwaltungsdienste und Web-Anmeldeprüfung: bestanden.
- 10 bestehende Prüfungen der kostenlosen Plattform: bestanden.
- 22 PostgreSQL-Szenarien der engeren Datenbankfassung: bestanden. Originale
  Funktionskörper und die tatsächlichen Ergänzungen an Mandantenprüfungen wurden
  gegen ausschließlich temporäre Tabellen ausgeführt und vollständig
  zurückgerollt. Es wurden keine produktiven Kunden- oder Kontodaten verändert.
- TSX-Syntaxprüfung mit vorhandener Babel-Umgebung: bestanden.
- DOM-Interaktionen und echte Layoutprüfung in breiten/schmalen angemeldeten
  Ansichten: offen; die benötigten React-/DOM-Werkzeuge sind lokal nicht vorhanden.
  Vier zusätzliche Interaktionsfälle sind zur Ausführung mit den vorhandenen
  Projektabhängigkeiten ergänzt. Es wird nichts installiert.

## Produktiver Serverstand: ausstehend

Die SQL-Datei unter `supabase/pending/platform_tenant_access_controls.sql` ist
ein geprüfter Entwurf. Sie ist nicht produktiv angewandt und gehört bewusst noch
nicht in die automatische Migrationsfolge. Die automatische Freigabeprüfung
lehnte zunächst zusätzliche Regeln auf allen Mandantentabellen ab. Diese Regeln
wurden vollständig entfernt. Auch die engere Fassung wurde abgelehnt, weil die
produktiven Änderungen an Zugang, Portalprüfungen, E-Mail-Vorgängen und
Unternehmenslisten eine ausdrückliche Freigabe für diesen Umfang benötigen.

Die engere Fassung ergänzt die bestehenden Mandantenprüfungen und erhält deren
bisherige Auflösung. Sie fügt keine flächendeckenden Tabellenregeln hinzu.
Ihre neue Zugriffstabelle ist für reguläre Benutzer nicht direkt beschreibbar.
Die vorgesehenen Verwaltungsfunktionen prüfen Plattformrecht, Begründung,
Bestätigung, Unternehmen, Konto, Zustand und Änderungszeitpunkt im selben
Datenbankvorgang.

Eine Veröffentlichung der neuen Oberfläche bleibt bis zur ausdrücklichen
Serverfreigabe und dem anschließend bestätigten Serverstand gesperrt. Der
öffentliche Bereitstellungsnachweis enthält ausschließlich die Versionskennung.
Das Veröffentlichungspaket enthält keinen Befehl zur Ausführung der SQL-Datei.
Android wird nicht gebaut oder veröffentlicht. CareSuite bleibt kostenlos.
