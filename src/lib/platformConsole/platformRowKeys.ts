/** Stable row keys for platform catalog tables when legacy rows lack primary keys. */
export function resolvePlatformAddonRowKey(row: Record<string, unknown>, index: number): string {
  const key = String(row.addon_key ?? '').trim();
  if (key) return key;
  const id = String(row.id ?? '').trim();
  if (id) return `legacy-addon:${id}`;
  return `legacy-addon-index:${index}`;
}

export function resolvePlatformPlanRowKey(row: Record<string, unknown>, index: number): string {
  const key = String(row.plan_key ?? '').trim();
  if (key) return key;
  const id = String(row.id ?? '').trim();
  if (id) return `legacy-plan:${id}`;
  return `legacy-plan-index:${index}`;
}
