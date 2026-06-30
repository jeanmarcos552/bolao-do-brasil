'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import type { UserProfile } from '@/lib/types';

export function useRequireProfile(): { ready: boolean; profile: UserProfile | null } {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (profile && !profile.pixKey && path !== '/conta') { router.replace('/conta'); }
  }, [loading, user, profile, path, router]);

  const ready = !loading && !!user && !!profile && (!!profile.pixKey || path === '/conta');
  return { ready, profile };
}
