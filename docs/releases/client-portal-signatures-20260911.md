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

Ergebnis: **95 Tests in 12 Suites bestanden**, davon 19 PostgreSQL-Transaktionstests. Die projektweite Typprüfung meldet bestehende Fehler außerhalb dieser Änderung; in den neuen Dateien wurden keine Typfehler festgestellt.

Die gezielten Tests umfassen Dialogbedienung, Kontowechsel, sofortige Aktualisierung, Pagination mit 620 Einträgen bei einem Serverlimit von 75, Portal-/Nachweisabgleich, PDF-/Upload-/RPC-Fehler und wiederholte Fertigstellung. PostgreSQL-Tests mit der bereits vorhandenen PGlite-Abhängigkeit prüfen die tatsächliche Migration in einer isolierten Datenbank: Transaktionen, Rückrollen, Mandanten-/Klientenzuordnung, zurückgezogene Freigaben, Signaturgültigkeit, geänderte Dokumente, Vorlagenunterschriften und Wiederherstellung alter PDF-Rückläufe. Die Test-Authentifizierungsfunktionen und das Schema sind isolierte Fixtures; sie ersetzen keine Prüfung der produktiven Konten und Policies.

Sichtprüfung des echten neuen Dialogs mit dem vorhandenen Browser und Century Gothic: 1440 × 1000, 390 × 844, sowie 390 × 844 mit 150 % App-Schriftgröße. Screenshots wurden visuell geprüft. Kein horizontaler Überlauf, Aktion erreichbar, Fokus im Dialog, Escape/Hintergrund blockiert. Die Umgebung hinter dem Dialog ist eine Testoberfläche; ein authentifizierter Produktivdurchlauf ist noch offen.

## Offener Freigabeschritt

Die automatische Sicherheitsprüfung hat `vercel env pull` abgelehnt, weil damit produktive Umgebungsvariablen einschließlich möglicher Zugangsdaten abgerufen würden und diese Freigabe fehlt. Keine produktiven Umgebungsvariablen wurden abgerufen, keine Migration angewendet und kein produktiver Signaturvorgang verändert.

Nach Freigabe: erforderliche produktive Verbindung sicher auflösen, Ist-Zustand aller Klienten des betroffenen Mandanten lesend prüfen, Schema und Policies mit der Migration abgleichen, Migration anwenden, Web-Version veröffentlichen und den Live-Stand verifizieren. Echte Klientenunterschriften werden nicht zu Testzwecken erzeugt.
