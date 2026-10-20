// Preserve the existing synthetic support workflow, including the company search.
import { supportRpc as originalRpc } from './support-preview-service';
export { SUPPORT_SCOPES, SUPPORT_STATUS, newSupportNonce, isSupportAccessActive, withRequiredReadScopes,
  subscribeSupport, pickSupportAttachment, removeSupportDraftAttachment, downloadSupportAttachment,
  isSupportPermissionError } from './support-preview-service';
export async function supportRpc(name: string, args: any = {}) {
 const result = await originalRpc(name, args);
 if (name === 'support_list_tickets' && 'tickets' in result && Array.isArray(result.tickets) && args.p_search) {
  const search = String(args.p_search).toLowerCase();
  return { ...result, tickets: result.tickets.filter((t: any) => `${t.tenant_name} ${t.subject} ${t.number}`.toLowerCase().includes(search)) };
 }
 return result;
}
