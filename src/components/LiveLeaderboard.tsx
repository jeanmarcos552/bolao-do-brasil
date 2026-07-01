import Avatar from '@/components/Avatar';
import type { LeaderRow } from '@/lib/leaderboard';

const MEDALS = ['🥇', '🥈', '🥉'];

function sizeFor(position: number): number {
  if (position === 1) return 240;
  if (position === 2) return 200;
  if (position === 3) return 180;
  return 120;
}

export default function LiveLeaderboard({ rows }: { rows: LeaderRow[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto py-3">
      {rows.map((r) => {
        const size = r.eliminated ? 120 : sizeFor(r.position);
        const medal = !r.eliminated && r.position <= 3 ? MEDALS[r.position - 1] : null;
        return (
          <div key={r.uid} data-testid={`leader-${r.uid}`} className="flex flex-col items-center gap-1 shrink-0" style={{ width: size }}>
            <div className="h-7 text-2xl leading-none">{medal}</div>
            <div className={`rounded-full ${r.eliminated ? 'border-2 border-red-500' : ''}`}>
              <Avatar photoURL={r.photoURL} name={r.userName} size={size} grayscale={r.eliminated} />
            </div>
            <div className="font-bold text-sm">{r.position}º</div>
            <div className="text-xs text-center text-gray-600 truncate w-full">{r.userName}</div>
          </div>
        );
      })}
    </div>
  );
}
