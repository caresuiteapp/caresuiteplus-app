// Bounded, canonical dotted and DER OBJECT IDENTIFIER decoding shared by TI extensions.
export function canonicalOid(value) {
  if (typeof value !== 'string' || value.length > 256 || !/^(?:0|1|2)(?:\.(?:0|[1-9][0-9]*)){1,31}$/.test(value)) return false;
  const arcs = value.split('.').map(BigInt);
  return arcs.every(a => a <= 0x7fffffffffffffffn) && (arcs[0] === 2n || arcs[1] <= 39n);
}
export function oidText(node) {
  const fail = () => { throw new Error('DER_OID'); };
  if (node?.tag !== 6 || !node.value.length || node.value.length > 128) fail();
  const values = []; let value = 0n, start = true;
  for (const byte of node.value) {
    if (start && byte === 128) fail();
    value = (value << 7n) | BigInt(byte & 127);
    if (value > 0x7fffffffffffffffn) fail();
    if (!(byte & 128)) { values.push(value); value = 0n; start = true; } else start = false;
  }
  if (!start || !values.length) fail();
  const first = values.shift(), arc = first < 40n ? 0n : first < 80n ? 1n : 2n;
  const result = [arc, first - arc * 40n, ...values].join('.');
  if (!canonicalOid(result)) fail();
  return result;
}
