import { initials } from '@/lib/initials';

export default function Avatar({
  photoURL,
  name,
  size,
  grayscale = false,
}: {
  photoURL: string;
  name: string;
  size: number;
  grayscale?: boolean;
}) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    filter: grayscale ? 'grayscale(1)' : undefined,
  };
  if (photoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoURL} alt={name} style={style} className="rounded-full object-cover bg-gray-100" />;
  }
  return (
    <div style={style} className="rounded-full bg-verde text-white flex items-center justify-center font-bold">
      <span style={{ fontSize: Math.max(12, size * 0.4) }}>{initials(name)}</span>
    </div>
  );
}
