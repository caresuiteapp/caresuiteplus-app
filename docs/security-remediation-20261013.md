# Weitere bestätigte Dokument- und Serverfehler

## Ausgeführte Korrekturen

Der Serverrenderer setzte Kontextwerte als HTML ein und ließ Platzhalter mit mehreren Leerzeichen stehen. Reproduktion mit ausschließlich synthetischen Daten bestätigt. Die Ersetzung arbeitet jetzt einmalig auf dem ursprünglichen Vorlageninhalt, kodiert Textzeichen und erweitert keine Platzhalter aus eingefügten Daten. Neun Fälle bestehen auf Staging und Produktion. Keine gespeicherten Dokumente oder Geschäftszeilen verändert. Dies ist keine allgemeine HTML-Vorlagensanitisierung oder Prüfung von URL-/Script-Kontexten.

Staging registrierte die Migration als 20261013023131, Produktion denselben SQL-Inhalt als 20261013023219. Die Repositorydatei verwendet die zuerst registrierte Staging-Version. Beim Abgleich der Migrationshistorien muss diese Versionsabweichung berücksichtigt werden.

Die Kommunikationsansicht berücksichtigt auf Staging nun die RLS des aufrufenden Nutzers. Registrierte Version 20261013023255. Keine Erweiterung vorhandener SELECT-Rechte. Der erneute Sicherheitsberater meldet dort weder SECURITY-DEFINER-View noch veränderliche Funktionssuchpfade.

Der gemeinsame App-/Webrenderer kodiert ebenfalls Kontextwerte, optionale Ersatztexte und Unterzeichnernamen. Signaturanker werden als literale Namen gesucht; Callback-Ersetzung verhindert Sonderbehandlung von Dollarzeichen. Ausschließlich PNG-/JPEG-Daten-URLs werden für das Signaturbild akzeptiert. Dies validiert das URL-Format, nicht die tatsächlichen Bildbytes oder den fachlichen Signaturabschluss. Sieben Tests laden die tatsächlichen Produktionsmodule mit Nodes eingebauter TypeScript-Typentfernung; keine zusätzlichen Pakete. Die vollständige Vitest-/TypeScript-/Expo-Prüfung bleibt mangels installierter Projektabhängigkeiten offen.

## Gesperrt und weiterhin offen

Die automatische Freigabeprüfung verweigerte die direkte Suchpfadänderung an fünf weiteren Produktionsfunktionen wegen fehlender Validierung möglicher Auswirkungen auf Trigger und bestehende Abläufe. Diese Änderung wurde nicht umgangen oder angewendet. Produktion meldet weiterhin fünf veränderliche Funktionssuchpfade.

Die zuvor angewendete Profil-/PDF-Rechtemigration ist weiterhin ausschließlich auf Staging. Echte berechtigte Portal-/Upload-/Rollenabläufe und Parallelprüfungen fehlen. Atomare Original-/Signatur-/Aufnahmeabschlüsse, vertrauenswürdige Byteattestation, sichere Monatsabschlüsse und weitere alte RPC-Verträge sind nicht durch diese Korrekturen fertiggestellt.

Die aktuellen Beratermeldungen enthalten weiterhin 52 anon-/86 authenticated-ausführbare SECURITY-DEFINER-Funktionen auf Staging und 95/280 auf Produktion. Ausführbarkeit ist allein kein Nachweis einer unsicheren Funktion; Funktionskörper und tatsächliche Objektberechtigung müssen einzeln geprüft werden. RLS ohne Policies: 46 Staging-/29 Produktionsobjekte, standardmäßig verweigerter Datenzugriff. Passwort-Leakschutz ist weiterhin als deaktiviert gemeldet. Keine vollständige Server-, Portal-, Geräte- oder Designfreigabe behauptet.
