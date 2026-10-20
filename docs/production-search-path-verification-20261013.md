# Produktions-Suchpfade, 13. Oktober 2026

Nach ausdrücklicher Bestätigung wurde `care_existing_function_search_paths` auf Produktion als Version `20261013023814` angewendet. Betroffen: caresuite_touch_updated_at, search_cost_carrier_system_templates, append_pressure_injury_assessment_history, append_body_map_finding_history und default_travel_compensation_policy. Ausschließlich search_path ist auf pg_catalog festgelegt; Funktionskörper, Rechte, Triggerbindungen und Geschäftsdatensätze bleiben unverändert.

Die erneute Sicherheitsanalyse meldet keine veränderlichen Funktionssuchpfade mehr. Die übrigen Befunde und fehlenden echten Workflow-/Triggerabnahmen bleiben offen. Diese Aktualisierung ersetzt die vorherige Aussage, die Suchpfadänderung sei noch gesperrt; sie bestätigt keine vollständige Serverfreigabe.
