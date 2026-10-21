# Akademie: gemeinsamer Arbeitsvertrag

Stand 21.10.2026. Web/Desktop: Verwaltung sowie persönliche Lernbereiche für Mitarbeitende und Klient:innen. Angehörigenabläufe sind vorbereitet; neue Angehörigenzugänge bleiben im gestuften Rollout gesperrt. Bestehende Android-Oberflächen bleiben unverändert. Keine automatische Kursveröffentlichung und keine produktiven Testdatensätze.

Die Datenbankmigrationen `20261021113810_academy_family_foundation`, `20261021114233_academy_workspace` und `20261021115100_academy_gateway_hook_upgrade_compatibility` sind produktiv angewandt und in der Supabase-Migrationshistorie bestätigt. Die exakten SQL-Stände sind unter `supabase/migrations` abgelegt. Alle 19 betroffenen Edge-Funktionen sind veröffentlicht und haben den Status `ACTIVE`, einschließlich des korrigierten TI-Proxys in Version 1 ohne Service-Role-Schlüssel. Rolloutprotokoll vor dem Web-Merge am 21.10.2026: Der Web-Export ist erfolgreich; Push, Merge und produktive Web-Veröffentlichung folgen anschließend.

Die bestehenden Tabellen `courses`, `course_lessons`, `course_enrollments` und `certificates` bleiben die fachlichen Stammdatensätze. Private Ergänzungen halten Autorenentwürfe, unveränderliche Veröffentlichungen, personenbezogene Lernstände, Wissenschecks, Prüfentscheidungen und wiederholbare Anfragen fest. Es entsteht kein zweiter Kurskatalog in `training_*` oder `akademie_*`.

## RPC-Vertrag

- `academy_workspace_load(p_tenant uuid, p_view text)` gibt `AcademyWorkspace` aus `src/lib/akademie/workspaceModel.ts` zurück. `office` erfordert bestehende verifizierte Verwaltung plus passende Akademierechte. `learner` löst die Person ausschließlich aus der geprüften Sitzung und aktiven zentralen Zuordnung auf. Niemals eine vom Browser behauptete Person oder Rolle verwenden.
- `academy_workspace_mutate(p_tenant uuid, p_view text, p_action text, p_request uuid, p_record uuid, p_revision integer, p_data jsonb)` gibt `AcademyMutationResult` zurück. Alle Schreibvorgänge sind mandantengebunden, atomar und anhand der Vorgangs-ID samt unveränderlicher Nutzdaten wiederholbar. Dieselbe ID mit anderen Nutzdaten wird abgewiesen. Versionskonflikte bleiben sichtbar.

| Aktion | Datensatz | Nutzdaten |
| --- | --- | --- |
| save_course | stabile neue oder vorhandene Kurs-ID; null Revision bei Neuanlage | `{ content: AcademyContent }` |
| publish_course | Kurs + aktuelle Revision | `{}` |
| archive_course | Kurs + aktuelle Revision | `{}` |
| save_template | stabile neue oder vorhandene Vorlagen-ID; null Revision bei Neuanlage | `{ name, description, content: AcademyContent }` |
| archive_template | eigene Vorlage + aktuelle Revision | `{}` |
| restore_template | archivierte eigene Vorlage + aktuelle Revision | `{}` |
| assign | Kurs + aktuelle Revision | `{ targets: [{ kind, id }], dueDate: YYYY-MM-DD oder null }` |
| change_due_date | offene Teilnahme + aktuelle Revision | `{ dueDate: YYYY-MM-DD oder null, note }`; Begründung mit mindestens drei Zeichen |
| renew_enrollment | abgeschlossene Teilnahme oder beendete Folgeteilnahme + aktuelle Revision | `{ dueDate: YYYY-MM-DD oder null, note, courseRevision }`; aktuelle veröffentlichte Kursfassung, eigener neuer Lernstand |
| start_enrollment | Teilnahme + Revision | `{}` |
| complete_lesson | Teilnahme + Revision | `{ lessonId }` für Text/Video/Dokument; keine Prüfung überspringen |
| submit_quiz | Teilnahme + Revision | `{ lessonId, answers: { questionId: optionId } }` |
| submit_enrollment | Teilnahme + Revision | `{}`; alle Lektionen einschließlich Wissenschecks abgeschlossen |
| review_enrollment | Teilnahme + Revision | `{ decision: 'approve' oder 'return', note, validUntil: Datum oder null }` |
| cancel_enrollment | Teilnahme + Revision | `{ note }` |
| revoke_certificate | Nachweis; keine Revision | `{ note }` |

Nach der noch ausstehenden vollständigen Aktivierung lernen Angehörige als eigene Kontaktperson. Die vertretene Klienten-ID darf niemals deren Lernfortschritt oder Nachweis ersetzen. Ein persönlicher Angehörigenzugang erhält nur seine eigene Teilnahme, keine automatische Einsicht in die Lernstände der betreuten Person. Mitarbeitende und Klient:innen verwenden ihre bestehenden Zugangskonten. Die Einrichtung neuer Angehörigenzugänge ist in der zentralen Klientenakte für einen vorhandenen Kontakt vorbereitet, derzeit jedoch gesperrt. Zur Vergabe stehen nur berechtigt sichtbare zentrale Personen zur Auswahl.

Veröffentlichungen sind unveränderlich. Bearbeiten erzeugt einen neuen Entwurfsstand; bestehende Teilnahmen behalten die zugewiesene Fassung. Neue Zuweisungen verwenden ausschließlich die aktuelle veröffentlichte Fassung. Die bearbeitete Fassung darf nicht ohne bewusste Veröffentlichung in Teilnahmen gelangen. Archivierung verhindert neue Zuweisungen und zerstört keine bestehenden Nachweise.

Die Antworten von Wissenschecks bleiben serverseitig. Der Server berechnet Ergebnis, Versuchsanzahl und Fortschritt. Ein Klick auf „Bearbeitet“ bestätigt nur die eigene Bearbeitung des Materials, keine beobachtete praktische Kompetenz. Nach vollständiger Bearbeitung reichen Lernende ein. Berechtigte Prüfende geben frei oder zur Überarbeitung zurück. Eine Freigabe erstellt einen nachvollziehbaren Teilnahme-/Lernnachweis mit eingefrorenem Personen-, Kurs- und Ausstellerstand. Eigene Abschlüsse dürfen nicht selbst freigegeben werden. Keine automatische berufliche Qualifikations- oder Einsatzfreigabe.

Die vorhandene unzureichend abgesicherte `update_course_progress`-RPC und direkte Tabellenänderungen dürfen den neuen Ablauf nicht umgehen. Die angewandte Workspace-Migration sperrt diese Zugriffspfade für direkte Client-Aufrufe, ohne bestehende Datensätze umzuschreiben.

## Oberfläche

Verwaltung: Übersicht, Kurse mit Strukturvorlagen und Editor, Vorlagenbibliothek, Zuordnung nach Zielgruppe/Person und Frist, offene Prüfungen, Nachweise und verknüpfte Lernmaterialien. Lernende: eigene Schulungen, nächste Lektion, Wissenscheck, Rückmeldung und Nachweis. Gemeinsame serverbestätigte Daten; kein Demo-Fallback und keine pauschale Freischaltung weiterer Fachmodule.

### Vorlagen und eigene Kurserstellung

Unter `/akademie/vorlagen` stehen 14 bearbeitbare Strukturvorlagen sowie ein leerer Kursstart bereit. Die Strukturen decken unter anderem Einarbeitung, Pflichtschulung, Auffrischung, Softwareeinführung, Dokumentation, Kommunikation, Beratungsvorbereitung, häusliche Schulung und Fallbesprechung ab. Suche, Themenbereich, Zielgruppe und Herkunft filtern die Sammlung. Eine Detailansicht zeigt Aufbau und vorhandene Inhalte vor dem Übernehmen.

Kursverantwortliche können eigene Vorlagen erstellen, einen aktuellen Kursentwurf als Vorlage speichern, Vorlagen bearbeiten, archivieren und wiederherstellen. Diese mandantengebundenen Autoreninhalte liegen in `academy_private.course_templates`; sie sind keine veröffentlichten Kurse und erzeugen keine Teilnahmen. Der Workspace liefert sie ausschließlich in der Verwaltung mit `manageCourses`. Lernende und reine Prüfberechtigte erhalten keine Vorlagen oder enthaltenen Lösungsschlüssel. Laufzeitvalidierung und Datenbank prüfen diese Grenze.

Jede Verwendung einer Vorlage oder Kurskopie erzeugt einen unabhängigen Entwurf mit neuen Lektions-, Fragen- und Antwortkennungen. Richtige Antworten werden den neuen Antwortkennungen zugeordnet. Lernstände, Veröffentlichungen und Nachweise werden niemals mitkopiert. Auch archivierte Kurse lassen sich kopieren; archivierte Vorlagen müssen vor der Wiederverwendung wiederhergestellt werden. Speichern und Statuswechsel erfordern aktuelle Revisionen und verwenden den bestehenden wiederholbaren Anfragevertrag.

Der Kurseditor bietet zehn Lektionsbausteine: Lernziele, Kernaussagen, Praxis, Reflexion, Checkliste, häufige Fragen, Video, Dokument, Wissenscheck und Richtig/Falsch. Lektionen und Fragen können kopiert und umgeordnet werden. Unfertige Entwürfe lassen sich speichern; eine Vollständigkeitsliste führt zu fehlenden Angaben vor der Veröffentlichung. Die Lernendenvorschau arbeitet ausschließlich im lokalen Editorzustand: Sie schreibt keine Versuche, Lernfortschritte oder Abschlüsse. Neue Inhalte und Links werden durch die verantwortliche Person ergänzt und fachlich geprüft. Die Browserwarnung schützt beim Verlassen vor ungespeicherten Änderungen.

Der Schulungsplan zeigt Monatsübersicht und Agenda, offene Fristen, Schulungen ohne Frist sowie abgelaufene oder innerhalb von 30 Tagen ablaufende Nachweise. Auf schmalen Arbeitsflächen übernimmt die Agenda. Persönliche Portale zeigen ausschließlich eigene Einträge. Zielgruppe, Suche und Pflichtschulungsfilter gelten auch für die Planung. Die Pflichtschulungsroute setzt den Pflichtfilter tatsächlich und führt zur Mitarbeiterplanung.

Friständerungen sind für zugewiesene, laufende oder zurückgegebene Teilnahmen möglich. Sie benötigen eine Begründung und die aktuelle Teilnahmeversion. Der Server ändert zentrale Frist und Akademiefrist gemeinsam; der unveränderliche Fristverlauf erscheint auch für die lernende Person. Eingereichte, abgeschlossene und beendete Teilnahmen erhalten keine nachträgliche Friständerung.

Eine bewusst ausgelöste Folgeschulung verwendet die aktuelle veröffentlichte Kursfassung, eine neue Teilnahme-ID und leeren Lernfortschritt einschließlich neuer Quizversuche. `previousEnrollmentId` und `nextEnrollmentId` verbinden die Lernzyklen. Eine Quelle erhält höchstens eine direkte Folge; eine laufende Teilnahme desselben Kurses und derselben Person oder ein jüngerer Abschluss verhindern eine weitere Folge aus einem überholten Stand. Eine beendete Folgeteilnahme kann als neues Kettenglied fortgesetzt werden. Historische Lernstände und Nachweise bleiben erhalten. Die Bestätigung liefert `recordId` und `revision` der Quelle sowie `createdEnrollmentId` der neuen Teilnahme. Verfügbarkeit des persönlichen Zugangs wird anhand der aktuellen zentralen Zuordnung geprüft, nicht anhand des historischen Teilnahmesnapshots.

Auswertungen zählen jede Teilnahme einschließlich Folgeschulungen einzeln. Die Abschlussquote teilt bestätigte Abschlüsse durch alle ausgewählten Teilnahmen außer beendeten Teilnahmen. Eingereichte Abschlüsse werden separat geführt und nicht als offene Lernfrist gezählt. Für aktuelle Nachweisgültigkeit zählt pro Person und Kurs ausschließlich der jüngste Nachweis; seine Rücknahme aktiviert keinen älteren Nachweis. Der CSV-Export enthält gefilterte Kurszahlen ohne Personennamen und neutralisiert Formeln in Textzellen. Die Anzeige löst keine automatischen Wiederholungen oder Erinnerungsnachrichten aus.

`/akademie` und vorhandene Akademie-Aliasse erhalten Web-spezifische Einstiege. Persönliche Lernbereiche unter `/portal/employee/akademie` und `/portal/client/akademie`. Der Personal-Schulungseinstieg öffnet dieselbe Verwaltung mit Mitarbeiterfilter. Besuchs- und Leistungsdokumentation bleibt beim bestehenden Beratungsfall; eine automatische Übernahme von Beratungsterminen als absolvierte Schulung erfolgt nicht.

## Rechte und persönliche Angehörigenzugänge

Verwaltungsaktionen verwenden `akademie.courses.manage`, `akademie.enrollments.assign` und `akademie.enrollments.review`. Explizite Mitarbeiter-Denies und Datenbereiche bleiben wirksam. Nur bestehende Standardrollen `business_admin`/`akademie_admin` mit Akademie-Leserecht erhalten die neuen Standard-Akademierechte. Mandantenspezifische Ersatzrechte werden nicht erweitert.

Personenlisten benötigen zusätzlich vorhandene Leserechte: `office.employees.view` für Mitarbeitende und `office.clients.view_sensitive` für Klient:innen/Angehörige, jeweils mit gültigem Datenbereich. Eine reine `akademie_admin`-Rolle erhält damit nicht automatisch Einblick in die Personal- oder Klientenakten. Ohne diese expliziten Rechte bleibt die entsprechende Personenauswahl leer.

Neue Angehörigenkonten besitzen die unveränderliche Kontoart `academy_family`, den Scope `academy` und eine eigene Kontaktbindung. Der signierte JWT trägt `portal_type=academy_family`, `role_key=family_portal` und die aktuelle Zugangsgeneration. Klienten-Selbstzugänge werden beim Einrichten explizit über `contact_id IS NULL` ausgewählt. Kontaktlöschung, Deaktivierung und Codewechsel dürfen keine Umdeutung zum Selbstzugang ermöglichen; geänderte Generationen sperren bereits ausgestellte Lernzugänge.

Die noch nicht angewandte vollständige Angehörigenaktivierung sieht einen Data-API-Hook vor, der dieser neuen Identität ausschließlich die beiden Academy-Workspace-RPCs erlaubt und einen bestehenden Hook mit ursprünglicher Aufruferidentität weiter aufruft. Zusätzliche restriktive RLS-Regeln würden direkte Tabellen-, Storage- und Realtime-Zugriffe schützen. Im produktiven Grundlagenstand wurden weder dieser Hook noch die globalen RLS-Regeln installiert; stattdessen sind neue Angehörigenkonten und ihre Auth-Freigabe fest gesperrt. Die privaten Workspace-Funktionen prüfen Konto, Person, Mandant und Generation. Die vorbereiteten Edge-Einstiege prüfen den persönlichen Scope, bevor sie Serviceberechtigungen verwenden. Der stillgelegte Code-only-Login wird nicht reaktiviert.

## Prüfung und Rollout

`npm run verify:academy:release` prüft reale UI-Interaktionen, Portalsitzungen, Serviceantworten, PDF-Erzeugung und die tatsächlichen SQL-Funktionen mit isolierten Daten. Der reale Datenbank-Response wird zusätzlich durch die Runtimevalidierung des Frontends geschickt. Der PDF-Nachweis wurde gerendert und visuell geprüft. HappyDOM belegt keine Browsergeometrie; die tatsächliche responsive Browseransicht und die veröffentlichte PostgREST-/Auth-/Edge-Kette bleiben getrennte Prüfungen.

Abschließende Prüfung am 21.10.2026: 259 Anwendungstests und 20 isolierte SQL-Abläufe bestanden im vollständigen Akademie-Prüflauf. Darunter sind die vollständige Vorlagenverwaltung, unabhängige Kurskopien, Lektionsbausteine, die lokale Lernendenvorschau, Revisionskonflikte, die Autorengrenze für Lösungsschlüssel und die gesperrte Angehörigengrundlage. 19 betroffene Edge-Einstiegspunkte wurden erfolgreich lokal gebündelt; 677 Web-Routenmuster wurden geprüft. Weitere 106 Prüfungen der zwischenzeitlich hinzugekommenen Oberflächenänderungen waren zuvor erfolgreich. Der abschließende Web-Export ist erfolgreich. Der globale TypeScript-Check bestand nach Zusammenführung; die letzte Wiederholung brach wegen erschöpften Heap-Speichers ab. Die gezielte strikte TypeScript-Prüfung der neuen TI-Testdatei bestand. Die tatsächliche Browserdarstellung und die vollständige veröffentlichte Auth-/API-Kette sind weiterhin offen.

Vor dem Rollout wurden am 21.10.2026 die produktiven Zeilenzahlen gelesen: alle vier Kurs-/Teilnahme-/Nachweistabellen waren leer. Es bestanden 16 Klienten-Selbstzugänge und keine kontaktgebundenen Zugangskonten. Historische Einträge anderer Umgebungen werden nicht automatisch als versionierte Schulung umgedeutet.

Der am 21.10.2026 beauftragte Rollout hat zunächst `academy_family_foundation.sql`, anschließend `academy_workspace.sql` und zuletzt die gezielte Hook-Kompatibilitätskorrektur unter den oben genannten tatsächlichen Migrationsversionen angewandt. Die Korrektur ersetzt den gespeicherten `regprocedure`-Typ durch schemaqualifizierten Text und beseitigt damit ein Hindernis für PostgreSQL-Upgrades. Die Voraussetzung für eine vollständige Angehörigenfreischaltung lässt sich über den vorhandenen Projektzugriff nicht nachweisen. Deshalb bleiben neue Angehörigenkonten auf Datenbankebene gesperrt, während Verwaltung, Vorlagen und Mitarbeiter-/Klientenlernen auf Datenbankebene bereitgestellt sind. Bestehende PostgREST-Hooks und globale RLS-Policies bleiben dabei erhalten. Alle 19 Edge-Funktionen sind aktiv; die Web-Veröffentlichung steht aus. Details stehen in `docs/security/academy-family-access.md`.

Für die spätere vollständige Angehörigenaktivierung:

1. Die tatsächlich wirksame PostgREST-Pre-Request-Konfiguration feststellen. `academy_family.confirmed_pre_request` muss den verifizierten qualifizierten vorhandenen Hook oder `none` enthalten; kein vermuteter Standardwert. Der vorbereitete SQL-Stand bricht ohne diese Grundlage ab.
2. `supabase/changes/academy_family_access.sql` als zusätzliche Aktivierungsmigration anwenden und die vom System vergebene Version dokumentieren. Diese vollständige Aktivierung ist weiterhin vorbereitet und noch nicht ausgeführt. Die bereits angewandte Workspace-Migration darf nicht erneut ausgeführt werden.
3. Die geänderten Edge-Funktionen einschließlich ihrer gemeinsam genutzten Dateien ausrollen. `scripts/verify-academy-edge-build.mjs` enthält die 19 betroffenen Einstiegspunkte einschließlich abhängiger Auth-, KI-, Google-, Dokumenten- und Pushfunktionen. Die Datenbank verhindert die Bindung eines Angehörigenkontos an falsch ausgestellte Klienten-Claims. Vor vollständiger Auth-Bereitstellung keine neuen Zugänge aktivieren. Details: `docs/security/academy-family-access.md`.
4. Webbuild veröffentlichen und mit berechtigten Testkonten Einrichtung, Login, Zuweisung, Bearbeitung, Prüfung, Nachweis und Widerruf in der tatsächlichen Umgebung prüfen. Keine echten Klientenakten als Testdaten verwenden.

Der produktive Datenbankstand und die 19 Edge-Funktionen sind bereitgestellt. Der ausstehende Web-Rollout verhindert noch eine vollständige Veröffentlichung des Akademie-Ausbaus.

## Grenzen

SCORM/xAPI, externe LMS-Synchronisierung, Live-Videokonferenzen, Kursverkauf und anerkannte Fortbildungspunkte werden nicht als verfügbare Funktionen ausgewiesen. Diese Änderung ersetzt die bisherigen Demo-Abläufe durch den beschriebenen vollständigen Lern- und Freigabeablauf. Medizinische Kursinhalte werden fachlich vom Herausgeber erstellt und geprüft; Strukturvorlagen behaupten keine inhaltliche Freigabe.
