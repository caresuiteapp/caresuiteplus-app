-- Canonical source guards first, then projection into old read-only aliases.
-- Otherwise the old invoice_id projection appears to the invoice guard as an
-- unrelated source edit. The guard itself retains its full immutable-field test.
ALTER TRIGGER gkv_staging_record_compatibility ON public.service_records
 RENAME TO zz_gkv_staging_record_compatibility;
