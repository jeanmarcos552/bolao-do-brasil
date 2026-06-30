import { vi } from 'vitest';

type Doc = Record<string, unknown>;
interface Store { users: Map<string, Doc>; matches: Map<string, Doc>; bets: Map<string, Map<string, Doc>>; }

export function makeStore(): Store {
  return { users: new Map(), matches: new Map(), bets: new Map() };
}

/** Fake mínimo da API encadeada do Firestore usada pelas rotas. */
function makeFirestore(store: Store) {
  const docRef = (col: 'users' | 'matches', id: string) => ({
    async get() {
      const data = store[col].get(id);
      return { exists: !!data, id, data: () => data };
    },
    async set(data: Doc, opts?: { merge?: boolean }) {
      const prev = opts?.merge ? store[col].get(id) ?? {} : {};
      store[col].set(id, { ...prev, ...data });
    },
    async update(data: Doc) {
      store[col].set(id, { ...(store[col].get(id) ?? {}), ...data });
    },
    collection(sub: 'bets') {
      if (!store.bets.has(id)) store.bets.set(id, new Map());
      const sub2 = store.bets.get(id)!;
      return {
        doc: (betId: string) => ({
          async get() { const d = sub2.get(betId); return { exists: !!d, id: betId, data: () => d }; },
          async set(data: Doc, opts?: { merge?: boolean }) {
            const prev = opts?.merge ? sub2.get(betId) ?? {} : {};
            sub2.set(betId, { ...prev, ...data });
          },
        }),
        async get() {
          return { docs: [...sub2.entries()].map(([bid, d]) => ({ id: bid, data: () => d })) };
        },
      };
    },
  });

  const collection = (col: 'users' | 'matches') => ({
    doc: (id: string) => docRef(col, id),
    async get() {
      return { docs: [...store[col].entries()].map(([id, d]) => ({ id, data: () => d })) };
    },
    async add(data: Doc) {
      const id = `gen-${store[col].size + 1}`;
      store[col].set(id, data);
      return { id };
    },
  });

  return { collection } as const;
}

export interface MockHandles {
  store: Store;
  verifyIdToken: ReturnType<typeof vi.fn>;
}

/** Chame ANTES de importar a rota (vi.mock é hoisted). Retorna handles. */
export function installAdminMock(): MockHandles {
  const store = makeStore();
  const verifyIdToken = vi.fn();
  vi.doMock('@/lib/firebaseAdmin', () => ({
    adminDb: makeFirestore(store),
    adminAuth: { verifyIdToken },
    Timestamp: {
      fromMillis: (ms: number) => ({ toMillis: () => ms, _ms: ms }),
      now: () => ({ toMillis: () => 0, _ms: 0 }),
    },
  }));
  return { store, verifyIdToken };
}

/** Header Authorization e resposta padrão do verifyIdToken. */
export function asUser(h: MockHandles, uid: string, email: string, name = uid) {
  h.verifyIdToken.mockResolvedValue({ uid, email, name, picture: '' });
  return { Authorization: `Bearer fake-${uid}` };
}
