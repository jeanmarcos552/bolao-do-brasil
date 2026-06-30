import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthProvider';

export const metadata: Metadata = {
  title: 'Bolão da Seleção',
  description: 'Bolão dos próximos jogos da Seleção Brasileira',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
