/**
 * La barra de cada cadena: un segmento por eslabón.
 *
 * Reemplaza a la carta de estrellas, que Matias encontró fea: las líneas que
 * subían y bajaban no se leían. Esto se entiende de un vistazo porque cada
 * segmento es un eslabón y todos miden lo mismo:
 *
 * - **Hecho:** lleno, en la luz de la cadena.
 * - **Actual:** contorno en la luz y relleno desde la izquierda hasta donde
 *   está tu objetivo dentro de la ventana del eslabón (`rellenoDeVentana`).
 * - **Lo que falta:** contorno en regla-fuerte, hueco. No está prohibido,
 *   está sin iluminar: cero candados, cero tachados.
 *
 * La estrella se queda, ahora como la marca del "estás acá" en el borde del
 * relleno. Sigue siendo lo único con halo en toda la app.
 */

import { useId, type CSSProperties } from 'react'
import type { Avance, Patron } from '@/dominio/tipos'
import { enCadena, textoDeLaBarra, type EnCadena } from './enCadena'

/** La luz de cada cadena: la misma de la carta, la del glifo y la de la barra. */
export const LUZ: Record<Patron, string> = {
  empuje: 'var(--luz-empuje)',
  traccion: 'var(--luz-traccion)',
  piernas: 'var(--luz-piernas)',
  core: 'var(--luz-core)',
  bisagra: 'var(--luz-bisagra)',
}

/**
 * La estrella. Espigas asimétricas: se lee como difracción, no como un signo
 * más. Toma el color de la cadena del `color` de la barra.
 */
function Estrella({ animada }: { animada: boolean }) {
  const halo = useId()
  return (
    <svg viewBox="-22 -22 44 44" aria-hidden>
      <defs>
        <radialGradient id={halo}>
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.38" />
          <stop offset="55%" stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className={`estrella${animada ? ' anim-estrella' : ''}`}>
        <circle className="estrella-halo" r="17" fill={`url(#${halo})`} />
        <line className="estrella-espiga" x1="-19" x2="19" />
        <line className="estrella-espiga" y1="-11" y2="11" />
        <circle className="estrella-corona" r="8.5" />
        <circle className="estrella-nucleo" r="4.25" />
      </g>
    </svg>
  )
}

export type TamanoDeBarra = 's' | 'm' | 'l'

/**
 * `tamano`: `s` en Hoy y en las filas chicas del Cierre, `m` en Progreso, `l`
 * en la cadena que saltó en el Cierre.
 *
 * `animar` es la coreografía del Cierre cuando hubo salto: el relleno entra al
 * eslabón nuevo —o al que acabás de dominar, si el nuevo arranca en su piso— y
 * la estrella se posa. `huella` es dónde estabas antes.
 *
 * `orden` escalona el encendido de Progreso, que lo prende la pantalla con
 * `.enciende` una sola vez por carga.
 */
export function BarraDeCadena({
  avance,
  posicion,
  tamano = 'm',
  animar = false,
  huella,
  orden = 0,
}: {
  avance?: Avance
  posicion?: EnCadena
  tamano?: TamanoDeBarra
  animar?: boolean
  huella?: EnCadena
  orden?: number
}) {
  const e = posicion ?? (avance ? enCadena(avance) : null)
  if (!e) return null

  const estilo = {
    '--luz': LUZ[e.patron],
    '--n': e.total,
    '--orden': orden,
  } as CSSProperties

  // En una subida, si el eslabón nuevo arranca en el piso de su ventana no hay
  // relleno que entrar, así que entra el del eslabón que acabás de dominar: el
  // movimiento se ve sin mentir sobre dónde estás.
  const llenaElAnterior = animar && !!huella && huella.indice < e.indice && e.relleno === 0
  // La huella solo si no cae debajo de la estrella. A menos de cuatro décimos
  // de eslabón quedan encimadas y no se lee ningún movimiento.
  const huellaVisible =
    huella && Math.abs(e.indice + e.relleno - (huella.indice + huella.relleno)) >= 0.4 ? huella : null

  return (
    <div className={`bc bc--${tamano}`} style={estilo} role="img" aria-label={textoDeLaBarra(e)}>
      {Array.from({ length: e.total }, (_, k) => {
        if (k < e.indice) {
          if (llenaElAnterior && k === e.indice - 1) {
            return (
              <span key={k} className="bc-seg bc-seg--hecho bc-seg--recien">
                <span className="bc-relleno anim-llenar" style={{ width: '100%' }} />
              </span>
            )
          }
          return <span key={k} className="bc-seg bc-seg--hecho" style={{ '--k': k } as CSSProperties} />
        }
        if (k === e.indice) {
          return (
            <span key={k} className="bc-seg bc-seg--actual">
              <span
                className={`bc-relleno${animar ? ' anim-llenar' : ''}`}
                style={{ width: `${(e.relleno * 100).toFixed(2)}%`, '--k': k } as CSSProperties}
              />
            </span>
          )
        }
        return <span key={k} className="bc-seg" />
      })}
      {huellaVisible && (
        <span
          className="bc-huella"
          style={{ '--i': huellaVisible.indice, '--f': huellaVisible.relleno.toFixed(4) } as CSSProperties}
        />
      )}
      <span className="bc-marca" style={{ '--i': e.indice, '--f': e.relleno.toFixed(4) } as CSSProperties}>
        <Estrella animada={animar} />
      </span>
    </div>
  )
}
