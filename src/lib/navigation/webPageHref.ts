export function webPageHref(pathname: string, params: Record<string, string | string[] | undefined>, changes: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...changes })) {
    for (const part of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, part);
  }
  const search = query.toString();
  return pathname + (search ? `?${search}` : '');
}
