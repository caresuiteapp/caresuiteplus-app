-- Checkpoint 227 / T-05: exakte Mengen-, Rundungs- und Zuschlagsberechnung.
-- Bestehende Positionen werden nicht rückwirkend vervollständigt; NULL bleibt offen.

ALTER TABLE public.client_tariff_positions
  ADD COLUMN IF NOT EXISTS rounding_rule text,
  ADD COLUMN IF NOT EXISTS surcharge_basis_points integer,
  ADD COLUMN IF NOT EXISTS fixed_surcharge_cents bigint;

ALTER TABLE public.client_tariff_positions
  DROP CONSTRAINT IF EXISTS client_tariff_positions_rounding_rule_check,
  ADD CONSTRAINT client_tariff_positions_rounding_rule_check
    CHECK (rounding_rule IS NULL OR rounding_rule IN ('half_up_cent', 'ceil_cent', 'floor_cent')),
  DROP CONSTRAINT IF EXISTS client_tariff_positions_surcharge_basis_points_check,
  ADD CONSTRAINT client_tariff_positions_surcharge_basis_points_check
    CHECK (surcharge_basis_points IS NULL OR surcharge_basis_points BETWEEN 0 AND 10000),
  DROP CONSTRAINT IF EXISTS client_tariff_positions_fixed_surcharge_cents_check,
  ADD CONSTRAINT client_tariff_positions_fixed_surcharge_cents_check
    CHECK (fixed_surcharge_cents IS NULL OR fixed_surcharge_cents >= 0);

CREATE OR REPLACE FUNCTION public.calculate_client_tariff_amount(
  p_quantity numeric,
  p_unit_price_cents bigint,
  p_rounding_rule text,
  p_surcharge_basis_points integer,
  p_fixed_surcharge_cents bigint
)
RETURNS TABLE (
  base_amount_cents bigint,
  percentage_surcharge_cents bigint,
  fixed_surcharge_cents bigint,
  total_amount_cents bigint
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  base_exact numeric;
  surcharge_exact numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity >= 100000 OR scale(p_quantity) > 3 THEN
    RAISE EXCEPTION 'Ungültige Menge';
  END IF;
  IF p_unit_price_cents IS NULL OR p_unit_price_cents <= 0 THEN RAISE EXCEPTION 'Ungültiger Preis'; END IF;
  IF p_rounding_rule IS NULL OR p_rounding_rule NOT IN ('half_up_cent', 'ceil_cent', 'floor_cent') THEN
    RAISE EXCEPTION 'Ungültige Rundungsregel';
  END IF;
  IF p_surcharge_basis_points IS NULL OR p_surcharge_basis_points NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'Ungültiger prozentualer Zuschlag';
  END IF;
  IF p_fixed_surcharge_cents IS NULL OR p_fixed_surcharge_cents < 0 THEN RAISE EXCEPTION 'Ungültiger Festzuschlag'; END IF;

  base_exact := p_quantity * p_unit_price_cents;
  base_amount_cents := CASE p_rounding_rule
    WHEN 'ceil_cent' THEN ceil(base_exact)
    WHEN 'floor_cent' THEN floor(base_exact)
    ELSE round(base_exact)
  END;
  surcharge_exact := base_amount_cents * p_surcharge_basis_points::numeric / 10000;
  percentage_surcharge_cents := CASE p_rounding_rule
    WHEN 'ceil_cent' THEN ceil(surcharge_exact)
    WHEN 'floor_cent' THEN floor(surcharge_exact)
    ELSE round(surcharge_exact)
  END;
  fixed_surcharge_cents := p_fixed_surcharge_cents;
  total_amount_cents := base_amount_cents + percentage_surcharge_cents + fixed_surcharge_cents;
  IF base_amount_cents > 999999999 OR percentage_surcharge_cents > 999999999
    OR fixed_surcharge_cents > 999999999 OR total_amount_cents > 999999999 THEN
    RAISE EXCEPTION 'Betragsgrenze überschritten';
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_client_tariff_amount(numeric, bigint, text, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_client_tariff_amount(numeric, bigint, text, integer, bigint) TO authenticated;

COMMENT ON FUNCTION public.calculate_client_tariff_amount(numeric, bigint, text, integer, bigint) IS
  'Deterministische Centberechnung; keine Leistungs-, Anspruchs- oder Abrechnungsfreigabe.';
