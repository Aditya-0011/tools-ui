const DB_NAME = "tools";
const DB_VERSION = 2;

export type StoreName = "folio-notes" | "folio-drafts";

const STORES: StoreName[] = ["folio-notes", "folio-drafts"];

let opening: Promise<IDBDatabase | null> | null = null;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function open(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of [...db.objectStoreNames]) {
          if (!STORES.includes(name as StoreName)) db.deleteObjectStore(name);
        }
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  try {
    const db = await open();
    if (!db) return undefined;
    return await promisify(
      action(db.transaction(store, mode).objectStore(store)),
    );
  } catch {
    return undefined;
  }
}

export function idbGet<T>(
  store: StoreName,
  key: string,
): Promise<T | undefined> {
  return run<T>(store, "readonly", (s) => s.get(key) as IDBRequest<T>);
}

export async function idbSet(
  store: StoreName,
  key: string,
  value: unknown,
): Promise<void> {
  await run(store, "readwrite", (s) => s.put(value, key));
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  await run(store, "readwrite", (s) => s.delete(key));
}

export async function idbKeys(store: StoreName): Promise<string[]> {
  const keys = await run(store, "readonly", (s) => s.getAllKeys());
  return (keys ?? []).map(String);
}

export async function idbClearAll(): Promise<void> {
  await Promise.all(
    STORES.map((store) => run(store, "readwrite", (s) => s.clear())),
  );
}
