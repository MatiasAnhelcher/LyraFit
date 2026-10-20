/**
 * Qué eslabones están abiertos.
 *
 * El motor sube de a un eslabón dentro de su propia cadena y no mira nada más
 * (`vecino`, en `progresion.ts`). Para casi todo alcanza. La revisión del 20
 * de octubre de 2026 encontró, corriendo el código real, dos casos en que no:
 *
 * - **Sin barra.** Quien dijo "no tengo de dónde colgarme" igual terminaba en
 *   ejercicios colgado: el alta lo ubicaba ahí con 90 segundos de plancha, y
 *   el motor lo subía después a las dominadas negativas y a las elevaciones
 *   colgado.
 * - **La palanca frontal sin dominadas.** Con 120 segundos de plancha el alta
 *   ubicaba en la palanca frontal negativa a alguien con cero dominadas, y el
 *   motor llevaba ahí a cualquiera que terminara las elevaciones colgado.
 *
 * Son la misma regla —hay eslabones que no se abren solo por dominar el
 * anterior— y se resuelven igual: con la lista de eslabones cerrados, que el
 * motor recibe en su contexto y que el alta usa como techo.
 *
 * La palanca no se abre al llegar a las dominadas completas sino con 3 series
 * de 8 (`REQUISITOS`). Y quien ya estaba en ella con la regla vieja baja una
 * sola vez (`bajarPorRequisito`), con una línea que dice por qué.
 */

import type {
  Avance,
  BajadaPorRequisito,
  Cadena,
  Ejercicio,
  Patron,
  RevisionDeRequisitos,
  Sesion,
} from './tipos'
import { NOMBRE_PATRON, POR_ID, REQUISITOS, cadenaDe, type Requisito } from './biblioteca'
import { NECESITAN_BARRA } from './musculos'
import { recalibrar, requisitoDicho, ubicarEnCadena, type Cierre } from './progresion'

/**
 * ¿Cumple la persona el requisito, mirando su avance en la otra cadena?
 *
 * Pasado el eslabón pedido, sí. En el eslabón, solo si el objetivo actual ya
 * pide el mínimo: el objetivo y no lo logrado en una sesión suelta, porque el
 * objetivo es lo que el motor ya dio por sostenido. Y antes del eslabón, no.
 */
function cumple(avances: ReadonlyMap<Patron, Avance>, requisito: Requisito): boolean {
  const avance = avances.get(requisito.patron)
  if (!avance) return false
  const cadena = cadenaDe(requisito.patron).ejercicios
  const donde = cadena.indexOf(avance.ejercicioId)
  const pedido = cadena.indexOf(requisito.ejercicioId)
  if (donde === -1 || pedido === -1 || donde < pedido) return false
  if (donde > pedido || !requisito.minimo) return true
  const { series, cantidad } = avance.objetivoActual
  return series >= requisito.minimo.series && cantidad >= requisito.minimo.cantidad
}

/**
 * Los eslabones de esta cadena a los que el motor no puede subir todavía, y
 * por qué.
 *
 * Sin barra se cierra todo lo que cuelga, y ese motivo va primero: a quien no
 * tiene de dónde colgarse, decirle que le faltan dominadas no le sirve de
 * nada. Con barra, lo que tiene un requisito se abre cuando la persona lo
 * cumple en la otra cadena (`cumple`): para la palanca frontal, 3 series de 8
 * dominadas completas, o haberlas pasado.
 *
 * `tieneBarra` viene explícito y no como el campo de preferencias, que puede
 * faltar: el que llama decide qué hacer con el ausente, y en toda la app
 * cuenta como sí.
 */
export function eslabonesCerrados(
  cadena: Cadena,
  avances: ReadonlyMap<Patron, Avance>,
  tieneBarra: boolean,
): Map<string, Cierre> {
  const cerrados = new Map<string, Cierre>()
  for (const id of cadena.ejercicios) {
    if (!tieneBarra && NECESITAN_BARRA.has(id)) {
      cerrados.set(id, { motivo: 'sin-barra' })
      continue
    }
    const requisito = REQUISITOS.get(id)
    if (!requisito || cumple(avances, requisito)) continue
    const ejercicio = POR_ID.get(requisito.ejercicioId)
    if (ejercicio) {
      cerrados.set(id, {
        motivo: 'requisito',
        requisito: ejercicio,
        ...(requisito.minimo ? { minimo: requisito.minimo } : {}),
      })
    }
  }
  return cerrados
}

/**
 * El último eslabón de la cadena que no cuelga de una barra, o null si en la
 * cadena no cuelga ninguno.
 *
 * Sin barra, ahí se frena todo. Es lo que el alta nombra para decir hasta
 * dónde llega el plan.
 */
export function ultimoSinBarra(cadena: Cadena): Ejercicio | null {
  const primeroColgado = cadena.ejercicios.findIndex((id) => NECESITAN_BARRA.has(id))
  if (primeroColgado <= 0) return null
  return POR_ID.get(cadena.ejercicios[primeroColgado - 1]!) ?? null
}

/**
 * Dónde queda un avance cuando la persona dice que no tiene de dónde
 * colgarse, o null si no hace falta moverlo.
 *
 * Cerrar lo colgado frena las subidas, pero no saca a nadie de donde ya está.
 * Quien apagaba "Tengo dónde colgarme" estando en las dominadas seguía viendo
 * dominadas en Hoy, aunque el interruptor dice que el plan no le pide nada
 * colgado. Y como saltear un ejercicio no mueve el plan, se quedaba ahí para
 * siempre. Se baja al último eslabón que no cuelga, con la carga recalculada
 * igual que en cualquier cambio de eslabón del motor.
 */
export function bajarDeLoColgado(avance: Avance, ahora: number = Date.now()): Avance | null {
  if (!NECESITAN_BARRA.has(avance.ejercicioId)) return null
  const cadena = cadenaDe(avance.patron)
  const actual = POR_ID.get(avance.ejercicioId)
  const destino = ultimoSinBarra(cadena)
  if (!actual || !destino || !cadena.ejercicios.includes(actual.id)) return null
  return bajarA(avance, actual, destino, ahora)
}

/**
 * El avance puesto en un eslabón más abajo, con la carga recalculada igual
 * que en cualquier cambio de eslabón del motor. La señal se conserva: viene
 * de cómo le venía yendo, y eso no cambió. Lo que se reinicia es lo que mide
 * el eslabón nuevo.
 */
function bajarA(avance: Avance, actual: Ejercicio, destino: Ejercicio, ahora: number): Avance {
  return {
    patron: avance.patron,
    ejercicioId: destino.id,
    objetivoActual: {
      series: destino.series,
      cantidad: recalibrar(actual, avance.objetivoActual.cantidad, destino),
    },
    senal: avance.senal,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
    actualizadoEn: ahora,
  }
}

/**
 * Quién baja porque está en un eslabón cerrado por requisito, y adónde.
 *
 * Es para la revisión única de la palanca frontal (`revisionDeRequisitos`, en
 * las preferencias). Con la regla vieja, la palanca se abría apenas se llegaba
 * a las dominadas completas, y el alta ubicaba ahí con 120 segundos de
 * plancha aunque no hubiera ni una dominada. Cerrarla frena las subidas, pero
 * no saca a nadie de donde ya está: el motor no baja de eslabón a quien viene
 * cumpliendo.
 *
 * Baja al último eslabón abierto de su cadena por debajo del que estaba: con
 * barra, la elevación de piernas colgado; sin barra, la elevación de piernas
 * en el suelo, porque lo colgado también está cerrado. La carga se recalcula
 * como en `bajarDeLoColgado`.
 *
 * Solo mira el requisito, no la barra: quien cumple las dominadas no se toca,
 * tenga barra o no —de lo colgado sin barra se ocupa el interruptor de
 * Ajustes—. Y quien tiene la palanca abierta no se toca nunca. Es idempotente:
 * lo que devuelve ya no está en un eslabón cerrado, así que pasarlo dos veces
 * no mueve nada más. Que corra una sola vez lo decide el que llama.
 */
export function bajarPorRequisito(
  avances: ReadonlyMap<Patron, Avance>,
  tieneBarra: boolean,
  ahora: number = Date.now(),
): { avances: Avance[]; bajadas: BajadaPorRequisito[] } {
  const abajo: Avance[] = []
  const bajadas: BajadaPorRequisito[] = []
  for (const avance of avances.values()) {
    const requisito = REQUISITOS.get(avance.ejercicioId)
    if (!requisito || cumple(avances, requisito)) continue
    const cadena = cadenaDe(avance.patron)
    const actual = POR_ID.get(avance.ejercicioId)
    const donde = cadena.ejercicios.indexOf(avance.ejercicioId)
    if (!actual || donde <= 0) continue
    const cerrados = eslabonesCerrados(cadena, avances, tieneBarra)
    const destinoId = cadena.ejercicios
      .slice(0, donde)
      .reverse()
      .find((id) => !cerrados.has(id))
    const destino = destinoId ? POR_ID.get(destinoId) : undefined
    if (!destino) continue
    abajo.push(bajarA(avance, actual, destino, ahora))
    bajadas.push({ patron: avance.patron, desde: actual.id, hasta: destino.id })
  }
  return { avances: abajo, bajadas }
}

/**
 * La línea que explica una bajada por requisito, o null si los datos ya no
 * alcanzan para decirla (un eslabón o una cadena que dejó de existir).
 *
 * Una sola frase, en primera del plural porque la decisión fue de la app y no
 * de la persona: no hizo nada mal, la regla vieja la puso ahí. Dice adónde
 * bajó, qué la vuelve a abrir y por qué existe la regla. Sin barra suma la
 * barra, que es la otra mitad de lo que falta.
 */
export function avisoDeBajada(bajada: BajadaPorRequisito, tieneBarra: boolean): string | null {
  const requisito = REQUISITOS.get(bajada.desde)
  const pedido = requisito ? POR_ID.get(requisito.ejercicioId) : undefined
  const hasta = POR_ID.get(bajada.hasta)
  const cadena: string | undefined = NOMBRE_PATRON[bajada.patron]
  if (!requisito || !pedido || !hasta || !cadena) return null
  const falta = requisitoDicho(pedido, requisito.minimo)
  const cuando = tieneBarra
    ? `hasta que llegues a ${falta}`
    : `hasta que tengas una barra y llegues a ${falta}`
  return `Bajamos ${cadena.toLowerCase()} a ${hasta.nombre.toLowerCase()} ${cuando}: ${requisito.porque}.`
}

/**
 * Los avisos de la revisión que todavía hay que mostrar.
 *
 * Se muestran hasta la próxima sesión cerrada y después se callan solos. No
 * hace falta un "ya lo vio" guardado aparte: la fecha de la revisión y la de
 * las sesiones ya están en los datos, que es el mismo criterio con el que Hoy
 * ofrece el fuelle una sola vez. Y hasta entrenar es justo lo que sirve:
 * después, la sesión ya mostró dónde está.
 *
 * Y cada aviso, solo mientras la persona siga donde la bajamos. Antes de
 * entrenar la pueden mover dos cosas: apagar la barra en Ajustes, que baja lo
 * colgado al suelo, o volver a la palanca a mano desde la ficha. En los dos
 * casos "Bajamos core a elevación de piernas colgado" ya no es cierto, y sin
 * barra encima se contradice: diría que la puso en algo colgado hasta que
 * tenga una barra. Lo que hace falta para saberlo ya está en los avances.
 *
 * La revisión viene de la base, y una copia restaurada es un archivo que
 * cualquiera puede tocar: si `bajadas` no es una lista no hay nada que decir,
 * y Hoy no se cae por eso.
 */
export function avisosDeLaRevision(
  revision: RevisionDeRequisitos | undefined,
  sesiones: readonly Pick<Sesion, 'finalizadaEn'>[],
  avances: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId'>>,
  tieneBarra: boolean,
): string[] {
  if (!revision || !Array.isArray(revision.bajadas) || revision.bajadas.length === 0) return []
  if (sesiones.some((s) => s.finalizadaEn > revision.en)) return []
  return revision.bajadas.flatMap((bajada) => {
    if (!bajada || avances.get(bajada.patron)?.ejercicioId !== bajada.hasta) return []
    const aviso = avisoDeBajada(bajada, tieneBarra)
    return aviso ? [aviso] : []
  })
}

/**
 * El eslabón más alto en el que el alta puede ubicar a alguien con esta
 * prueba, o undefined si no hay techo.
 *
 * Una prueba del alta no abre tres cosas:
 *
 * - **Lo que cuelga, si la prueba no colgaba.** La plancha dice mucho del
 *   abdomen y nada de colgarse: 90 segundos ubicaban en "Elevación de piernas
 *   colgado", con barra o sin ella. Desde la plancha, el techo del core es el
 *   último eslabón que no cuelga. Las dominadas sí cuelgan, así que la cadena
 *   de tracción con barra queda como estaba.
 * - **Lo que cuelga, sin barra.** Hoy ninguna prueba sin barra cuelga, y se
 *   dice igual: es la regla que importa y no puede depender de eso.
 * - **Lo que tiene un requisito de otra cadena.** A la palanca frontal no se
 *   entra desde el alta: se llega con el motor, con las dominadas hechas.
 */
export function techoDeUbicacion(
  cadena: Cadena,
  pruebaId: string,
  tieneBarra: boolean,
): string | undefined {
  const pruebaCuelga = tieneBarra && NECESITAN_BARRA.has(pruebaId)
  const primeroCerrado = cadena.ejercicios.findIndex(
    (id) => REQUISITOS.has(id) || (NECESITAN_BARRA.has(id) && !pruebaCuelga),
  )
  if (primeroCerrado === -1) return undefined
  return cadena.ejercicios[Math.max(0, primeroCerrado - 1)]
}

/** Una respuesta del alta: con qué ejercicio se midió y cuánto salió. */
export interface PruebaDelAlta {
  patron: Patron
  ejercicioId: string
  logrado: number
}

/**
 * Los puntos de partida del alta, con los techos puestos.
 *
 * Vive acá y no en la pantalla para que el plan que el alta muestra y el que
 * se guarda salgan de la misma cuenta: el plan del alta es, literalmente, el
 * de mañana.
 */
export function ubicarDesdeElAlta(
  pruebas: PruebaDelAlta[],
  tieneBarra: boolean,
  ahora: number = Date.now(),
): Avance[] {
  return pruebas.map(({ patron, ejercicioId, logrado }) => {
    const cadena = cadenaDe(patron)
    const techo = techoDeUbicacion(cadena, ejercicioId, tieneBarra)
    return ubicarEnCadena(cadena, POR_ID, ejercicioId, logrado, ahora, techo)
  })
}
