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
 * llama la atención, y con movimiento reducido —el de Ajustes o el del
 * teléfono— o en medio del esfuerzo desaparece y quedan las dos posturas una
 * al lado de la otra, que es la versión honesta de lo mismo sin una sola cosa
 * moviéndose.
 */

import { useEffect, useRef, useState } from 'react'
import { debeQuedarseQuieto, useQuieto } from './movimiento'
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

/**
 * El cuerpo, con GROSOR y no como alambre.
 *
 * El dueño miró estos dibujos y dijo que eran ridículos y que no explicaban
 * el ejercicio. Tenía razón y la causa no estaba en los datos: las posturas
 * —los ángulos de cada articulación— estaban bien, y eso se ve en que la
 * silueta del movimiento es correcta en los cuarenta y siete. Lo que estaba
 * mal era el trazo: un esqueleto de 2,6 px parejo de la cabeza al pie, que no
 * se lee como un cuerpo sino como un diagrama de palitos.
 *
 * El arreglo no toca una sola coordenada. Lo que cambia es que cada segmento
 * lleva el grosor que le corresponde —el torso casi cuatro veces el
 * antebrazo— y que las uniones llevan un remate redondo del ancho del
 * segmento más grueso, que es lo que convierte dos palos en una articulación
 * en vez de en una esquina.
 *
 * Es la misma idea que el mapa muscular: no hacen falta ilustraciones
 * compradas, hace falta que el dibujo tenga las proporciones de una persona.
 */
function Cuerpo({ e }: { e: Esqueleto }) {
  /*
   * Los grosores, en fracción del alto del cuerpo.
   *
   * No son a ojo: salen de las proporciones del canon de dibujo, el mismo que
   * usa `anatomia.ts` para el mapa muscular. El torso de perfil es ancho, el
   * muslo algo menos, y el antebrazo menos de la mitad del muslo. Que esa
   * jerarquía exista es casi todo el trabajo — un cuerpo donde el brazo mide
   * lo mismo que el torso no se lee como un cuerpo por más bien articulado
   * que esté.
   */
  const G = {
    torso: ALTO_CUERPO * 0.105,
    muslo: ALTO_CUERPO * 0.072,
    pantorrilla: ALTO_CUERPO * 0.05,
    brazo: ALTO_CUERPO * 0.052,
    antebrazo: ALTO_CUERPO * 0.04,
    pie: ALTO_CUERPO * 0.03,
  }

  const tinta = 'var(--color-tinta)'

  /** Un segmento, con su grosor. Redondo en las dos puntas: ahí van las uniones. */
  const Hueso = ({
    de,
    a,
    ancho,
    lejano = false,
  }: {
    de: Punto
    a: Punto
    ancho: number
    lejano?: boolean
  }) => (
    <line
      x1={de.x}
      y1={de.y}
      x2={a.x}
      y2={a.y}
      stroke={tinta}
      strokeWidth={lejano ? ancho * 0.72 : ancho}
      strokeLinecap="round"
      opacity={lejano ? 0.42 : 1}
    />
  )

  return (
    <g>
      {/* El lado lejano primero y más fino: es lo que se lee como "esto está
          detrás", y va abajo para que el cuerpo cercano lo tape al cruzarse. */}
      {e.rodillaLejos && (
        <>
          <Hueso de={e.cadera} a={e.rodillaLejos} ancho={G.muslo} lejano />
          <Hueso de={e.rodillaLejos} a={e.tobilloLejos!} ancho={G.pantorrilla} lejano />
          <Hueso de={e.tobilloLejos!} a={e.puntaLejos!} ancho={G.pie} lejano />
        </>
      )}
      {e.codoLejos && (
        <>
          <Hueso de={e.hombro} a={e.codoLejos} ancho={G.brazo} lejano />
          <Hueso de={e.codoLejos} a={e.muñecaLejos!} ancho={G.antebrazo} lejano />
        </>
      )}

      {/* El torso va PRIMERO de los cercanos y la pierna encima: de perfil, el
          muslo nace por delante de la cadera y taparlo al revés deja la pierna
          saliendo del aire. */}
      <Hueso de={e.cadera} a={e.hombro} ancho={G.torso} />
      <Hueso de={e.cadera} a={e.rodilla} ancho={G.muslo} />
      <Hueso de={e.rodilla} a={e.tobillo} ancho={G.pantorrilla} />
      <Hueso de={e.tobillo} a={e.punta} ancho={G.pie} />

      {/* El cuello: un segmento corto del hombro a la cabeza. Sin él la cabeza
          queda pegada al torso y el dibujo pierde el gesto de la mirada, que
          en media docena de ejercicios es parte de la técnica —"mirada al
          piso un poco adelante de las manos"—. */}
      <Hueso de={e.hombro} a={e.cabeza} ancho={G.brazo * 0.9} />

      {/* La cabeza, rellena y no hueca. Hueca sobre fondo oscuro se leía como
          un agujero; llena es una cabeza. */}
      <circle cx={e.cabeza.x} cy={e.cabeza.y} r={ALTO_CUERPO * 0.066} fill={tinta} />

      {/*
        EL BRAZO CERCANO VA ÚLTIMO, DESPUÉS DE LA CABEZA, y no es un detalle.

        Con la cabeza encima, en todos los ejercicios de barra el brazo sube
        desde el hombro, pasa por detrás de la cabeza y desaparece: quedaba un
        brazo saliéndole a la persona de la coronilla. Mientras la figura era
        un alambre no se notaba —la línea se veía cruzar el círculo hueco— y
        al darle grosor y relleno se volvió evidente.

        Al revés no pasa nada: cuando los brazos están abajo —sentadilla,
        flexión, plancha— no tocan la cabeza, así que ninguna postura empeora.
        Y con los brazos arriba, el brazo por delante de la cabeza es como lo
        dibuja cualquier pictograma.
      */}
      <Hueso de={e.hombro} a={e.codo} ancho={G.brazo} />
      <Hueso de={e.codo} a={e.muñeca} ancho={G.antebrazo} />
    </g>
  )
}

/**
 * Cómo se dibuja la figura.
 *
 * - `animada`: va y vuelve entre las dos posturas. Es lo de siempre, y se
 *   convierte sola en `ambas-quietas` con movimiento reducido o dentro del
 *   esfuerzo, sin que nadie se lo pase: una pantalla que se olvida de pedirlo
 *   es una figura moviéndose en el descanso.
 * - `inicio`: quieta en la postura de inicio. Es para cuando hay varias en
 *   pantalla, donde media docena de cuerpos moviéndose sería exactamente el
 *   ruido que el sistema visual trata de evitar.
 * - `ambas-quietas`: las dos posturas lado a lado.
 */
export type PosturaDeLaFigura = 'animada' | 'inicio' | 'ambas-quietas'

/**
 * La figura de un ejercicio.
 *
 * Quieta no corre ningún `requestAnimationFrame`. Antes, `animar={false}`
 * dejaba quieto el dibujo pero no el bucle, y en el esfuerzo cada cuadro
 * despertaba a React para no cambiar nada.
 */
export function FiguraEjercicio({
  figura,
  postura = 'animada',
  className = '',
}: {
  figura: Figura
  postura?: PosturaDeLaFigura
  className?: string
}) {
  const caja = useRef<HTMLDivElement>(null)
  const quieta = useQuieto(caja)
  const [t, setT] = useState(0)
  const anima = postura === 'animada' && !quieta

  useEffect(() => {
    if (!anima) return
    // Se vuelve a mirar el DOM antes de arrancar: `useQuieto` se entera del
    // esfuerzo recién en un efecto de layout, y este efecto puede correr con
    // el valor de antes. Sin esta pregunta habría un primer cuadro pedido.
    if (debeQuedarseQuieto(caja.current)) return

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
  }, [anima, figura])

  // Quieta en lugar de animada muestra los dos extremos, que es la misma
  // información sin nada moviéndose. La segunda no se anuncia: el lector de
  // pantalla ya leyó el gesto en la primera, y repetirlo no agrega nada.
  if (postura === 'ambas-quietas' || (postura === 'animada' && quieta)) {
    return (
      <div ref={caja} className={`flex gap-2 ${className}`} data-animada="false">
        <Lienzo figura={figura} postura={figura.inicio} />
        <Lienzo figura={figura} postura={figura.fin} oculto />
      </div>
    )
  }

  return (
    <div ref={caja} className={className} data-animada={anima}>
      <Lienzo figura={figura} postura={anima ? entre(figura.inicio, figura.fin, t) : figura.inicio} />
    </div>
  )
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

  // El piso entra en el marco solo si el cuerpo lo usa. Colgado de una barra
  // los pies no llegan al suelo, así que forzarlo adentro dejaba medio recuadro
  // vacío debajo de la persona y encogía la figura a la mitad para nada: lo que
  // sostiene ahí es la barra, y el piso no es información.
  const cuelga = figura.apoyo === 'colgado'
  const y0 = Math.min(...ys, cuelga ? ALTURA_BARRA - 6 : PISO)
  const y1 = cuelga ? Math.max(...ys) : Math.max(...ys, PISO)
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
  oculto = false,
}: {
  figura: Figura
  postura: Postura
  oculto?: boolean
}) {
  const e = ubicar(postura, figura.apoyo, figura.inicio)
  return (
    <svg
      viewBox={encuadre(figura)}
      className="w-full"
      {...(oculto ? { 'aria-hidden': true } : { role: 'img', 'aria-label': figura.gesto })}
    >
      {figura.apoyo !== 'colgado' && (
        <line
          x1={-ANCHO}
          y1={PISO}
          x2={ANCHO * 2}
          y2={PISO}
          stroke="var(--color-regla)"
          strokeWidth={1.4}
        />
      )}
      <Apoyos escena={figura.escena} e={e} />
      <Cuerpo e={e} />
    </svg>
  )
}
