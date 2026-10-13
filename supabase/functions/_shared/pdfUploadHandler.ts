import { MAX_PDF_BYTES, parsePdfUpload, pdfSha256, pdfUploadJobId, pdfUploadPath } from './pdfUpload.ts';

type RowResult = { data: Record<string, unknown> | null; error: unknown };
type SelectQuery = {
  eq: (column: string, value: unknown) => SelectQuery;
  or: (filter: string) => SelectQuery;
  maybeSingle: () => PromiseLike<RowResult>;
  single: () => PromiseLike<RowResult>;
};
type PdfClient = {
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    select: (columns: string) => SelectQuery;
    upsert: (row: Record<string, unknown>, options: { onConflict: string; ignoreDuplicates: boolean }) => PromiseLike<{ error: unknown }>;
  };
  storage: { from: (bucket: string) => {
    upload: (path: string, bytes: Uint8Array, options: { contentType: string; upsert: boolean }) => PromiseLike<{ error: { statusCode?: string | number } | null }>;
    download: (path: string) => PromiseLike<{ data: Blob | null; error: unknown }>;
  } };
};

type Dependencies = {
  userClient: (authorization: string) => PdfClient;
  serviceClient: () => PdfClient;
  respond: (body: unknown, status?: number) => Response;
  corsHeaders: Record<string, string>;
};

/** Client-rendered PDF storage; neither document completion nor signature attestation. */
export function createPdfUploadHandler(dependencies: Dependencies) {
  return async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: dependencies.corsHeaders });
  if (req.method !== 'POST') return dependencies.respond({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  const authorization = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) return dependencies.respond({ ok: false, error: 'Bitte erneut anmelden.' }, 401);
  const userClient = dependencies.userClient(authorization);
  try {
    const verified = await userClient.auth.getUser();
    if (verified.error || !verified.data.user) return dependencies.respond({ ok: false, error: 'Bitte erneut anmelden.' }, 401);
    const security = await userClient.rpc('care_security_pdf_upload_ready', {});
    if (security.error || security.data !== true) return dependencies.respond({
      ok: false, error: 'Die Dokumentrechte sind noch nicht vollständig eingerichtet. Bitte die Verwaltung informieren.',
    }, 503);
    const maximumBody = Math.ceil(MAX_PDF_BYTES / 3) * 4 + 100000;
    const reader = req.body?.getReader();
    if (!reader) return dependencies.respond({ ok: false, error: 'PDF-Anfrage fehlt.' }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > maximumBody) {
        await reader.cancel();
        return dependencies.respond({ ok: false, error: 'Die PDF-Datei ist zu groß.' }, 413);
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let input;
    try { input = parsePdfUpload(JSON.parse(new TextDecoder().decode(bytes))); }
    catch (error) { return dependencies.respond({ ok: false, error: error instanceof Error ? error.message : 'Ungültige PDF-Anfrage.' }, 400); }
    const service = dependencies.serviceClient();
    const userId = verified.data.user.id;
    const actor = await service.from('profiles').select('id,tenant_id,role_id,is_active,status,auth_user_id')
      .or(`auth_user_id.eq.${userId},and(auth_user_id.is.null,id.eq.${userId})`).maybeSingle();
    if (actor.error || !actor.data || actor.data.tenant_id !== input.tenantId
      || actor.data.is_active !== true || actor.data.status !== 'active') {
      return dependencies.respond({ ok: false, error: 'Keine aktive Berechtigung für diesen Mandanten.' }, 403);
    }
    const role = await service.from('roles').select('*').eq('id', actor.data.role_id).single();
    if (role.error || !role.data || ['employee_portal', 'client_portal', 'family_portal', 'employee', 'caregiver', 'nurse', 'client', 'family', 'relative'].includes(String(role.data.key).toLowerCase())
      || role.data.tenant_id != null && role.data.tenant_id !== input.tenantId) {
      return dependencies.respond({ ok: false, error: 'Keine Verwaltungsberechtigung für diesen Upload.' }, 403);
    }
    const payroll = input.documentId.startsWith('payroll-');
    const permission = await userClient.rpc('has_permission', { p_permission_key: payroll ? 'office.employees.edit' : 'documents.finalize' });
    const administrator = role.data.is_admin_role === true || ['owner', 'admin', 'business_admin'].includes(String(role.data.key));
    if (permission.error || permission.data !== true && !administrator) return dependencies.respond({ ok: false, error: 'Die Dokumentberechtigung fehlt.' }, 403);
    if (payroll) {
      const employee = await service.from('employees').select('id').eq('tenant_id', input.tenantId).eq('id', input.employeeId).maybeSingle();
      if (employee.error || !employee.data) return dependencies.respond({ ok: false, error: 'Mitarbeitende:r nicht gefunden.' }, 403);
    } else {
      const document = await service.from('generated_documents').select('id,status,locked_at')
        .eq('tenant_id', input.tenantId).eq('id', input.documentId).maybeSingle();
      if (document.error || !document.data) return dependencies.respond({ ok: false, error: 'Dokument nicht gefunden.' }, 404);
      if (document.data.locked_at || !['draft', 'preview', 'generated'].includes(String(document.data.status))) {
        return dependencies.respond({ ok: false, error: 'Ein abgeschlossenes Dokument darf nicht neu erzeugt werden.' }, 409);
      }
    }
    const hash = await pdfSha256(input.pdfBytes);
    const storagePath = pdfUploadPath(input, hash);
    const bucket = service.storage.from('office-documents');
    const uploaded = await bucket.upload(storagePath, input.pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (uploaded.error) {
      // A content-addressed retry succeeds only when existing bytes match.
      if (String(uploaded.error.statusCode) !== '409') return dependencies.respond({ ok: false, error: 'PDF-Datei konnte nicht gespeichert werden.' }, 503);
      const original = await bucket.download(storagePath);
      if (original.error || !original.data || await pdfSha256(new Uint8Array(await original.data.arrayBuffer())) !== hash) {
        return dependencies.respond({ ok: false, error: 'Die vorhandene PDF-Datei konnte nicht bestätigt werden.' }, 409);
      }
    }
    const job = await service.from('document_render_jobs').upsert({
      id: await pdfUploadJobId(input, String(actor.data.id), hash), tenant_id: input.tenantId,
      job_type: 'pdf', job_status: 'completed', pdf_path: storagePath,
      related_entity_table: payroll ? 'payroll_month_statements' : 'generated_documents',
      related_entity_id: payroll ? input.documentId.slice(8) : input.documentId,
      created_by: actor.data.id, finished_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (job.error) return dependencies.respond({ ok: false, error: 'Der PDF-Upload konnte nicht vollständig bestätigt werden. Bitte erneut versuchen.' }, 503);
    return dependencies.respond({ ok: true, pdfPath: storagePath, engine: 'client_jspdf_upload', bytes: input.pdfBytes.length, sha256: hash });
  } catch {
    return dependencies.respond({ ok: false, error: 'Die PDF-Datei konnte gerade nicht gespeichert werden. Bitte erneut versuchen.' }, 503);
  }

  };
}
