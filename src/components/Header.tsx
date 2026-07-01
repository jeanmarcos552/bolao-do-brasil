'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import Avatar from '@/components/Avatar';

export default function Header() {
  const { profile, signOut } = useAuth();
  const path = usePathname();
  const links: Array<{ href: string; label: string }> = [
    { href: '/', label: 'Jogos' },
    { href: '/ranking', label: 'Ranking' },
    { href: '/conta', label: 'Minha conta' },
  ];
  if (profile?.isAdmin) links.push({ href: '/admin', label: 'Admin' });

  return (
    <header>
      <div className="bg-verde-escuro text-white px-4 py-3 flex items-center justify-between">
        <div className="font-extrabold text-lg tracking-wide flex items-center gap-2">
          <span className="bg-amarelo text-verde-escuro rounded-full w-7 h-7 inline-flex items-center justify-center">⚽</span>
          BOLÃO DA SELEÇÃO
        </div>
        <div className="flex items-center gap-3">
          <Avatar photoURL={profile?.photoURL ?? ''} name={profile?.name ?? ''} size={32} />
          <button onClick={() => signOut()} className="text-xs underline opacity-90">Sair</button>
        </div>
      </div>
      <nav className="bg-verde flex gap-1 px-2">
        {links.map((l) => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href}
              className={`text-white text-sm font-semibold px-4 py-2.5 ${active ? 'shadow-[inset_0_-3px_0_#ffdf00] opacity-100' : 'opacity-85'}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
