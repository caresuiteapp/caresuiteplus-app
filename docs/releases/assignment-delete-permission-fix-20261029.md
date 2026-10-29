# Einsatzlöschung: bestehende Verwaltungsrechte erkennen

Ein aktiver Inhaberzugang hatte den älteren Modulschlüssel `assignments` mit `can_update=true`. Die bestehende private Rollenprüfung erkannte nur den exakten Schlüssel `assist.assignments.manage`. Dadurch lehnte `delete_assist_visit` einen berechtigten Verwaltungszugang ab.

Die Rollenprüfung und das gemeinsame Web-/App-Rechte-Repository übersetzen jetzt ausschließlich die älteren Einsatzflags: `can_view` nach `assist.assignments.view`, `can_update` nach `assist.assignments.manage`. Das entspricht dem bestehenden Manage-Vertrag von `public.has_permission`. `can_delete` allein erteilt kein Verwaltungsrecht. Exakte Rechte bleiben unabhängig von alten Modulflags gültig. Mandantenbezogene Ersetzungen, ausdrückliche Mitarbeitenden-Sperren, aktive Identität und Zuständigkeitsgrenzen bleiben wirksam. Fremde Mandanteneinträge fließen nicht in die clientseitige Zuordnung ein.

Die Löschroutine selbst und ihre Transaktion für Einsatz, explizit verknüpften Alt-Datensatz und Budgetfreigabe bleiben unverändert. Es werden keine Rollen, Konten oder Fachdaten angepasst und keine Tabellen- oder Funktionsrechte erweitert.

## Nachweise

- Der Fehler wurde vor dem Fix durch den neuen Funktionstest und den echten Rollenlesetest reproduziert.
- 78 Funktionsprüfungen und 30 isolierte PostgreSQL-Prüfungen bestanden, einschließlich atomarer Löschung/Budgetfreigabe, Leserechten, fremdem Mandanten, expliziter Sperre, eingeschränkter Zuständigkeit und Portalzugang.
- Native-Abgleich: 1.111 Module, 269 Routen, keine veraltete generierte Datei.
- Produktive Migration `20261029172100_assignment_legacy_manage_permission` über die bestehende Supabase-Verbindung angewendet. Die private Funktion bleibt für `anon` und `authenticated` direkt gesperrt; vorhandene geschützte Aufrufer verwenden sie weiterhin.
- Produktionsprüfung mit lokal begrenztem Anfragekontext: korrekter Mandant, aktives Verwaltungsprofil, unbeschränkte Zuständigkeit und `assist.assignments.manage` jeweils bestätigt. Dabei wurden keine realen Einsätze gelöscht.
- Vorhandene allgemeine Security-Advisories sind unverändert. Die bestehende entfernte Testumgebung enthält die ältere Firmen-Berechtigungsfunktion nicht; sie wurde für diesen Fix nicht umgebaut. Der vollständige Löschablauf wurde mit synthetischen Datensätzen in der vorhandenen PGlite-Prüfung ausgeführt.

Der Webstand wird veröffentlicht. Dieselbe Quelltextkorrektur wird für das nächste ausdrücklich angeforderte App-Paket gesammelt; dieser Fix erzeugt kein weiteres Android-Paket.
