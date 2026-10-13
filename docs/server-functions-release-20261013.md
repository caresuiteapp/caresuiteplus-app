# Serverfunktionen – 13.10.2026

Produktiv installiert:
- Migration 20261013072827_verified_assignment_service_records: Capability, autorisierte Quellenabfrage, ausschließlich serverseitige Bytebestätigung und Erstellung eines einmaligen Leistungsnachweises.
- Edge Function complete-assist-service-record v1, ACTIVE, JWT-Prüfung aktiviert. Prüft Originalsignatur, erstellt PDF, liest gespeicherte Originalbytes zurück und bestätigt erst danach die unveränderte Quelle.
- Migration 20261013074646_admin_pdf_and_role_completion: sichere Rollenänderung, Schutz der Profilidentität, vier restriktive Regeln für erzeugte PDFs und care_security_pdf_upload_ready. Bestehende Lesegrenzen anderer Tabellen werden hier nicht erweitert.

Nachweise:
- 15 Dienstprüfungen bestanden, mit echtem PDF-Renderer und synthetischer Signatur.
- Isolierte Postgres-Prüfungen des Einsatzabschlusses bestanden; alle Testdaten zurückgerollt.
- Produktiver Abschlussdienst ohne Anmeldung: HTTP 401. RPC-Rechte und feste search_path-Einstellungen geprüft; Bytebestätigung ausschließlich service_role.
- Verwaltungs-PDF-Migration auf Staging erfolgreich. Readiness und Sperre direkter Rollenfeldänderung auf Staging und Produktion innerhalb zurückgerollter Transaktionen geprüft, ohne Geschäftsdatensätze zu verändern.
- Der bestehende produktive render-document-pdf v10 verwendet bereits care_security_pdf_upload_ready; fehlende Abhängigkeit wurde jetzt installiert.

Offen: angemeldeter vollständiger Browser–API–Storage-Durchlauf mit einem Testeinsatz; ältere Einsätze ohne kanonische Nachweisverknüpfung werden weiterhin sicher abgewiesen. Staging hat bestehende Schemaabweichungen (u. a. Rollen-Mandantenspalten), daher ließ sich die Einsatzmigration dort nicht vollständig anwenden; die gleichen Funktionskörper wurden isoliert mit produktionsentsprechendem Schema geprüft.

Der Security Advisor meldet bestehende allgemeine Warnungen außerhalb dieses Releases. Die neue Attestation-Tabelle besitzt absichtlich keine Nutzer-RLS-Freigabe; Zugriff ausschließlich durch den Server. Die öffentlichen Abschluss-RPCs sind absichtlich für angemeldete Personen ausführbar und prüfen den Mandanten und die Person intern. Dies ist keine vollständige Sicherheitsfreigabe der gesamten Plattform.
