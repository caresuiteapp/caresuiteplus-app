BEGIN;
ALTER FUNCTION public.cs_placeholder_value(jsonb,text) SET search_path TO pg_catalog;
ALTER FUNCTION public.cs_seed_template(text,text,text,text,text,text,text,text,boolean,text[],text,jsonb,integer) SET search_path TO pg_catalog;
CREATE OR REPLACE FUNCTION public.cs_render_template_html(_html text,_context jsonb)
RETURNS text LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $body$
DECLARE remaining text:=coalesce(_html,''); output text:=''; token text[]; position integer; value text;
BEGIN
 LOOP
  token:=regexp_match(remaining,'(\{\{\s*([a-zA-Z0-9_.]+)\s*\}\})');
  EXIT WHEN token IS NULL;
  position:=strpos(remaining,token[1]);
  value:=public.cs_placeholder_value(_context,token[2]);
  value:=replace(replace(replace(replace(replace(value,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');
  output:=output||substr(remaining,1,position-1)||value;
  remaining:=substr(remaining,position+length(token[1]));
 END LOOP;
 RETURN output||remaining;
END;
$body$;
COMMIT;
