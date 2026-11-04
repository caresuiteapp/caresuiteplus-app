-- Compare only catalog metadata. No service-record values, count, conversion or repair.
-- Reference: 26 physical columns of public.service_records observed 2026-11-04.
WITH expected(name,typ,nn,default_expr) AS (
 VALUES
  ('id','uuid',true,'gen_random_uuid()'),
  ('tenant_id','uuid',true,NULL),
  ('assignment_id','uuid',false,NULL),
  ('documentation_entry_id','uuid',false,NULL),
  ('signature_id','uuid',false,NULL),
  ('client_id','uuid',true,NULL),
  ('employee_id','uuid',false,NULL),
  ('product_key','product_key',true,'''assist''::product_key'),
  ('record_number','text',false,NULL),
  ('service_date','date',true,NULL),
  ('service_month','date',false,NULL),
  ('planned_minutes','integer',false,NULL),
  ('actual_minutes','integer',false,NULL),
  ('billable_minutes','integer',false,NULL),
  ('hourly_rate','numeric(10,2)',false,NULL),
  ('total_amount','numeric(10,2)',false,NULL),
  ('status','service_record_status',true,'''draft''::service_record_status'),
  ('pdf_url','text',false,NULL),
  ('approved_by','uuid',false,NULL),
  ('approved_at','timestamp with time zone',false,NULL),
  ('billed_invoice_id','uuid',false,NULL),
  ('notes','text',false,NULL),
  ('created_at','timestamp with time zone',true,'now()'),
  ('updated_at','timestamp with time zone',true,'now()'),
  ('assist_visit_id','uuid',false,NULL),
  ('source_receipt','jsonb',true,'''{}''::jsonb')
), actual AS (
 SELECT a.attname::text name,format_type(a.atttypid,a.atttypmod) typ,a.attnotnull nn,
        pg_get_expr(d.adbin,d.adrelid) default_expr
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid=to_regclass('public.service_records') AND a.attnum>0 AND NOT a.attisdropped
)
SELECT COALESCE(e.name,a.name) AS column_name,e.typ AS expected_type,a.typ AS actual_type,
 CASE WHEN a.name IS NULL THEN 'missing' WHEN e.name IS NULL THEN 'additional'
      WHEN (e.typ,e.nn,e.default_expr) IS DISTINCT FROM (a.typ,a.nn,a.default_expr) THEN 'differs' ELSE 'matches' END AS comparison
FROM expected e FULL JOIN actual a ON a.name=e.name ORDER BY 1;
