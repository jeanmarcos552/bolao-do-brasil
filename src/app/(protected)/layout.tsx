'use client';
import Header from '@/components/Header';
import Loading from '@/components/Loading';
import { useRequireProfile } from '@/hooks/useRequireProfile';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireProfile();
  if (!ready) return <Loading />;
  return (
    <>
      <Header />
      {children}
    </>
  );
}
