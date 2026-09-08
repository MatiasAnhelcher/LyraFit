/**
 * El dibujo de un ejercicio.
 *
 * Toma las dos posturas de `figuras.ts` y las convierte en una persona de
 * perfil que se mueve entre una y otra. La escala, la ubicación y los apoyos se
 * calculan solos a partir de la postura: nadie acomoda un banco a mano, así que
 * nadie puede dejar a la persona flotando diez píxeles arriba del banco.
 *
 * ## Sobre la sexta animación
 *
 * El sistema visual de esta app dice que hay cinco animaciones y que cualquier
 * sexta es un bug. Ésta es la sexta y entra a propósito, con el mismo argumento
 * con el que entró el arco del descanso: **el movimiento es la información, no
 * la decoración.** Lo que nadie entiende de un ejercicio no es la postura
 * quieta —eso ya lo dice el texto— sino qué se mueve y hasta dónde. Una figura
 * congelada no contesta eso; dos figuras congeladas obligan a imaginar el
 * camino entre las dos.
 *
 * La regla igual manda en lo demás: es lineal y lenta, no tiene rebote, no
 * llama la atención, y con `prefers-reduced-motion` desaparece y quedan las dos
 * posturas una al lado de la otra, que es la versión honesta de lo mismo sin
 * una sola cosa moviéndose.
 */

import { useEffect, useRef, useState } from 'react'
import {
  ALTO_CUERPO,
  ALTURA_BARRA,
  ANCHO,
  PISO,
  todos,
  entre,
  ubicar,
  type Escena,
  type Esqueleto,
  type Figura,
  type Postura,
  type Punto,
} from '@/dominio/figuras'

/** Cuánto tarda el recorrido de ida. Lento: es una demostración, no un latido. */
const DURACION = 1800
/** El descanso en cada extremo, para que se lea la postura antes de volver. */
const PAUSA = 500

/** Los apoyos salen de dónde quedó el cuerpo, no de números escritos a mano. */
function Apoyos({ escena, e }: { escena: Escena; e: Esqueleto }) {
  const regla = { stroke: 'var(--color-regla-fuerte)', strokeWidth: 1.4, strokeLinecap: 'round' as const }

  if (escena === 'barra' || escena === 'barra-baja') {
    const y = e.muñeca.y
    return (
      <g>
        <line x1={22} y1={y} x2={98} y2={y} {...regla} />
        <line x1={26} y1={y} x2={26} y2={escena === 'barra' ? 8 : PISO} {...regla} strokeWidth={1} opacity={0.5} />
        <line x1={94} y1={y} x2={94} y2={escena === 'barra' ? 8 : PISO} {...regla} strokeWidth={1} opacity={0.5} />
      </g>
    )
  }

  if (escena === 'apoyo-manos' || escena === 'apoyo-pies' || escena === 'banco-atras') {
    const sobre =
      escena === 'apoyo-manos' ? e.muñeca : escena === 'apoyo-pies' ? e.punta : e.tobillo
    // Un cajón desde donde se apoya hasta el piso, ancho fijo para que no se
    // deforme cuando la mano se mueve unos milímetros entre postura y postura.
    return (
      <rect
        x={sobre.x - 16}
        y={sobre.y}
        width={32}
        height={Math.max(2, PISO - sobre.y)}
        fill="none"
        {...regla}
      />
    )
  }

  return null
}

function Cuerpo({ e }: { e: Esqueleto }) {
  const linea = {
    stroke: 'var(--color-tinta)',
    strokeWidth: 2.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }
  const d = (...ps: Punto[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

  // El lado lejano, más fino y más claro: es lo que se lee como "esto está
  // detrás". Va primero para que el cuerpo cercano lo tape donde se cruzan.
  const lejos = { ...linea, strokeWidth: 1.8, opacity: 0.45 }

  return (
    <g>
      {e.rodillaLejos && (
        <path d={d(e.cadera, e.rodillaLejos, e.tobilloLejos!, e.puntaLejos!)} {...lejos} />
      )}
      {e.codoLejos && <path d={d(e.hombro, e.codoLejos, e.muñecaLejos!)} {...lejos} />}
      {/* La pierna va primero: en un cuerpo de perfil, el brazo tapa al muslo. */}
      <path d={d(e.cadera, e.rodilla, e.tobillo, e.punta)} {...linea} />
      <path d={d(e.cadera, e.hombro)} {...linea} />
      <path d={d(e.hombro, e.codo, e.muñeca)} {...linea} />
      <circle
        cx={e.cabeza.x}
        cy={e.cabeza.y}
        r={ALTO_CUERPO * 0.062}
        fill="var(--color-fondo)"
        stroke="var(--color-tinta)"
        strokeWidth={2.4}
      />
    </g>
  )
}

/**
 * La figura de un ejercicio.
 *
 * `animar` en false la deja quieta en la postura de inicio: es lo que se usa
 * cuando hay varias en pantalla, donde media docena de cuerpos moviéndose sería
 * exactamente el ruido que el sistema visual trata de evitar.
 */
export function FiguraEjercicio({
  figura,
  animar = true,
  className = '',
}: {
  figura: Figura
  animar?: boolean
  className?: string
}) {
  const [t, setT] = useState(0)
  const quieto = useRef(false)

  useEffect(() => {
    if (!animar) return
    const prefiereQuieto =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    quieto.current = prefiereQuieto
    if (prefiereQuieto) return

    let cuadro = 0
    const arranque = performance.now()
    const ciclo = DURACION * 2 + PAUSA * 2

    const paso = (ahora: number) => {
      const m = (ahora - arranque) % ciclo
      // Ida, pausa, vuelta, pausa. Lineal a propósito: una curva de suavizado
      // haría parecer que el ejercicio tiene un rebote, y no lo tiene.
      const avance =
        m < DURACION ? m / DURACION
        : m < DURACION + PAUSA ? 1
        : m < DURACION * 2 + PAUSA ? 1 - (m - DURACION - PAUSA) / DURACION
        : 0
      setT(avance)
      cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [animar, figura])

  const reducido =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Con el movimiento apagado se muestran los dos extremos, que es la misma
  // información sin nada moviéndose.
  if (animar && reducido) {
    return (
      <div className={`flex gap-2 ${className}`}>
        <Lienzo figura={figura} postura={figura.inicio} />
        <Lienzo figura={figura} postura={figura.fin} />
      </div>
    )
  }

  const postura = animar ? entre(figura.inicio, figura.fin, t) : figura.inicio
  return <Lienzo figura={figura} postura={postura} className={className} />
}

/**
 * El encuadre: la caja que de verdad ocupa este ejercicio.
 *
 * El lienzo es de ciento veinte por cien, pero casi ningún ejercicio lo llena:
 * una flexión vive en la franja de abajo y deja media lámina en blanco arriba.
 * Recortar a lo que se usa hace que cada dibujo llegue al ancho de la columna
 * en vez de flotar chiquito en el medio de un vacío.
 *
 * Se calcula sobre las DOS posturas juntas, no sobre la que se está dibujando:
 * si cambiara cuadro a cuadro, la figura haría zoom mientras se mueve.
 */
function encuadre(figura: Figura): string {
  const puntos = [figura.inicio, figura.fin].flatMap((p) =>
    todos(ubicar(p, figura.apoyo, figura.inicio)),
  )
  const xs = puntos.map((p) => p.x)
  const ys = puntos.map((p) => p.y)

  // El piso y la barra son parte del dibujo: si quedan afuera, el cuerpo
  // aparece apoyado en nada.
  const y0 = Math.min(...ys, figura.apoyo === 'colgado' ? ALTURA_BARRA - 6 : PISO)
  const y1 = Math.max(...ys, PISO)
  const margen = 8

  return [
    Math.min(...xs) - margen,
    y0 - margen,
    Math.max(...xs) - Math.min(...xs) + margen * 2,
    y1 - y0 + margen * 2,
  ].join(' ')
}

function Lienzo({
  figura,
  postura,
  className = '',
}: {
  figura: Figura
  postura: Postura
  className?: string
}) {
  const e = ubicar(postura, figura.apoyo, figura.inicio)
  return (
    <svg
      viewBox={encuadre(figura)}
      className={`w-full ${className}`}
      role="img"
      aria-label={figura.gesto}
    >
      <line
        x1={-ANCHO}
        y1={PISO}
        x2={ANCHO * 2}
        y2={PISO}
        stroke="var(--color-regla)"
        strokeWidth={1.4}
      />
      <Apoyos escena={figura.escena} e={e} />
      <Cuerpo e={e} />
    </svg>
  )
}
