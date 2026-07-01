export interface Team {
  name: string;
  /** Caminho do SVG servido de public/, ex.: '/flags/br.svg'. */
  flag: string;
}

/** As 32 seleções classificadas ao mata-mata (Round of 32) da Copa 2026. Ordenadas por name (pt-BR). */
export const TEAMS: Team[] = [
  { name: 'África do Sul', flag: '/flags/za.svg' },
  { name: 'Alemanha', flag: '/flags/de.svg' },
  { name: 'Argélia', flag: '/flags/dz.svg' },
  { name: 'Argentina', flag: '/flags/ar.svg' },
  { name: 'Austrália', flag: '/flags/au.svg' },
  { name: 'Áustria', flag: '/flags/at.svg' },
  { name: 'Bélgica', flag: '/flags/be.svg' },
  { name: 'Bósnia e Herzegovina', flag: '/flags/ba.svg' },
  { name: 'Brasil', flag: '/flags/br.svg' },
  { name: 'Cabo Verde', flag: '/flags/cv.svg' },
  { name: 'Canadá', flag: '/flags/ca.svg' },
  { name: 'Colômbia', flag: '/flags/co.svg' },
  { name: 'Costa do Marfim', flag: '/flags/ci.svg' },
  { name: 'Croácia', flag: '/flags/hr.svg' },
  { name: 'Egito', flag: '/flags/eg.svg' },
  { name: 'Equador', flag: '/flags/ec.svg' },
  { name: 'Espanha', flag: '/flags/es.svg' },
  { name: 'Estados Unidos', flag: '/flags/us.svg' },
  { name: 'França', flag: '/flags/fr.svg' },
  { name: 'Gana', flag: '/flags/gh.svg' },
  { name: 'Holanda', flag: '/flags/nl.svg' },
  { name: 'Inglaterra', flag: '/flags/gb-eng.svg' },
  { name: 'Japão', flag: '/flags/jp.svg' },
  { name: 'Marrocos', flag: '/flags/ma.svg' },
  { name: 'México', flag: '/flags/mx.svg' },
  { name: 'Noruega', flag: '/flags/no.svg' },
  { name: 'Paraguai', flag: '/flags/py.svg' },
  { name: 'Portugal', flag: '/flags/pt.svg' },
  { name: 'RD Congo', flag: '/flags/cd.svg' },
  { name: 'Senegal', flag: '/flags/sn.svg' },
  { name: 'Suécia', flag: '/flags/se.svg' },
  { name: 'Suíça', flag: '/flags/ch.svg' },
];
