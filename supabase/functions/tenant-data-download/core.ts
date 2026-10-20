type DownloadInput = { tenantId: string; requestId: string; fileId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validDownloadInput(value: unknown): value is DownloadInput {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return ['tenantId','requestId','fileId'].every(key => typeof row[key] === 'string' && uuid.test(row[key]));
}
export async function authorizeDownload(
  input: DownloadInput,
  authorize: (args: Record<string, string>) => Promise<{ data: unknown; error: unknown }>,
  sign: (path: string, seconds: number, name: string) => Promise<{ data: { signedUrl: string } | null; error: unknown }>,
): Promise<string> {
  const { data, error } = await authorize({ p_action: 'download', p_tenant_id: input.tenantId, p_request_id: input.requestId, p_file_id: input.fileId });
  const file = data as { id?: string; tenant_id?: string; request_id?: string; object_path?: string; name?: string } | null;
  const expected = `${input.tenantId}/${input.requestId}/${input.fileId}`;
  if (error || !file || file.id !== input.fileId || file.tenant_id !== input.tenantId || file.request_id !== input.requestId || file.object_path !== expected || !file.name) throw new Error('forbidden');
  const safeName = file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_');
  const signed = await sign(expected, 60, safeName);
  if (signed.error || !signed.data?.signedUrl) throw new Error('unavailable');
  return signed.data.signedUrl;
}
