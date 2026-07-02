// Renderiza a bandeira de um time a partir de um caminho .svg (hoje os assets locais em /flags/*.svg; também aceita URLs externas de jogos antigos).
// Usa <img> simples (não next/image) para evitar configurar domínios externos.
export default function Flag({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <span className={`inline-flex items-center justify-center bg-gray-100 text-gray-400 rounded ${className}`} aria-hidden>
        ⚽
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`object-contain ${className}`} />;
}
