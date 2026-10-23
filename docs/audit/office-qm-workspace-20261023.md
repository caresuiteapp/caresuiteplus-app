# Office-Qualitätsmanagement: Funktionsprüfung und Überarbeitung

Stand: 23.10.2026. Basis: `c339d36731c4479fd6345f809195bfacad3e8293`.

## Auftrag und Grenzen

Überarbeitung der QM-Oberflächen für Web/Desktop, Prüfung der Datenabfragen, Navigation und tatsächlich verfügbaren Funktionen. Die nativen Android-Ansichten werden nicht umgestaltet. Bestehende fachliche Schutzsperren bleiben erhalten. Es werden keine produktiven Testdatensätze angelegt, verändert oder gelöscht.

## Belegter Ausgangszustand

- Das Dashboard mountete mehrere voneinander unabhängige Fachpanels beim Öffnen. Mindestens die Sturz-/Ereignisanalyse führte laut Nutzerbild zu einem automatisch geöffneten Zugriffsfehler. Der Qualitätsarbeitsplatz war gleichzeitig gesperrt.
- Die Live-Dashboardabfrage lieferte Compliance-Anzahl `0`, Änderungen `[]` und anstehende Audits `[]` als feste Ersatzwerte. Diese Angaben belegten keinen leeren Datenbestand.
- Die Navigation bezeichnete Audits, Maßnahmen, Compliance, Änderungen und MD-Arbeitsabläufe als verfügbar. Mehrere zugehörige Legacy-Services waren im Livebetrieb ausdrücklich gesperrt.
- Die MD-Liste las zwar Livezeilen, castete die Datenbankfelder jedoch ohne Mapping auf das Frontendmodell. Dadurch fehlten beispielsweise `inspectionYear` und `datenschutzConfirmed`.
- Das MD-Detail verwendete einen Demo-Store für Freigabetoken. Mutationsergebnisse wurden nicht ausgewertet; die entsprechenden Liveaktionen waren im Service ohnehin gesperrt.
- QM-Einstellungen zeigten feste Demo-Standardwerte, obwohl keine gespeicherte Mandantenkonfiguration gelesen wurde.

## Funktionsmatrix

| Bereich | Prüfung und Änderung | Verbleibende Grenze |
| --- | --- | --- |
| QM-Übersicht | Eigener Web-Arbeitsplatz mit kontrastreichen Kennzahlen, kompakten Registerzugängen und explizitem Status der Fachbereiche. Datenfehler werden nicht als Nullbestand ausgegeben. | Eine erfolgreiche Datenabfrage bestätigt den gespeicherten Stand, keine fachliche Vollständigkeit. |
| Mandanten-/Kontowechsel | Web-QM-Abfragen sind an Konto, Mandant, Rolle, Sitzung und bestätigte Rechte gebunden. Wechsel invalidiert alte Ergebnisse. | Angemeldeter Ende-zu-Ende-Nachweis erforderlich. |
| Audits | Echte `SELECT`-Abfrage von `qm_audits`, Suche nach Titel/Inhalt/Prüfer, deutscher Statusfilter, Termin, Feststellungen und ausklappbare Details. | Anlegen, Bearbeiten und Abschließen bleiben gesperrt. |
| Maßnahmen | Echte `SELECT`-Abfrage von `qm_measures`, Suche, Statusfilter, Frist, Zuständigkeit, Auditbezug und Beschreibung. | Keine Scheinspeicherung; bestehende Schreibsperre bleibt erhalten. |
| Compliance | Echte `SELECT`-Abfrage von `qm_compliance_requirements`, Status/Frist/Verantwortung und Links zu Nachweisdokumenten. | Bearbeiten und Freigeben nicht angebunden. Ein gespeicherter Status ist keine neue rechtliche Bewertung. |
| Änderungen | Echte `SELECT`-Abfrage von `qm_changes`, Suche, Statusfilter, Änderungsart, Beschreibung und Dokumentbezug. | Anlegen und Bearbeiten nicht freigeschaltet. |
| Rechtsgrundlagen | Echte `SELECT`-Abfrage von `qm_legal_references`, Referenz, Quelle, Gültigkeitsdatum und Dokumentlinks. | Keine automatische Aktualitätsprüfung oder Rechtsfreigabe. |
| MD-Mappenliste | Tatsächliche Felder werden gemappt; Suche nach Titel, Prüfjahr, Inhalt und Freigabeverantwortung. Gespeicherte Statuswerte und Datenschutzbestätigung werden angezeigt. | Der Listenstatus aktiviert keine externe Freigabe. |
| MD-Mappeninhalt | Mandanten- und mappengefilterte Header-/Inhaltsabfrage. Gespeicherte Dokument- und Fassungsreferenzen bleiben unverändert; Links öffnen die Dokumentansicht. | Die dort aktuelle Dokumentreferenz kann von der in der Mappe gespeicherten Fassung abweichen; dies wird angezeigt. |
| MD-Erstellen/Freigabe/Export | Defekte Liveaktionen aus der Web-Leserichtung entfernt; Vorbereitungsstand benannt. Liveansicht liest keine Demo-Freigabetoken. | Externe Links, QR-Freigabe, Widerruf und Export bleiben gesperrt. |
| MD-Zugriffsprotokoll | Keine automatische Abfrage einer zusätzlich geschützten/noch nicht angebundenen Logfunktion beim Öffnen einer Mappe. | Zugriffsprotokoll wird in dieser Überarbeitung nicht als live freigeschaltet. |
| Handbuch | Web-Überarbeitung separat durch Dokument-Arbeitsstrang; bestehende Live-Leserichtung bleibt Grundlage. | Kapitel anlegen, ändern und versionieren waren in den Legacy-Services gesperrt; kein pauschales Freischalten. |
| QM-Dokumente/Fassungen | Web-Überarbeitung separat durch Dokument-Arbeitsstrang. Gespeicherte Referenz und zugehörige Lesebelege müssen getrennt bleiben. | Eine neuere Fassung ersetzt keine gespeicherte aktuelle Referenz. Keine ungeprüfte Freigabe. |
| Vorlagen | Web-Überarbeitung separat durch Dokument-Arbeitsstrang. Der Legacy-QM-Vorlagenservice war im Livebetrieb gesperrt. | Ein Textentwurf oder eine Vorlage ist kein freigegebenes QM-Dokument. |
| QM-Einstellungen | Web zeigt den tatsächlichen Vorbereitungsstand; feste Werte wie 12 Monate oder 90 Tage werden nicht als aktive Mandantenwerte ausgegeben. | Keine persistente Konfiguration angebunden. |
| QM-Assistent | Direkter Webaufruf zeigt Vorbereitungsstand und Zugang zu vorhandenen Dokumenten. | Kein echter KI-Aufruf oder Entwurfsspeicher freigeschaltet. |
| QM-Export | Direkter Webaufruf zeigt Vorbereitungsstand und navigiert zu Dokumenten/Mappen. | Keine Links für nicht erzeugte Dateien; kein freigeschalteter Exportjob. |
| Aktualisieren | Sichtbare Schaltflächen, getrennte Initial-/Aktualisierungsfehler, erneuter Versuch; bereits geladene Register werden bei Refreshfehler als bisheriger Stand ausgewiesen. | Verfügbarkeit und Ausführung unter echter Sitzung noch separat prüfen. |
| Filter/Details | Suchwörter werden gemeinsam angewandt, deutsche Statusbegriffe sind durchsuchbar, Reset verfügbar; native `details` sind per Tastatur bedienbar. | Visuelle Prüfung ist vom reinen Funktionstest getrennt. |
| Umfangreiche Register | Explizite Spalten, stabile Reihenfolge mit ID, Abfrage in Seiten zu 250 Zeilen. Über 20.000 Zeilen wird keine unvollständige Liste als Gesamtbestand ausgegeben. | Kein transaktionaler Snapshot über mehrere HTTP-Anfragen. |

## Datenbanknachweis

Der separate Datenbank-Review bestätigte am 23.10.2026 in `caresuiteplus-production` die vorhandenen Registertabellen und die Spalten aus Migration 0015. Für `qm_audits`, `qm_measures`, `qm_compliance_requirements`, `qm_changes`, `qm_legal_references`, `md_audit_packages`, `md_audit_package_items` und `md_audit_access_logs` bestehen `SELECT`-Grants für `authenticated`; RLS ist eingeschaltet. Die geprüften Kernregister enthielten zum Prüfzeitpunkt keine Datensätze.

Die bestehenden Policies begrenzen auf `tenant_id = current_tenant_id()`, unterscheiden jedoch keine QM-Fachrollen. Die neue Leserichtung verwendet ausschließlich den angemeldeten Client, vorhandene Tenant-Guards und die bestätigten QM-Leserechte. Es werden keine erhöhten Zugangsdaten verwendet und keine Policies gelockert. Neue Schreibabläufe bleiben aus diesem Grund ausdrücklich außerhalb dieser Freigabe.

## Verifikation

Für die Register-/Mappen-Leserichtung:

- `node --test scripts/checks/qm-registers-web.node.test.mjs`: 7 Tests bestanden.
- Geprüft: snake_case-Mapping aller sechs Register, Fremdmandanten und unvollständige Zeilen, deutsche Suche mit Statusfilter, Pagination über 250 Datensätze, Verweigerung vor Datenbankzugriff, Abfrage-/Envelopefehler sowie unveränderte MD-Fassungsreferenz.
- Syntaxprüfung der bearbeiteten Web-TSX mit vorhandenem Playwright/Babel bestanden.
- `git diff --check` bestanden.
- Keine Schreibtests auf Produktionsdaten durchgeführt.

Das sind Funktions- und Quellcodebelege. Die angemeldete Prüfung der realen Oberfläche in breiter und schmaler Darstellung sowie der tatsächliche Build-/Deploymentstatus sind separat nachzutragen; aus diesen Prüfungen folgt keine vollständige visuelle Abnahme.
