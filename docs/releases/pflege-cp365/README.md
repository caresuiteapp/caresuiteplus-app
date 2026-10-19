# Pflege CP365 – Integrationsstand, keine Produktionsfreigabe

Ziel: Checkpoint 365, Quellcommit 548f51a0616092b4ea3817f6594c387e16f3c925. Integration auf main e5a70298869b46f1110953f737bd2b442f109bb8. Historische 12.598 lokale Tests sind im Originalprotokoll enthalten und ersetzen keine heutigen Integrations-, Datenbank- oder fachlichen Prüfungen.

## Änderungen

Die Pflege-Erweiterungen aus app/src/scripts/supabase wurden dreiseitig übernommen. 20 Konfliktdateien wurden aufgelöst. Die aktuelle Office-Klientenakte, Office-Aufnahme und deren serverseitiger atomarer Abschluss bleiben erhalten. Die geschützte CP365-Klientenakte und ihre Belegübersicht liegen separat unter Pflege und werden über neue Web-Routen angebunden. Bestehende native Routen wurden hierfür nicht ersetzt. Sieben fehlerhafte JSX-Map-Abschlüsse sowie zwei ungültige Imports der Einsatz-Repositories wurden berichtigt. Die 14 CP365-Testdateien zur Akte referenzieren jetzt die getrennte Pflege-Implementierung.

## Prüfung

- 932 geänderte JS/TS-Dateien: keine Syntaxfehler nach Korrektur.
- 23 geänderte Web-Routen: lokaler esbuild-Abhängigkeits-/Exportcheck erfolgreich; Pakete und statische Assets extern. Kein vollständiger Expo-Build, keine visuelle Freigabe.
- Erster Integrationslauf: 12.195 Tests, 11.815 bestanden, 380 fehlgeschlagen. Enthält veraltete Quellenpfade und zunächst fehlende historische Fixtures; Ergebnis bleibt als Befund erhalten.
- Wiederholung der 14 umgestellten Akten-Testdateien: 544 Tests, 541 bestanden, 3 fehlgeschlagene Dateien durch ReferenceError validateIntakeStep im extrahierenden Testaufbau.
- Historische Checkpoint-Paar-Prüfung mit wiederhergestellten Original-Fixtures: erfolgreich (separates Protokoll).
- Staging-Schnittstellenfreigabe bestätigt: Migration 20261019210100 ambulatory_workspace_guarded_api_access.
- Keine produktiven Testdaten angelegt. Keine produktiven RPC-Freigaben oder App-Promotion in diesem Integrationsschritt.

## Produktionsblocker

1. Abgleich literal erkannter RPC-Aufrufe in Pflege/Assessment/Klienten: 163 eindeutige Namen, davon 132 im Produktionskatalog nicht vorhanden. Das ist eine statische Teilinventur, keine Vollständigkeitszusage für dynamische RPC-Aufrufe.
2. Live-Staging care_private.visit_sources liest care_tour_stops.admission_id, die im nativen Schema fehlt. Zusätzlich muss der Pflegeplanstatus gegen den tatsächlichen Enum geprüft werden.
3. Positive Rollen-/Sitzungs-/Datensatzrechte einschließlich fremdem Mandanten und abgelaufener Sitzung sind nicht vollständig live nachgewiesen. Die bisherigen großen Rollback-Testblöcke scheitern am Connector mit Invalid or expired requestState. Ohne-Sitzung-Prüfungen ersetzen das nicht.
4. Die neue Web-Aufnahme überschneidet sich mit dem aktuellen serverseitigen Office-Aufnahmevertrag. Die Auswahl von .web-Hooks und Repository-Adaptern muss vollständig gegen aktuelle Office-Abläufe abgeglichen werden.
5. Gesamte Testsuite nach Auflösung der Test-/Vertragskonflikte, vollständiger Expo-Web-Build und visuelle Prüfung fehlen.

Das Pflege-Modul bleibt global gesperrt. Dieser Stand darf nicht als produktionsreif oder klinisch/fachlich abgenommen bezeichnet werden. Nicht blind alle vorbereiteten SQL-Patches einspielen; bestehende native Schreibrechte und produktive Helfer müssen erhalten bleiben.

## Im Produktionskatalog fehlende literal erkannte RPCs

- web_read_wound_path_review_page
- web_read_wound_path_context
- web_read_wound_path_page
- web_commit_wound_path_packet
- web_confirm_wound_path_packet
- write_ambulatory_wound_care
- write_ambulatory_wound_assessment_correction
- record_ambulatory_vital_measurement
- record_ambulatory_vital_follow_up
- invalidate_ambulatory_vital_measurement
- web_read_vital_care_review_page
- web_read_vital_care_path_context
- web_read_vital_care_path_page
- web_commit_vital_care_path_packet
- web_confirm_vital_care_path_packet
- web_read_visit_execution_review_page
- web_commit_visit_execution_event
- write_structured_treatment_execution
- read_treatment_wound_relation
- write_clinical_treatment_correction
- web_read_treatment_care_review_page
- web_read_treatment_care_context
- web_read_treatment_care_page
- web_commit_treatment_care_packet
- web_confirm_treatment_care_packet
- web_read_tour_planning_review_page
- web_commit_tour_planning_event
- web_read_supply_review_page
- web_commit_supply
- web_read_respiratory_intensive_care_path_context
- web_read_respiratory_intensive_care_path_page
- web_commit_respiratory_intensive_care_path_packet
- web_confirm_respiratory_intensive_care_path_packet
- web_read_respiratory_care_review_page
- web_read_nutrition_review_page
- web_read_nutrition_elimination_prerequisites
- web_read_nutrition_elimination_page
- web_commit_nutrition_elimination_packet
- web_confirm_nutrition_elimination_packet
- web_read_medication_safety_review_page
- web_read_medication_safety_context
- web_read_medication_safety_page
- web_commit_medication_safety_packet
- web_confirm_medication_safety_packet
- read_infusion_courses
- write_infusion_event
- web_read_connected_specialist_review_page
- web_commit_case_handover
- get_ambulatory_care_tour_resources
- reconcile_ambulatory_care_stop_write
- correct_pfleger_service_proof
- capture_pfleger_proof_client_confirmation
- web_read_care_documentation_page
- web_read_care_documentation_record
- web_commit_care_documentation_packet
- web_confirm_care_documentation_packet
- web_care_documentation_path_workspace_context
- web_commit_care_documentation_path_event
- web_confirm_care_documentation_path_event
- web_record_care_diagnosis_with_history
- web_confirm_care_diagnosis_with_history
- create_bound_pfleger_invoice_foundation
- create_pfleger_invoice_draft
- approve_pfleger_invoice_draft
- record_pfleger_cost_carrier_export_validation
- record_pfleger_cost_carrier_rejection
- record_pfleger_cost_carrier_resubmission
- record_pfleger_invoice_adjustment
- record_pfleger_receivable_payment
- record_pfleger_accounting_posting
- record_pfleger_dunning_notice
- record_pfleger_dunning_dispatch
- record_pfleger_direct_debit_release
- record_pfleger_direct_debit_return
- record_pfleger_invoice_cost_share_assessment
- record_pfleger_invoice_period_closure
- record_pfleger_invoice_period_correction
- web_read_basic_care_prerequisites
- web_read_basic_care_page
- web_read_basic_care_review_page
- web_commit_basic_care_packet
- web_confirm_basic_care_packet
- web_commit_basic_care_review
- web_confirm_basic_care_review
- write_ambulatory_wound_documentation
- write_ambulatory_wound_lifecycle
- get_ambulatory_care_stop_proof_batch
- create_ambulatory_care_stop_proof_batch
- create_ambulatory_handover
- web_client_lifecycle_workspace_context
- web_commit_client_lifecycle_event
- web_confirm_client_lifecycle_event
- web_prepare_client_intake_identity_review
- web_read_client_financing_review_page
- web_client_financing_context
- web_commit_client_financing_event
- web_confirm_client_financing_event
- web_read_client_billing_review_page
- web_client_billing_context
- web_commit_client_billing_event
- web_confirm_client_billing_event
- web_read_ambulatory_plan_lifecycle_packet
- web_read_palliative_special_care_review_page
- web_read_palliative_special_care_path_context
- web_read_palliative_special_care_path_page
- web_commit_palliative_special_care_path_packet
- web_confirm_palliative_special_care_path_packet
- web_read_mental_health_care_review_page
- web_read_mental_health_care_path_context
- web_read_mental_health_care_path_page
- web_commit_mental_health_care_path_packet
- web_confirm_mental_health_care_path_packet
- web_read_counseling_coordination_review_page
- web_read_counseling_coordination_path_context
- web_read_counseling_coordination_path_page
- web_commit_counseling_coordination_path_packet
- web_confirm_counseling_coordination_path_packet
- web_care_plan_path_workspace_context
- web_commit_care_plan_path_event
- web_confirm_care_plan_path_event
- submit_ambulatory_assessment_review
- write_ambulatory_assessment_draft
- apply_ambulatory_assessment_lifecycle
- web_assessment_path_workspace_context
- web_commit_assessment_path_event
- web_confirm_assessment_path_event
- web_read_ambulatory_assessment_instrument_packet
- web_reserve_reviewed_client_intake_draft
- web_confirm_reviewed_client_intake_draft
- web_prepare_packet_client_intake_completion
- web_finalize_client_intake_completion
- web_confirm_client_intake_completion

