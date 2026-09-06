import type { ReactNode } from 'react'
import type { Patron } from '@/dominio/tipos'

/** Cada patrón tiene su color y se mantiene igual en toda la app. */
export const COLOR_PATRON: Record<Patron, string> = {
  empuje: 'var(--color-empuje)',
  traccion: 'var(--color-traccion)',
  piernas: 'var(--color-piernas)',
  core: 'var(--color-core)',
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {accion}
    </header>
  )
}

export function Etiqueta({ patron, children }: { patron: Patron; children: ReactNode }) {
  return (
    <span
      className="inline-flex w-fit shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color: COLOR_PATRON[patron],
        backgroundColor: `color-mix(in srgb, ${COLOR_PATRON[patron]} 14%, transparent)`,
      }}
    >
      {children}
    </span>
  )
}

export function Barra({ porcentaje, color }: { porcentaje: number; color: string }) {
  const valor = Math.max(0, Math.min(100, porcentaje))
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-superficie-alta)]"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${valor}%`, backgroundColor: color }}
      />
    </div>
  )
}

export function Boton({
  children,
  onClick,
  variante = 'principal',
  tipo = 'button',
  deshabilitado = false,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variante?: 'principal' | 'secundario' | 'peligro' | 'fantasma'
  tipo?: 'button' | 'submit'
  deshabilitado?: boolean
  className?: string
}) {
  const estilos: Record<string, string> = {
    principal:
      'bg-[var(--color-acento)] text-white hover:opacity-90 disabled:opacity-40',
    secundario:
      'bg-[var(--color-superficie-alta)] text-[var(--color-texto)] hover:opacity-80 disabled:opacity-40',
    peligro:
      'bg-transparent text-[var(--color-error)] border border-[var(--color-error)] hover:bg-[var(--color-error)]/10',
    fantasma:
      'bg-transparent text-[var(--color-texto-suave)] hover:text-[var(--color-texto)]',
  }

  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={deshabilitado}
      className={`rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${estilos[variante]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="tarjeta px-5 py-10 text-center">
      <p className="font-semibold">{titulo}</p>
      <p className="mt-2 text-sm text-[var(--color-texto-suave)]">{texto}</p>
    </div>
  )
}

export function Dato({ valor, etiqueta }: { valor: ReactNode; etiqueta: string }) {
  return (
    <div className="tarjeta px-3 py-4 text-center">
      <p className="cifra text-2xl font-bold">{valor}</p>
      <p className="mt-1 text-[0.7rem] uppercase tracking-wide text-[var(--color-texto-suave)]">
        {etiqueta}
      </p>
    </div>
  )
}

/** Singular o plural, sin el "1 ejercicios" que delata a una app apurada. */
export function plural(cantidad: number, singular: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`
}

/** "repeticiones" o "segundos", pero en la forma corta que se lee mejor. */
export function unidad(medida: 'repeticiones' | 'segundos', cantidad: number): string {
  if (medida === 'segundos') return `${cantidad}s`
  return `${cantidad}`
}

export function nombreUnidad(medida: 'repeticiones' | 'segundos', plural = true): string {
  if (medida === 'segundos') return plural ? 'segundos' : 'segundo'
  return plural ? 'repeticiones' : 'repetición'
}
