/**
 * La carta: el mapa de las cadenas como cielo nocturno.
 *
 * Es el elemento firma del sistema y resuelve un problema concreto: la barra
 * de porcentaje que había antes no decía nada. Un 43% no se recuerda, no
 * ubica y no da ganas de nada. Un camino con nodos dice de dónde viniste,
 * dónde estás y qué falta, sin una sola palabra.
 *
 * Tres decisiones que la sostienen:
 *
 * - **Es una ventana, no la cadena entera.** Se ven siete nodos: tres atrás,
 *   vos, tres adelante. Y el índice del desvío vertical es ABSOLUTO, así que
 *   la ventana se desliza sobre una constelación fija: a medida que progresás
 *   el cielo se corre y la silueta sigue siendo la misma. La carta es más
 *   grande que la pantalla, que es exactamente lo que es una constelación.
 *   Comprimir once nodos en 340 píxeles daría un plato de fideos; esto no es
 *   un compromiso, es mejor.
 *
 * - **Cada cadena tiene su silueta.** Los desvíos son fijos por patrón, así
 *   que la forma de "empuje" es siempre la misma y se reconoce como se
 *   reconoce una constelación. Una línea recta no se memoriza.
 *
 * - **Lo que falta no está prohibido, está sin iluminar.** Nada de candados,
 *   tachados ni "bloqueado": línea punteada y nodo hueco. La ausencia de luz
 *   comunica sin castigar, que es la regla de toda la app.
 *
 * Y la estrella es lo único que brilla en toda la aplicación. Ese monopolio es
 * lo que hace que el "estás acá" sea imposible de no ver.
 */

import type { Avance, Patron } from '@/dominio/tipos'
import { POR_ID, NOMBRE_PATRON, cadenaDe } from '@/dominio/biblioteca'

/** La luz de cada patrón sobre la noche. No es el mismo color que sobre papel. */
const LUZ: Record<Patron, string> = {
  empuje: 'var(--luz-empuje)',
  traccion: 'var(--luz-traccion)',
  piernas: 'var(--luz-piernas)',
  core: 'var(--luz-core)',
}

/**
 * La silueta de cada cadena, en pasos verticales.
 *
 * Se cicla si la cadena crece, así que agregar eslabones extiende la forma en
 * vez de romperla.
 */
const SILUETA: Record<Patron, number[]> = {
  empuje: [0, -1, 1, 0, -2, -1, 1, 2, 1, -1, 0, -2, 1],
  traccion: [1, 2, 0, -1, -2, -1, 1, 0, 2, 1, -1, 0],
  piernas: [0, 2, 1, -1, -2, 0, 1, -1, 0, 2, -1],
  core: [-1, 0, 2, 1, -1, -2, 0, 1, 2, 0, -1],
}

const ANCHO = 340
const MARGEN_X = 30
const VENTANA = 7
const PASO_Y = 8

interface Punto {
  x: number
  y: number
  /** Índice dentro de la cadena completa. */
  i: number
}

function ventanaDe(total: number, actual: number): number[] {
  const inicio = Math.max(0, Math.min(actual - 3, Math.max(0, total - VENTANA)))
  const fin = Math.min(total, inicio + VENTANA)
  return Array.from({ length: fin - inicio }, (_, k) => inicio + k)
}

function trazo(puntos: { x: number; y: number }[]): string {
  return puntos.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

/** La estrella. Espigas asimétricas: se lee como difracción, no como un signo más. */
function Estrella({
  x,
  y,
  luz,
  animada,
  id,
}: {
  x: number
  y: number
  luz: string
  animada: boolean
  id: string
}) {
  return (
    <g className={`estrella${animada ? ' anim-estrella' : ''}`} style={{ transformOrigin: `${x}px ${y}px` }}>
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" stopColor={luz} stopOpacity="0.38" />
          <stop offset="55%" stopColor={luz} stopOpacity="0.12" />
          <stop offset="100%" stopColor={luz} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="estrella-halo" cx={x} cy={y} r="17" fill={`url(#${id})`} />
      <line className="estrella-espiga" x1={x - 19} y1={y} x2={x + 19} y2={y} />
      <line className="estrella-espiga" x1={x} y1={y - 11} x2={x} y2={y + 11} />
      <circle className="estrella-corona" cx={x} cy={y} r="8.5" />
      <circle className="estrella-nucleo" cx={x} cy={y} r="4.25" />
    </g>
  )
}

export interface FilaDeCarta {
  patron: Patron
  avance: Avance
  /** Dónde estaba antes, para dibujar la huella en la pantalla de cierre. */
  huella?: string
}

/**
 * Una banda de cielo con una cadena por fila.
 *
 * `animar` solo se usa en la pantalla de cierre y solo cuando hubo salto de
 * nodo. En Hoy nunca: esa pantalla se abre veinte veces por semana, y una
 * animación repetida deja de ser énfasis y pasa a ser ruido.
 */
export function Carta({
  filas,
  rotulos = false,
  animar = false,
}: {
  filas: FilaDeCarta[]
  rotulos?: boolean
  animar?: boolean
}) {
  const altoFila = rotulos ? 92 : 74
  const alto = filas.length * altoFila

  return (
    <div className="carta">
      <svg
        viewBox={`0 0 ${ANCHO} ${alto}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Dónde estás en cada cadena de progresión"
      >
        {filas.map((fila, f) => {
          const cadena = cadenaDe(fila.patron)
          const total = cadena.ejercicios.length
          const actual = Math.max(0, cadena.ejercicios.indexOf(fila.avance.ejercicioId))
          const indices = ventanaDe(total, actual)
          const silueta = SILUETA[fila.patron]
          const luz = LUZ[fila.patron]
          const base = f * altoFila + (rotulos ? 52 : 40)
          const paso = (ANCHO - MARGEN_X * 2) / (VENTANA - 1)

          const puntos: Punto[] = indices.map((i, k) => ({
            i,
            x: MARGEN_X + k * paso,
            y: base + (silueta[i % silueta.length] ?? 0) * PASO_Y,
          }))

          const hechos = puntos.filter((p) => p.i <= actual)
          const futuros = puntos.filter((p) => p.i >= actual)
          const aca = puntos.find((p) => p.i === actual) ?? puntos[0]!
          const huella = fila.huella ? cadena.ejercicios.indexOf(fila.huella) : -1

          // En los bordes la polilínea SALE del cuadro en vez de terminar: la
          // cadena continúa más allá de lo que se ve, que es la idea.
          const primero = puntos[0]!
          const ultimo = puntos[puntos.length - 1]!
          const entra = primero.i > 0 ? [{ x: -6, y: primero.y }, ...hechos] : hechos
          const sale =
            ultimo.i < total - 1 ? [...futuros, { x: ANCHO + 6, y: ultimo.y }] : futuros

          return (
            <g key={fila.patron} style={{ ['--luz' as string]: luz }}>
              {rotulos && (
                <text className="rotulo" x={MARGEN_X} y={f * altoFila + 22} fill="var(--carta-rotulo)">
                  {NOMBRE_PATRON[fila.patron].toUpperCase()} · NODO {actual + 1} DE {total}
                </text>
              )}

              {sale.length > 1 && <path className="trazo-futuro" d={trazo(sale)} />}
              {entra.length > 1 && (
                <path
                  className={`trazo-recorrido${animar ? ' anim-trazo' : ''}`}
                  d={trazo(entra)}
                  pathLength={1}
                />
              )}

              {puntos.map((p) => {
                if (p.i === actual) return null
                if (p.i === total - 1) {
                  return (
                    <rect
                      key={p.i}
                      className="nodo-terminal"
                      x={p.x - 3.5}
                      y={p.y - 3.5}
                      width="7"
                      height="7"
                      transform={`rotate(45 ${p.x} ${p.y})`}
                    />
                  )
                }
                return p.i < actual ? (
                  <circle key={p.i} className="nodo-hecho" cx={p.x} cy={p.y} r="3.5" />
                ) : (
                  <circle key={p.i} className="nodo-futuro" cx={p.x} cy={p.y} r="3.5" />
                )
              })}

              {(() => {
                const marca = puntos.find((p) => p.i === huella && p.i !== actual)
                return marca ? (
                  <circle className="nodo-huella" cx={marca.x} cy={marca.y} r="5.5" />
                ) : null
              })()}

              <Estrella
                x={aca.x}
                y={aca.y}
                luz={luz}
                animada={animar}
                id={`halo-${fila.patron}-${animar ? 'cierre' : 'hoy'}`}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** El nombre del eslabón donde está cada cadena, para acompañar la carta. */
export function nombreDeAvance(avance: Avance): string {
  return POR_ID.get(avance.ejercicioId)?.nombre ?? '—'
}
