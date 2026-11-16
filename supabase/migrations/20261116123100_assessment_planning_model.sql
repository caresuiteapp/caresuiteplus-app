alter table public.care_assessments add column if not exists planning_model text
  check (planning_model in ('atl','aedl','fedl','roper','orem','henderson'));
