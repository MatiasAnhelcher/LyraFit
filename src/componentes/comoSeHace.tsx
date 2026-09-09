/**
 * Cómo se hace: el dibujo y la técnica, encima de lo que estés haciendo.
 *
 * Existe por una queja concreta y justa: la app te manda a hacer "flexiones
 * pseudo plancha" y la única explicación vive en la ficha del ejercicio, o sea
 * afuera de la sesión. Nadie sale de la sesión con el pulso a ciento cuarenta
 * para leer una ficha, y si saliera, hasta hace poco perdía la sesión.
 *
 * Por eso esto se abre ENCIMA y no navega a ningún lado: es la misma pantalla
 * con algo adelante. Se cierra y seguís exactamente donde estabas, porque nunca
 * te fuiste.
 *
 * El orden de adentro no es casual. Primero el dibujo, que contesta "qué forma
 * tiene esto" en un segundo; después el gesto en una línea; después los pasos,
 * que son el detalle que el dibujo no puede dar —agarre, separación de manos,
 * rotación—; y al final los errores, que solo sirven cuando ya entendiste el
 * movimiento. Al revés no se lee: una lista de errores de algo que todavía no
 * sabés hacer es ruido.
 */

import { useEffect } from 'react'
import type { Ejercicio } from '@/dominio/tipos'
import { POSTURAS } from '@/dominio/posturas'
import { FiguraEjercicio } from './figura'
import { AccionQuieta, Rotulo } from './ui'

export function ComoSeHace({ ejercicio, alCerrar }: { ejercicio: Ejercicio; alCerrar: () => void }) {
  const figura = POSTURAS[ejercicio.id]

  // Escape cierra, y mientras está abierto el fondo no se mueve: si no, al
  // cerrar aparecés en otro punto de la sesión y no sabés dónde estabas.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    document.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
    }
  }, [alCerrar])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ backgroundColor: 'var(--color-fondo)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Cómo se hace: ${ejercicio.nombre}`}
    >
      <div className="mx-auto w-full max-w-lg px-4 pt-8 pb-24">
        <Rotulo>CÓMO SE HACE</Rotulo>
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight">{ejercicio.nombre}</h1>

        {figura && (
          <>
            <FiguraEjercicio figura={figura} className="mt-4" />
            <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-[var(--color-glosa)]">
              {figura.gesto}
            </p>
          </>
        )}

        <ol className="registro mt-6">
          {ejercicio.tecnica.map((paso, i) => (
            <li key={i}>
              <span className="canal">{i + 1}</span>
              <span className="text-sm leading-relaxed">{paso}</span>
              <span />
            </li>
          ))}
        </ol>

        <Rotulo className="mt-8">LO QUE SALE MAL</Rotulo>
        <ul className="registro mt-3">
          {ejercicio.erroresComunes.map((error, i) => (
            <li key={i}>
              <span className="canal">✕</span>
              <span className="text-sm leading-relaxed text-[var(--color-glosa)]">{error}</span>
              <span />
            </li>
          ))}
        </ul>
      </div>

      {/* Fondo sólido y una regla arriba: la barra es fija, así que sin esto el
          texto se ve pasar por detrás y parece un error de dibujo. */}
      <div
        className="fixed inset-x-0 bottom-0"
        style={{
          backgroundColor: 'var(--color-fondo)',
          borderTop: '1px solid var(--color-regla)',
        }}
      >
        <AccionQuieta onClick={alCerrar}>Volver a la serie</AccionQuieta>
      </div>
    </div>
  )
}
