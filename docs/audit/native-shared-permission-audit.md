# Gemeinsame Rechteauflösung im Portal-Audit

Der Live-Hook vergibt vor Abschluss seiner Abfrage keine statischen Rollenrechte. Sichtbare Rechte sind an Mandant, Rolle, Profil, Authperson, Portalkonto und Sitzung gebunden. Wechsel verwerfen den alten Zustand sofort; späte Antworten und Fehler können ihn nicht wieder einsetzen. Die leere Rechtemenge bleibt referenzstabil, damit abhängige Formulare nicht durch jeden Render einen neuen Berechtigungsbesitzer erhalten.

Der Repository-Cache wird nur bei explizit übergebener Identität verwendet und läuft nach 30 Sekunden aus. Nicht identitätsgebundene Serviceaufrufe lesen frisch. Eine Cacheleerung verhindert auch das spätere Wiedereintragen einer alten Anfrage. Fehlende Verbindung und Fehler beim Lesen von Rollen, Basisrechten oder Mandantenüberschreibungen führen zu keiner Rechtevergabe und werden nicht als erfolgreicher Cacheeintrag gespeichert.

Der lesende Produktionskatalog bestätigt, dass Rollenschlüssel pro Mandant und nicht global eindeutig sind. Die Abfrage wählt deshalb zuerst die exakte Mandantenrolle und nur nach einem erfolgreichen leeren Ergebnis die Systemrolle. Mandantenüberschreibungen werden auch ohne historische Basisrollendefinition ausgewertet.

Die bestehende statische Vorgabe bei einer erfolgreich gelesenen, vollständig leeren Legacydefinition bleibt erhalten. Sie ist keine generelle Freigabe bei Transportfehlern. Dieser Vertrag unterscheidet weiterhin fehlende Definitionen von einer explizit modellierten vollständigen Rollenverweigerung; die Serverberechtigung bleibt maßgeblich.

Die beiden Tests `runtimePermissionScope.test.tsx` und `runtimePermissionRepository.test.ts` prüfen echte Hook-/Repositorypfade mit synthetischen Transportantworten, darunter Konto-/Mandanten-/Sitzungswechsel, späte Antworten, Abfragefehler, Cacheisolation und gleichnamige Rollen. Sie belegen weder produktive RLS-Ausführung noch den sofortigen Widerruf aller bereits geöffneten Daten bei serverseitigen Rechteänderungen. Ein solcher vollständiger Ende-zu-Ende-Nachweis bleibt offen.
