export const PUBLIC_EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const PUBLIC_NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function publicAccessHash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))
    .map(byte => byte.toString(16).padStart(2,'0')).join('');
}
export type PublicAccessDb = { rpc(name: string,args: Record<string,unknown>): PromiseLike<{data: unknown;error: unknown}> };
export async function consumePublicAccessLimit(client: PublicAccessDb,channel: string,ip: string,account: string) {
  const { data,error } = await client.rpc('public_access_consume_limit',{
    p_channel:channel,p_ip_hash:await publicAccessHash(`ip:${ip}`),p_account_hash:await publicAccessHash(`account:${account}`),
  });
  if(error) throw new Error('public_access_limit_unconfirmed');
  return data === true;
}
