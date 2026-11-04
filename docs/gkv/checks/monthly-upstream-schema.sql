-- Read-only PostgreSQL 17 schema comparison; never scans an application table.
-- pg_get_* deparses names relative to search_path. Use the same transaction-local
-- path in both environments. All values below refer to metadata, never rows.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog, public;
WITH targets(t) AS (VALUES ('audit_logs'),('documentation_entries'),('invoice_items'),
  ('payments'),('payroll_month_statements'),('signatures'),('time_entries')),
rels AS (
  SELECT t,c.oid,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl,c.relowner
  FROM targets LEFT JOIN pg_class c ON c.oid=to_regclass(format('public.%I',t))
), items(t,facet,k,v) AS (
  SELECT t,'table',t,jsonb_build_array(relkind,relrowsecurity,relforcerowsecurity) FROM rels WHERE oid IS NOT NULL
  UNION ALL SELECT t,'columns',lpad(a.attnum::text,5,'0'),jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),
    a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated)
    FROM rels JOIN pg_attribute a ON a.attrelid=rels.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  UNION ALL SELECT t,'constraints',k.conname,jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid,false),k.convalidated)
    FROM rels JOIN pg_constraint k ON k.conrelid=rels.oid
  UNION ALL SELECT t,'indexes',i.relname,jsonb_build_array(i.relname,pg_get_indexdef(i.oid),ix.indisvalid,ix.indisready)
    FROM rels JOIN pg_index ix ON ix.indrelid=rels.oid JOIN pg_class i ON i.oid=ix.indexrelid
  UNION ALL SELECT t,'triggers',g.tgname,jsonb_build_array(g.tgname,pg_get_triggerdef(g.oid,false),g.tgenabled)
    FROM rels JOIN pg_trigger g ON g.tgrelid=rels.oid AND NOT g.tgisinternal
  UNION ALL SELECT t,'policies',p.polname,jsonb_build_array(p.polname,p.polpermissive,p.polcmd,
    ARRAY(SELECT CASE WHEN role_id=0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_id)::text END AS role_name FROM unnest(p.polroles) role_id ORDER BY (CASE WHEN role_id=0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_id)::text END) COLLATE "C"),
    pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))
    FROM rels JOIN pg_policy p ON p.polrelid=rels.oid
  UNION ALL SELECT t,'acl',concat_ws('/',coalesce(gr.rolname,'PUBLIC'),a.privilege_type),jsonb_build_array(
    coalesce(gr.rolname,'PUBLIC'),a.privilege_type,a.is_grantable)
    FROM rels CROSS JOIN LATERAL aclexplode(coalesce(relacl,acldefault('r',relowner))) a
    LEFT JOIN pg_roles gr ON gr.oid=a.grantee WHERE rels.oid IS NOT NULL AND a.grantee<>relowner
), facets(facet) AS (VALUES ('table'),('columns'),('constraints'),('indexes'),('triggers'),('policies'),('acl')),
observed AS (
  SELECT r.t,f.facet,r.oid IS NOT NULL present,count(i.v)::integer n,
    encode(sha256(convert_to(coalesce(jsonb_agg(i.v ORDER BY i.k COLLATE "C",i.v::text COLLATE "C")
      FILTER (WHERE i.v IS NOT NULL),'[]'::jsonb)::text,'UTF8')),'hex') sha
  FROM rels r CROSS JOIN facets f LEFT JOIN items i ON i.t=r.t AND i.facet=f.facet GROUP BY r.t,r.oid,f.facet
), expected(t,facet,n,sha) AS (VALUES
  ('audit_logs','acl',16,'999191e13d3d3f1a40ac7fbb2f4ba5251f9b1ca06ae4fd47c918151961ee33e9'),
  ('audit_logs','columns',14,'261cf9609bf6526364083b47e6c3225f9ed2846f097ab6bbccd4433f5b56c9d1'),
  ('audit_logs','constraints',3,'1a92b2d77c0443fae990b48584f2b1784aaa1fc57eb3a9f74152b5038019697a'),
  ('audit_logs','indexes',3,'a0996836c84712c65bba8e584beefc97439600555eacba58277878fc700307bc'),
  ('audit_logs','policies',4,'8af8ff3a6d0eb2f2fc67b76d5fc0a2297f57f77e9a59f2cfe6b8a617bc896ba5'),
  ('audit_logs','table',1,'3fb5593b7e5c2526a56c3e01d0c13ad989c1aff2d5e61e56a63e1ca08dabdb0c'),
  ('audit_logs','triggers',0,'4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'),
  ('documentation_entries','acl',16,'999191e13d3d3f1a40ac7fbb2f4ba5251f9b1ca06ae4fd47c918151961ee33e9'),
  ('documentation_entries','columns',22,'d6bfba1ab7e2c5e29f58a8125f0230a30bae63bbba1ec15e19bf28710ca5005c'),
  ('documentation_entries','constraints',9,'626cd23ecb307e9ea872caeab959b9258a89bc64f2626dbd153c76c6228c66c9'),
  ('documentation_entries','indexes',4,'2d67fe9b5a8f3fda78972380d882580d16fbd69351c6010734fd2e8c0df01b5d'),
  ('documentation_entries','policies',2,'77faedaff12b3a859eb7e7fe381592d9ecd8eada915c852169507fd4ea619f11'),
  ('documentation_entries','table',1,'3fb5593b7e5c2526a56c3e01d0c13ad989c1aff2d5e61e56a63e1ca08dabdb0c'),
  ('documentation_entries','triggers',2,'040d08701726c7e0368af47591b81f23d3088a216873d5a0e3499ab6df8ac11b'),
  ('invoice_items','acl',16,'999191e13d3d3f1a40ac7fbb2f4ba5251f9b1ca06ae4fd47c918151961ee33e9'),
  ('invoice_items','columns',20,'c0c08e45db1529c6886b7efd415451b90e1e62e7dbffd7ed6330dbe31f5a2ea3'),
  ('invoice_items','constraints',5,'165b35008d564ae2097c0bb5a66a6bbd215bc8a7ca0b92b9c22689532becce8c'),
  ('invoice_items','indexes',4,'3d3abcde729f954eeae9b7e9fb87635c1782b4d15362d94cde325c3557a6bc33'),
  ('invoice_items','policies',3,'506d328de97e504337b7ff41cdf30f95ecc04a3eb2be8fbb411ede6863d66d2b'),
  ('invoice_items','table',1,'3fb5593b7e5c2526a56c3e01d0c13ad989c1aff2d5e61e56a63e1ca08dabdb0c'),
  ('invoice_items','triggers',3,'51e15047201d3fbe3d0a03eec12a850ad45be6abd74056ecbd95b48531e3818e'),
  ('payments','acl',16,'999191e13d3d3f1a40ac7fbb2f4ba5251f9b1ca06ae4fd47c918151961ee33e9'),
  ('payments','columns',19,'a9fca6ae4d4c4a5a6cc1d126ab9336827a0c8f36652858d3abc3aa0039213801'),
  ('payments','constraints',5,'5ff0677ca65e847673f301bb3071b160417cea8ae4df4da18aa512daba548dc0'),
  ('payments','indexes',5,'2e443060b87b3883678c384187fd34a82a470ee500ed870e742476696db3797b'),
  ('payments','policies',3,'6cea57426ea1ea84796f5d7455cf0a39c513a14fe6e56ed663c4dfdb5ffbf5a8'),
  ('payments','table',1,'3fb5593b7e5c2526a56c3e01d0c13ad989c1aff2d5e61e56a63e1ca08dabdb0c'),
  ('payments','triggers',3,'6f582783a5a87bdfa8e024a7de67ff4c09a51cd7d04e583c2a7e2b8f051f1c84'),
  ('payroll_month_statements','acl',15,'bee23dc86f620cb6c52cb74576b428855226d361d26809f6fdaa95ce7757ba82'),
  ('payroll_month_statements','columns',31,'9750552d0bf5e0fa92fc5c01929dc0fb47bb89d73eb39a5a524dd76849b719a2'),
  ('payroll_month_statements','constraints',21,'5057c578dbda6d7778882726ef5125dbfc7d078123a4dedd5340976702650493'),
  ('payroll_month_statements','indexes',5,'a09f113680bfc833f7f76429c9fb29fc919f1d8d5c72b58f9bc4d8b7140fc4a4'),
  ('payroll_month_statements','policies',3,'fe371a771e465ade56ba0adf92e701f424dd49bf31b2c1f026ad3bf2756a52be'),
  ('payroll_month_statements','table',1,'3fb5593b7e5c2526a56c3e01d0c13ad989c1aff2d5e61e56a63e1ca08dabdb0c'),
  ('payroll_month_statements','triggers',1,'d04574f9a4c503c246ccce28a959154eec29e905ebf22ce072982b700f7c007f'),
  ('signatures','acl',16,'999191e13d3d3f1a40ac7fbb2f4ba5251f9b1ca06ae4fd47c918151961ee33e9'),
  ('signatures','columns',20,'797f0ddc5fc897933ad3eecf858ac4638d2c45f577ce04a69432002591bbc4af'),
  ('signatures','constraints',6,'5591c5d6cf66eba8a7fe8ee89218a5824f9a5e5c10c8aaed2330d8d379177238'),
  ('signatures','indexes',3,'eb5aea7dc33b4dea3019501494bf91a4e7cd7aea73e6c38508b74349c7483eac'),
  ('signatures','policies',2,'afa7fc6b9154f5fa0797f6f23e3a19c48fcebcfe32fccc478759acdddabce8ab'),
  ('signatures','table',1,'3fb5593b7e5c2526a56c3e01d0c13ad989c1aff2d5e61e56a63e1ca08dabdb0c'),
  ('signatures','triggers',2,'2eb1189ffff39821b2d66a002f24932126852e3bba5aa309ac23ef92a98877a7'),
  ('time_entries','acl',16,'999191e13d3d3f1a40ac7fbb2f4ba5251f9b1ca06ae4fd47c918151961ee33e9'),
  ('time_entries','columns',16,'ef2da8f1038c01a15048a013b61bb6001bc23ba573827143bc5edd6c0df1c49e'),
  ('time_entries','constraints',5,'82509b5932049c8056bb4b4f0a4db565970a947013803653e8e59e5173c9be4b'),
  ('time_entries','indexes',3,'6da487d3c912d86767026e60117dcf1b1498578238fdb38be9ce500815026ecf'),
  ('time_entries','policies',2,'14c42938eba1f19f9f3d18572d265ce36742539fe435c443154c612825a45479'),
  ('time_entries','table',1,'3fb5593b7e5c2526a56c3e01d0c13ad989c1aff2d5e61e56a63e1ca08dabdb0c'),
  ('time_entries','triggers',0,'4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945')
)
SELECT o.t AS table_name,o.facet,e.n AS expected_count,o.n AS observed_count,
  CASE WHEN NOT o.present THEN 'absent' WHEN o.n=e.n AND o.sha=e.sha THEN 'matches_reference' ELSE 'differs' END AS state
FROM observed o JOIN expected e USING(t,facet) ORDER BY o.t,o.facet;
COMMIT;
