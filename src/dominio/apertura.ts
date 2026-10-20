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
 */

import type { Avance, Cadena, Ejercicio, Patron } from './tipos'
import { POR_ID, REQUISITOS, cadenaDe } from './biblioteca'
import { NECESITAN_BARRA } from './musculos'
import { ubicarEnCadena, type Cierre } from './progresion'

/** ¿Llegó la persona, en esa cadena, al eslabón que pide el requisito? */
function llego(avances: ReadonlyMap<Patron, Avance>, patron: Patron, ejercicioId: string): boolean {
  const avance = avances.get(patron)
  if (!avance) return false
  const cadena = cadenaDe(patron).ejercicios
  const donde = cadena.indexOf(avance.ejercicioId)
  const pedido = cadena.indexOf(ejercicioId)
  return donde !== -1 && pedido !== -1 && donde >= pedido
}

/**
 * Los eslabones de esta cadena a los que el motor no puede subir todavía, y
 * por qué.
 *
 * Sin barra se cierra todo lo que cuelga, y ese motivo va primero: a quien no
 * tiene de dónde colgarse, decirle que le faltan dominadas no le sirve de
 * nada. Con barra, lo que tiene un requisito se abre cuando la persona llegó a
 * ese eslabón de la otra cadena. Llegar alcanza: es el momento en que el motor
 * ya la dio por lista para hacerlo.
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
    if (!requisito || llego(avances, requisito.patron, requisito.ejercicioId)) continue
    const ejercicio = POR_ID.get(requisito.ejercicioId)
    if (ejercicio) cerrados.set(id, { motivo: 'requisito', requisito: ejercicio })
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
