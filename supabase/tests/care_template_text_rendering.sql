with cases(label,html,context,expected) as (values
('plain','<p>{{client.name}}</p>','{"client":{"name":"Ada"}}'::jsonb,'<p>Ada</p>'),
('whitespace','{{  client.name  }} / {{client.name}}','{"client":{"name":"Ada"}}'::jsonb,'Ada / Ada'),
('escape','{{x}}','{"x":"<img src=x onerror=alert(1)> & \"quoted\""}'::jsonb,'&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot;'),
('no_recursive_expansion','{{x}} / {{y}}','{"x":"{{y}}","y":"safe"}'::jsonb,'{{y}} / safe'),
('missing','a{{missing}}b','{}'::jsonb,'ab'),
('null_html',null,'{}'::jsonb,''),
('repeated','{{x}}{{x}}','{"x":"A"}'::jsonb,'AA'),
('apostrophe','{{x}}',jsonb_build_object('x','O''Brien'),'O&#39;Brien'),
('literal_slashes','{{x}}',jsonb_build_object('x',chr(92)||'1$'),'\1$')
) select label,public.cs_render_template_html(html,context)=expected as passed from cases;
