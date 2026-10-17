/**
 * Los íconos: SVG escritos a mano, no una librería.
 *
 * Traer un paquete serían cientos de kilobytes que el teléfono baja antes de
 * la primera pantalla, y el service worker los precachea enteros. Estos son
 * doce trazos que pesan lo que pesa el texto que los escribe.
 *
 * ## Por qué no son genéricos
 *
 * La versión anterior tenía un engranaje, unas barras y una lupa: los íconos
 * de cualquier app. Existían desde hacía meses y no los importaba NADIE, que
 * es lo que suele pasar con un set genérico — no agregan nada que el rótulo
 * no diga ya, así que nadie se molesta en ponerlos.
 *
 * Estos son de ESTA app. El día es un amanecer, las cadenas son eslabones de
 * verdad, el diario es un plato y una luna, la curva es una progresión que
 * sube por escalones. A 24 px se reconocen por silueta sin leer el rótulo, que
 * es lo único que justifica que un ícono exista.
 *
 * Todos usan `currentColor`: toman el color de donde estén, incluida la luz
 * del dominio.
 */

import type { CSSProperties } from 'react'

interface Props {
  className?: string
  style?: CSSProperties
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** EL DÍA. Un sol bajo sobre el horizonte: el día que empieza, no un gráfico. */
export function IconoHoy({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M3 17h18" />
      <path d="M7.5 17a4.5 4.5 0 019 0" />
      <path d="M12 5v2.5M5.6 7.6l1.8 1.8M18.4 7.6l-1.8 1.8M3 21h18" />
    </svg>
  )
}

/** LAS CADENAS. Tres eslabones encadenados: es literalmente el modelo. */
export function IconoCadenas({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <rect x="2.5" y="9" width="8" height="6" rx="3" />
      <rect x="13.5" y="9" width="8" height="6" rx="3" />
      <path d="M10.5 12h3" />
    </svg>
  )
}

/** EL DIARIO. Un plato y una luna: comida y sueño, que son el mismo registro. */
export function IconoDiario({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="9" cy="13" r="5.5" />
      <path d="M9 9.5a3.5 3.5 0 000 7" />
      <path d="M20.5 7.2a3.6 3.6 0 11-3.9-3.6 2.8 2.8 0 003.9 3.6z" />
    </svg>
  )
}

/** LA CURVA. Una progresión que sube por escalones, que es cómo sube de verdad. */
export function IconoProgreso({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M3 19h18" />
      <path d="M4 16h4v-4h4V8h4V5h4" />
      <circle cx="20" cy="5" r="1.6" />
    </svg>
  )
}

/** AJUSTES. Un cursor sobre una regleta: lo que se hace ahí es correr valores. */
export function IconoAjustes({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M3 7h18M3 12h18M3 17h18" />
      <circle cx="8" cy="7" r="2.2" />
      <circle cx="16" cy="12" r="2.2" />
      <circle cx="11" cy="17" r="2.2" />
    </svg>
  )
}

/** EL FUELLE. Dos pulmones: lo que se entrena cuando se entrena el aliento. */
export function IconoFuelle({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 3v8" />
      <path d="M12 8c-1.6-2-4-2.6-5.4-1.3C5.4 7.8 5 9.6 5 12c0 3.4.8 6 2.6 6C9.6 18 11 15.6 11 12" />
      <path d="M12 8c1.6-2 4-2.6 5.4-1.3C18.6 7.8 19 9.6 19 12c0 3.4-.8 6-2.6 6C14.4 18 13 15.6 13 12" />
    </svg>
  )
}

/** LA COMIDA. Un plato visto de frente, con el tenedor al costado. */
export function IconoComida({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="10" cy="12" r="7" />
      <circle cx="10" cy="12" r="3.4" />
      <path d="M20 4v7M20 11v9" />
    </svg>
  )
}

/** EL SUEÑO. Una luna en cuarto, sin estrellitas: las estrellas son de la carta. */
export function IconoSueno({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
  )
}

/** LA FUERZA. Un brazo en flexión: la silueta más reconocible que hay. */
export function IconoFuerza({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4 18v-3.5A4.5 4.5 0 018.5 10H11" />
      <path d="M11 10V7a3 3 0 116 0v5.5a6.5 6.5 0 01-6.5 6.5H4" />
      <path d="M14.5 13.5c-1.6 0-2.5-1-2.5-2" />
    </svg>
  )
}

export function IconoAtras({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function IconoTilde({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function IconoReloj({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
