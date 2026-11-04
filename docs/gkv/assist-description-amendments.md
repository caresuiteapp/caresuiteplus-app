# Berichtigung einer abgeschlossenen Assist-Leistungsbeschreibung

Stand: 04.11.2026. [SQL-Entwurf 10](sql/monthly-assist-amendments-draft.sql) ist kein aktiviertes Datenbankschema. Er benötigt die neun bisherigen Monatsentwürfe, darunter die aktualisierten Fassungen für Monatsnachweise, Quellenauswahl und Originalverifikation. Das Fachverhalten ist auf die Beschreibung einer tatsächlich bereits persönlich versiegelten Leistung begrenzt.

## Was die Pflegekraft berichtigen kann

Im abgeschlossenen Web-Einsatz öffnet die ursprüngliche Pflegekraft „Beschreibung berichtigen“. Sie prüft den Wortlaut, erfasst die vollständige berichtigte Beschreibung und begründet die Änderung. Vor dem Speichern sieht sie den Hinweis, dass eine bereits bestätigte Monatsfassung dadurch ungültig wird. Einsatzzeit, Mitarbeitende, Klient, Aufgaben, Mengen und Leistungsziffern lassen sich mit diesem Auftrag nicht ändern. Altbelege ohne persönliche Ursprungsbindung sind ausgeschlossen.

Ein Nachtrag gehört zu genau einer Original-ID und ihrem Hash. Die Datenbank überprüft den persönlichen Zugang, die ursprüngliche Beschäftigtenzuordnung, den kanonischen Nachweis und den ausdrücklich angezeigten Bearbeitungsstand. Sie speichert den Text, den Grund, die Vorgängerkennung, Person, Sitzung und Serverzeit in einem eigenen unveränderbaren Datensatz. Die ursprüngliche Assist-Unterschrift und ihr PDF bleiben unverändert. Sie gelten weiterhin nur für den damaligen Wortlaut. Der Nachtrag ist eine dokumentierte Erklärung der Pflegekraft, keine erneut eingeholte Unterschrift des Klienten im Tagesbeleg.

Im Verlauf bleiben auch frühere Berichtigungen einsehbar; jeweils zehn Einträge werden geladen. Eine fehlende Speicherantwort löst keine automatische Wiederholung aus. Der persönliche Auftrag lässt sich lesend klären. Nur wenn er nicht vorliegt und der Ausgangsstand unverändert ist, kann dieselbe Auftragskennung ausdrücklich erneut gesendet werden.

## Was mit dem Monatsnachweis passiert

| Stand bei der Berichtigung | Folge |
| --- | --- |
| Noch kein Monatsnachweis | Beim späteren Anlegen übernimmt die Datenbank die aktuelle Berichtigung neben den unterschriebenen Originaltext. |
| Monatsnachweis offen | ID und Fassung bleiben erhalten. Bearbeitungsstand und Inhaltshash ändern sich. Bereits vorbereitete Erfassungen und Quittungen passen nicht mehr; die Fachangaben müssen erneut übernommen werden. |
| Monatsnachweis bestätigt | Die bestätigte Fassung bleibt mit ihren bisherigen Originalbytes, der Bestätigung und dem Archivverweis als entwertete Fassung erhalten. Ein offener Nachfolger erhält eine neue ID und enthält keine Bestätigung, Unterschrift oder eingefrorenen Fachangaben. |

Berichtigung, betroffene Monatsfassungen und Prüfprotokolle werden zusammen gespeichert oder gemeinsam zurückgerollt. Ein geteilter Transaktionslock für reguläre Monatsänderungen und ein exklusiver Lock für die Berichtigung koordinieren die Schreibvorgänge innerhalb eines Mandanten. Die Tests mit PGlite ersetzen keine Messung mit mehreren echten Datenbankverbindungen.

Die neue Formatkennung schützt vor gemischten Programmversionen: Frühere Web- und Host-Leser akzeptieren nur das bisherige Format und dürfen die ergänzte Beschreibung nicht übersehen. In der aktuellen Monatsansicht, im Fassungsvergleich und im Monats-PDF stehen Original und Berichtigung getrennt. Vor der neuen Erfassung müssen die Fachangaben für ein unterstütztes Profil übernommen werden. Ein Abschluss mit „fehlender Unterschrift“ ist für berichtigte Leistungsbeschreibungen gesperrt. Erst die neue persönliche Monatsbestätigung bindet den geänderten Inhalt. Das Fach-XML verwendet unverändert die vorgesehenen Felder; für den Freitext wird kein zusätzliches XML-Element erfunden.

Die Änderung deckt die GKV-Monatsnachweise ab. Sie ändert weder bereits ausgestellte Rechnungen noch versandte Abrechnungen und löst keine Nachricht an einen Kostenträger aus.

## Reproduzierbare Prüfung

- `npm run verify:gkv:monthly-web` führt die bestehenden Prüfgruppen sowie die neuen PGlite-, Portal-, Katalog- und CMS-Fälle aus.
- [SQL und Dienst](../../tests/gkv-exchange/monthly-assist-amendments.test.mjs): Vor-Ort- und Portalquelle, zwei Schreibstände, alte Quittung, neue Monatsunterschrift, alte Originalbytes, Fehler-Rollback, Identität und komplette paginierte Historie.
- [Web-Oberfläche](../../src/__tests__/assistWorkflow/gkvAmendmentPanel.web.test.tsx): gesperrte und nicht aktivierte Funktion, ausdrückliche Bestätigung, verlorene und ausbleibende Schreibantwort, unveränderte Wiederholung und fremdes Ergebnis.
- `npm run verify:gkv:amendment-cms`: Die vorhandene lokale SOAP-/Kartenfixture überprüft die alte archivierte und die neu bestätigte Fassung. Der Test benutzt die vorhandene XSD-/CMS-Prüfung und erzeugt keinen Hardware- oder TI-Nachweis.

Die Beschreibung der Prüffälle ist kein Ausführungsprotokoll. Die tatsächlich ausgeführten Prüfungen, der Commit und die Vorschau-Ergebnisse stehen in [PR #129](https://github.com/caresuiteapp/caresuiteplus-app/pull/129). Die Web-Tests verwenden einen DOM ohne Layoutberechnung. Die PDF-Prüfung liest den Text aus dem erzeugten Dokument. Breite und schmale Browseransichten, optische PDF-Abnahme dieser Änderung, reale Portal-/Storage-/PostgreSQL-Abnahme, Aktivierung und unabhängige Prüfungen bleiben offen. Berichtigung von Zeiten und Leistungspositionen, mobile Einzelerfassung und Mehrpersonenleistungen sind eigene Aufgaben.
