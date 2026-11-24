# BfArM-Referenzdaten im Medikationsmodul

CareSuite zeigt nach Eingabe einer vollständigen achtstelligen PZN genau einen Referenzdatensatz an. Die Ansicht steht in der Medikamentenerfassung unter „BfArM · PZN“ zur Verfügung. Sie zeigt die Arzneimittelbezeichnung, Darreichungsformen und alle Wirkstoffangaben getrennt nach Komponente. Quelle und Lieferdatum stehen direkt am Ergebnis; ab dem nächsten regulären Liefertermin wird ein überholter Stand gekennzeichnet.

Die Ansicht dient zum Abgleich. Sie kopiert keine PZN oder Referenzdatensätze in Verordnungen, allgemeine Kataloge, Trefferlisten oder Exporte. Bestehende Verordnungsprüfungen und klinische Zugriffsregeln werden nicht geändert. Die gemeinsame React-Native-Komponente und der gemeinsame Dienst gelten für Web und App.

## Speicherung und Zugriff

Die Original-ZIP wird unverändert in `bfarm_reference.archive_chunks` gespeichert. Originalprüfsumme, Dateiprüfsummen und Mengen stehen in `bfarm_reference.deliveries`. Aufbereitete Einzelansichten liegen in `bfarm_reference.packages`. Diese Tabellen besitzen RLS und keine Leserechte für `anon`, `authenticated` oder `service_role`. Das Schema ist nicht als Data-API-Schema vorgesehen.

`get_pflege_bfarm_reference(tenant, pzn)` liefert ein einzelnes JSON-Objekt oder `null`. Die private Lesefunktion prüft `auth.uid()` und die bereits vorhandene aktuelle Pflege-Leseberechtigung des Mandanten. Portale, fremde Mandanten, inaktive Profile und unvollständige oder ungültige PZN werden abgewiesen. Es gibt keinen Such-, Listen-, Download- oder Exportendpunkt für die Lieferung.

Eine neue Lieferung bleibt bis zur Bestätigung von Original-ZIP-Prüfsumme und sämtlichen Mengen inaktiv. Geprüfte Originale und ihre aufbereiteten Datensätze sind unveränderlich. Der aktive Zeiger wird erst nach dem vollständigen Import umgestellt; ein älterer Stand kann einen neueren nicht ablösen.

## Lieferungen importieren

Node.js 24 und die vorhandenen Projektabhängigkeiten verwenden:

```bash
node scripts/bfarm-reference-import.mjs --archive ORIGINAL.zip --out PRIVATER_ORDNER
```

Der Ausgabeordner muss außerhalb des Git-Projekts liegen. Er enthält geschützte SQL-Importteile und ein Manifest. Originaldateien und Importteile gehören weder in Git noch in `public`, `assets`, `dist` oder ein App-Paket. Administratoren können die Teile über den bestehenden Datenbankzugang anwenden. Der optionale Modus `--apply --project PROJEKTKENNUNG` verwendet ausschließlich einen im Prozess vorhandenen `SUPABASE_ACCESS_TOKEN`. Keine Zugangsdaten als Kommandozeilenargumente oder im Repository speichern.

BfArM-Ränge von `0` werden erhalten. Fehlende Wirkstärken bleiben fehlend. Kombipackungen werden mit ihren einzelnen Komponenten angezeigt. Für das bestehende, auf 500 Zeichen begrenzte allgemeine Katalogformat wird eine zu lange zusammengefasste Wirkstärke ausgelassen; die vollständigen Originalangaben bleiben in den Komponenten und im Originalexport erhalten.

## Verifikation

- Isolierte PostgreSQL-Tests für Aktivierung, Originalintegrität, Zugriffsgrenzen, Einzelabfragen und Unveränderlichkeit.
- Komponentenprüfungen für vollständige PZN, Lade-/Fehler-/Leerzustände, Mandantenwechsel und veraltete Lieferungen.
- Bestehende Tests zur Medikamentenerfassung und Katalogsuche sowie gemeinsamer Web-/App-Abgleich und TypeScript.
- Das Git-Bash-Veröffentlichungspaket prüft die neue Ansicht vor dem Release mit Edge bei 1440, 768 und 390 Pixeln. Die Browserprüfung in der Linux-Arbeitsumgebung war durch die Umgebung blockiert; DOM-Tests gelten nicht als visueller Nachweis.

Die Lieferung vom 15.11.2026 enthält 92.769 Arzneimittel, 96.305 Komponenten und 141.251 Wirkstoffzuordnungen. Fünf Zuordnungen enthalten keine Wirkstärke. Der regelmäßige Bezug erfolgt nach der vorliegenden BfArM-Korrespondenz zum 1. und 15. eines Monats per E-Mail. Die Anzeige fordert dazu auf, sich möglichst auch direkt bei der Originalquelle zu informieren.
