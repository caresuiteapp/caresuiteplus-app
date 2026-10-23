// KIM address comparison is case-insensitive in BOTH parts (A_21455-01/A_21456-01).
// Existing accounts may retain the broader RFC dot-atom alphabet; new accounts use the KIM alphabet.
export function kimAddress(value, { provision = false } = {}) {
  if (typeof value !== 'string' || value.length > 254) throw new Error('KIM_ADDRESS');
  const parts = value.split('@');
  if (parts.length !== 2) throw new Error('KIM_ADDRESS');
  const [local, host] = parts;
  const alphabet = provision ? /^[A-Za-z0-9._-]+$/ : /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  if (!local || local.length > 64 || !alphabet.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || host.length > 189 || !/\.kim\.telematik(?:-test)?$/i.test(host)
    || host.split('.').some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) throw new Error('KIM_ADDRESS');
  return value.toLowerCase();
}
export const messageId = v => typeof v === 'string' && v.length <= 250 && /^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+>$/.test(v);
export const hostName = v => typeof v === 'string' && v.length <= 189 && v.includes('.') && v.split('.').every(s => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s));
