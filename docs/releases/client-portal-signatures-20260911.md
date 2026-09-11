# Klientenportal: verpflichtender Unterschriftenhinweis und bestätigter Rücklauf

## Verhalten

- Bei offenen Unterschriften sperrt ein modaler Hinweis die anderen Portalseiten. Es gibt ausschließlich den Button „Zu den offenen Unterschriften“. Escape und Hintergrundklick schließen ihn nicht.
- Die Unterschriftenliste und zugehörige Dokumentdetails bleiben frei bedienbar. Nach einer Unterschrift bleibt das gerade bearbeitete Dokument zugänglich. Auf anderen Seiten erscheint der Hinweis erneut, solange weitere Aufgaben offen sind.
- Kontowechsel löschen den vorherigen Hinweiszustand. Erfolgreiche Signaturen aktualisieren die Liste sofort; Echtzeitabfragen und regelmäßiges Nachladen ergänzen die Aktualisierung.
- Portalnachweise werden vollständig paginiert und anhand ihrer ID mit dem aktuellen Nachweis zusammengeführt. Fehler einzelner Datenquellen werden nicht als leere oder vollständige Liste ausgegeben.
- Ein gespeicherter Signaturversuch kann ohne erneutes Zeichnen fertiggestellt werden. Das signierte PDF wird vor dem abschließenden Statuswechsel erstellt und hochgeladen.
- Eine Datenbanktransaktion bestätigt Signatur, PDF, Portal-Dokument und Ausführungsstatus gemeinsam. Der Nachweis steht danach in der Verwaltung zur Prüfung. Doppelte Fertigstellung überschreibt keinen bestätigten Vorgang.
- Unterschriebene Anfragen verschwinden aus „Offen“. Die Dokumente und Unterschriften bleiben als Nachweis erhalten. Vorlagen mit noch ausstehenden Verwaltungsunterschriften werden nicht als vollständig unterschrieben ausgegeben; die bereits erledigte Klientenunterschrift bleibt erledigt.
- Vertretungsfelder und Familienportalrollen werden bei den offenen Dokumenten berücksichtigt.

## Technischer Umfang

Neue `.web`-Varianten erhalten die bestehende Android-Oberfläche. Die Migration ergänzt die bestätigten Portalaktionen, Zugriff auf eigene Signaturbilder und die Fertigstellung älterer unvollständiger PDF-Rückläufe. Sie ändert keine bestehenden Nachweise pauschal.

Pflicht vor dem Web-Rollout: `supabase/migrations/20260911120000_client_portal_signature_completion.sql` muss angewendet sein. Die Web-Version ruft die neuen Datenbankfunktionen auf.

## Verifikation

Ergebnis: **96 Tests in 12 Suites bestanden**, davon 19 PostgreSQL-Transaktionstests. Die projektweite Typprüfung meldet bestehende Fehler außerhalb dieser Änderung; in den neuen Dateien wurden keine Typfehler festgestellt.

Die gezielten Tests umfassen Dialogbedienung, Kontowechsel, sofortige Aktualisierung, Pagination mit 620 Einträgen bei einem Serverlimit von 75, Portal-/Nachweisabgleich, PDF-/Upload-/RPC-Fehler und wiederholte Fertigstellung. PostgreSQL-Tests mit der bereits vorhandenen PGlite-Abhängigkeit prüfen die tatsächliche Migration in einer isolierten Datenbank: Transaktionen, Rückrollen, Mandanten-/Klientenzuordnung, zurückgezogene Freigaben, Signaturgültigkeit, geänderte Dokumente, Vorlagenunterschriften und Wiederherstellung alter PDF-Rückläufe. Die Test-Authentifizierungsfunktionen und das Schema sind isolierte Fixtures; sie ersetzen keine Prüfung der produktiven Konten und Policies.

Sichtprüfung des echten neuen Dialogs mit dem vorhandenen Browser und Century Gothic: 1440 × 1000, 390 × 844, sowie 390 × 844 mit 150 % App-Schriftgröße. Screenshots wurden visuell geprüft. Kein horizontaler Überlauf, Aktion erreichbar, Fokus im Dialog, Escape/Hintergrund blockiert. Die Umgebung hinter dem Dialog ist eine Testoberfläche; ein authentifizierter Produktivdurchlauf ist noch offen.

## Produktivabgleich am 11.09.2026

Die Produktivmigration wurde nach ausdrücklicher Freigabe gezielt angewendet und in der Migrationshistorie erfasst. Der Abgleich berücksichtigt die tatsächliche Audit-Tabelle, das SHA-256-Präfix der Anwendung und die produktiven Terminspalten. Transaktionstests verwenden die reale Prüfsummenfunktion und den produktiven Audit-Feldvertrag.

Die aktiven verknüpften Portalkonten des betroffenen Mandanten wurden lesend unter den tatsächlichen Datenbank-Zugriffsregeln geprüft. Fremde Nachweise waren nicht sichtbar; die erwarteten offenen Nachweise waren erreichbar. Die Prüfung schließt Datensätze ohne verknüpfte Anmeldung nicht als funktionsfähige Portalzugänge ein.

Eine veraltete offene Anforderung zu einem stornierten Einsatz wurde nach erneuter Zustandsprüfung mit Audit-Eintrag zurückgenommen. Alte Portal-Dokumente können stornierte oder zurückgezogene Nachweise nicht wieder als offene Aufgaben einblenden. Ein Altfall mit vorhandener, nicht eindeutig zugeordneter Unterschrift bleibt zur fachlichen Prüfung erhalten; es wurde keine Ersatzunterschrift erzeugt oder eine vorhandene Unterschrift ungeprüft übernommen.

Ein echter Signaturabschluss durch einen Klienten im produktiven Browser wurde nicht stellvertretend durchgeführt. Die belastbaren Nachweise sind gezielte Funktions-/Transaktionstests, echte Browserprüfung der Oberfläche und lesende Prüfung der produktiven Kontozuordnung, Freigaben und Berechtigungen.
