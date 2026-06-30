// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock do firebaseClient e do firebase/auth ANTES de importar o provider
const onAuthCbs: Array<(u: unknown) => void> = [];
vi.mock('@/lib/firebaseClient', () => ({
  auth: {},
  googleProvider: {},
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => { onAuthCbs.push(cb); return () => {}; },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

beforeEach(() => { onAuthCbs.length = 0; vi.restoreAllMocks(); });

import { AuthProvider, useAuth } from '@/context/AuthProvider';

function Probe() {
  const { user, profile, loading } = useAuth();
  return <div>{loading ? 'loading' : user ? `user:${profile?.name ?? '?'}` : 'anon'}</div>;
}

describe('AuthProvider', () => {
  it('começa carregando e vira anônimo quando não há usuário', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    onAuthCbs[0](null); // dispara onAuthStateChanged com null
    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument());
  });

  it('com usuário, busca o perfil via /api/me', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: 'Jean', pixKey: 'x', isAdmin: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthProvider><Probe /></AuthProvider>);
    onAuthCbs[0]({ uid: 'u1', getIdToken: async () => 'tok' });
    await waitFor(() => expect(screen.getByText('user:Jean')).toBeInTheDocument());
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/me');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });
});
