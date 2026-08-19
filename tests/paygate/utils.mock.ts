import path from 'path';

export function createMockFirestore() {
  const db: Record<string, Map<string, any>> = {};

  function ensure(col: string) {
    if (!db[col]) db[col] = new Map();
    return db[col];
  }

  return {
    __db: db,
    collection(col: string) {
      const map = ensure(col);
      return {
        doc(id?: string) {
          return {
            async set(obj: any) {
              if (!id) throw new Error('doc id required');
              map.set(id, JSON.parse(JSON.stringify(obj)));
              return;
            },
            async get() {
              return { exists: map.has(id || ''), data: () => map.get(id || '') };
            },
            async update(obj: any) {
              const existing = map.get(id || '');
              if (!existing) throw new Error('not found');
              const merged = { ...existing, ...obj };
              map.set(id || '', merged);
              return;
            },
          };
        },
        async add(obj: any) {
          const id = `mock_${Math.random().toString(16).slice(2, 10)}`;
          const copy = JSON.parse(JSON.stringify(obj));
          ensure(col).set(id, copy);
          return { id };
        },
        async where() {
          // minimal stub for queries used elsewhere (not heavily used in tests)
          return { limit: () => ({ get: async () => ({ docs: [] }) }) };
        }
      };
    }
  };
}

export const authModulePath = path.resolve(process.cwd(), 'src/server/auth');
export const firebaseAdminModulePath = path.resolve(process.cwd(), 'src/server/firebase-admin');
