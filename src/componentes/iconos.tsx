/**
 * Los íconos son SVG escritos a mano y no una librería.
 *
 * Son ocho: traer un paquete entero para eso serían cientos de kilobytes que
 * el celular tiene que bajar antes de mostrar la primera pantalla. Todos usan
 * `currentColor`, así que toman el color del texto donde estén.
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
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconoHoy({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M3 12l2-2 4 4 8-8 4 4" />
      <path d="M3 20h18" />
    </svg>
  )
}

export function IconoBiblioteca({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
      <path d="M14 5a1 1 0 011-1h4a1 1 0 011 1v14a1 1 0 01-1 1h-4a1 1 0 01-1-1z" />
      <path d="M10 12h4" />
    </svg>
  )
}

export function IconoProgreso({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19H2" />
    </svg>
  )
}

export function IconoAjustes({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 8.6a1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
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

export function IconoSubir({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
}

export function IconoBajar({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
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

export function IconoLlama({ className, style }: Props) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 3s5 4 5 9a5 5 0 01-10 0c0-2 1-3 1-3s.5 2 2 2c0-3 2-5 2-8z" />
    </svg>
  )
}
