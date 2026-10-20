-- Repair service end timestamps overwritten by documentation/signature finalize (abgeschlossen).
-- When actual_end_at is much later than assist_visit_execution_state.service_ended_at,
-- restore the physical service end from execution state.

UPDATE public.assignments a
SET
  actual_end_at = es.service_ended_at,
  updated_at = NOW()
FROM public.assist_visit_execution_state es
WHERE es.tenant_id = a.tenant_id
  AND es.visit_id = a.id
  AND es.service_ended_at IS NOT NULL
  AND a.actual_end_at IS NOT NULL
  AND a.actual_end_at > es.service_ended_at + INTERVAL '5 minutes';

UPDATE public.assist_visits av
SET
  actual_end_at = es.service_ended_at,
  updated_at = NOW()
FROM public.assist_visit_execution_state es
WHERE es.tenant_id = av.tenant_id
  AND es.visit_id = av.id
  AND es.service_ended_at IS NOT NULL
  AND av.actual_end_at IS NOT NULL
  AND av.actual_end_at > es.service_ended_at + INTERVAL '5 minutes';
