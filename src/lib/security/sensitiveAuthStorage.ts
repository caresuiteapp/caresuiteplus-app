import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type SecureStoreModule = typeof import('expo-secure-store');

type SecureManifest = {
  version: 1;
  generation: string;
  chunks: number;
};

const CHUNK_SIZE = 1_800;
const MANIFEST_SUFFIX = '.secure-manifest';

function manifestKey(key: string): string {
  return `${key}${MANIFEST_SUFFIX}`;
}

function chunkKey(key: string, generation: string, index: number): string {
  return `${key}.${generation}.${index}`;
}

function parseManifest(raw: string | null): SecureManifest | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<SecureManifest>;
    if (
      value.version !== 1 ||
      typeof value.generation !== 'string' ||
      !/^[a-z0-9]+$/i.test(value.generation) ||
      !Number.isInteger(value.chunks) ||
      Number(value.chunks) < 1 ||
      Number(value.chunks) > 128
    ) {
      return null;
    }
    return value as SecureManifest;
  } catch {
    return null;
  }
}

async function getSecureStore(): Promise<SecureStoreModule> {
  const secureStore = await import('expo-secure-store');
  if (!(await secureStore.isAvailableAsync())) {
    throw new Error('Der geschützte Gerätespeicher ist nicht verfügbar.');
  }
  return secureStore;
}

async function deleteGeneration(
  secureStore: SecureStoreModule,
  key: string,
  manifest: SecureManifest | null,
): Promise<void> {
  if (!manifest) return;
  await Promise.all(
    Array.from({ length: manifest.chunks }, (_, index) =>
      secureStore.deleteItemAsync(chunkKey(key, manifest.generation, index)),
    ),
  );
}

async function readNative(key: string): Promise<string | null> {
  const secureStore = await getSecureStore();
  const manifestRaw = await secureStore.getItemAsync(manifestKey(key));
  const manifest = parseManifest(manifestRaw);

  if (manifestRaw && !manifest) {
    await secureStore.deleteItemAsync(manifestKey(key));
    throw new Error('Der geschützte Sitzungsspeicher ist beschädigt.');
  }

  if (manifest) {
    const chunks = await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) =>
        secureStore.getItemAsync(chunkKey(key, manifest.generation, index)),
      ),
    );
    if (chunks.some((chunk) => chunk === null)) {
      await deleteGeneration(secureStore, key, manifest);
      await secureStore.deleteItemAsync(manifestKey(key));
      throw new Error('Die geschützte Sitzung ist unvollständig und wurde verworfen.');
    }
    return chunks.join('');
  }

  // One-time migration from the pre-R14-C unencrypted native AsyncStorage.
  const legacy = await AsyncStorage.getItem(key);
  if (!legacy) return null;
  await writeNative(key, legacy);
  await AsyncStorage.removeItem(key);
  return legacy;
}

async function writeNative(key: string, value: string): Promise<void> {
  const secureStore = await getSecureStore();
  const previous = parseManifest(await secureStore.getItemAsync(manifestKey(key)));
  const generation = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];
  const options = {
    keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  await Promise.all(
    chunks.map((chunk, index) =>
      secureStore.setItemAsync(chunkKey(key, generation, index), chunk, options),
    ),
  );

  const manifest: SecureManifest = { version: 1, generation, chunks: chunks.length };
  await secureStore.setItemAsync(manifestKey(key), JSON.stringify(manifest), options);
  await deleteGeneration(secureStore, key, previous);
  await AsyncStorage.removeItem(key);
}

async function removeNative(key: string): Promise<void> {
  const secureStore = await getSecureStore();
  const manifest = parseManifest(await secureStore.getItemAsync(manifestKey(key)));
  await deleteGeneration(secureStore, key, manifest);
  await secureStore.deleteItemAsync(manifestKey(key));
  await AsyncStorage.removeItem(key);
}

/**
 * Storage adapter for bearer credentials. Web keeps the browser storage contract;
 * native builds use the OS keystore/keychain and migrate old AsyncStorage values once.
 */
export const sensitiveAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    return Platform.OS === 'web' ? AsyncStorage.getItem(key) : readNative(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await writeNative(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }
    await removeNative(key);
  },
};
