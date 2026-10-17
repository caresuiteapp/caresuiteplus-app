-- Additive schema for personal Office notes.
-- Ownership always uses auth.uid(), never a profile ID or administrator bypass.
-- DELETE requests must also filter the expected revision in the client service.

CREATE TABLE public.office_private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  format text NOT NULL DEFAULT 'plain',
  status text NOT NULL DEFAULT 'open',
  tags text[] NOT NULL DEFAULT '{}'::text[],
  due_date date,
  pinned boolean NOT NULL DEFAULT false,
  content jsonb NOT NULL DEFAULT '{"text":"","cues":"","summary":"","fields":[],"tasks":[],"sources":[],"nodes":[],"strokes":[]}'::jsonb,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT office_private_notes_title_length CHECK (char_length(title) <= 240),
  CONSTRAINT office_private_notes_category CHECK (category IN ('general', 'contacts', 'dates', 'knowledge', 'sources', 'tasks', 'decisions', 'next_steps', 'ideas', 'reflections', 'questions')),
  CONSTRAINT office_private_notes_format CHECK (format IN ('plain', 'cornell', 'mindmap', 'handwriting')),
  CONSTRAINT office_private_notes_status CHECK (status IN ('open', 'in_progress', 'done')),
  CONSTRAINT office_private_notes_tags_count CHECK (cardinality(tags) <= 30),
  CONSTRAINT office_private_notes_due_date_range CHECK (due_date IS NULL OR due_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  CONSTRAINT office_private_notes_content_object CHECK (jsonb_typeof(content) = 'object'),
  CONSTRAINT office_private_notes_content_size CHECK (octet_length(content::text) <= 1048576),
  CONSTRAINT office_private_notes_revision_positive CHECK (revision > 0)
);

CREATE INDEX office_private_notes_owner_updated_idx
  ON public.office_private_notes (tenant_id, owner_user_id, updated_at DESC, id);
CREATE INDEX office_private_notes_auth_owner_idx
  ON public.office_private_notes (owner_user_id);

CREATE FUNCTION public.validate_office_private_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_key text;
  v_tag text;
  v_item jsonb;
  v_point jsonb;
  v_id text;
  v_parent text;
  v_seen_ids text[];
  v_chain text[];
  v_node_parents jsonb := '{}'::jsonb;
  v_point_count integer := 0;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT COALESCE(
    NEW.tenant_id = public.current_tenant_id()
    AND NEW.owner_user_id = auth.uid()
    AND public.has_permission('office.access')
    AND public.current_role_key() NOT IN ('employee_portal', 'client_portal', 'family_portal'),
    false
  ) THEN
    RAISE EXCEPTION 'Not permitted to save this personal note.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.revision IS DISTINCT FROM 1 OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'A new personal note must start at revision 1 and must not be archived.' USING ERRCODE = '22023';
    END IF;
    NEW.created_at := v_now;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Personal note identity cannot be changed.' USING ERRCODE = '42501';
    END IF;
    IF NEW.revision IS NULL OR NEW.revision::bigint <> OLD.revision::bigint + 1 THEN
      RAISE EXCEPTION 'Personal note revision conflict.' USING ERRCODE = '40001';
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      IF NEW.archived_at IS NOT NULL THEN
        NEW.archived_at := COALESCE(OLD.archived_at, v_now);
      END IF;
    END IF;
  END IF;
  NEW.updated_at := v_now;

  IF NEW.tags IS NULL OR COALESCE(array_ndims(NEW.tags), 1) > 1 OR cardinality(NEW.tags) > 30 THEN
    RAISE EXCEPTION 'Invalid personal note tags.' USING ERRCODE = '22023';
  END IF;
  FOREACH v_tag IN ARRAY NEW.tags LOOP
    IF v_tag IS NULL OR char_length(v_tag) > 40
      OR btrim(v_tag, E' \t\n\r\013\f' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') = ''
    THEN
      RAISE EXCEPTION 'Invalid personal note tag.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF jsonb_typeof(NEW.content) IS DISTINCT FROM 'object'
    OR octet_length(NEW.content::text) > 1048576
  THEN
    RAISE EXCEPTION 'Invalid personal note content.' USING ERRCODE = '22023';
  END IF;

  FOREACH v_key IN ARRAY ARRAY['text', 'cues', 'summary'] LOOP
    IF jsonb_typeof(NEW.content -> v_key) IS DISTINCT FROM 'string'
      OR char_length(NEW.content ->> v_key) > 100000
    THEN
      RAISE EXCEPTION 'Invalid personal note text field: %.', v_key USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOREACH v_key IN ARRAY ARRAY['fields', 'tasks', 'sources', 'nodes', 'strokes'] LOOP
    IF jsonb_typeof(NEW.content -> v_key) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Invalid personal note collection: %.', v_key USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(NEW.content -> v_key) > (CASE v_key
      WHEN 'fields' THEN 80 WHEN 'tasks' THEN 200 WHEN 'sources' THEN 100
      WHEN 'nodes' THEN 80 ELSE 500 END)
    THEN
      RAISE EXCEPTION 'Personal note collection is too large: %.', v_key USING ERRCODE = '22023';
    END IF;

    v_seen_ids := '{}'::text[];
    FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.content -> v_key) LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
        OR jsonb_typeof(v_item -> 'id') IS DISTINCT FROM 'string'
      THEN
        RAISE EXCEPTION 'Invalid personal note item in %.', v_key USING ERRCODE = '22023';
      END IF;
      v_id := v_item ->> 'id';
      IF char_length(btrim(v_id)) = 0 OR char_length(v_id) > 100 OR v_id = ANY(v_seen_ids) THEN
        RAISE EXCEPTION 'Invalid or duplicate personal note item ID in %.', v_key USING ERRCODE = '22023';
      END IF;
      v_seen_ids := array_append(v_seen_ids, v_id);

      IF v_key = 'fields' THEN
        IF jsonb_typeof(v_item -> 'label') IS DISTINCT FROM 'string'
          OR char_length(v_item ->> 'label') > 100
          OR jsonb_typeof(v_item -> 'value') IS DISTINCT FROM 'string'
          OR char_length(v_item ->> 'value') > 5000
        THEN
          RAISE EXCEPTION 'Invalid personal note field.' USING ERRCODE = '22023';
        END IF;
      ELSIF v_key = 'tasks' THEN
        IF jsonb_typeof(v_item -> 'text') IS DISTINCT FROM 'string'
          OR char_length(v_item ->> 'text') > 2000
          OR jsonb_typeof(v_item -> 'assignee') IS DISTINCT FROM 'string'
          OR char_length(v_item ->> 'assignee') > 160
          OR jsonb_typeof(v_item -> 'dueDate') IS DISTINCT FROM 'string'
          OR jsonb_typeof(v_item -> 'status') IS DISTINCT FROM 'string'
          OR (v_item ->> 'status') NOT IN ('open', 'in_progress', 'done')
        THEN
          RAISE EXCEPTION 'Invalid personal note task.' USING ERRCODE = '22023';
        END IF;
        IF v_item ->> 'dueDate' <> '' THEN
          IF (v_item ->> 'dueDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RAISE EXCEPTION 'Invalid personal note task date.' USING ERRCODE = '22023';
          END IF;
          IF to_char((v_item ->> 'dueDate')::date, 'YYYY-MM-DD') <> v_item ->> 'dueDate' THEN
            RAISE EXCEPTION 'Invalid personal note task date.' USING ERRCODE = '22023';
          END IF;
        END IF;
      ELSIF v_key = 'sources' THEN
        IF jsonb_typeof(v_item -> 'title') IS DISTINCT FROM 'string'
          OR char_length(v_item ->> 'title') > 240
          OR jsonb_typeof(v_item -> 'url') IS DISTINCT FROM 'string'
          OR char_length(v_item ->> 'url') > 2048
          OR ((v_item ->> 'url') <> '' AND (v_item ->> 'url') !~* '^https?://[^[:space:]]+$')
        THEN
          RAISE EXCEPTION 'Invalid personal note source.' USING ERRCODE = '22023';
        END IF;
      ELSIF v_key = 'nodes' THEN
        IF jsonb_typeof(v_item -> 'text') IS DISTINCT FROM 'string'
          OR char_length(v_item ->> 'text') > 500
          OR COALESCE(jsonb_typeof(v_item -> 'parentId'), '') NOT IN ('null', 'string')
          OR jsonb_typeof(v_item -> 'x') IS DISTINCT FROM 'number'
          OR jsonb_typeof(v_item -> 'y') IS DISTINCT FROM 'number'
        THEN
          RAISE EXCEPTION 'Invalid personal note mind map node.' USING ERRCODE = '22023';
        END IF;
        IF (v_item ->> 'x')::numeric NOT BETWEEN 0 AND 1000
          OR (v_item ->> 'y')::numeric NOT BETWEEN 0 AND 600
        THEN
          RAISE EXCEPTION 'Personal note mind map coordinates are out of bounds.' USING ERRCODE = '22023';
        END IF;
        v_node_parents := v_node_parents || jsonb_build_object(v_id, v_item -> 'parentId');
      ELSIF v_key = 'strokes' THEN
        IF jsonb_typeof(v_item -> 'color') IS DISTINCT FROM 'string'
          OR (v_item ->> 'color') !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$'
          OR jsonb_typeof(v_item -> 'width') IS DISTINCT FROM 'number'
          OR jsonb_typeof(v_item -> 'points') IS DISTINCT FROM 'array'
        THEN
          RAISE EXCEPTION 'Invalid personal note handwriting stroke.' USING ERRCODE = '22023';
        END IF;
        IF (v_item ->> 'width')::numeric NOT BETWEEN 1 AND 20 THEN
          RAISE EXCEPTION 'Invalid personal note handwriting width.' USING ERRCODE = '22023';
        END IF;
        IF jsonb_array_length(v_item -> 'points') = 0 THEN
          RAISE EXCEPTION 'Personal note handwriting stroke must contain a point.' USING ERRCODE = '22023';
        END IF;
        v_point_count := v_point_count + jsonb_array_length(v_item -> 'points');
        IF v_point_count > 30000 THEN
          RAISE EXCEPTION 'Personal note handwriting has too many points.' USING ERRCODE = '22023';
        END IF;
        FOR v_point IN SELECT value FROM jsonb_array_elements(v_item -> 'points') LOOP
          IF jsonb_typeof(v_point) IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION 'Invalid personal note handwriting point.' USING ERRCODE = '22023';
          END IF;
          IF jsonb_array_length(v_point) <> 2
            OR jsonb_typeof(v_point -> 0) IS DISTINCT FROM 'number'
            OR jsonb_typeof(v_point -> 1) IS DISTINCT FROM 'number'
          THEN
            RAISE EXCEPTION 'Invalid personal note handwriting point.' USING ERRCODE = '22023';
          END IF;
          IF (v_point ->> 0)::numeric NOT BETWEEN 0 AND 1000
            OR (v_point ->> 1)::numeric NOT BETWEEN 0 AND 600
          THEN
            RAISE EXCEPTION 'Personal note handwriting coordinates are out of bounds.' USING ERRCODE = '22023';
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- Bounded by 80 nodes: reject missing parents and cycles before storage.
  FOR v_id IN SELECT jsonb_object_keys(v_node_parents) LOOP
    v_chain := ARRAY[v_id];
    v_parent := v_node_parents ->> v_id;
    WHILE v_parent IS NOT NULL LOOP
      IF NOT (v_node_parents ? v_parent) OR v_parent = ANY(v_chain) THEN
        RAISE EXCEPTION 'Personal note mind map has a missing parent or a cycle.' USING ERRCODE = '22023';
      END IF;
      v_chain := array_append(v_chain, v_parent);
      v_parent := v_node_parents ->> v_parent;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_office_private_note_before_write
BEFORE INSERT OR UPDATE ON public.office_private_notes
FOR EACH ROW EXECUTE FUNCTION public.validate_office_private_note();

REVOKE ALL ON FUNCTION public.validate_office_private_note() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.office_private_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_private_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY office_private_notes_select_own ON public.office_private_notes
FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND owner_user_id = (SELECT auth.uid())
  AND (SELECT public.has_permission('office.access'))
  AND (SELECT public.current_role_key()) NOT IN ('employee_portal', 'client_portal', 'family_portal')
);

CREATE POLICY office_private_notes_insert_own ON public.office_private_notes
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND owner_user_id = (SELECT auth.uid())
  AND (SELECT public.has_permission('office.access'))
  AND (SELECT public.current_role_key()) NOT IN ('employee_portal', 'client_portal', 'family_portal')
);

CREATE POLICY office_private_notes_update_own ON public.office_private_notes
FOR UPDATE TO authenticated
USING (
  tenant_id = (SELECT public.current_tenant_id())
  AND owner_user_id = (SELECT auth.uid())
  AND (SELECT public.has_permission('office.access'))
  AND (SELECT public.current_role_key()) NOT IN ('employee_portal', 'client_portal', 'family_portal')
)
WITH CHECK (
  tenant_id = (SELECT public.current_tenant_id())
  AND owner_user_id = (SELECT auth.uid())
  AND (SELECT public.has_permission('office.access'))
  AND (SELECT public.current_role_key()) NOT IN ('employee_portal', 'client_portal', 'family_portal')
);

CREATE POLICY office_private_notes_delete_own_archived ON public.office_private_notes
FOR DELETE TO authenticated
USING (
  archived_at IS NOT NULL
  AND tenant_id = (SELECT public.current_tenant_id())
  AND owner_user_id = (SELECT auth.uid())
  AND (SELECT public.has_permission('office.access'))
  AND (SELECT public.current_role_key()) NOT IN ('employee_portal', 'client_portal', 'family_portal')
);

REVOKE ALL ON TABLE public.office_private_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.office_private_notes TO authenticated;

COMMENT ON TABLE public.office_private_notes IS 'Personal Office notes, isolated by tenant and authenticated owner; administrators cannot read another owner''s notes through RLS.';
