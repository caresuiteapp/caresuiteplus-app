import { createCipheriv } from 'node:crypto';

export function aesBlock(key, block) {
  const cipher = createCipheriv('aes-256-ecb', key, null); cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}
export function isoPad(bytes) {
  const padded = Buffer.alloc(bytes.length + 16 - bytes.length % 16);
  padded.set(bytes); padded[bytes.length] = 128; return padded;
}
function double(block) {
  const result = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) result[i] = (block[i] << 1) | ((block[i + 1] ?? 0) >>> 7);
  result[15] ^= (block[0] >>> 7) * 0x87; return result;
}
/** NIST SP 800-38B CMAC over native AES. Returns the full 16-byte MAC.
 * COS N002.820 adds ISO padding BEFORE CMAC and truncates the result to 8 bytes.
 */
export function aes256Cmac(key, message) {
  if (!(key instanceof Uint8Array) || key.length !== 32 || !(message instanceof Uint8Array) || message.length > 1024) throw new Error('KIM_CMAC_INPUT');
  let l, k1, k2, blocks, encrypted;
  try {
    l = aesBlock(key, Buffer.alloc(16)); k1 = double(l); k2 = double(k1);
    const complete = message.length > 0 && message.length % 16 === 0;
    blocks = complete ? Buffer.from(message) : isoPad(message);
    const last = blocks.length - 16, subkey = complete ? k1 : k2;
    for (let i = 0; i < 16; i++) blocks[last + i] ^= subkey[i];
    const cipher = createCipheriv('aes-256-cbc', key, Buffer.alloc(16)); cipher.setAutoPadding(false);
    encrypted = Buffer.concat([cipher.update(blocks), cipher.final()]);
    return Buffer.from(encrypted.subarray(-16));
  } finally { for (const bytes of [l, k1, k2, blocks, encrypted]) bytes?.fill(0); }
}
