# Klientenportal: interne Freischaltungshinweise

Fehlende ambulante Portal-RPCs wurden bislang als „Die Pflegeanbindung ist noch nicht freigeschaltet“ an `ErrorState` gegeben. Dessen Standarddarstellung öffnet einen blockierenden Dialog, obwohl dieser optionale Bereich für den Zugang noch nicht bereitsteht.

Der gemeinsame Portaldienst unterscheidet jetzt fehlende Serverfunktionen beziehungsweise Tabellen von echten Ladefehlern. Der optionale Pflegebereich bleibt während der ersten Verfügbarkeitsprüfung und bei fehlender Verfügbarkeit oder Berechtigung unsichtbar. Das gilt auch nach einem zuvor erfolgreichen Abruf; veraltete Nachweise und Aktionen bleiben dann nicht sichtbar. Tatsächliche Ladefehler erscheinen verständlich und mit Wiederholung direkt im betroffenen Bereich. Beim Unterschreiben, PDF-Abruf und Lesen gespeicherter Unterschriften gelangen keine internen Verfügbarkeitscodes in die Anzeige. Der zweite Verbraucher des gemeinsamen Dienstes, das Mitarbeitendenpanel, behandelt diese Codes ebenfalls.

Die zentrale Portaltextprüfung filtert außerdem interne Modul-, Schnittstellen- und Freischaltungsangaben. Fachliche Hinweise wie „Dokument nicht gefunden oder nicht freigegeben“ bleiben erhalten. Der gemeinsame Quellstand gilt für Web und App; keine Datenbankfreigabe oder Berechtigungsänderung ist Teil dieser Korrektur.

Prüfstand vor Veröffentlichung:

- 51 gezielte Vitest-Prüfungen bestehen in vier Suiten: Verfügbarkeit, Aktualisierung, echte Fehler, Signatur-/PDF-Aktionen, Rollen, bestehende Klientenabläufe und lokale SQL-Zugriffssicherung.
- Gezielte semantische TypeScript-Prüfung der sechs geänderten Quelldateien/Tests einschließlich vorhandener Ambientdeklarationen und 3.296 Abhängigkeitsdateien: keine Diagnosen. Der vollständige lokale Projektlauf überschritt die Speichergrenze und ist dadurch nicht als bestanden belegt; die bestehende Produktionspipeline bleibt unverändert maßgeblich.
- Native-Generierung und anschließende Synchronitätsprüfung: 1.170 Module, 274 Routen, keine veralteten Dateien.
- `git diff --check` besteht.
- Die angemeldete Nachweisansicht konnte weder breit noch schmal visuell abgenommen werden: Die verfügbare Browsersitzung führt zur Portalanmeldung. Die DOM-Interaktionsprüfungen ersetzen diese visuelle Abnahme nicht.
