# Persönlicher Akademiezugang für Angehörige

Status am 21.10.2026: Die Supabase-Migrationshistorie bestätigt die produktiv angewandten Migrationen `20261021113810_academy_family_foundation`, `20261021114233_academy_workspace` und `20261021115100_academy_gateway_hook_upgrade_compatibility`. Die exakten SQL-Stände liegen unter `supabase/migrations`. Alle 19 betroffenen Edge-Funktionen sind veröffentlicht und haben den Status `ACTIVE`, einschließlich des korrigierten TI-Proxys in Version 1. Dieser prüft die Anfragesitzung und verwendet keinen Service-Role-Schlüssel. Rolloutprotokoll vor dem Web-Merge am 21.10.2026: Der Web-Export ist erfolgreich; Push, Merge und produktive Web-Veröffentlichung folgen anschließend.

Neue Angehörigenzugänge bleiben gesperrt, bis die effektive PostgREST-Konfiguration, die nötigen Policy-Eigentümerrechte und die tatsächliche Hosted-Kette geprüft sind. Die vollständige Aktivierung wird nicht aus leeren SQL-Rolleneinstellungen abgeleitet. Ein neuer PostgREST-Hook und die globalen restriktiven RLS-Regeln wurden nicht installiert.

## Gesperrte Grundlage für den gestuften Rollout

`supabase/changes/academy_family_foundation.sql` stellt die benötigten Identitätsspalten und RPC-Verträge bereit, ohne bestehende PostgREST-Hooks oder öffentliche, Storage- und Realtime-Policies zu verändern. `gateway_ready()` liefert dabei fest `false`. Ein gefälschter Anfragemarker kann diese Sperre nicht aufheben. Auch direkte Service-Schreibversuche können keine neuen Familienkonten erstellen, umklassifizieren oder mit Auth verknüpfen. Die Anwendung bricht ab, wenn bereits Familienkonten oder eine aktivierte Akademie-Gatewaykonfiguration existieren.

Diese Grundlage wurde vor `academy_workspace.sql` angewandt. Verwaltung, Vorlagen und persönliche Mitarbeiter-/Klientenlernabläufe sind damit auf Datenbankebene bereitgestellt und lokal als vollständige Abläufe geprüft. Die vorbereitete Oberfläche weist die noch gesperrte Angehörigenanmeldung aus. Die spätere vollständige Aktivierung erfolgt weiterhin über `academy_family_access.sql` und benötigt alle unten beschriebenen Nachweise. Die vier tatsächlichen SQL-Prüfungen in `supabase/tests/academy_family_foundation.test.mjs` prüfen Bestandsschutz, gesperrte Anmeldung trotz gefälschtem Marker, Service-Schreibsperre, vollständige Mitarbeiter-/Klientenlernabläufe und die spätere verifizierte Aktivierung.

Die anschließend angewandte Kompatibilitätsmigration speichert `gateway_config.previous_hook` als schemaqualifizierten Text statt als `regprocedure`, damit die Spalte kein PostgreSQL-Upgrade blockiert. Sie aktiviert keinen Hook und verändert keine RPC-Berechtigungen. Die vier SQL-Prüfungen der Grundlage umfassen auch den Erhalt eines vorhandenen Funktionsnamens bei dieser Umstellung. Die vorbereitete vollständige Aktivierung löst den gespeicherten Namen erneut auf und weist fehlende oder nicht schemaqualifizierte Vorgänger zurück.

## Identität und Rechte

Die folgenden Abschnitte beschreiben den vorbereiteten Zustand nach der vollständigen Angehörigenaktivierung. Im derzeit produktiven Grundlagenstand bleibt `gateway_ready()` fest `false`; Einrichtung, Aktivierung, Codewechsel und Auth-Freigabe neuer Angehörigenkonten sind gesperrt.

`client_portal_access` bleibt die zentrale Kontoverknüpfung zur Klientenakte. Die unveränderliche `account_kind` unterscheidet `self`, bestehende `legacy_contact`-Konten und neue `academy_family`-Konten. Neue Angehörigenkonten haben ausschließlich `access_scope = 'academy'`. Bestehende Kontakt- und Gesundheitsdatenfreigaben werden weder kopiert noch verändert.

Der signierte Portaltyp lautet `academy_family`, die Rollenbezeichnung `family_portal`. Ein solches Konto ist niemals eine Klienten-Selbstidentität. Die persönliche Lernidentität ist der exakt verknüpfte zentrale Kontakt. Der Academy-Resolver prüft bei jedem Lesen und Schreiben zusätzlich die aktuelle Kontoaktivität, Mandanten-, Kontakt-, Klienten- und Authbindung sowie `academy_access_generation` gegen `access_generation` in der Datenbank. Gesperrte, gelöschte oder unvollständige Verknüpfungen berechtigen zu keinem Lernzugriff.

Ein Trigger erlaubt eine neue Auth-Verknüpfung nur, wenn `auth.users.raw_app_meta_data` bereits exakt Portaltyp, Rolle, Konto, Mandant und Akademiescope enthält. Damit kann eine noch nicht aktualisierte Login-Edge-Function ein neues Familienkonto während eines gestaffelten Rollouts nicht als Klientenkonto verknüpfen. Direkte Office-Änderungen oder Löschungen von Familienkonten sind gesperrt; die Verwaltungs-RPC bleibt zuständig.

Codewechsel, Deaktivierung und Kontaktverlust erhöhen die Generation und widerrufen die exakten opaken Kontositzungen. Wiederaktivierung setzt die Generation nicht zurück. Jede Generation verwendet eine eigene Auth-ID; alte Auth-Nutzermetadaten werden niemals auf eine neue Generation angehoben. Andernfalls könnte ein alter Supabase-Refresh-Token wieder neue gültige Claims erhalten. Bei Erstbindung oder Änderung der Auth-ID prüft der Datenbanktrigger deshalb zusätzlich die exakte aktuelle Generation und Kontakt-ID. Bereits ausgestellte JWTs und aufgefrischte Sitzungen alter Auth-IDs bleiben auch nach Wiederaktivierung unwirksam. Eine Kontaktlöschung lässt die unveränderliche Kontoart bestehen und deaktiviert das Konto; sie erzeugt keinen Selbstzugang.

## Datenbank- und API-Grenze

Die bestehenden generischen `current_*`-Resolver erkennen `academy_family` nicht und liefern keine repräsentierte Klientenidentität. Zusätzlich verknüpfen restriktive Policies auf öffentlichen Tabellen, Storage-Objekten und Realtime-Nachrichten die vorhandenen Policies mit einer expliziten Sperre für diesen Portaltyp. Tabellen, die zuvor ausschließlich über SQL-Grants geschützt waren, behalten für andere Identitäten exakt dieses Verhalten über eine benannte Bestandsschutzpolicy; diese darf bei einer späteren fachlichen RLS-Einführung nicht übersehen werden.

RLS allein genügt nicht: bestehende `SECURITY DEFINER`-RPCs und Views mit Eigentümerrechten können RLS umgehen. Daher erlaubt ein vorgeschalteter PostgREST-Hook für `academy_family` ausschließlich diese öffentlichen API-Routen:

- `/rpc/academy_workspace_load` mit GET, HEAD oder POST
- `/rpc/academy_workspace_mutate` ausschließlich mit POST

Andere Routen und andere API-Schemata werden zurückgewiesen. Der eigentliche Academy-RPC bleibt für die fachliche Autorisierung verantwortlich. Der Hook ist keine allgemeine SQL-Firewall und gilt nicht für Edge Functions, die mit Service-Schlüsseln eigene Datenzugriffe durchführen. Diese Funktionen müssen den Portaltyp ausdrücklich zurückweisen, sofern sie nicht zum persönlichen Akademiezugang gehören. Private Schemata dürfen nicht als zusätzliche API-Schemata veröffentlicht werden.

Der neue Hook verkettet einen vorhandenen schemaqualifizierten Hook und führt ihn unter der ursprünglichen Anfragerolle aus. Fehler des bestehenden Hooks werden nicht unterdrückt. Ein Transaktionsmarker bestätigt, dass die Sperre in der tatsächlichen Data-API-Anfrage durchlaufen wurde. Ohne diesen Marker können weder Konten eingerichtet oder aktiviert noch neue Authsitzungen freigegeben werden. Ein Datenbankeintrag allein ist kein Nachweis einer geladenen PostgREST-Konfiguration.

## Kontoverwaltung

`public.academy_family_access_manage` ist die einzige neue öffentliche Verwaltungs-RPC. Die Aktionen heißen `list`, `setup`, `rotate`, `enable`, `disable`. Sie verlangen eine bestätigte Office-Identität, `office.access` und passende Klientenrechte einschließlich Datenscope. Mutationen verwenden `office.clients.manage_consents`, Lesen verwendet `office.clients.view_sensitive`. Kontakte müssen exakt zur selben Klientenakte und zum selben Mandanten gehören. Bestehende Selbst- und Legacykonten werden nicht umgewandelt oder überschrieben.

Die Antwort enthält sichere Kontofelder, jedoch weder Codehash noch Auth-ID. Klartextcodes entstehen nur im bestehenden Einrichtungsablauf und werden einmalig angezeigt. `list` liefert zusätzlich `ready`; ohne geladenen Schutz bleibt die Einrichtung gesperrt.

`public.academy_family_auth_identity` ist ausschließlich für `service_role` ausführbar. Login und Sitzungsauffrischung verwenden sie vor dem Minten. Sie prüft Kontoverknüpfung, Aktivität, Generation, Klientenstatus und Mandantenfreigabe. Der stillgelegte Code-only-Endpunkt wird nicht reaktiviert.

## Reihenfolge bei der späteren vollständigen Angehörigenaktivierung

1. Effektive PostgREST-Konfiguration einschließlich Umgebungsvariablen und `db-pre-config` prüfen. Den bestehenden `db-pre-request` exakt feststellen. SQL-Rollenkataloge allein können einen extern konfigurierten Hook nicht ausschließen.
2. Vor dem ersten Anwenden den geprüften Zustand setzen: `SET academy_family.confirmed_pre_request = 'schema.existing_hook'`, beziehungsweise `'none'`, wenn nachweislich kein Hook vorhanden ist. Das ist eine technische Rolloutvoraussetzung; keine Aufforderung, unbekannte Konfiguration als leer anzunehmen. Eine abweichende bekannte Datenbankkonfiguration führt zum Abbruch.
3. `supabase/changes/academy_family_access.sql` als zusätzliche Aktivierungsmigration anwenden und die tatsächliche Migrationsversion dokumentieren. Sie ersetzt die gesperrten Grundlagenfunktionen, setzt die datenbankspezifische Authenticator-Konfiguration und sendet `reload config` sowie `reload schema`. Ein vorhandener Pre-Config-Mechanismus darf diese Einstellung anschließend nicht überschreiben. `academy_workspace.sql` ist bereits angewandt und darf nicht erneut ausgeführt werden.
4. Die zugehörigen Auth- und Portaländerungen gemeinsam bereitstellen. Alte Login-/Refreshversionen dürfen keine neuen Familienkonten als Klientenidentität minten. Allgemeine Profil-/Rollentabellen sind für Familienzugänge absichtlich gesperrt; die Portalwiederherstellung muss den persönlichen Portalpfad verwenden.
5. Mit ausdrücklich freigegebenen Testidentitäten die echte Hosted-Kette prüfen: Einrichtung, Login, Reload, Refresh, Lernfortschritt, Zertifikat, Codewechsel, Sperrung, Wiederaktivierung und Kontaktentfernung. Dabei fremde Mandanten/Kontakte, alte Generationen sowie direkte Dokument-, Gesundheitsdaten-, Nachrichten-, Storage-, Realtime-, GraphQL- und Legacy-RPC-Zugriffe negativ prüfen.
6. Keine Familienkonten freischalten, solange die Hosted-Hookwirkung, der Edge-Bypass-Audit oder die tatsächliche Portalwiederherstellung unbelegt sind. Bei fehlender Hookwirkung verweigert die Datenbank Einrichtung und Mint automatisch.

## Vorhandene lokale Nachweise

Der abschließende Akademie-Prüflauf umfasst 259 bestandene Anwendungstests, 20 isolierte SQL-Abläufe, 19 erfolgreich gebündelte Edge-Einstiege und 677 geprüfte Web-Routenmuster. Der Web-Export ist erfolgreich. Zuvor bestanden auch 106 Prüfungen der zwischenzeitlich hinzugekommenen Oberflächenänderungen. Der globale TypeScript-Check bestand nach Zusammenführung; seine abschließende Wiederholung brach wegen erschöpften Heap-Speichers ab. Die gezielte strikte TypeScript-Prüfung der neuen TI-Testdatei bestand. Diese lokalen Ergebnisse ersetzen keine Prüfung der veröffentlichten Auth-/API-Kette.

`src/__tests__/auth/academyFamilyAccessDatabase.test.ts` führt die tatsächliche vorbereitete SQL-Datei in der vorhandenen PGlite-Laufzeit aus. Geprüft werden Bestandsschutz, getrennte Kontoeinrichtung, Kontakt-/Mandanten-/Office-Scope, fehlender Hook, Hashvalidierung, exakte Sperrung und Sitzungswiderruf, Generation, unveränderliche Kontoart, Kontaktverlust, Service-only Authidentität, restriktive RLS, Blockade von Legacy-Definer-/View-Endpunkten sowie idempotente Hookverkettung unter ursprünglicher Rolle.

PGlite simuliert die PostgREST-Transaktionswerte und führt die echten Funktionen aus. Es ist kein Hosted-PostgREST-, Auth-, Storage- oder Realtime-Ende-zu-Ende-Nachweis. Der Academy-Resolver besitzt zusätzliche eigene SQL-Tests für Principalbindung und Generation.

`supabase/tests/academy_family_integration.test.mjs` wendet beide echten SQL-Dateien in ihrer Rolloutreihenfolge auf dasselbe isolierte Schema an. Der Test richtet den Kontaktzugang über die Verwaltungs-RPC ein, prüft die Service-Authidentität, verknüpft eine synthetische Auth-ID mit passender geschützter Metadatenidentität und führt den Familienlernablauf bis zur unabhängigen Freigabe und zum Zertifikat aus. Er prüft außerdem alte Generationen nach Rotation und Deaktivierung/Wiederaktivierung, Kontaktverlust, Legacy-RPC-/View-Sperren und den unveränderten persönlichen Zugriff vorhandener Klienten- und Mitarbeitendenkonten. Lediglich die externe Supabase-Auth-Tokenausstellung wird durch den synthetischen Authlink ersetzt.

Lokale Aufrufe:

```sh
node node_modules/vitest/vitest.mjs run src/__tests__/auth/academyFamilyAccessDatabase.test.ts --maxWorkers=1 --minWorkers=1
node --test supabase/tests/academy_family_integration.test.mjs
node --test supabase/tests/academy_family_foundation.test.mjs
```

Referenzen: [Supabase API-Schutz](https://supabase.com/docs/guides/api/securing-your-api), [PostgREST Pre-Request](https://docs.postgrest.org/en/stable/references/transactions.html#pre-request), [PostgREST Konfiguration](https://docs.postgrest.org/en/stable/references/configuration.html), [PostgreSQL restriktive Policies](https://www.postgresql.org/docs/current/sql-createpolicy.html).
