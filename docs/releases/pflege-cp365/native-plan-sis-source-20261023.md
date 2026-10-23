# Pflegeplan: gespeicherten SIS-Bezug im Web prüfen — 23.10.2026

Ausgangspunkt dieses Blocks ist `fce2a1a2909c6f9bf5d24cd9db09dbf625909add`. Die ältere Web-Detailroute `/pflege/planung/[id]` zeigte bisher bereits bei einer vorhandenen projizierten Assessment-ID „Verknüpft“. Eine eigene Web-Detailimplementierung ersetzt diese Aussage durch einen tatsächlich gelesenen Bezug. Die gemeinsame Detailansicht und Android-Dateien bleiben unverändert.

## Zusammenhängender Lese- und Öffnungsablauf

`CarePlanDetailScreen.web.tsx` verwendet bestätigte aktuelle Web-Rechte. Fehlendes Leserecht, eine andere angeforderte Plan-ID oder ein anderer aktueller Mandant verhindern die Anzeige. Das Fortschreibungsangebot folgt dem eigenen Pflegeplan-Verwaltungsrecht statt dem allgemeinen Office-Lesemodus.

`NativeCarePlanSourcePanel.web.tsx` und `useNativeCarePlanSource.web.ts` binden die Auswahl an Plan-ID, Klient, gespeicherte SIS-ID, aktuelles Konto, internes Profil, Mandant, Sitzung, Berechtigungsursprung und SDK. Ein Generationswechsel entzieht alten Ansichten und Rückrufen ihre Gültigkeit. Das Panel verwendet die vorhandenen Zustandskomponenten und die CareLight-Farbpalette; Texte und Aktionen können bei wenig Breite umbrechen.

Das neue Repository liest ausschließlich vollständige einzelne Originalzeilen aus `care_plans` und gegebenenfalls `care_assessments`. Jede Abfrage enthält die konkrete ID und den Mandanten sowie den Klienten beziehungsweise `subject_type=client` und dessen ID. Rückgaben werden unabhängig von den Abfragefiltern erneut geprüft. Der vorhandene Transport bestätigt das echte Auth-Konto getrennt vom aktuell aufgelösten internen Profil und Mandanten. Fehlende Ablaufmetadaten, ungeklärte Autorität, Fehlerantworten und Kontowechsel schließen die Bestätigung aus.

Zwei vollständige Lesedurchgänge müssen einschließlich sämtlicher gelieferter Originalfelder gleich sein. Das erkennt auch Änderungen an Mikrosekunden, nicht projizierten Metadaten und Planversionen. Das explizit gespeicherte `source_assessment_id:null` bleibt leer; fehlende, undefinierte oder leere Felder werden nicht zu einer leeren oder positiven Zuordnung umgedeutet. Eine fremde SIS, ein anderes Fachgebiet oder ein anderer Klient wird abgewiesen.

Vor „Gespeicherte SIS öffnen“ wird derselbe Bezug erneut vollständig gelesen und mit dem angezeigten Original verglichen. Bei Änderungen wird kein Link geöffnet; zuerst ist ein ausdrückliches Neuladen erforderlich. Unklare Antworten, Rechteverlust, Wechsel der Auswahl, konkurrierende lokale Aufrufe und Antworten nach dem Verlassen des Bildschirms erzeugen keine Navigation. Eine gelesene Zuordnung ist ausdrücklich keine fachliche Aktualitäts- oder Freigabeentscheidung.

## Nachweise und Grenzen

Die Suite `scripts/checks/native-care-plan-source-web.node.test.mjs` führt das tatsächliche Repository, den tatsächlichen Supabase-Abfrageadapter, den Lebenszykluscontroller und den tatsächlichen Web-Hook mit synthetischem Transport aus. **54 gezielte Tests bestehen.** Sie umfassen eigene getrennte Konto-/Profil-IDs, alle Scope- und Nullvarianten, vollständige Originalerhaltung, Drift, getarnte Zugriffe über Getter, Konto-/Sitzungs-/SDK-Wechsel, fremde Quellen, Navigation nach neuer Prüfung, Rechteentzug, Wiederherstellung alter Rechte, verspätete Antworten, Entsorgung und Effekt-Neustart.

Der abschließende vollständige Node-Lauf besteht mit **14.980 Tests, null Fehlern und null übersprungenen Fällen** (82.687 ms). Die 54 gezielten Fälle sind darin enthalten und werden nicht zusätzlich addiert. Diese Modellprüfungen berechnen kein Browserlayout und führen keine authentifizierten HTTP-Abfragen aus. Der existierende Web-Elternroutengenerator prüft weiterhin 686 Routenmuster. `audit-vercel-config.mjs` kann lokal nicht vollständig laufen, da `expo-router/build/getRoutesCore` nicht installiert ist. Es wurde keine zusätzliche Software installiert. Vollständige TypeScript-/Expo-/Edge-Prüfung und breite/schmale Browserabnahme bleiben offen.

Die zwei gleichen Lesedurchgänge sind kein atomarer Datenbanksnapshot. Das Panel prüft gespeicherte Originalbezüge, keinen vollständigen SIS-Inhalt mit allen Untertabellen und keinen Historien- oder Versorgungsabschluss. Es setzt keinen SIS-Bezug und verändert weder Pflegepläne noch Assessments. Der ältere Anlagebildschirm übergibt weiterhin `sourceAssessmentId:null`; die native Schreibkette mit Originalbindung, Konfliktkontrolle und eigener wiederauffindbarer Quittung bleibt ein eigener offener Abnahmeblock. Auch bestehende serverseitige Rechte/RLS-Regeln werden hierdurch nicht vollständig geprüft oder geändert.

## Veröffentlichung

Pflege bleibt global gesperrt; PR #155 bleibt ein Entwurf. Dieser Block enthält keine SQL-Migration, Datenbankmutation, API-Freigabe, Produktionsänderung oder klinische Aktivierung.

GitHub meldet den Ausgangscommit `fce2a1a` abschließend in allen vier Vercel-Projekten mit „Deployment has completed“. Das Hauptprojekt `caresuiteplus-app` wurde am 23.10.2026 um 18:38:38 UTC (20:38:38 MESZ) erfolgreich gemeldet. Der dokumentierte Ausschnitt der tatsächlichen GitHub-Metadaten steht in `docs/audit/pflege-fce2a1a-vercel-status-20261023.json`. Netlify meldet lediglich eine abgebrochene Vorschau. Diese Statusmeldungen gelten für den Ausgangscommit, nicht automatisch für die danach ergänzte Web-Brücke. Das Vercel-Plugin hat keinen Teamzugriff. Der Browser führt zum Vercel-Anmeldebildschirm. Die automatische Freigabeprüfung hat den sicheren Anmeldeschritt wegen fehlender ausdrücklicher Nutzerzustimmung abgewiesen; es wurden keine Anmeldewerte eingegeben oder Umgehungen durchgeführt. Die sichere Alternative war die verfügbare GitHub-Statusabfrage. Dadurch ist der erfolgreiche Vercel-Abschluss des Ausgangscommits belegt; dessen genaue Logkette wurde nicht eingesehen.

Dokumentationsgrundlage für gefilterte Einzelzeilenabfragen und die getrennte serverseitige RLS-Grenze: https://supabase.com/docs/reference/javascript/using-filters-eq und https://supabase.com/docs/guides/database/postgres/row-level-security .
