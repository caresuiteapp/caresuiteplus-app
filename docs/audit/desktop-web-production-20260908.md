# Desktop/Web: Produktionsveröffentlichung am 08.09.2026

## Veröffentlichter Stand

Der Nutzer hat Push in das öffentliche Repository und Veröffentlichung auf caresuiteplus.app einschließlich der erforderlichen Supabase-Anpassungen ausdrücklich bestätigt. Der geprüfte Anwendungsstand `5e19a606f18692d716cfcad0f2a45a5197091c39` wurde auf den Feature-Zweig und per Fast-forward auf `main` gepusht.

- Bestehendes Vercel-Projekt: `caresuiteplus-app`; produktive Domain: https://caresuiteplus.app.
- Anwendungsdeployment: `dpl_2aPNcneFTN9vffRF1mATovqYqcTQ`, Status `Ready`, Ziel `production`.
- Vercel meldete die Veröffentlichung am 08.09.2026 um 06:49:04 UTC abgeschlossen. Die Domain zeigte bei der Prüfung auf dieses Deployment; alle drei bestehenden GitHub/Vercel-Statusprüfungen waren erfolgreich.
- Vorheriges Web-Deployment für eine gegebenenfalls notwendige Rückkehr: `dpl_HSpPM4tBqZ7NRaGCVRAfCEo4kiKc`. Es wurde keine Rückkehr ausgeführt. Eine reine Web-Rückkehr setzt keine Datenbankänderungen zurück.
- Die nachfolgende Fortschreibung dieses Berichts ändert ausschließlich Dokumentation; der oben genannte Commit bezeichnet den geprüften Anwendungsstand.

## Server und bestehende Daten

Die vier Migrationen `20260907170000`, `20260907171000`, `20260907172000` und `20260907173000` wurden auf dem bestehenden Supabase-Produktionsprojekt gemeinsam in einer Transaktion angewendet und in dessen Migrationshistorie eingetragen. Anschließend wurden Historie, Tabellenrechte, RLS und der private Anhangs-Bucket erneut aus dem Katalog gelesen.

Vor der Veröffentlichung wurde eine Kollision mit der bereits vorhandenen älteren Tabelle `support_tickets` erkannt und behoben. Der neue Web-Support verwendet `support_workspace_tickets`; seine Fremdschlüssel, Richtlinien, RPCs und Realtime-Anmeldung verwenden diesen Namen. Die bestehende ältere Tabelle, ihre drei Tickets und ihre verknüpften Nachrichten/Anhänge bleiben erhalten. Die drei Tickets wurden nicht automatisch in den neuen Arbeitsbereich übernommen; dessen anfänglicher Bestand ist leer. Der zusätzliche SQL-Regressionstest prüft den Erhalt eines älteren Tickets mit verknüpfter Antwort bei Anwendung der neuen Migrationen.

Die Registrierungsfunktion `register-business-tenant` ist in Version 13 aktiv. Ihr bereits zuvor öffentlicher Zugang vor der Anmeldung bleibt unverändert (`verify_jwt=false`, auch in Version 12). Die neue atomare Datenbankprozedur zur Einrichtung eines Unternehmens ist ausschließlich für `service_role` ausführbar. Frühere Funktionsdefinitionen und die bisherige Edge-Funktion wurden vorab außerhalb des Repositorys lokal gesichert.

Die fünf neuen Support-Tabellen verwenden RLS. Anonyme Lesezugriffe sowie direkte authentifizierte INSERT-/UPDATE-Zugriffe sind gesperrt; Änderungen erfolgen über die dafür vorgesehenen Berechtigungsprüfungen. Der Bucket `support-ticket-attachments` ist privat. Es wurden keine Testkonten oder Testtickets in Produktion angelegt.

## Verifikation

- Vorbereitende Prüfungen: 41 Desktop-/Intro-Tests, vollständige TypeScript-Prüfung, Expo-Web-Export und DOM-Vorschauprüfungen erfolgreich; deren Aussagegrenzen stehen im [R4-Prüfbericht](desktop-home-intro-20260908.md).
- Ergänzende Veröffentlichungsprüfung: 33 Registrierungs-/Unternehmens-/Support-Tests und 14 SQL-Prüfungen erfolgreich, einschließlich der Verträglichkeit mit dem älteren Support-Bestand.
- Registrierungs-HTTP-Prüfung: GET liefert 405; ein ungültiger leerer POST liefert 400 mit der neuen Eingabevalidierung. Dabei wurde kein Konto angelegt.
- Anonymer Aufruf von `support_list_tickets`: HTTP 401 mit Datenbankcode 42501; Zugriff verweigert.
- Öffentliche Web-Prüfung am 08.09.2026 um 06:50 UTC: `/`, `/auth/register`, `/auth/business-login` und `/support` liefern HTTP 200 und den neuen Intro-Inhaltsrahmen. Die Startseite enthält außerdem die Intro-Ebene.
- Das tatsächlich ausgelieferte Bundle `entry-f154f8e0ff9cd3c20f7338820da6b68f.js` enthält den Web-Intro-Ablauf und den neuen Support-Tabellennamen.
- Alle sechs vom Live-Bundle referenzierten MP4-Dateien liefern HTTP 200 und `video/mp4`. Ihre SHA-256-Prüfsummen stimmen jeweils mit den ursprünglichen App-Dateien überein. Sie wurden weder umkodiert noch ersetzt.

## Verbleibende Prüfgrenzen

Die Auslieferung ist bestätigt. Die gerenderte Desktop-Anordnung sowie tatsächliche Video-/Tonwiedergabe und Autoplay-Verhalten im Browser sind noch nicht visuell bestätigt. HTTP- und DOM-Prüfungen belegen dies nicht. Auch angemeldete Endabläufe der Registrierung und des Supports mit getrennten Rollen, privaten Uploads und zeitabhängigen Freigaben bleiben offen. HTTP 200 auf einer SPA-Route ist keine vollständige Funktionsprüfung dieser Ansicht.

Die fertige Android-Oberfläche, ihre Intro-Datei und die Video-Originale wurden nicht geändert. Kein Android-Build wurde ausgelöst. Es wurden keine zusätzlichen lokalen Werkzeuge, keine Docker-Umgebung und keine neue Infrastruktur eingerichtet. Die Veröffentlichung erfolgte mit den bereits vorhandenen Verbindungen und dem bestehenden Vercel-Git-Deployment.
