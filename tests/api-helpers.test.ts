import { describe, it, expect } from 'vitest';
import { toMatchDTO } from '@/lib/api-helpers';

describe('toMatchDTO', () => {
  it('preenche defaults dos campos ao vivo quando ausentes', () => {
    const dto = toMatchDTO('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: 1, cota: 10, status: 'scheduled', homeScore: null, awayScore: null });
    expect(dto.extraTime).toBe(false);
    expect(dto.penalties).toBe(false);
    expect(dto.homePen).toBe(0);
    expect(dto.awayPen).toBe(0);
    expect(dto.status).toBe('scheduled');
  });

  it('propaga os campos ao vivo quando presentes', () => {
    const dto = toMatchDTO('m1', { status: 'live', homeScore: 1, awayScore: 1, extraTime: true, penalties: true, homePen: 4, awayPen: 2 });
    expect(dto.status).toBe('live');
    expect(dto.extraTime).toBe(true);
    expect(dto.penalties).toBe(true);
    expect(dto.homePen).toBe(4);
    expect(dto.awayPen).toBe(2);
  });
});
