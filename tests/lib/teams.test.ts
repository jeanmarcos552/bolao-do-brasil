import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TEAMS } from '@/lib/teams';

describe('TEAMS (catálogo de seleções)', () => {
  it('tem as 32 seleções do mata-mata', () => {
    expect(TEAMS).toHaveLength(32);
  });

  it('nomes são únicos', () => {
    const names = TEAMS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('está ordenado alfabeticamente por name (pt-BR)', () => {
    const sorted = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    expect(TEAMS.map((t) => t.name)).toEqual(sorted.map((t) => t.name));
  });

  it('todo flag segue o padrão /flags/<code>.svg', () => {
    for (const t of TEAMS) {
      expect(t.flag).toMatch(/^\/flags\/[a-z-]+\.svg$/);
    }
  });

  it('todo arquivo de bandeira existe em public/flags/', () => {
    for (const t of TEAMS) {
      const file = join(process.cwd(), 'public', t.flag.replace(/^\//, ''));
      expect(existsSync(file), `Faltando arquivo para ${t.name}: ${t.flag}`).toBe(true);
    }
  });
});
