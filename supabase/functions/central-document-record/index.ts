import { createClient } from 'npm:@supabase/supabase-js@2';
import { canonicalJson, validateCentralPayload, decodePdf, mapStoredRecord } from './payload.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return response({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer \S+$/.test(auth)) return response({ ok: false, error: 'Anmeldung erforderlich.' }, 401);
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await caller.auth.getUser(auth.slice(7));
  if (authError || !user) return response({ ok: false, error: 'Anmeldung ungültig.' }, 401);
  let body: Record<string, unknown>;
  try {
    // Bound the stream, including clients that omit Content-Length.
    const reader = req.body?.getReader(); if (!reader) throw new Error('Anfrage fehlt.');
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 24 * 1024 * 1024) { await reader.cancel(); throw new Error('Anfrage zu groß.'); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return response({ ok: false, error: 'Ungültige oder zu große Anfrage.' }, 400); }
  const validation = validateCentralPayload(body);
  if (!validation.ok) return response(validation, 400);
  const { snapshot, pdfBase64, original } = validation.data;
  const [{ data: tenantId, error: tenantError }, { data: canSave, error: permError }] = await Promise.all([
    caller.rpc('current_tenant_id'), caller.rpc('has_permission', { p_permission_key: 'documents.save_to_file' }),
  ]);
  if (tenantError || permError || tenantId !== snapshot.context.tenantId || !canSave) return response({ ok: false, error: 'Keine Berechtigung für diesen Mandanten oder die Aktenablage.' }, 403);
  for (const permission of ['documents.create', 'office.documents.view', ...(snapshot.context.target === 'client' ? ['office.clients.view','office.clients.view_sensitive'] : snapshot.context.target === 'employee' ? ['office.employees.view'] : [])]) {
    const { data, error } = await caller.rpc('has_permission', { p_permission_key: permission });
    if (error || !data) return response({ ok: false, error: 'Keine Berechtigung für die ausgewählte Akte.' }, 403);
  }
  const { data: definition, error: catalogError } = await caller.from('central_document_catalog').select('definition_json,review_status').eq('template_key', snapshot.definition.key).eq('version', snapshot.definition.version).maybeSingle();
  if (catalogError || !definition || definition.review_status === 'withdrawn' || canonicalJson(definition.definition_json) !== canonicalJson(snapshot.definition)) return response({ ok: false, error: 'Die Vorlagenfassung wurde verändert oder ist nicht verfügbar.' }, 409);
  if (definition.definition_json.clinicalReviewRequired) {
    const { data, error } = await caller.rpc('has_permission', { p_permission_key: 'office.clients.view_sensitive' });
    if (error || !data) return response({ ok: false, error: 'Keine Berechtigung für sensible Pflegedokumente.' }, 403);
  }
  // Resolve the real profile identity, including installations with auth_user_id.
  const { data: profile, error: profileError } = await caller.from('profiles').select('id,tenant_id').or(`id.eq.${user.id},auth_user_id.eq.${user.id}`).eq('tenant_id', tenantId).single();
  if (profileError || !profile) return response({ ok: false, error: 'Benutzerprofil nicht eindeutig zugeordnet.' }, 403);
  if (snapshot.context.target !== 'company') {
    const { data, error } = await caller.from(snapshot.context.target === 'client' ? 'clients' : 'employees').select('id').eq('tenant_id', tenantId).eq('id', snapshot.context.entityId).maybeSingle();
    if (error || !data) return response({ ok: false, error: 'Akte nicht verfügbar.' }, 403);
  }
  let pdf: Uint8Array; let originalBytes: Uint8Array | null;
  try { pdf = decodePdf(pdfBase64); originalBytes = original ? decodePdf(original.base64) : null; }
  catch { return response({ ok: false, error: 'Eine gültige PDF-Datei mit höchstens 8 MB ist erforderlich.' }, 400); }
  if (!originalBytes && definition.definition_json.sourceMode === 'original' && snapshot.parentDocumentId) {
    const {data:parent,error:parentError} = await caller.from('central_document_records').select('original_path,original_hash')
      .eq('tenant_id',tenantId).eq('id',snapshot.parentDocumentId).eq('target',snapshot.context.target).eq('entity_id',snapshot.context.entityId).eq('template_key',snapshot.definition.key).eq('revision',snapshot.revision-1).maybeSingle();
    if(parentError || !parent?.original_path) return response({ok:false,error:'Originalunterlage der Vorgängerfassung ist nicht verfügbar.'},409);
    const {data:file,error:fileError} = await caller.storage.from('office-documents').download(parent.original_path);
    if(fileError || !file || file.size>8*1024*1024) return response({ok:false,error:'Originalunterlage konnte nicht übernommen werden.'},409);
    originalBytes = new Uint8Array(await file.arrayBuffer());
    if(await digest(originalBytes)!==parent.original_hash) return response({ok:false,error:'Der Prüfwert der Originalunterlage stimmt nicht überein.'},409);
  }
  const [pdfHash, snapshotHash, originalHash] = await Promise.all([digest(pdf), digest(new TextEncoder().encode(canonicalJson(snapshot))), originalBytes ? digest(originalBytes) : null]);
  const { data: previous, error: previousError } = await caller.from('central_document_records').select('*').eq('tenant_id', tenantId).eq('id', snapshot.documentId).maybeSingle();
  if (previousError) return response({ ok: false, error: 'Dokumentenablage nicht verfügbar.' }, 503);
  if (previous) return previous.pdf_hash === pdfHash && previous.snapshot_hash === snapshotHash && previous.original_hash === originalHash
    ? response({ ok: true, record: mapStoredRecord(previous) })
    : response({ ok: false, error: 'Diese Dokument-ID ist bereits für eine andere Fassung vergeben.' }, 409);
  const manifest: Record<string, unknown> = { schema: 'caresuite-stored-document/1', assertion: 'stored_file_integrity', documentId: snapshot.documentId, revision: snapshot.revision, pdfHash, snapshotHash, originalHash };
  const signingSecret = Deno.env.get('CENTRAL_DOCUMENT_HMAC_SECRET');
  if (signingSecret) {
    manifest.algorithm = 'HMAC-SHA256'; manifest.keyId = Deno.env.get('CENTRAL_DOCUMENT_HMAC_KEY_ID') || 'v1';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonicalJson(manifest))));
    manifest.signature = btoa(String.fromCharCode(...signature));
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const folder = `tenant/${tenantId}/central-documents/${snapshot.documentId}`;
  const pdfPath = `${folder}/draft.pdf`; const originalPath = originalBytes ? `${folder}/original.pdf` : null;
  const uploaded: string[] = [];
  try {
    const first = await admin.storage.from('office-documents').upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: false });
    if (first.error) throw new Error('Dateiablage nicht verfügbar.'); uploaded.push(pdfPath);
    if (originalBytes && originalPath) {
      const second = await admin.storage.from('office-documents').upload(originalPath, originalBytes, { contentType: 'application/pdf', upsert: false });
      if (second.error) throw new Error('Originalunterlage konnte nicht gespeichert werden.'); uploaded.push(originalPath);
    }
    const { data, error } = await admin.rpc('register_central_document', { p_snapshot: snapshot, p_actor: profile.id, p_pdf_path: pdfPath, p_pdf_hash: pdfHash, p_snapshot_hash: snapshotHash, p_original_path: originalPath, p_original_hash: originalHash, p_manifest: manifest });
    if (error || !data) throw new Error('Die Aktenzuordnung konnte nicht abgeschlossen werden.');
    return response({ ok: true, record: mapStoredRecord(data) });
  } catch (error) {
    // A failed registration leaves no pretend success or orphan PDF pointer.
    // If an uncertain network result actually committed, do not delete its file.
    const { data: registered, error: lookupError } = await admin.from('central_document_records').select('*').eq('id', snapshot.documentId).eq('tenant_id', tenantId).maybeSingle();
    if (registered?.pdf_hash === pdfHash && registered.snapshot_hash === snapshotHash && registered.original_hash === originalHash) return response({ ok: true, record: mapStoredRecord(registered) });
    if (!lookupError && !registered && uploaded.length) await admin.storage.from('office-documents').remove(uploaded);
    return response({ ok: false, error: error instanceof Error ? error.message : 'Aktenablage fehlgeschlagen.' }, 503);
  }
});
