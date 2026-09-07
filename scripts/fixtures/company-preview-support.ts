// Preserve the existing synthetic support workflow, including the company search.
export * from './support-preview-service';
import { supportRpc as originalRpc } from './support-preview-service';
export async function supportRpc(name: string, args: any = {}) {
 const result = await originalRpc(name, args);
 if (name === 'support_list_tickets' && 'tickets' in result && args.p_search) {
  const search = String(args.p_search).toLowerCase();
  return { ...result, tickets: result.tickets.filter((t: any) => `${t.tenant_name} ${t.subject} ${t.number}`.toLowerCase().includes(search)) };
 }
 return result;
}
