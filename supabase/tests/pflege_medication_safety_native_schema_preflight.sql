-- Read-only dependency inventory. Every required column must be reconciled before packet installation.
with required(table_name,column_name) as(values
('medications','status'),('medications','active_ingredient'),('medications','strength'),('medications','form'),('medications','route'),('medications','prescribed_by'),('medications','start_date'),('medications','end_date'),('medications','indication'),('medications','is_prn'),('medication_administrations','occurred_at'),('medication_administrations','creation_payload'))
select r.table_name,r.column_name,exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name) as present from required r order by 1,2;
