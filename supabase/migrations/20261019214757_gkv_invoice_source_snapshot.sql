-- Read-only invoice import/export snapshot. Reuse the established Office source
-- verifier; a client checkbox or plausible PDF path is never a source attestation.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('care_security.office_invoice_assert_source(public.service_records,boolean)') IS NULL
    OR to_regprocedure('care_security.office_invoice_proofs(public.invoices)') IS NULL
    OR to_regprocedure('care_security.gkv_exchange_actor(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Aktueller Office-Rechnungs- und GKV-Datenbankstand erforderlich';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION care_security.gkv_invoice_source_snapshot(p_tenant_id uuid,p_invoice_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE inv public.invoices; item public.invoice_items; rec public.service_records;
  v_id uuid; v_items jsonb; v_records jsonb; v_proofs jsonb; v_client jsonb;
  v_result jsonb:='[]'::jsonb; v_count integer:=0; v_seen uuid[];
BEGIN
  IF care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.view') IS NOT TRUE
    OR care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.create') IS NOT TRUE THEN
    RAISE EXCEPTION 'Abrechnungszugriff erforderlich' USING ERRCODE='42501';
  END IF;
  IF coalesce(cardinality(p_invoice_ids),0) NOT BETWEEN 1 AND 50 OR array_position(p_invoice_ids,NULL) IS NOT NULL
    OR cardinality(p_invoice_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_invoice_ids) x) THEN
    RAISE EXCEPTION 'Ein bis 50 eindeutige Rechnungsreferenzen erforderlich';
  END IF;
  -- Deterministic lock/read order. There is no mutation and no service-role bypass.
  FOR v_id IN SELECT x FROM unnest(p_invoice_ids) x ORDER BY x LOOP
    SELECT * INTO inv FROM public.invoices WHERE tenant_id=p_tenant_id AND id=v_id FOR SHARE;
    IF NOT FOUND OR coalesce(inv.status::text,'') IN ('','draft','cancelled') OR inv.client_id IS NULL
      OR inv.invoice_date IS NULL OR NOT isfinite(inv.invoice_date)
      OR inv.service_period_from IS NULL OR inv.service_period_to IS NULL
      OR NOT isfinite(inv.service_period_from) OR NOT isfinite(inv.service_period_to) OR inv.service_period_to<inv.service_period_from THEN
      RAISE EXCEPTION 'Eine ausgestellte, nicht stornierte Rechnung mit Klientenzuordnung ist erforderlich' USING ERRCODE='40001';
    END IF;
    v_items:='[]'::jsonb; v_records:='[]'::jsonb; v_seen:='{}'::uuid[];
    FOR item IN SELECT * FROM public.invoice_items WHERE tenant_id=p_tenant_id AND invoice_id=inv.id ORDER BY id FOR SHARE LOOP
      v_count:=v_count+1;
      IF v_count>5000 THEN RAISE EXCEPTION 'Zu viele Rechnungspositionen. Paket aufteilen'; END IF;
      v_items:=v_items||jsonb_build_array(jsonb_build_object('id',item.id,'tenant_id',item.tenant_id,'invoice_id',item.invoice_id,
        'updated_at',item.updated_at,'service_record_id',item.service_record_id,'description',item.description,
        'service_date',item.service_date,'quantity',item.quantity,'unit',item.unit,'unit_price',item.unit_price,
        'net_amount',item.net_amount,'vat_amount',item.vat_amount,'vat_rate',item.vat_rate,'gross_amount',item.gross_amount,'sort_order',item.sort_order));
      IF item.service_record_id IS NOT NULL AND NOT item.service_record_id=ANY(v_seen) THEN
        SELECT * INTO rec FROM public.service_records WHERE tenant_id=p_tenant_id AND id=item.service_record_id FOR SHARE;
        IF NOT FOUND OR rec.client_id IS DISTINCT FROM inv.client_id OR coalesce(rec.status::text,'') NOT IN ('approved','billable','billed')
          OR (rec.billed_invoice_id IS NOT NULL AND rec.billed_invoice_id<>inv.id)
          OR rec.service_date IS NULL OR rec.service_date NOT BETWEEN inv.service_period_from AND inv.service_period_to THEN
          RAISE EXCEPTION 'Die verknüpfte Leistung ist nicht für diese Rechnung freigegeben' USING ERRCODE='40001';
        END IF;
        PERFORM care_security.office_invoice_assert_source(rec,true);
        v_seen:=array_append(v_seen,rec.id);
        v_records:=v_records||jsonb_build_array(jsonb_build_object('id',rec.id,'tenant_id',rec.tenant_id,'client_id',rec.client_id,
          'updated_at',rec.updated_at,'service_date',rec.service_date,'actual_minutes',rec.actual_minutes,
          'billable_minutes',rec.billable_minutes,'status',rec.status,'billed_invoice_id',rec.billed_invoice_id,
          'source_receipt',rec.source_receipt));
      END IF;
    END LOOP;
    IF jsonb_array_length(v_items)=0 THEN RAISE EXCEPTION 'Die Rechnung enthält keine Positionen'; END IF;
    v_proofs:=care_security.office_invoice_proofs(inv);
    SELECT jsonb_build_object('id',c.id,'tenant_id',c.tenant_id,'first_name',c.first_name,'last_name',c.last_name,
      'date_of_birth',c.date_of_birth,'insurance_number',c.insurance_number,'care_level',c.care_level,
      'street',c.street,'house_number',c.house_number,'postal_code',c.postal_code,'city',c.city)
      INTO v_client FROM public.clients c WHERE c.tenant_id=p_tenant_id AND c.id=inv.client_id FOR SHARE;
    IF v_client IS NULL THEN RAISE EXCEPTION 'Die Klientenakte ist nicht verfügbar'; END IF;
    v_result:=v_result||jsonb_build_array(jsonb_build_object('id',inv.id,'tenant_id',inv.tenant_id,'updated_at',inv.updated_at,
      'status',inv.status,'invoice_number',inv.invoice_number,'invoice_date',inv.invoice_date,'total_amount',inv.total_amount,
      'client_id',inv.client_id,'service_period_from',inv.service_period_from,'service_period_to',inv.service_period_to,
      'selected_proof_ids',coalesce(to_jsonb(inv.selected_proof_ids),'[]'::jsonb),'items',v_items,'records',v_records,'proofs',v_proofs,'client',v_client));
  END LOOP;
  RETURN jsonb_build_object('version','gkv-invoice-source-v1','invoices',v_result);
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_invoice_source_snapshot(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.gkv_invoice_source_snapshot(uuid,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.gkv_invoice_source_snapshot(p_tenant_id uuid,p_invoice_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
  SELECT care_security.gkv_invoice_source_snapshot(p_tenant_id,p_invoice_ids)
$$;
REVOKE ALL ON FUNCTION public.gkv_invoice_source_snapshot(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gkv_invoice_source_snapshot(uuid,uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
