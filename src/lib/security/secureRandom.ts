export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 256) {
    throw new Error('Ungültiger Wertebereich für sichere Zufallszahl.');
  }
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Sichere Zufallszahlen sind auf diesem Gerät nicht verfügbar.');
  }

  const rejectionLimit = 256 - (256 % maxExclusive);
  const byte = new Uint8Array(1);
  do {
    crypto.getRandomValues(byte);
  } while (byte[0] >= rejectionLimit);
  return byte[0] % maxExclusive;
}
