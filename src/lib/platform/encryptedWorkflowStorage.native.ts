import { openDatabaseSync, deleteDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { getItem, setItem, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';

/** SQLCipher key is device-bound and never stored alongside the workflow data. */
export function encryptedNativeWorkflowStore(legacyName: string): Storage {
  if (!/-v1\.db$/.test(legacyName)) throw new Error('Ungültiger geschützter Datenbereich.');
  let database: SQLiteDatabase | null = null;
  const name = legacyName.replace(/-v1\.db$/, '-encrypted-v2.db');
  const keyName = `caresuite.workflow.key.${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const db = () => {
    if (database) return database;
    let secret = getItem(keyName);
    if (!secret) {
      secret = Array.from(getRandomBytes(32), byte => byte.toString(16).padStart(2, '0')).join('');
      setItem(keyName, secret, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    }
    if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Der geschützte lokale Datenschlüssel ist ungültig.');
    const connection = openDatabaseSync(name);
    try {
      // Interpolation is restricted to an internally generated, validated hex key.
      connection.execSync(`PRAGMA key = "x'${secret}'";`);
      const cipher = connection.getFirstSync<Record<string, unknown>>('PRAGMA cipher_version;');
      if (!cipher || !Object.values(cipher).some(value => typeof value === 'string' && value.length > 0)) {
        throw new Error('Verschlüsselte lokale Speicherung ist in diesem App-Paket nicht verfügbar.');
      }
      connection.execSync('PRAGMA cipher_memory_security = ON; CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS migration (version INTEGER PRIMARY KEY);');
      const migrated = connection.getFirstSync('SELECT version FROM migration WHERE version = 1;');
      if (!migrated) {
        const legacy = openDatabaseSync(legacyName);
        try {
          const exists = legacy.getFirstSync("SELECT name FROM sqlite_master WHERE type='table' AND name='storage';");
          const rows = exists ? legacy.getAllSync<{ key: string; value: string }>('SELECT key,value FROM storage;') : [];
          connection.withTransactionSync(() => {
            for (const row of rows) {
              if (typeof row.key !== 'string' || typeof row.value !== 'string') throw new Error('Der bisherige lokale Datenbestand ist unvollständig.');
              connection.runSync('INSERT INTO storage(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING;', row.key, row.value);
              const stored = connection.getFirstSync<{ value: string }>('SELECT value FROM storage WHERE key=?;', row.key);
              if (stored?.value !== row.value) throw new Error('Die Übernahme des lokalen Entwurfs konnte nicht bestätigt werden.');
            }
            connection.runSync('INSERT INTO migration(version) VALUES(1);');
          });
          // Only remove the plaintext source after every value is committed and read back.
        } finally { legacy.closeSync(); }
      }
      if (!connection.getFirstSync('SELECT version FROM migration WHERE version = 2;')) {
        deleteDatabaseSync(legacyName);
        connection.runSync('INSERT INTO migration(version) VALUES(2);');
      }
      database = connection;
      return connection;
    } catch (error) { connection.closeSync(); throw error; }
  };
  return {
    get length() { return db().getFirstSync<{ count: number }>('SELECT COUNT(*) AS count FROM storage;')?.count ?? 0; },
    key(index) {
      if (!Number.isInteger(index) || index < 0) return null;
      return db().getFirstSync<{ key: string }>('SELECT key FROM storage ORDER BY key LIMIT 1 OFFSET ?;', index)?.key ?? null;
    },
    getItem(key) { return db().getFirstSync<{ value: string }>('SELECT value FROM storage WHERE key=?;', String(key))?.value ?? null; },
    setItem(key, value) { db().runSync('INSERT INTO storage(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value;', String(key), String(value)); },
    removeItem(key) { db().runSync('DELETE FROM storage WHERE key=?;', String(key)); },
    clear() { db().runSync('DELETE FROM storage;'); },
  };
}
