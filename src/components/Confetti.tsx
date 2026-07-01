const COLORS = ['#009c3b', '#ffdf00', '#ffffff'];

export default function Confetti({ count = 40 }: { count?: number }) {
  return (
    <div aria-hidden data-testid="confetti" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 97) % 100;
        const delay = (i % 10) * 0.15;
        const duration = 2.5 + (i % 5) * 0.4;
        const color = COLORS[i % COLORS.length];
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-10px',
              left: `${left}%`,
              width: 8,
              height: 8,
              background: color,
              borderRadius: 2,
              animation: `confetti-fall ${duration}s linear ${delay}s infinite`,
            }}
          />
        );
      })}
      <style>{`@keyframes confetti-fall { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0.7; } }`}</style>
    </div>
  );
}
