import type { CSSProperties } from 'react'
import { COLOR_PATRON } from '@/componentes/ui'
import type { Patron, Serie as SerieHecha } from '@/dominio/tipos'

/**
 * Los nodos de la serie: la constelación del ejercicio.
 *
 * Un círculo por serie, unidos por una línea que es sólida en el color de la
 * cadena hasta la última serie hecha y punteada después. Anotar una serie es
 * ver la línea llegar a su nodo: el avance se ve sin leer un número.
 *
 * Lo que se lee no cambió con el dibujo, y es a propósito: el `aria-label`
 * de cada nodo y el texto de adentro (el número, la vara o "·") son los de
 * los casilleros de antes, que `rescate.mjs` y `datos.mjs` comparan antes y
 * después de recargar.
 *
 * La serie de ahora lleva "·" y no la vara, aunque la haya: el anillo dice el
 * momento —punteado para predecir, sólido para hacer y anotar— y la vara de
 * esa serie está en su nombre y en "la vez pasada", abajo.
 */
export function NodosDeLaSerie({
  total,
  series,
  varas,
  patron,
  paso,
}: {
  /** Las series del objetivo. */
  total: number
  /** Las ya anotadas. */
  series: SerieHecha[]
  /** Lo que se hizo en cada serie la vez pasada, si hay vez pasada. */
  varas: readonly number[] | undefined
  patron: Patron
  /** 1 mientras se predice la serie de ahora; 2 mientras se hace y se anota. */
  paso: 1 | 2
}) {
  const hechas = Math.min(series.length, total)
  // La línea va de centro a centro, y estos son sus cortes en porcentaje del
  // largo: así sirve con cualquier tamaño de nodo, también apretado.
  const corte = (i: number) => `${(i / Math.max(1, total - 1)) * 100}%`
  return (
    <div
      className="nodos-serie"
      data-cuantos={Math.min(total, 5)}
      style={{ ['--cuantos' as string]: total, ['--tinta-cadena' as string]: COLOR_PATRON[patron] } as CSSProperties}
    >
      {total > 1 && (
        <svg className="nodos-linea" aria-hidden="true" focusable="false">
          {hechas > 1 && (
            <line x1="0" y1="1" x2={corte(hechas - 1)} y2="1" style={{ stroke: 'var(--tinta-cadena)' }} />
          )}
          <line className="por-hacer" x1={corte(Math.max(0, hechas - 1))} y1="1" x2="100%" y2="1" />
        </svg>
      )}
      <ul aria-label="Series de este ejercicio">
        {Array.from({ length: total }, (_, i) => {
          const serie = series[i]
          const actual = i === series.length
          const vara = varas?.[i]
          return (
            <li
              key={i}
              className="nodo-serie"
              data-estado={serie ? 'hecha' : actual ? 'actual' : undefined}
              data-paso={actual ? paso : undefined}
              aria-label={
                serie
                  ? `Serie ${i + 1}: ${serie.logrado}`
                  : vara !== undefined
                    ? `Serie ${i + 1}, sin hacer. La vez pasada: ${vara}`
                    : `Serie ${i + 1}, sin hacer`
              }
            >
              {serie ? serie.logrado : !actual && vara !== undefined ? <span className="vara">{vara}</span> : '·'}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Los dos momentos de la serie, en chico, adelante de la pregunta: dos nodos
 * unidos, lleno el del paso en que estás. Dice "primero predecís, después
 * anotás" sin una palabra más en la pantalla más cargada de la app.
 */
export function MarcaDelPaso({ paso }: { paso: 1 | 2 }) {
  return (
    <svg viewBox="0 0 28 12" aria-hidden="true" focusable="false">
      <line x1="6" y1="6" x2="22" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <circle
        cx="6"
        cy="6"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.5"
        style={{ fill: paso === 1 ? 'currentColor' : 'var(--color-fondo)' }}
      />
      <circle
        cx="22"
        cy="6"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.5"
        style={{ fill: paso === 2 ? 'currentColor' : 'var(--color-fondo)' }}
      />
    </svg>
  )
}
