# Registrierung: verbindliche Unternehmensvorgaben

Stand: 12. September 2026

## Umfang
Rechtsform und Einrichtungstyp / Branche werden über feste Auswahllisten erfasst. Es ist keine Kategorie vorausgewählt. Firmenname und IK-Nummer bleiben individuelle Angaben. Die Auswahl bescheinigt keine amtliche Registrierung, Zulassung oder Abrechnungsberechtigung.

## Rechtsformen
| Schlüssel | Bezeichnung |
| --- | --- |
| einzelunternehmen | Einzelunternehmen |
| ek | e. K. |
| ug | UG (haftungsbeschränkt) |
| gmbh | GmbH |
| gug | gUG (haftungsbeschränkt) |
| ggmbh | gGmbH |
| gbr | GbR |
| egbr | eGbR |
| ohg | OHG |
| kg | KG |
| gmbh_co_kg | GmbH & Co. KG |
| ag | AG |
| eg | eG |
| ev | e. V. |
| stiftung | Stiftung |
| kdoer | Körperschaft des öffentlichen Rechts |
| adoer | Anstalt des öffentlichen Rechts |
| sonstige | Sonstige Rechtsform |

## Einrichtungstyp / Branche
| Schlüssel | Bezeichnung |
| --- | --- |
| alltagsbegleitung | Ambulante Alltagsbegleitung |
| betreuungsdienst | Ambulanter Betreuungsdienst |
| pflegedienst | Ambulanter Pflegedienst |
| haushaltsdienst | Haushaltsnahe Dienstleistungen |
| persoenliche_assistenz | Persönliche Assistenz |
| betreutes_wohnen | Betreutes Wohnen / Servicewohnen |
| ambulante_wg | Ambulant betreute Wohngemeinschaft |
| tagespflege | Tagespflege |
| nachtpflege | Nachtpflege |
| kurzzeitpflege | Kurzzeitpflege |
| stationaere_pflege | Vollstationäre Pflegeeinrichtung |
| eingliederungshilfe | Einrichtung der Eingliederungshilfe |
| pflegeberatung | Pflegeberatung / Beratungsstelle |
| bildung | Bildungs- und Schulungsanbieter |
| pflege_allgemein | Pflegeeinrichtung (allgemein) |
| sonstige | Sonstiger Einrichtungstyp |

## Verarbeitung
- „Sonstige“ verlangt eine Beschreibung mit 2 bis 180 Zeichen.
- Bekannte ältere Schreibweisen werden eindeutig zugeordnet. Beispielsweise entspricht „UG“ dem Schlüssel `ug`; gUG, GmbH und gGmbH bleiben getrennt.
- Unbekannte Altwerte werden nicht geraten oder stillschweigend ersetzt. Die Registrierung fordert eine Auswahl; bestehende Datensätze bleiben lesbar.
- Die Web-Registrierung übergibt kanonische Bezeichnungen sowie `legalFormKey`, `industryKey` und die Katalogversion `2026-09-12`.
- Die Registrierungsfunktion prüft die Übereinstimmung vor dem Anlegen des Kontos.
- Die Datenbank leitet die Schlüssel nochmals aus den tatsächlich gespeicherten Unternehmensangaben ab. Die zusätzlichen Spalten heißen `tenants.legal_form_key`, `tenants.industry_key` und `tenants.registration_catalog_version`.
- Die bisherigen Anzeigefelder bleiben Klartext. Der bestehende atomare Registrierungs-RPC wird weiterhin verwendet.
- Keine automatische Umschreibung vorhandener Unternehmen. Für bekannte Altwerte ist eine lesende Zuordnung über `resolve_company_registration_key` möglich.
- Kataloge im bestehenden System: `company_legal_form` und `company_industry`.
- Abgleichfunktion `compareCompanyCatalogValues`: true = gleiche Kategorie, false = unterschiedliche Kategorien, null = manuelle Zuordnung erforderlich. „Sonstige“ allein begründet keine Übereinstimmung.
- Die Branchenauswahl schaltet keine Funktionen ab und löst keine Tarifauswahl aus.

## Prüfung und Veröffentlichung
22 automatisierte Prüfungen bestanden: Kataloge und Alias-Eindeutigkeit, Bedienung der Auswahl, serverseitige Provisionierung sowie SQL-Migration und Speicherung in einer isolierten PGlite-Datenbank. Keine produktiven Konten für Tests angelegt.

Die bestehende vollständige Unternehmensvorschau kann mit dem aktuellen Projektstand wegen zusätzlicher Live-API-Abhängigkeiten in anderen Oberflächen nicht gebaut werden. Ihre Netzwerksperre bleibt bestehen. Die separate Registrierung wurde erfolgreich gebaut und im isolierten DOM auf Entwurfswiederherstellung, Erhalt der Auswahl beim Schrittwechsel und Pflichtbeschreibung bei Sonstige geprüft. Eine visuelle Browserprüfung ist noch nicht belegt.

Veröffentlichungsreihenfolge:
1. Migration `20260912210000_company_registration_catalog.sql` als Transaktion anwenden.
2. Edge Function `register-business-tenant` einschließlich des gemeinsamen Katalogs veröffentlichen.
3. Webversion veröffentlichen.

Ältere Clients ohne Katalogversion werden serverseitig weiterhin angenommen. Neue Katalogdaten werden streng geprüft. Die Datenbankänderung, Edge Function und Webversion sind zusammen für die Freigabe vorgesehen.
