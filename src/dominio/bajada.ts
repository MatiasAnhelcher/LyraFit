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

import type { Avance, BloqueRutina, Cadena, Ejercicio, Objetivo } from './tipos'
import { NECESITAN_BARRA_CARGABLE } from './musculos'

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
 *
 * Un ejercicio `porLado` cuenta su trabajo dos veces: la cantidad es de cada
 * lado, así que diez zancadas por pierna son veinte, y un sostén de treinta
 * segundos por lado son sesenta. Contarlo una vez prometía
 * una sesión más corta que la que después se hace, y los mixes de piernas y
 * glúteos son los que más ejercicios por lado tienen. El descanso no se
 * duplica: entre un lado y el otro se cambia de posición, no se descansa una
 * serie entera.
 */
export const SEGUNDOS_POR_REPETICION = 3

export function minutosDeSesion(
  entradas: { ejercicio: Ejercicio; objetivo: Objetivo; descansoSegundos?: number }[],
  segundosDeFuelle = 0,
): number {
  const trabajo = entradas.reduce((suma, { ejercicio, objetivo, descansoSegundos }) => {
    const unLado =
      ejercicio.medida === 'segundos'
        ? objetivo.cantidad
        : objetivo.cantidad * SEGUNDOS_POR_REPETICION
    const porSerie = ejercicio.porLado ? unLado * 2 : unLado
    const descanso = descansoSegundos ?? ejercicio.descansoSegundos
    return suma + objetivo.series * porSerie + Math.max(0, objetivo.series - 1) * descanso
  }, 0)

  // Lo que no es ni serie ni descanso: entrar en calor, cambiar de ejercicio,
  // la serie de cierre y las tres preguntas del final. Medido a ojo sobre el
  // recorrido de `revisar.mjs`, redondeado para arriba.
  const alrededor = 5 * 60

  return Math.round((trabajo + segundosDeFuelle + alrededor) / 60)
}

// El selector de duración y el cálculo del bloque vivían acá y se fueron a
// `metabolico.ts`, convertidos en una prescripción fija. La razón está escrita
// allá: "que la sesión dure una hora" era el objetivo equivocado, y en un día
// de fuelle producía ochenta y cuatro vueltas de saltos encadenados.

/**
 * El ejercicio concreto de un bloque, según de qué clase sea.
 *
 * Tres clases y una sola función que las resuelve, porque `Hoy` y `Entrenar`
 * tienen que coincidir exactamente: si una pantalla anuncia cuatro ejercicios
 * y la otra arma cinco, la estimación de duración miente y la sesión no es la
 * que se prometió. Ya pasó con `patronDelBloque` y por eso ese también vive
 * en el dominio.
 *
 *   · bloque con `ejercicioId` → ese ejercicio, fijo. Un accesorio.
 *   · bloque con `volumen`     → el eslabón anterior del patrón.
 *   · bloque pelado            → el eslabón que el motor eligió.
 *
 * Devuelve `null` cuando el bloque no se puede armar: un accesorio que
 * necesita una barra que la persona no tiene, o un bloque de volumen sobre un
 * patrón donde está en el primer eslabón y no hay nada abajo. Las dos son
 * situaciones normales, no errores, y la pantalla simplemente no dibuja la
 * fila.
 */
export function ejercicioDelBloque(
  bloque: BloqueRutina,
  avance: Avance | undefined,
  ejercicios: Map<string, Ejercicio>,
  cadena: Cadena,
  opciones: { tieneBarraCargable: boolean },
): { ejercicio: Ejercicio; objetivo: Objetivo; accesorio: boolean } | null {
  if (bloque.ejercicioId) {
    const fijo = ejercicios.get(bloque.ejercicioId)
    if (!fijo) return null
    // Sin barra cargable el accesorio no existe, y la rutina sigue andando
    // con los bloques de cadena. Ofrecer un press militar a quien no tiene
    // barra es la clase de promesa que hace que una app se cierre.
    if (!opciones.tieneBarraCargable && NECESITAN_BARRA_CARGABLE.has(fijo.id)) return null
    return {
      ejercicio: fijo,
      // El piso de la ventana. La vara de la vez pasada la pone la pantalla:
      // acá no hay historial, y meterlo haría que esta función dependiera de
      // la base de datos.
      objetivo: { series: fijo.series, cantidad: fijo.ventana.min },
      accesorio: true,
    }
  }

  if (!avance) return null

  if (bloque.volumen) {
    const actual = ejercicios.get(avance.ejercicioId)
    if (!actual) return null
    const abajo = bajadaDe(actual, cadena, ejercicios)
    if (!abajo) return null
    return { ejercicio: abajo.ejercicio, objetivo: abajo.objetivo, accesorio: true }
  }

  const ejercicio = ejercicios.get(avance.ejercicioId)
  if (!ejercicio) return null
  return { ejercicio, objetivo: avance.objetivoActual, accesorio: false }
}

/**
 * El plan sin ejercicios repetidos.
 *
 * ## Por qué hace falta
 *
 * Las rutinas por grupo tienen, a propósito, un bloque de cadena y otro de
 * volumen sobre el MISMO patrón: así un día de pecho es pecho de verdad y no
 * una serie de pecho. En un día denso eso choca — el bloque de cadena agrega
 * su bajada, que es el eslabón anterior, y el bloque de volumen resuelve a
 * ESE MISMO eslabón. El ejercicio entra dos veces.
 *
 * Y no es una fila repetida y nada más. `Entrenar` guarda las series en un
 * `Record` indexado por **id de ejercicio** mientras el plan es posicional:
 * las dos entradas comparten el mismo arreglo. Se anotan una vez, aparecen
 * hechas en las dos, y la sesión se guarda con el ejercicio duplicado.
 *
 * ## Qué se queda
 *
 * El bloque que la rutina DECLARA, no la bajada que agrega la densidad. La
 * bajada es un extra automático; el bloque de volumen está escrito en la
 * rutina, y además llega con la vara de la vez pasada, que es lo que deja a
 * la persona progresarlo a mano.
 *
 * Vive en el dominio y no en cada pantalla por el mismo motivo que
 * `ejercicioDelBloque`: si `Hoy` y `Entrenar` dedupearan distinto, Hoy
 * anunciaría una sesión y la sesión sería otra.
 */
export function sinEjerciciosRepetidos<T extends { ejercicio: Ejercicio; bajada?: boolean }>(
  entradas: T[],
): T[] {
  // Lo que alguna entrada declara por derecho propio, o sea sin ser bajada.
  const declarados = new Set(entradas.filter((e) => !e.bajada).map((e) => e.ejercicio.id))
  const puestos = new Set<string>()

  return entradas.filter((e) => {
    const id = e.ejercicio.id
    // Una bajada cuyo ejercicio ya está declarado en otro bloque sobra.
    if (e.bajada && declarados.has(id)) return false
    if (puestos.has(id)) return false
    puestos.add(id)
    return true
  })
}
