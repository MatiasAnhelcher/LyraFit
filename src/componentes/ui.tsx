/**
 * Las piezas compartidas del sistema Efeméride.
 *
 * Casi todo lo visual vive en `estilos.css` como clases; acá están las que
 * tienen algo de lógica o que se repiten tantas veces que conviene que existan
 * una sola vez.
 *
 * La regla de oro del sistema: nada brilla salvo la estrella de la carta, y
 * nada usa cursiva salvo el motor. Si aparece un componente nuevo que rompe
 * alguna de las dos, el sistema deja de funcionar entero.
 */

import type { ReactNode } from 'react'
import type { Medida, Patron } from '@/dominio/tipos'

/** El patrón como tinta sobre papel. Para la noche está la rampa de luz. */
export const COLOR_PATRON: Record<Patron, string> = {
  empuje: 'var(--color-empuje)',
  traccion: 'var(--color-traccion)',
  piernas: 'var(--color-piernas)',
  core: 'var(--color-core)',
}

/** El rótulo de lámina: el título es una placa, no un titular. */
export function Rotulo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`rotulo ${className}`}>{children}</p>
}

/** El contenedor de filas regladas. Las reglas van a sangre; el texto no. */
export function Registro({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`registro ${className}`}>{children}</div>
}

/** El cuadradito de 8px que marca el patrón en el canal de la izquierda. */
export function Glifo({ patron }: { patron: Patron }) {
  return (
    <span
      className="glifo"
      style={{ ['--tinta-patron' as string]: COLOR_PATRON[patron] }}
      aria-hidden
    />
  )
}

/**
 * La barra de acción principal, pegada al canto de la pantalla.
 *
 * Por la ley de Fitts, un objetivo contra el borde tiene ancho infinito hacia
 * afuera: no se le puede errar con la mano transpirada, que es la condición
 * real de uso de esta app.
 */
export function Accion({
  children,
  onClick,
  tipo = 'button',
  deshabilitado = false,
  esfuerzo = false,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  tipo?: 'button' | 'submit'
  deshabilitado?: boolean
  /** True en la pantalla de entrenar, donde el objetivo táctil sube a 88px. */
  esfuerzo?: boolean
  className?: string
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={deshabilitado}
      className={`accion${esfuerzo ? ' accion-esfuerzo' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

/** La acción que no empuja: terminar es terminar. */
export function AccionQuieta({
  children,
  onClick,
  deshabilitado = false,
}: {
  children: ReactNode
  onClick?: () => void
  deshabilitado?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={deshabilitado} className="accion-quieta">
      {children}
    </button>
  )
}

/**
 * La voz del motor.
 *
 * Es lo único de la app en cursiva y es deliberadamente más grande que el
 * cuerpo: la explicación del algoritmo no es letra chica, es el activo
 * diferencial del producto. Un mal día se dice en ámbar; nunca en rojo.
 */
export function Glosa({
  children,
  cita,
  tono,
}: {
  children: ReactNode
  /** La regla que se aplicó. El motor firma lo que decide. */
  cita?: string
  tono?: 'ambar'
}) {
  return (
    <div>
      <p className="glosa glosa-motor" {...(tono ? { 'data-tono': tono } : {})}>
        {children}
      </p>
      {cita && <span className="cita">{cita}</span>}
    </div>
  )
}

/**
 * El acumulador monotónico, como marca de cuaderno.
 *
 * Un trazo por sesión, largo cada cinco, el último en Vega. Nunca baja: si
 * faltaste tres semanas sigue diciendo lo mismo, sin huecos ni marcas de
 * ausencia. Es exactamente lo que una racha no puede ser.
 */
export function Tira({ cantidad, tope = 120 }: { cantidad: number; tope?: number }) {
  const visibles = Math.min(cantidad, tope)
  return (
    <div className="tira" aria-hidden>
      {Array.from({ length: visibles }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  )
}

/** El estado vacío: las reglas ya dibujadas, quietas. Sin esqueleto latiendo. */
export function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div className="registro" aria-busy="true" aria-live="polite">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="fila-vacia" />
      ))}
    </div>
  )
}

export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="py-10">
      <p className="nombre">{titulo}</p>
      <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-[var(--color-glosa)]">{texto}</p>
    </div>
  )
}

// ─── Texto ───────────────────────────────────────────────────────────────

export function plural(cantidad: number, singular: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`
}

/** El número con su unidad, cuando la unidad hace falta para entenderlo. */
export function unidad(medida: Medida, cantidad: number): string {
  return medida === 'segundos' ? `${cantidad}s` : `${cantidad}`
}

export function nombreUnidad(medida: Medida, muchas = true): string {
  if (medida === 'segundos') return muchas ? 'segundos' : 'segundo'
  return muchas ? 'repeticiones' : 'repetición'
}

/** El objetivo escrito como en la tabla: 3×12, con el × discreto. */
export function Objetivo({ series, cantidad, medida }: { series: number; cantidad: number; medida: Medida }) {
  return (
    <span className="cifra-fila">
      {series}
      <span className="por">×</span>
      {cantidad}
      {medida === 'segundos' && <span className="unidad">s</span>}
    </span>
  )
}

// ─── Compatibilidad ──────────────────────────────────────────────────────
// El sistema viejo tenía `Boton`, `Titulo`, `Etiqueta`, `Barra` y `Dato`. Se
// mantienen mientras queden pantallas sin migrar, y se borran cuando no queden.

export const Boton = ({
  children,
  onClick,
  deshabilitado,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variante?: string
  deshabilitado?: boolean
  className?: string
}) => (
  <Accion onClick={onClick} deshabilitado={deshabilitado} className={className}>
    {children}
  </Accion>
)
