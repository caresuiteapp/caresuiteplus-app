## Korrektur der Google-Verbindung vom 11.09.2026

Die Oberfläche meldete „Google-Verbindungsstatus konnte nicht gelesen werden“.
In Produktion fehlten der Backend-Rolle service_role die SELECT-, INSERT-,
UPDATE- und DELETE-Rechte auf den Google-Tabellen. BYPASSRLS allein ersetzt
keine PostgreSQL-Tabellenrechte. Die vorherigen Build- und nicht angemeldeten
Endpoint-Prüfungen konnten diesen angemeldeten Datenbankpfad nicht belegen.

Die Migration 20260911233000_google_workspace_service_permissions.sql setzt
explizite, auf die verwendeten Operationen begrenzte Backend-Rechte. Token- und
OAuth-State-Tabellen bleiben für Browserrollen gesperrt; das Lesen des Audits
bleibt an die bestehende Mandanten-/Admin-RLS gebunden. Audit-Änderung,
Audit-Löschung und strukturelle Tabellenrechte werden nicht freigegeben.

Sieben isolierte PostgreSQL-Regressionstests reproduzieren den ursprünglichen
Berechtigungsfehler, prüfen Statusabruf ohne Google-Konto, den OAuth-State-Ablauf,
Verbindungsänderungen, Audit, Rollen-/Mandantentrennung und Wiederholbarkeit.
Die Migration wurde gezielt in Produktion angewendet und registriert. Der
lesende Produktionszugriff mit service_role wird vor dem GitHub-Push geprüft.
Eine vollständige Google-Kontofreigabe benötigt weiterhin den angemeldeten Nutzer.
