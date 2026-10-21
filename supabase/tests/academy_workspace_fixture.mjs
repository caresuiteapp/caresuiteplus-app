import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { companyFixture, id } from './company_access_fixture.mjs';
export { id };
export const academySql = () => readFileSync(new URL('../changes/academy_workspace.sql', import.meta.url), 'utf8');
export const content = (changes = {}) => ({
  title: 'Synthetischer Lernkurs', summary: 'Isolierter SQL-Test', category: 'Grundlagen',
  audiences: ['employee', 'client', 'family'], estimatedMinutes: 20, mandatory: true,
  passPercent: 80, maxAttempts: 2,
  lessons: [{ id: 'reading', title: 'Einführung', kind: 'text', body: 'Testinhalt' },
    { id: 'check', title: 'Wissenscheck', kind: 'quiz', body: '', questions: [
      { id: 'question-1', prompt: 'Testfrage', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'b' },
    ] }], ...changes,
});
/** Actual prepared SQL in isolated Postgres, using only synthetic identities and no network. */
export async function academyFixture({ beforeWorkspace } = {}) {
  const f = await companyFixture(); const { db, owner } = f; await owner();
  await db.exec(`
    ALTER TABLE tenants ADD COLUMN name text DEFAULT 'Synthetisches Unternehmen';
    ALTER TABLE employees ADD COLUMN portal_enabled boolean DEFAULT true;
    CREATE TABLE documents(id uuid PRIMARY KEY);
    CREATE TYPE course_status AS ENUM('draft','published','archived','deleted');
    CREATE TYPE lesson_status AS ENUM('draft','published','archived');
    CREATE TYPE course_enrollment_status AS ENUM('invited','active','completed','failed','cancelled');
    CREATE TYPE certificate_status AS ENUM('draft','issued','revoked','expired');
    CREATE TYPE product_key AS ENUM('assist','pflege','stationaer','office','beratung','akademie');
    CREATE TABLE courses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),title text NOT NULL,subtitle text,description text,status course_status NOT NULL DEFAULT 'draft',product_key product_key DEFAULT 'akademie',is_mandatory boolean DEFAULT false,mandatory_for_roles text[] DEFAULT '{}',estimated_minutes integer,cover_image_url text,intro_video_url text,passing_required boolean DEFAULT false,created_by uuid REFERENCES profiles(id),published_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE course_lessons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),course_id uuid NOT NULL REFERENCES courses(id),title text NOT NULL,description text,status lesson_status NOT NULL DEFAULT 'draft',content_text text,video_url text,document_id uuid REFERENCES documents(id),sort_order integer DEFAULT 0,estimated_minutes integer,is_preview boolean DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE course_enrollments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),course_id uuid NOT NULL REFERENCES courses(id),employee_id uuid REFERENCES employees(id),profile_id uuid REFERENCES profiles(id),status course_enrollment_status NOT NULL DEFAULT 'invited',progress_percent numeric DEFAULT 0,invited_at timestamptz DEFAULT now(),started_at timestamptz,completed_at timestamptz,due_at timestamptz,last_activity_at timestamptz,notes text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT course_enrollments_unique_employee_course UNIQUE(tenant_id,course_id,employee_id));
    CREATE TABLE certificates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),course_id uuid REFERENCES courses(id),employee_id uuid REFERENCES employees(id),profile_id uuid REFERENCES profiles(id),certificate_number text,title text NOT NULL,status certificate_status NOT NULL DEFAULT 'draft',issued_at date,valid_until date,pdf_url text,document_id uuid REFERENCES documents(id),revoked_at timestamptz,revoked_reason text,created_by uuid REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,certificate_number));
    CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,table_name text,record_id uuid,new_data jsonb,old_data jsonb);
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON audit_logs TO authenticated;
    CREATE POLICY audit_logs_tenant_manage ON audit_logs TO authenticated USING(tenant_id=public.current_tenant_id());
    CREATE FUNCTION academy_fixture_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN INSERT INTO public.audit_logs(tenant_id,table_name,record_id,new_data,old_data) VALUES(NEW.tenant_id,TG_TABLE_NAME,NEW.id,to_jsonb(NEW),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END); RETURN NEW; END $$;
    CREATE VIEW v_course_overview AS SELECT * FROM courses;
    CREATE VIEW v_course_lesson_overview AS SELECT * FROM course_lessons;
    CREATE VIEW v_course_enrollment_overview AS SELECT * FROM course_enrollments;
    CREATE VIEW v_certificate_overview AS SELECT * FROM certificates;
    GRANT SELECT ON v_course_overview,v_course_lesson_overview,v_course_enrollment_overview,v_certificate_overview TO authenticated;
    CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),first_name text,last_name text,status text,portal_enabled boolean DEFAULT true,deleted_at timestamptz);
    CREATE TABLE client_contacts(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),client_id uuid REFERENCES clients(id),first_name text,last_name text,portal_enabled boolean DEFAULT true);
    CREATE TABLE employee_portal_accounts(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,employee_id uuid REFERENCES employees(id),auth_user_id uuid,status text);
    CREATE TABLE client_portal_access(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid REFERENCES clients(id),contact_id uuid REFERENCES client_contacts(id) ON DELETE SET NULL,auth_user_id uuid,status text,portal_enabled boolean,account_kind text NOT NULL DEFAULT 'self',access_scope text NOT NULL DEFAULT 'client',access_generation bigint NOT NULL DEFAULT 1);
    CREATE TABLE client_portal_codes(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid REFERENCES clients(id),auth_user_id uuid,status text,expires_at timestamptz);
    CREATE TABLE relative_portal_codes(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid REFERENCES clients(id),relative_contact_id uuid REFERENCES client_contacts(id),auth_user_id uuid,status text,expires_at timestamptz);
    CREATE TABLE portal_sessions(id uuid PRIMARY KEY,tenant_id uuid,portal_type text,access_code_id uuid,client_id uuid,relative_contact_id uuid,status text,expires_at timestamptz,revoked_at timestamptz,logged_out_at timestamptz);
    CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql AS $$ SELECT auth.jwt()->'app_metadata'->>'portal_type' $$;
    CREATE FUNCTION public.current_portal_account_id() RETURNS uuid LANGUAGE sql AS $$ SELECT (auth.jwt()->'app_metadata'->>'portal_account_id')::uuid $$;
    CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT CASE WHEN public.current_portal_type()='academy_family' THEN NULL ELSE nullif(current_setting('fixture.tenant',true),'')::uuid END $$;
    CREATE FUNCTION public.platform_tenant_access_allowed(uuid,boolean) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 IN ('${id(10)}'::uuid,'${id(11)}'::uuid) $$;
    CREATE FUNCTION public.update_course_progress(uuid,numeric) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN UPDATE public.course_enrollments SET progress_percent=$2,status='completed' WHERE id=$1; RETURN true; END $$;
    GRANT EXECUTE ON FUNCTION public.update_course_progress(uuid,numeric) TO authenticated;
  `);
  for (const table of ['courses', 'course_lessons', 'course_enrollments', 'certificates']) {
    await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT ALL ON ${table} TO authenticated; CREATE POLICY legacy_tenant ON ${table} TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id()); CREATE TRIGGER academy_test_audit AFTER INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION academy_fixture_audit()`);
  }
  await db.query("INSERT INTO clients(id,tenant_id,first_name,last_name,status) VALUES($1,$2,'Client','One','active'),($3,$4,'Other','Tenant','active')", [id(50), id(10), id(51), id(11)]);
  await db.query("INSERT INTO client_contacts(id,tenant_id,client_id,first_name,last_name) VALUES($1,$2,$3,'Family','One')", [id(52), id(10), id(50)]);
  await db.query("INSERT INTO employee_portal_accounts VALUES($1,$2,$3,$4,'active')", [id(60), id(10), id(41), id(122)]);
  await db.query("INSERT INTO client_portal_access VALUES($1,$2,$3,NULL,$4,'aktiv',true,'self','client',1),($5,$2,$3,$6,$7,'aktiv',true,'academy_family','academy',1)", [id(61), id(10), id(50), id(130), id(62), id(52), id(131)]);
  await db.query("INSERT INTO relative_portal_codes VALUES($1,$2,$3,$4,$5,'active',now()+interval '1 day')", [id(63), id(10), id(50), id(52), id(132)]);
  await db.query("INSERT INTO portal_sessions VALUES($1,$2,'relative',$3,$4,$5,'active',now()+interval '1 day',NULL,NULL)", [id(64), id(10), id(63), id(50), id(52)]);
  // Exercise controlled standard-role defaults and explicit manager grants.
  for (const permission of ['akademie.courses.view','office.employees.view','office.clients.view_sensitive']) await db.query('INSERT INTO role_permissions(role_id,permission_key) VALUES($1,$2)', [id(1), permission]);
  for (const permission of ['akademie.courses.view','akademie.courses.manage','akademie.enrollments.assign','akademie.enrollments.review','office.clients.view_sensitive']) await db.query('INSERT INTO role_permissions(role_id,permission_key) VALUES($1,$2)', [id(2), permission]);
  if (beforeWorkspace) await beforeWorkspace(f);
  await db.exec(academySql());
  const learner = async (kind = 'employee') => {
    const [profile, account, portal] = { employee: [22,60,'employee'], client: [30,61,'client'], family: [31,62,'academy_family'], relative: [32,63,'relative'] }[kind];
    await f.actor(profile,10,{app_metadata:{portal_type:portal,portal_account_id:id(account),academy_access_generation:1,role_key: kind==='employee'?'employee_portal':kind==='client'?'client_portal':'family_portal'}});
  };
  const load = async (view = 'office', tenant = 10) => (await db.query('SELECT public.academy_workspace_load($1,$2) r', [id(tenant),view])).rows[0].r;
  const mutate = async (action, recordId, revision, data = {}, options = {}) => (await db.query('SELECT public.academy_workspace_mutate($1,$2,$3,$4,$5,$6,$7) r',[id(options.tenant ?? 10),options.view ?? 'office',action,options.request ?? randomUUID(),recordId,revision,JSON.stringify(data)])).rows[0].r;
  const publish = async (courseContent = content(), courseId = randomUUID()) => { const saved = await mutate('save_course',courseId,null,{content:courseContent}); return mutate('publish_course',courseId,saved.revision); };
  const assign = async (course, targets = [{kind:'employee',id:id(41)}]) => mutate('assign',course.recordId,course.revision,{targets,dueDate:null});
  await f.actor(); return {...f,learner,load,mutate,publish,assign};
}
