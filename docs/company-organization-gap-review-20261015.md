# Unternehmen: Bestands- und Lückenprüfung

Prüfdatum: 15. Oktober 2026

Geprüfte Basis: `d6d20d92f4a4c02b0753cf473d589198535bd09e` (`main`)

Umfang: Unternehmensakte im Web sowie angrenzende Organisations-, Rechte-, Inventar- und Fahrtenbuchmodelle im Repository.

Die Unternehmensakte bildet auf diesem Stand vor allem ein Unternehmen mit einem Hauptsitz ab. Stammdaten, Kontakte, Geschäftsführung, Bankkonten, steuerliche Angaben und Leistungspreise sind vorhanden. Für mehrere Standorte, eigenständige Gesellschaften und Franchise fehlen zusammenhängende Abläufe. Einzelne Grundlagen liegen bereits in Personal, Inventar, Fahrtenbuch und Arbeitszeitverwaltung; sie sollten angebunden und fachlich ergänzt werden.

Nach dieser Bestandsprüfung wurde die Integration des bestehenden Inventars in „Unternehmen“ ausdrücklich beauftragt. Sie wird parallel bearbeitet. Dieser Bericht beschreibt weiterhin die oben genannte Basis und bestätigt weder den Abschluss noch die Veröffentlichung dieser neuen Integration.

## Aussagekraft der Prüfung

Geprüft wurden Quellcode, Typmodelle und versionierte SQL-Migrationen. Es gab keine Produktionsabfragen, Datenänderungen, Schemaänderungen oder Live-Funktionstests. Eine vorhandene Migration belegt nicht, dass sie produktiv angewandt wurde. Ein vorhandener Service belegt noch keinen erfolgreich durchlaufenen Ablauf. Optische Abnahme und Laufzeittests sind nicht Gegenstand dieses Berichts.

„Fehlt“ bedeutet im Folgenden: Im untersuchten Unternehmensablauf beziehungsweise in den dafür gefundenen Repository-Modellen ist keine entsprechende Umsetzung vorhanden. Fachliche Zielangaben sind Vorschläge, keine bereits zugesagten Funktionen.

## Bestand und konkrete Lücken

| Bereich | Bereits vorhanden | Konkrete Lücke auf der geprüften Basis |
| --- | --- | --- |
| Unternehmensprofil | Name, Rechtsform, Branche, ein Hauptsitz, Kontaktdaten und Logo; mehrere Ansprechpersonen, Vertretungen und Bankkonten. | Kein gemeinsames Modell für mehrere rechtlich eigenständige Unternehmen und deren Beziehungen. |
| Standorte | Ein Hauptsitz; ein älterer Abschnitt „Standorte“ ist ausdrücklich als nicht bearbeitbarer Platzhalter gekennzeichnet. | Keine Standortverwaltung mit eigener Anschrift, Leitung, Erreichbarkeit, Öffnungszeiten, Status oder Zuordnungen. Der neue Workspace zeigt keine Standortliste; eine interne `locations`-Aktion öffnet lediglich das allgemeine Unternehmensformular. |
| Abteilungen und Teams | Abteilung im Personalprofil, Katalogauswahl und Filter. Die Nachrichtenauswahl leitet Teams aus den hinterlegten Abteilungswerten ab. | Keine eigenständigen Team-/Abteilungsakten, Leitung, Stellvertretung, Hierarchie oder zeitlich gültige Mehrfachzuordnungen. Ein Textwert ersetzt keine belastbare Organisationsstruktur. |
| Organisation und Kostenstellen | Arbeitszeitmodell mit Organisationseinheiten, Kostenstellen und Projekten; Kostenstellenfeld in der Personalakte. | Die betreffenden Schreibfunktionen sind im Supabase-Modus ausdrücklich bis zur serverseitigen Persistenz gesperrt. Keine zentrale Verwaltung in „Unternehmen“ und keine durchgängige Zuordnung zu Standorten, Personal, Fahrzeugen und Kosten. |
| Gesellschaften und Holding | Tenantbezogene Unternehmensprofile und eine Mitgliedschaftstabelle als technische Grundlage. | Keine gefundenen Mutter-/Tochterbeziehungen, Beteiligungen, gemeinsame Gruppenansicht oder ausdrücklich geregelte gesellschaftsübergreifende Freigaben. |
| Franchise | Allgemeine Mandanten- und Rollenstruktur. | Kein gefundenes Franchise-Partner-/Vertragsmodell, Gebietsbezug, zentrale Vorgaben mit lokalen Ausnahmen oder klar begrenzte Zentraleinsicht. |
| Rechte und Datenabgrenzung | Tenantfilter, allgemeine Berechtigungen und Portaltrennung im Code. Personalrechte können Team-/Standort-Sichtbereiche speichern. | Eine durchgehende Auswertung dieser gespeicherten Sichtbereiche zur Begrenzung fachlicher Datenabfragen oder in RLS-Regeln wurde nicht gefunden. Die Unternehmensakte setzt zudem ein gemeinsames Verwaltungsrecht voraus, statt getrennte Lese-/Bearbeitungsrechte je Sachgebiet oder Standort anzubieten. |
| Versicherungen | Ein Haftpflichtprofil mit Versicherer, Bezeichnung, Versicherungsnummer sowie Kammer-/Verbandsangaben. | Kein Mehrfachregister für unterschiedliche Policen, versicherte Gesellschaften/Standorte/Fahrzeuge, Laufzeit, Beitrag, Deckung, Selbstbehalt, Dokumente oder Schadenfälle. |
| Fuhrpark | Private und betriebliche Fahrzeuge im Mitarbeitenden-Fahrtenbuch; Kennzeichen, Marke, Modell, Aktivstatus und Fahrtzuordnung. Inventar kennt eine Fahrzeugkategorie. | Keine zentrale Fahrzeugakte mit Poolzuordnung, wechselnden Nutzenden, Standort, Leasing/Finanzierung, Versicherung, Wartung, Prüf- und Rückgabeterminen. Die Inventarverknüpfung `vehicleRefId` ist ausdrücklich vorbereitet; die Pflege-Fuhrparkroute öffnet lediglich die nach Fahrzeugen gefilterte Inventarliste. |
| Inventar und Ausstattung | Eigenes Modul mit Beständen, Kategorien, Lagerorten, Ausgaben, Rücknahmen, Schäden, Protokollen und Auditdaten; Supabase-Repository und entsprechende Typmodelle vorhanden. | Im geprüften Unternehmen-Workspace nicht eingebunden. Die allgemeine Inventarliste verwendet auf dieser Basis für Namen, Personalausstattung und Empfängerauswahl noch `demoEmployees`. Lagerorte bilden Gebäude/Räume ab, aber keine vollständigen Unternehmensstandorte. |
| Verträge und Fristen | Vertragsdokumentmodell enthält Beginn, Ende und Kündigungsfrist. Inventar enthält Garantieende und erwartete Rückgabe; Fahrtenbuch besitzt Fahrzeugbezug. | Kein zentrales Unternehmensregister für Miet-, Leasing-, Versicherungs-, Lieferanten- und Franchiseverträge mit Verantwortlichkeit, berechnetem Handlungstermin, Wiedervorlage und verknüpftem Objekt gefunden. Einzelne Datumsfelder belegen keine laufende Fristenüberwachung. |
| Stammdaten in Dokumenten | Der zentrale Dokumentenkatalog lädt Unternehmensname, Anschrift und weitere Angaben aus `tenants`; ein zusätzlicher Dokumentkontext-Helfer ist vorhanden. | Bank-, Vertretungs- und Logoquellen stimmen nicht durchgängig mit der neuen Unternehmensakte überein. Die Auswahl des Hauptkontos und eigene Feldwerte sind im zusätzlichen Helfer nicht umgesetzt. |

### Unternehmensdaten müssen im Dokument ankommen

Auf der geprüften Basis lädt `loadCentralContext` aus `tenant_document_settings` nur `logo_url`. Der Mapper erwartet dort auch Bankname, IBAN und BIC; diese Werte bleiben in diesem Ladepfad leer, weil `tenant_bank_accounts` nicht abgefragt wird. Die Unternehmensvertretung kommt weiterhin aus `tenants.representative_name`, während der neue Editor nach `tenant_representatives` schreibt. Das Unternehmenslogo wird nach `tenant_branding` gespeichert, der Dokumentenkatalog liest es aus der separaten Dokumenteinstellung. Eine durchgängige Übernahme aktueller Hauptvertretung und Logoänderungen ist durch diesen Lader daher nicht sichergestellt. Der zusätzliche Helfer `getTenantDocumentContext` verwendet `bankAccounts[0]` statt des mit `isPrimary` markierten Hauptkontos und setzt eigene Feldwerte pauschal auf `null`. Für ihn wurde in `src` und `app` kein Aufrufer gefunden; er stellt somit keine nachgewiesene Verbindung zum zentralen Katalog her. Diese Datenübernahme ist vor der Erweiterung um weitere Gesellschaften und Standorte zu vereinheitlichen und mit einem neu erzeugten Dokument zu prüfen. Ein Live-Nachweis wurde hier nicht durchgeführt.

### Sichtbereiche vor Mehrstandortfreigabe klären

Die Personaloberfläche bietet „Gesamter Mandant“, „Eigenes Team“, „Standort“ und „Nur eigene Datensätze“ an. `employee_data_scopes` speichert dafür Modul, Typ und einen freien Textwert. Die Suche nach den Scope-Feldern und ihrer Verwendung ergab Speichern, Laden, Anzeige und Auditprotokollierung. Eine Nutzung zur Begrenzung der fachlichen Datensätze wurde nicht gefunden. Die Berechtigungszusammenführung reicht die Scopes nur weiter.

Diese Einstellung darf deshalb auf Grundlage dieses Audits nicht als wirksame Standort- oder Teamtrennung bewertet werden. Vor einer entsprechenden Freigabe sind Datensatzzuordnungen und serverseitige Prüfungen erforderlich. Gesondert zu prüfen sind Suche, Exporte, Dokumente, Anhänge, Direktaufrufe, Nachrichten und Auswertungen. Eine gefilterte Oberfläche allein genügt dafür nicht.

### Bestehendes Inventar weiterverwenden

Die beauftragte Integration sollte vorhandene Bestände und Vorgänge erreichbar machen und dieselben Datensätze verwenden. Eine zweite Inventartabelle unter „Unternehmen“ würde Zuordnungen und Rückgaben auseinanderlaufen lassen.

Die Basiskonfiguration enthält offene Grenzen: produktive Rückgabe-PDFs und MDM-Anbindung sind nicht als erledigt ausgewiesen; Fahrzeug- und Softwarezugangsverknüpfungen sind vorbereitet. `isInventoryLiveReady()` prüft Konfiguration und Demomodus, aber nicht den tatsächlichen Migrationsstand. Diese Kennzeichnung ist kein Live-Nachweis. Welche dieser Grenzen die parallele Integration behebt, muss deren eigener Änderungs- und Prüfbericht festhalten.

## Fachliche Zielstruktur

| Ebene | Zweck | Zugeordnete Informationen und Vorgänge |
| --- | --- | --- |
| Unternehmensgruppe | Gemeinsame Übersicht über ausdrücklich verbundene Unternehmen. | Gesellschaftsbeziehungen, berechtigte Verantwortliche, freigegebene Gesamtauswertungen. Eine Gruppenbeziehung verleiht für sich genommen keinen Zugriff auf alle Akten. |
| Rechtlich eigenständiges Unternehmen | Eindeutiger Vertragspartner und Träger seiner Stammdaten. | Name, Register/Steuern, Vertretung, Bankverbindungen, Verträge, Versicherungen und zugehörige Standorte. |
| Standort | Betrieblicher Ort innerhalb eines Unternehmens. | Anschrift, Kontakt, Leitung/Stellvertretung, Öffnungszeiten, aktive Zeiträume und zugeordnete Ressourcen. Lager und Räume können unterhalb eines Standortes geführt werden. |
| Abteilung oder Team | Zuständigkeit und Zusammenarbeit. | Leitung, Mitglieder mit Gültigkeitszeitraum, Standortbezug, Aufgabenbereich und Kostenstelle. Ein Team kann bei Bedarf mehrere Standorte bedienen. |
| Ressourcen und Vorgänge | Gemeinsame operative Nutzung der Stammdaten. | Personal, Klient:innen, Fahrzeuge, Inventar, Verträge, Policen, Dokumente und Termine mit nachvollziehbarer Zugehörigkeit. |

Franchise sollte als ausdrücklich vereinbarte Beziehung zwischen selbstständigen Unternehmen abgebildet werden. Ein Franchisebetrieb ist nicht allein wegen seiner Markenbeziehung ein Standort des Franchisegebers. Das Modell benötigt Vertragslaufzeit, Gebiet, Ansprechpartner, gültige zentrale Vorgaben, genehmigte Abweichungen und einzeln freigegebene Einsichten. Gebühren und Abrechnungsregeln werden nur ergänzt, soweit sie zum tatsächlichen Geschäftsmodell gehören.

Für Versicherungen und Verträge empfiehlt sich ein gemeinsames Prinzip: Vertragspartner, Gegenstand, zuständige Person, Gültigkeit, nächste Handlung, zugehörige Unterlagen und Änderungshistorie. Die jeweilige Police oder der Vertrag bleibt ein eigener Datensatz und kann mit Gesellschaft, Standort oder Fahrzeug verbunden werden.

Fuhrpark und Inventar sollten eine eindeutige Fahrzeugreferenz teilen. Fahrten bleiben bei ihrem Fahrtenbuch; Ausgabe und Rückgabe bleiben beim Inventarprozess. Die zentrale Fahrzeugakte verbindet diese Vorgänge und zeigt Zuständigkeit, Verfügbarkeit und anstehende Termine.

## Priorisierte Reihenfolge

1. **Beauftragte Inventarintegration umsetzen und gesondert prüfen.** Vorhandene Daten und Rechte verwenden; Zugänge, Rücknavigation, Leer-/Fehlerzustände und reale Personalzuordnungen prüfen. Aus dieser Verknüpfung keine Fertigstellung des gesamten Inventarmoduls ableiten.
2. **Organisationsmodell und Zugriffsgrenzen festlegen.** Rechtseinheit, Standort, Lagerort und Team eindeutig unterscheiden. Regeln für gemeinsame Mitarbeitende, Vertretungen, Standortwechsel, Archivierung und historische Vorgänge definieren. Gespeicherte Sichtbereiche wirksam durchsetzen und anhand konkreter erlaubter/verbotener Zugriffe nachweisen.
3. **Standorte und Abteilungen zentral verwalten.** Hauptsitz übernehmen, weitere Standorte erfassen, Verantwortliche und Teams zuordnen. Bestehende Personal- und Kostenstellendaten anbinden; keine doppelte Stammdatenpflege einführen.
4. **Versicherungs- und Vertragsregister mit Fristen ergänzen.** Mehrere Policen und Verträge, Objektbezug, Dokumente, Verantwortlichkeit und fällige Handlungen. Erinnerungen benötigen einen tatsächlich laufenden und überprüften Zustellweg.
5. **Fuhrpark vervollständigen.** Fahrzeuge zentral zuordnen, Poolnutzung, Wartungs-/Vertragsdaten und Ausgaben mit dem bestehenden Fahrtenbuch verbinden. Doppelte Fahrzeugidentitäten vermeiden.
6. **Gesellschaftsgruppen und Franchise darauf aufbauen.** Partnerbeziehungen, freigegebene Gruppenansichten, zentrale Vorgaben und lokale Abweichungen erst auf belastbarer Zuordnung und Zugriffskontrolle einführen.

## Fundstellen der geprüften Basis

Die Pfade beziehen sich auf den oben genannten Commit. Zeilen können sich in späteren Änderungen verschieben.

| Fundstelle | Beleg |
| --- | --- |
| `src/lib/tenant/companyWorkspaceModel.web.ts`, Funktion `companySections` | Ein Hauptsitz; Versicherung als einzelnes Haftpflichtprofil; Organisation ohne Standort-, Franchise-, Inventar- oder Vertragsregister. |
| `src/lib/tenant/tenantCenterSections.ts`, Abschnitt `locations` | Standortbereich als nicht bearbeitbarer Platzhalter. |
| `src/liquid-command/screens/CompanyWorkspace.web.tsx`, `openSection`, `canManage` | Standortaktion führt zu Unternehmensdaten; gemeinsames Recht `business.tenant.manage`. |
| `src/types/tenant/tenantCenter.ts`, `TenantCompanyProfile`, `TenantLegalProfile`, `TenantCenterSnapshot` | Einzelnes Unternehmens-/Haftpflichtprofil; mehrere Kontakte, Vertretungen und Konten. |
| `src/lib/office/employeeSupabasePayload.ts`; `src/components/office/EmployeesListExperience.web.tsx` | Abteilung wird gespeichert und ist filterbar. |
| `src/lib/office/officeComposeRecipientService.ts` | Teamempfänger aus den Abteilungswerten des Personals. |
| `supabase/migrations/0161_homeoffice_time_tracking.sql` | Tabellen `tenant_work_organizations`, `tenant_cost_centers`, `tenant_projects`. |
| `src/lib/timeTracking/timeTrackingSettingsService.ts`, `upsertWorkOrganization`, `upsertCostCenter` | Produktive Schreibsperren für Organisationseinheiten und Kostenstellen. |
| `supabase/migrations/0113_voicecore_ai.sql`, `tenant_memberships` | Mitgliedschaftsbasis, keine Gesellschaftshierarchie. |
| `supabase/migrations/0108_tenant_center_foundation_live.sql`; `supabase/migrations/20260730173000_portal_internal_rls_separation.sql` | Tenantbezogene Unternehmensprofile und Trennung interner-/Portalsitzungen in versionierten Richtlinien. |
| `src/lib/office/employeeRbacSaveService.ts`; `src/components/office/rbac/RbacSpecialPermissionsPanel.tsx` | Wählbare Team-/Standort-Sichtbereiche und freier Scope-Wert. |
| `src/lib/permissions/rbacService.ts`, `mergeEffectivePermissions`; `src/lib/permissions/enforce.ts` | Scopes werden mitgeführt; Berechtigungsprüfung arbeitet mit Berechtigungsschlüsseln. |
| `supabase/migrations/0173_rbac_dynamic_model.sql`, `employee_data_scopes` | Speicherung als Modul, Texttyp und Textwert ohne konkrete Standort-/Teamreferenz. |
| `src/types/modules/employeeLogbook.ts`; `src/lib/employeeLogbook/employeeLogbookRepository.supabase.ts`; `supabase/migrations/20260822123000_employee_logbook_live_r1.sql` | Mitarbeitendenbezogene Fahrzeuge, privater/betrieblicher Besitz und Fahrtzuordnung. |
| `app/pflege/fuhrpark.tsx` | Fuhrparkroute als nach `vehicles` gefilterte Inventarliste. |
| `src/types/inventory/index.ts` | Lagerorte, Ausstattung, Ausgabe, Rücknahme, Schäden, Fristen und vorbereitete Fahrzeugreferenz. |
| `src/lib/inventory/inventoryService.ts`; `src/lib/inventory/inventoryRepository.supabase.ts` | Vorhandene Inventarservices mit Berechtigungs-/Tenantprüfung und Supabase-Zugriff. |
| `src/screens/inventory/InventoryListScreen.tsx` | `demoEmployees` für Namensauflösung, Personalausstattung und Ausgabeempfänger auf der geprüften Basis. |
| `src/lib/inventory/inventoryModuleConfig.ts` | Grenzen bei MDM, Rückgabe-PDF und vorbereiteten Kategorieverknüpfungen; Konfigurationsprüfung ist kein Migrationsnachweis. |
| `src/types/documents/contract.ts`, `ContractRecord` | Vertragsdokumentmodell mit `termStart`, `termEnd`, `noticePeriod`; kein Nachweis einer zentralen Unternehmens-Fristensteuerung. |
| `src/lib/documents/centralCatalogService.ts`, `loadCompanySource`, `loadCentralContext`, `mapCentralContext` | Unternehmensvertretung aus `tenants`; Dokumenteinstellung lädt nur das Logo, obwohl der Mapper auch Bankdaten daraus erwartet. Keine Abfrage von `tenant_bank_accounts` oder `tenant_representatives` in diesem Service. |
| `src/lib/tenant/tenantCenterService.ts`, `saveTenantRepresentatives`, `saveTenantBankAccounts`; `src/lib/tenant/tenantLogoService.ts`, `persistTenantLogoUrl` | Neue Stammdaten werden nach `tenant_representatives`, `tenant_bank_accounts` und `tenant_branding` geschrieben. Konten werden im Snapshot nach `sort_order` geladen. |
| `src/lib/tenant/tenantCenterIntegrations.ts`, `getTenantDocumentContext` | Erstes Konto statt Hauptkonto; eigene Feldwerte `null`. Suche mit `git grep` auf der geprüften Basis findet unter `src` und `app` nur die Definition, keinen Aufruf. |
