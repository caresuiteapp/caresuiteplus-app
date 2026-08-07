-- CareSuite HealthOS — geplante Einsätze verbindlich im Klientenbudget abbilden.
--
-- R11 hat die Anzeige und den künftigen Schreibpfad ergänzt. Bereits vorhandene
-- sowie wegen einer verworfenen internen Rollenprüfung ohne Reservierung
-- gespeicherte Einsätze benötigen eine einmalige, idempotente Rückberechnung.

BEGIN;

LOCK TABLE public.client_budget_accounts IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.client_budget_transactions IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE _r12_planned_visits ON COMMIT DROP AS
WITH priced_visits AS (
  SELECT
    visit.tenant_id,
    visit.id AS visit_id,
    visit.client_id,
    visit.assignment_date,
    visit.billing_budget_source_key,
    visit.created_by,
    COALESCE(
      NULLIF(visit.budget_amount_cents, 0)::BIGINT,
      ROUND(
        COALESCE(
          NULLIF(visit.duration_minutes, 0),
          GREATEST(
            0,
            EXTRACT(EPOCH FROM (visit.planned_end_at - visit.planned_start_at)) / 60
          )
        )
        * COALESCE(service_rate.hourly_rate_cents, billing_rate.hourly_rate_cents, 0)
        / 60
      )::BIGINT
    ) AS amount_cents
  FROM public.assist_visits visit
  LEFT JOIN LATERAL (
    SELECT ROUND(price.price_net * 100)::BIGINT AS hourly_rate_cents
    FROM public.tenant_service_catalog catalog
    JOIN public.tenant_service_prices price
      ON price.tenant_id = catalog.tenant_id
     AND price.catalog_id = catalog.id
    WHERE catalog.tenant_id = visit.tenant_id
      AND catalog.module_key = 'assist'
      AND catalog.category = 'service'
      AND catalog.unit = 'hour'
      AND catalog.is_active = TRUE
      AND price.valid_from <= visit.assignment_date
      AND (price.valid_to IS NULL OR price.valid_to >= visit.assignment_date)
    ORDER BY
      CASE WHEN catalog.service_key = visit.service_key THEN 0 ELSE 1 END,
      price.is_default DESC,
      price.valid_from DESC,
      catalog.sort_order ASC
    LIMIT 1
  ) service_rate ON TRUE
  LEFT JOIN LATERAL (
    SELECT ROUND(settings.default_hourly_rate * 100)::BIGINT AS hourly_rate_cents
    FROM public.tenant_billing_settings settings
    WHERE settings.tenant_id = visit.tenant_id
      AND settings.default_hourly_rate > 0
    LIMIT 1
  ) billing_rate ON TRUE
  WHERE visit.planning_status = 'scheduled'
    AND visit.execution_status = 'pending'
    AND visit.canonical_status IN ('planned', 'confirmed')
    AND NOT EXISTS (
      SELECT 1
      FROM public.client_budget_transactions existing
      WHERE existing.tenant_id = visit.tenant_id
        AND existing.reference_type = 'assist_visit'
        AND existing.reference_id = visit.id
        AND existing.transaction_type = 'reservation'
        AND COALESCE(existing.lifecycle_status, 'geplant') IN ('geplant', 'durchgefuehrt')
    )
)
SELECT *
FROM priced_visits
WHERE amount_cents > 0;

CREATE TEMP TABLE _r12_reservations (
  tenant_id UUID NOT NULL,
  visit_id UUID NOT NULL,
  client_id UUID NOT NULL,
  assignment_date DATE NOT NULL,
  created_by UUID,
  amount_cents BIGINT NOT NULL,
  budget_account_id UUID NOT NULL,
  catalog_key TEXT NOT NULL,
  balance_after_cents BIGINT NOT NULL
) ON COMMIT DROP;

DO $r12_allocate$
DECLARE
  planned RECORD;
  account RECORD;
BEGIN
  FOR planned IN
    SELECT *
    FROM _r12_planned_visits
    ORDER BY assignment_date, visit_id
  LOOP
    SELECT candidate.*
      INTO account
      FROM public.client_budget_accounts candidate
     WHERE candidate.tenant_id = planned.tenant_id
       AND candidate.client_id = planned.client_id
       AND candidate.status = 'active'
       AND COALESCE(candidate.is_enabled, TRUE) = TRUE
       AND COALESCE(candidate.locked, FALSE) = FALSE
       AND candidate.period_start <= planned.assignment_date
       AND candidate.period_end >= planned.assignment_date
       AND candidate.allocated_cents - candidate.used_cents - candidate.reserved_cents
         >= planned.amount_cents
       AND (
         NOT EXISTS (
           SELECT 1
           FROM public.client_funding_selections funding
           WHERE funding.tenant_id = candidate.tenant_id
             AND funding.client_id = candidate.client_id
             AND funding.replaced_at IS NULL
         )
         OR EXISTS (
           SELECT 1
           FROM public.client_funding_selections funding
           WHERE funding.tenant_id = candidate.tenant_id
             AND funding.client_id = candidate.client_id
             AND funding.replaced_at IS NULL
             AND (
               candidate.catalog_key = 'paragraph_45b'
                 AND 'entlastungsleistung' = ANY(funding.sources)
               OR candidate.catalog_key LIKE 'umwandlung\_%' ESCAPE '\'
                 AND 'umwandlung' = ANY(funding.sources)
               OR candidate.catalog_key IN ('verhinderungspflege', 'gemeinsames_jahresbudget')
                 AND 'verhinderungspflege' = ANY(funding.sources)
               OR candidate.catalog_key = 'selbstzahler'
                 AND 'selbstzahler' = ANY(funding.sources)
             )
         )
       )
     ORDER BY
       CASE WHEN candidate.catalog_key = planned.billing_budget_source_key THEN 0 ELSE 1 END,
       candidate.billing_priority ASC,
       candidate.period_end ASC,
       candidate.period_start ASC
     LIMIT 1
     FOR UPDATE;

    IF FOUND THEN
      UPDATE public.client_budget_accounts
         SET reserved_cents = reserved_cents + planned.amount_cents,
             updated_at = NOW()
       WHERE tenant_id = planned.tenant_id
         AND id = account.id;

      INSERT INTO _r12_reservations (
        tenant_id,
        visit_id,
        client_id,
        assignment_date,
        created_by,
        amount_cents,
        budget_account_id,
        catalog_key,
        balance_after_cents
      ) VALUES (
        planned.tenant_id,
        planned.visit_id,
        planned.client_id,
        planned.assignment_date,
        planned.created_by,
        planned.amount_cents,
        account.id,
        account.catalog_key,
        account.allocated_cents - account.used_cents - account.reserved_cents
          - planned.amount_cents
      );
    END IF;
  END LOOP;
END;
$r12_allocate$;

INSERT INTO public.client_budget_transactions (
  tenant_id,
  client_id,
  budget_account_id,
  transaction_type,
  amount_cents,
  balance_after_cents,
  reference_type,
  reference_id,
  lifecycle_status,
  note,
  created_by
)
SELECT
  reservation.tenant_id,
  reservation.client_id,
  reservation.budget_account_id,
  'reservation',
  reservation.amount_cents,
  reservation.balance_after_cents,
  'assist_visit',
  reservation.visit_id,
  'geplant',
  'Planbetrag aus bestehender Einsatzplanung nachgetragen',
  reservation.created_by
FROM _r12_reservations reservation
WHERE NOT EXISTS (
  SELECT 1
  FROM public.client_budget_transactions existing
  WHERE existing.tenant_id = reservation.tenant_id
    AND existing.reference_type = 'assist_visit'
    AND existing.reference_id = reservation.visit_id
    AND existing.budget_account_id = reservation.budget_account_id
    AND existing.transaction_type = 'reservation'
    AND COALESCE(existing.lifecycle_status, 'geplant') IN ('geplant', 'durchgefuehrt')
);

INSERT INTO public.assignment_budget_allocations (
  tenant_id,
  assignment_id,
  client_id,
  budget_account_id,
  catalog_key,
  allocation_status,
  planned_amount_cents,
  reserved_amount_cents,
  priority_order,
  is_manual_override,
  metadata
)
SELECT
  reservation.tenant_id,
  reservation.visit_id,
  reservation.client_id,
  reservation.budget_account_id,
  reservation.catalog_key,
  'reserved',
  reservation.amount_cents,
  reservation.amount_cents,
  1,
  FALSE,
  jsonb_build_object('source', 'r12_existing_planned_visit_backfill')
FROM _r12_reservations reservation
WHERE NOT EXISTS (
  SELECT 1
  FROM public.assignment_budget_allocations existing
  WHERE existing.tenant_id = reservation.tenant_id
    AND existing.assignment_id = reservation.visit_id
    AND existing.budget_account_id = reservation.budget_account_id
    AND existing.allocation_status IN ('planned', 'reserved', 'executed')
);

WITH affected_accounts AS (
  SELECT DISTINCT tenant_id, budget_account_id
  FROM _r12_reservations
), reservation_totals AS (
  SELECT
    transaction.tenant_id,
    transaction.budget_account_id,
    SUM(transaction.amount_cents)::BIGINT AS reserved_cents
  FROM public.client_budget_transactions transaction
  JOIN affected_accounts affected
    ON affected.tenant_id = transaction.tenant_id
   AND affected.budget_account_id = transaction.budget_account_id
  WHERE transaction.transaction_type = 'reservation'
    AND COALESCE(transaction.lifecycle_status, 'geplant') = 'geplant'
  GROUP BY transaction.tenant_id, transaction.budget_account_id
)
UPDATE public.client_budget_accounts account
SET reserved_cents = COALESCE(total.reserved_cents, 0),
    updated_at = NOW()
FROM affected_accounts affected
LEFT JOIN reservation_totals total
  ON total.tenant_id = affected.tenant_id
 AND total.budget_account_id = affected.budget_account_id
WHERE account.tenant_id = affected.tenant_id
  AND account.id = affected.budget_account_id;

UPDATE public.assist_visits visit
SET budget_amount_cents = COALESCE(NULLIF(visit.budget_amount_cents, 0), reservation.amount_cents),
    billing_budget_source_key = COALESCE(visit.billing_budget_source_key, reservation.catalog_key),
    billing_status = CASE WHEN visit.billing_status = 'none' THEN 'preview' ELSE visit.billing_status END,
    budget_warning = NULL,
    updated_at = NOW()
FROM _r12_reservations reservation
WHERE visit.tenant_id = reservation.tenant_id
  AND visit.id = reservation.visit_id;

UPDATE public.assist_visits visit
SET budget_warning = 'Geplanter Einsatz konnte keinem ausreichenden aktiven Budgetkonto zugeordnet werden.',
    updated_at = NOW()
FROM _r12_planned_visits planned
WHERE visit.tenant_id = planned.tenant_id
  AND visit.id = planned.visit_id
  AND NOT EXISTS (
    SELECT 1
    FROM _r12_reservations reservation
    WHERE reservation.tenant_id = planned.tenant_id
      AND reservation.visit_id = planned.visit_id
  );

INSERT INTO public.client_billing_audit_log (
  tenant_id,
  client_id,
  action,
  entity_type,
  entity_id,
  payload,
  actor_id
)
SELECT
  reservation.tenant_id,
  reservation.client_id,
  'backfill_planned_assignment_reservation',
  'assist_visits',
  reservation.visit_id,
  jsonb_build_object(
    'budgetAccountId', reservation.budget_account_id,
    'catalogKey', reservation.catalog_key,
    'amountCents', reservation.amount_cents,
    'source', 'r12'
  ),
  reservation.created_by
FROM _r12_reservations reservation;

COMMIT;
