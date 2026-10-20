/**
 * La molestia: lo que cambia el día que la avisás.
 *
 * ## Lo que había
 *
 * Avisar una molestia "congelaba" la cadena: la sesión no contaba ni a favor
 * ni en contra (`cadenasCongeladas`, en `estado.ts`). Y nada más. El ejercicio
 * y el objetivo seguían iguales, ninguna pantalla lo decía, y las ráfagas del
 * fuelle podían caer justo sobre la zona que avisó. Mientras tanto el chequeo
 * prometía que "la app deja de empujar esa cadena". Encima el aviso venía
 * apagado de fábrica, aparecía solo con los músculos doloridos y no dejaba
 * elegir la bisagra, que es la cadena del curl nórdico.
 *
 * ## Lo que hace ahora
 *
 * La versión mínima del Anexo B del rol 8 (kinesiología), sin tocar la base:
 *
 * - Ese día, la cadena con la molestia **baja un eslabón**: el anterior de la
 *   misma cadena, con dos series y al piso de su ventana. Si ya está en el
 *   primero, **se saltea** ese día. Los accesorios y el volumen de esa cadena
 *   también se saltean, porque son más carga sobre la misma zona.
 * - Las ráfagas no la cargan, ni en el descanso ni en el bloque del final
 *   (`metabolico.ts`).
 * - **El motor no se entera.** El eslabón de abajo es OTRO ejercicio, y
 *   `cerrarSesion` solo progresa un patrón "si se entrenó el ejercicio que
 *   tocaba". No es un fallo ni un progreso, igual que la sesión neutra que ya
 *   existía. Avisar no puede costar nada: si avisar castiga, la gente deja de
 *   avisar.
 * - Se dice en una línea, sin retar y sin diagnosticar: la app pregunta
 *   dónde, nunca por qué.
 *
 * Lo que queda para la versión completa, que necesita una firma profesional y
 * un cambio en la base: la molestia por zona del cuerpo y no por cadena, el
 * botón "Me molesta" en la serie, la intensidad, y la pausa que se levanta
 * cuando la persona dice "ya no" en vez de por calendario.
 */

import { bajadaDe } from './bajada'
import { NOMBRE_PATRON } from './biblioteca'
import type { Cadena, Ejercicio, Estado, Objetivo, Patron } from './tipos'

/**
 * Cuántas series del eslabón de abajo, el día de la molestia.
 *
 * Dos, como la bajada y como pide el Anexo B: es mover la cadena sin buscar
 * nada, no un entrenamiento de reemplazo.
 */
export const SERIES_CON_MOLESTIA = 2

/**
 * Las cadenas con una molestia avisada hoy.
 *
 * Sale de la fila de hoy, tenga o no el chequeo entero: con el chequeo
 * apagado, que es como viene de fábrica, la fila trae solo la molestia. Y no
 * mira `preferencias.estadoActivo` a propósito: el interruptor apaga la
 * pregunta diaria, no el canal de seguridad.
 */
export function molestiasDeHoy(estados: readonly Estado[], hoy: string): Set<Patron> {
  const deHoy = estados.find((e) => e.fecha === hoy)
  return new Set(deHoy?.molestia ? [deHoy.molestia] : [])
}

/**
 * Las cadenas con molestia para la sesión en curso: las de hoy, más las que
 * la sesión ya traía en su borrador.
 *
 * Una molestia no puede dejar de valer a mitad de una sesión. Si la persona
 * la retira con "Ya no" después de anotar series en el eslabón de abajo —o la
 * sesión cruza la medianoche y la pestaña se recarga—, la fila de hoy ya no
 * la trae. Sin el borrador, el bloque volvería al eslabón de siempre, las
 * series anotadas en el de abajo quedarían fuera del plan y el cierre no las
 * guardaría: trabajo perdido en silencio. Al revés no hace falta nada: una
 * molestia nueva entra sola por la fila de hoy, y lo ya empezado lo cuida
 * `yaEmpezado`.
 */
export function molestiasDeLaSesion(
  estados: readonly Estado[],
  hoy: string,
  delBorrador: readonly Patron[] = [],
): Set<Patron> {
  return new Set([...molestiasDeHoy(estados, hoy), ...delBorrador])
}

export type CambioPorMolestia = 'baja' | 'saltea'

/** Un bloque ya resuelto: lo que devuelve `ejercicioDelBloque`. */
export interface BloqueResuelto {
  ejercicio: Ejercicio
  objetivo: Objetivo
  accesorio: boolean
}

export type BloqueConMolestia =
  | (BloqueResuelto & { cambio: null })
  | { cambio: 'baja'; ejercicio: Ejercicio; objetivo: Objetivo; accesorio: false }
  | { cambio: 'saltea' }

/**
 * El bloque de hoy, con la molestia aplicada.
 *
 * Va después de `ejercicioDelBloque` y en el dominio por el mismo motivo que
 * él: `Hoy` y `Entrenar` tienen que llegar a la misma sesión. Si una pantalla
 * anunciara la cadena bajada y la otra la pidiera entera, la promesa sería
 * falsa en el peor lugar posible.
 *
 * - Sin molestia en esa cadena, el bloque queda exactamente igual.
 * - `yaEmpezado` también lo deja igual: si ese ejercicio ya tiene series
 *   anotadas en esta sesión, cambiarlo ahora las dejaría huérfanas —el cierre
 *   solo guarda lo que está en el plan— y perder trabajo en silencio es peor
 *   que cualquier otra cosa. La cadena igual queda congelada, así que el motor
 *   tampoco se mueve.
 * - Un accesorio o un bloque de volumen se saltea: es carga extra sobre la
 *   misma zona, y el volumen ya es el eslabón de abajo.
 * - El eslabón del motor baja al anterior de su cadena, dos series al piso de
 *   la ventana: un eslabón que ya se dominó, pedido de la forma más liviana
 *   que tiene. Sin kilos: con la zona avisando no se le pone peso encima.
 * - En el primer eslabón no hay dónde bajar, y la cadena se saltea ese día.
 */
export function bloqueConMolestia(
  resuelto: BloqueResuelto,
  molestias: ReadonlySet<Patron>,
  ejercicios: Map<string, Ejercicio>,
  cadena: Cadena,
  opciones: { yaEmpezado?: boolean } = {},
): BloqueConMolestia {
  const toca = molestias.has(resuelto.ejercicio.patron) || molestias.has(cadena.patron)
  if (!toca || opciones.yaEmpezado) return { ...resuelto, cambio: null }

  if (resuelto.accesorio) return { cambio: 'saltea' }

  const abajo = bajadaDe(resuelto.ejercicio, cadena, ejercicios)
  if (!abajo) return { cambio: 'saltea' }

  return {
    cambio: 'baja',
    ejercicio: abajo.ejercicio,
    objetivo: {
      series: Math.min(SERIES_CON_MOLESTIA, resuelto.objetivo.series),
      cantidad: abajo.ejercicio.ventana.min,
    },
    accesorio: false,
  }
}

/**
 * Qué decir de cada cadena con molestia, una vez por cadena.
 *
 * Una cadena puede aparecer en varios bloques —el eslabón, el volumen, un
 * accesorio— y cada uno resuelve por su lado. Si el eslabón bajó, eso es lo
 * que se dice, aunque el volumen se haya salteado: decir "hoy no cargamos
 * tracción" con una dominada asistida en pantalla sería mentir.
 *
 * Por lo mismo, "no cargamos" solo se dice de una cadena que no quedó en el
 * plan: `enElPlan` son los patrones de lo que sí quedó. Si algo de esa cadena
 * siguió —un ejercicio que ya tenía series anotadas—, la frase sería falsa y
 * no se dice.
 */
export function avisosDeMolestia(
  cambios: readonly { patron: Patron; cambio: CambioPorMolestia }[],
  enElPlan: Iterable<Patron> = [],
): { patron: Patron; cambio: CambioPorMolestia }[] {
  const quedaron = new Set(enElPlan)
  const porCadena = new Map<Patron, CambioPorMolestia>()
  for (const { patron, cambio } of cambios) {
    if (porCadena.get(patron) !== 'baja') porCadena.set(patron, cambio)
  }
  return [...porCadena]
    .filter(([patron, cambio]) => cambio === 'baja' || !quedaron.has(patron))
    .map(([patron, cambio]) => ({ patron, cambio }))
}

/**
 * La línea que lo dice, en la sesión.
 *
 * Primera del plural y con el motivo, que es lo que separa un ajuste de un
 * error de la app. Sin "lesión", sin "tranqui, no es nada" y sin reto: la
 * persona hizo exactamente lo que tenía que hacer.
 */
export function lineaDeMolestia(aviso: { patron: Patron; cambio: CambioPorMolestia }): string {
  const cadena = NOMBRE_PATRON[aviso.patron].toLowerCase()
  return aviso.cambio === 'saltea'
    ? `Hoy no cargamos ${cadena}: avisaste una molestia.`
    : `Hoy bajamos un eslabón en ${cadena}: avisaste una molestia.`
}

/**
 * Lo que queda de la sesión sin la cadena con molestia.
 *
 * Para la serie de cierre, que cae sobre el ejercicio más fácil del plan: el
 * eslabón bajado suele ser justo ese, y una tercera serie ahí no es un saludo
 * final, es volver a cargar la zona. Si no queda otra cosa, se usa lo que hay:
 * el cierre se puede saltear y nunca cuenta para nada.
 */
export function fueraDeLaMolestia<T extends { ejercicio: Ejercicio }>(
  entradas: readonly T[],
  molestias: ReadonlySet<Patron>,
): readonly T[] {
  const libres = entradas.filter((e) => !molestias.has(e.ejercicio.patron))
  return libres.length > 0 ? libres : entradas
}
