# Staging-Rechtemigration vom 13. Oktober 2026

Nach ausdrücklicher Nutzerbestätigung wurde die vorbereitete Rechtemigration auf `caresuiteplus-staging` angewendet. Supabase registrierte Version `20261013022501`; die gleichnamige Repositorydatei enthält unverändert das angewendete SQL. Produktion wurde nicht verändert.

## Tatsächliche Prüfung

- Beide neuen öffentlichen Funktionen vorhanden.
- Direkte UPDATE-Rechte für authenticated auf id, tenant_id, role_id, auth_user_id, status und is_active entzogen. first_name bleibt bearbeitbar.
- RLS auf clients, employees, employee_documents und storage.objects aktiv.
- Vier generated_pdf-Policies vorhanden und restriktiv.
- Anonyme Rollenänderung nicht ausführbar; angemeldete Ausführung vorhanden, zusätzliche interne Autorisierung erforderlich.
- Upload-Bereitschaft ohne Anmeldung false; mit synthetischem JWT-Sub true. Die technische Bereitschaft ist keine Berechtigung für einen konkreten Upload.
- Synthetischer, nicht zugeordneter Office-Akteur false; fremder PDF-Pfad false; client_reader NULL (SQL-RLS verweigert damit Zugriff). Transaktion vollständig zurückgerollt; keine Geschäfts-/Auth-/Storage-Testdatensätze angelegt.

## Offene Nachweise

Keine echte Portal-, Upload- oder Rollenverwaltungsprüfung mit freigegebenen Testkonten; keine Parallelprüfung. Sicherheitsberater meldet weiterhin 1 SECURITY-DEFINER-View, 3 veränderliche Funktionssuchpfade, 52 anon- und 86 authenticated-ausführbare SECURITY-DEFINER-Funktionen, 46 Tabellen ohne RLS-Policy sowie deaktivierten Passwort-Leakschutz. Ausführbarkeit allein belegt keinen ungeschützten Funktionskörper; diese Meldungen sind keine vollständige Einzelfallbewertung.

Diese Migration schließt weder sämtliche alten Serverbefunde noch die fehlenden atomaren Signatur-/Aufnahmeabschlüsse. Gesamtauftrag und Produktionsübernahme sind nicht als abgeschlossen belegt.
