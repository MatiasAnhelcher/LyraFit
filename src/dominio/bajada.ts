/**
 * La bajada: volumen en el eslabón anterior, después del trabajo duro.
 *
 * ## Por qué existe
 *
 * Una sesión de fuerza de esta app son cuatro cadenas por tres series. Medido
 * contra los descansos reales de la biblioteca, eso son entre veinte y treinta
 * minutos, y buena parte quieto. Para que una sesión dure una hora hay que
 * agregar trabajo, y hay exactamente tres formas de hacerlo:
 *
 * 1. Más series del ejercicio que toca. **Es la peor.** El motor mide el
 *    rendimiento contra `objetivo.series * objetivo.cantidad`, y la peor serie
 *    pesa un cuarto: agregar series cansa la última y baja el número que el
 *    motor lee. Se pagaría con eslabones.
 * 2. Más cadenas. No hay más: son cuatro.
 * 3. **Más volumen en un eslabón que el motor no está mirando.** Es esta.
 *
 * ## Por qué es gratis para el motor
 *
 * No hace falta ninguna regla nueva, y eso es lo que la hace segura: la regla
 * ya está escrita en `cerrarSesion` desde antes de que esto existiera.
 *
 *     if (!avance || avance.ejercicioId !== ejercicio.id) continue
 *     // Solo progresa el patrón si se entrenó el ejercicio que tocaba.
 *
 * La bajada es, por construcción, **otro** ejercicio: el eslabón anterior de la
 * misma cadena. Así que el motor la saltea sin que nadie se lo pida.
 *
 * Y tampoco ensucia la curva de fuerza, por una razón igual de vieja:
 * `curvaDeFuerza` se queda con el **máximo** índice de carga del día, no con el
 * promedio ni con el último. Un eslabón más fácil da un índice más bajo, así
 * que nunca puede reemplazar al del trabajo duro. La curva ni se entera.
 *
 * Las dos propiedades tienen su test, porque "anda porque otra función hace tal
 * cosa" dura hasta que alguien cambia esa otra función.
 */

import type { Cadena, Ejercicio, Objetivo } from './tipos'

/**
 * Cuántas series de bajada.
 *
 * Dos y no tres: la bajada es volumen, no un segundo entrenamiento. Tres series
 * de un eslabón entero más fácil, en las cuatro cadenas, son doce series extra
 * por sesión, que es más de lo que aguanta cualquiera cinco días por semana.
 */
export const SERIES_DE_BAJADA = 2

/**
 * El descanso de la bajada, en segundos.
 *
 * Corto a propósito y fijo, no el del ejercicio: acá no se está midiendo nada,
 * así que no hace falta recuperar para expresar capacidad. Es justo lo que hace
 * que la bajada sea densa en vez de larga — y, de paso, queda por debajo del
 * piso de recuperación del fuelle, así que la bajada no lleva ráfagas.
 */
export const DESCANSO_DE_BAJADA = 45

/**
 * El eslabón anterior de la cadena, con su objetivo de volumen.
 *
 * Devuelve `null` cuando no hay dónde bajar —el primer eslabón de la cadena—,
 * que es un resultado normal y no un error: quien recién empieza no necesita
 * volumen extra, necesita aprender el movimiento.
 */
export function bajadaDe(
  ejercicio: Ejercicio,
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
): { ejercicio: Ejercicio; objetivo: Objetivo } | null {
  const posicion = cadena.ejercicios.indexOf(ejercicio.id)
  if (posicion <= 0) return null

  const anterior = ejercicios.get(cadena.ejercicios[posicion - 1]!)
  if (!anterior) return null

  return {
    ejercicio: anterior,
    // El techo de su ventana: es un eslabón que ya se domina, así que pedirle
    // el mínimo sería no pedirle nada. Si igual no sale, no pasa nada — nadie
    // está midiendo.
    objetivo: { series: SERIES_DE_BAJADA, cantidad: anterior.ventana.max },
  }
}

/**
 * Cuántos minutos dura una sesión, estimados.
 *
 * Existe porque "una rutina de una hora a una hora y media" es un requisito
 * concreto y hasta acá la app no podía ni decir cuánto duraba una sesión. Es
 * una estimación y se dice que lo es, pero no es inventada: sale de los mismos
 * números con los que la sesión se arma.
 *
 * El tiempo de trabajo se estima en tres segundos por repetición, que es un
 * tempo tranquilo y realista, y en los isométricos es el propio sostén. La
 * última serie de cada ejercicio no lleva descanso, y por eso se resta uno.
 */
export const SEGUNDOS_POR_REPETICION = 3

export function minutosDeSesion(
  entradas: { ejercicio: Ejercicio; objetivo: Objetivo; descansoSegundos?: number }[],
  segundosDeFuelle = 0,
): number {
  const trabajo = entradas.reduce((suma, { ejercicio, objetivo, descansoSegundos }) => {
    const porSerie =
      ejercicio.medida === 'segundos'
        ? objetivo.cantidad
        : objetivo.cantidad * SEGUNDOS_POR_REPETICION
    const descanso = descansoSegundos ?? ejercicio.descansoSegundos
    return suma + objetivo.series * porSerie + Math.max(0, objetivo.series - 1) * descanso
  }, 0)

  // Lo que no es ni serie ni descanso: entrar en calor, cambiar de ejercicio,
  // la serie de cierre y las tres preguntas del final. Medido a ojo sobre el
  // recorrido de `revisar.mjs`, redondeado para arriba.
  const alrededor = 5 * 60

  return Math.round((trabajo + segundosDeFuelle + alrededor) / 60)
}

/**
 * Las duraciones que se pueden pedir. Nada de un deslizador de un minuto.
 *
 * El 90 no es una promesa de noventa minutos y la pantalla no lo dice así: es
 * "lo más largo que dé". Medido sobre la biblioteca real, una sesión de cuatro
 * cadenas al techo de su ventana más la bajada más el bloque topeado da entre
 * 56 y 71 minutos según en qué eslabón esté la persona, y ese techo sube solo a
 * medida que progresa —los ejercicios difíciles tienen descansos más largos—.
 *
 * Llegar a noventa de verdad pediría series que a nadie le sirven, y eso es
 * volumen de relleno: la app prefiere decir la cifra que va a durar, que para
 * eso `Hoy` la muestra antes de empezar.
 */
export const MINUTOS_OBJETIVO = [45, 60, 90] as const

/**
 * Cuánto dura un día de fuelle cuando nadie eligió duración.
 *
 * El día de fuelle no tiene fuerza adelante, así que no hay nada de qué
 * descontar: o dura lo que se pidió, o dura esto. Media hora es lo que dura una
 * sesión de acondicionamiento sin que sea un evento.
 */
export const MINUTOS_DEL_DIA_POR_DEFECTO = 30

/** Lo más corto y lo más largo que puede ser el bloque de fuelle. */
export const BLOQUE_MINIMO = 6
export const BLOQUE_MAXIMO = 35

/**
 * Cuántos minutos de fuelle hacen falta para que la sesión dure lo que se pidió.
 *
 * Es la única palanca honesta que hay para estirar una sesión. Las otras dos
 * son peores y por eso no están: más series del ejercicio que toca le cuesta
 * eslabones a la persona —el motor mide contra `objetivo.series` y la peor
 * serie pesa un cuarto—, y más cadenas no existen, son cuatro.
 *
 * El fuelle, en cambio, no toca nada de lo que el motor lee. Así que cuando
 * alguien pide una sesión más larga, lo que se estira es esto.
 *
 * Hay DOS topes, y los dos existen por algo que pasó:
 *
 * - **Uno absoluto.** Treinta y cinco minutos de trabajo metabólico pegados a
 *   la fuerza ya son una sesión de acondicionamiento completa. Más que eso no
 *   es entrenar más, es no recuperar.
 *
 * - **Y uno proporcional: el bloque nunca puede ser más largo que la fuerza.**
 *   Sin esto, alguien en los primeros eslabones —cuya sesión de fuerza dura
 *   veintiún minutos— que pidiera una hora recibía treinta y cinco minutos de
 *   metabólico: más cardio que fuerza, en una app de fuerza. Es la versión
 *   metabólica del volumen de relleno, y se descubrió justo antes de publicar
 *   el ofrecimiento de Hoy, calculando qué recibía de verdad alguien que
 *   tocaba "Probarlo" en una instalación nueva.
 *
 * Y `undefined` no es sesenta: es **nadie pidió una sesión más larga**. Ahí el
 * bloque es el mínimo. Es la misma distinción que decide si el fuelle se ofrece
 * en Hoy, y aplanarla con un `?? 60` le daba media hora de cardio a alguien que
 * lo único que hizo fue tener curiosidad.
 */
export function minutosDelBloque(
  minutosObjetivo: number | undefined,
  minutosDeFuerza: number,
): number {
  if (minutosObjetivo === undefined) return BLOQUE_MINIMO
  const tope = Math.min(BLOQUE_MAXIMO, Math.max(BLOQUE_MINIMO, Math.round(minutosDeFuerza)))
  return Math.max(BLOQUE_MINIMO, Math.min(tope, Math.round(minutosObjetivo - minutosDeFuerza)))
}
