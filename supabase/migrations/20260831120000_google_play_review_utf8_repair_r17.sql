-- CareSuite HealthOS R17 -- repair Google Play review data independently of
-- the terminal code page. This migration intentionally contains ASCII only;
-- PostgreSQL U& literals create the intended German Unicode characters.

BEGIN;

UPDATE public.tenants
SET name = U&'CareSuite Pr\00FCfzentrum Berlin',
    legal_form = U&'Interner Pr\00FCfmandant',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000001';

UPDATE public.clients
SET internal_notes = U&'Synthetische Pr\00FCfakte. Bevorzugt Termine am Vormittag.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000020';

UPDATE public.clients
SET street = U&'Parkstra\00DFe 7',
    internal_notes = U&'Synthetische Pr\00FCfakte f\00FCr den Tourenplan.',
    special_notes = U&'Zugang \00FCber den Innenhof.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000021';

UPDATE public.clients
SET internal_notes = U&'Synthetische Pr\00FCfakte f\00FCr Einsatz- und Fahrtenbuchdaten.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000022';

UPDATE public.assist_visits
SET description = U&'Gemeinsamer Spaziergang und Unterst\00FCtzung im Haushalt.',
    employee_notes = U&'Einsatz vollst\00E4ndig dokumentiert.',
    client_visible_notes = U&'Vielen Dank \2013 der Einsatz wurde erfolgreich abgeschlossen.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000080';

UPDATE public.assist_visits
SET description = U&'Unterst\00FCtzung im Haushalt und kleiner Einkauf.',
    location_notes = U&'Einkaufsliste liegt in der K\00FCche.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000081';

UPDATE public.assist_visits
SET address_snapshot = U&'Parkstra\00DFe 7, 10178 Berlin',
    employee_notes = U&'Versichertenkarte pr\00FCfen.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000082';

UPDATE public.assist_visits
SET description = U&'Gespr\00E4ch, Aktivierung und gemeinsames Kaffeetrinken.',
    employee_notes = U&'Material f\00FCr Ged\00E4chtnistraining mitnehmen.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000083';

UPDATE public.assist_visits
SET title = U&'Wohnungsunterst\00FCtzung',
    description = U&'Unterst\00FCtzung bei W\00E4sche und Wohnungsordnung.',
    employee_notes = U&'W\00E4scheplan beachten.',
    client_visible_notes = U&'Geplanter Unterst\00FCtzungstermin.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000084';

UPDATE public.assist_visits
SET employee_notes = U&'Einkaufsbudget pr\00FCfen.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000085';

UPDATE public.assist_visit_tasks
SET title = U&'Haushalt unterst\00FCtzen', updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000087';

UPDATE public.assist_visit_tasks
SET title = U&'Spaziergang durchf\00FChren', updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000088';

UPDATE public.assist_visit_proofs
SET approval_note = U&'Vollst\00E4ndig gepr\00FCft und f\00FCr das Portal freigegeben.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000090';

UPDATE public.client_intake_documents
SET preview_html = U&'<h1>Betreuungsvertrag</h1><p>Pr\00FCfvorschau f\00FCr Maria Muster.</p>',
    finalized_html = U&'<h1>Betreuungsvertrag</h1><p><strong>Maria Muster</strong></p><p>Vereinbart sind Alltagsbegleitung, Haushaltshilfe und Begleitdienste.</p><p>Dieses Dokument enth\00E4lt ausschlie\00DFlich synthetische Pr\00FCfdaten.</p>',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000070';

UPDATE public.client_care_entitlement
SET notes = U&'Synthetischer Pflegegrad f\00FCr die App-Pr\00FCfung.', updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000091';

UPDATE public.message_threads
SET subject = U&'Dienstplan und R\00FCckfrage',
    last_message_preview = U&'Danke, der Termin ist best\00E4tigt.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000050';

UPDATE public.message_threads
SET subject = U&'Ihr n\00E4chster Betreuungstermin',
    last_message_preview = U&'Wir freuen uns auf den n\00E4chsten Termin.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000051';

UPDATE public.messages
SET body = U&'Danke, der Termin ist best\00E4tigt.', updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000061';

UPDATE public.workforce_absences
SET internal_note = U&'F\00FCr den Pr\00FCfzugang freigegeben.', updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000113';

UPDATE public.employee_payroll_settings
SET payroll_notes = U&'Synthetische Abrechnungsdaten f\00FCr die App-Pr\00FCfung.', updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000115';

UPDATE public.employee_expense_claims
SET description = U&'Parkgeb\00FChr w\00E4hrend des Betreuungseinsatzes',
    office_note = U&'F\00FCr die Erstattung freigegeben.',
    updated_at = NOW()
WHERE id = 'c5000000-0000-4000-8000-000000000116';

UPDATE public.employee_logbook_trips
SET manual_reason = U&'Google-Play-Pr\00FCffahrt',
    start_address = CASE id
      WHEN 'c5000000-0000-4000-8000-000000000040' THEN U&'Beispielstra\00DFe 8, 10117 Berlin'
      ELSE start_address
    END,
    end_address = CASE id
      WHEN 'c5000000-0000-4000-8000-000000000042' THEN U&'Beispielstra\00DFe 8, 10117 Berlin'
      ELSE end_address
    END,
    notes = CASE id
      WHEN 'c5000000-0000-4000-8000-000000000040' THEN U&'Vollst\00E4ndig synthetische GPS-Pr\00FCffahrt.'
      WHEN 'c5000000-0000-4000-8000-000000000041' THEN U&'Begleitfahrt w\00E4hrend des Einsatzes.'
      WHEN 'c5000000-0000-4000-8000-000000000042' THEN U&'R\00FCckfahrt l\00E4uft bewusst nach dem Einsatzende weiter.'
      ELSE notes
    END,
    purpose = CASE id
      WHEN 'c5000000-0000-4000-8000-000000000042' THEN U&'R\00FCckfahrt nach Einsatzende'
      ELSE purpose
    END,
    updated_at = NOW()
WHERE id IN (
  'c5000000-0000-4000-8000-000000000040',
  'c5000000-0000-4000-8000-000000000041',
  'c5000000-0000-4000-8000-000000000042'
);

COMMIT;
