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
import { CADENA_POR_PATRON, NOMBRE_PATRON, POR_ID } from './biblioteca'
import type {
  Cadena,
  ClaseDePaso,
  Ejercicio,
  Estado,
  Objetivo,
  PasoDelBorrador,
  Patron,
  Serie,
} from './tipos'

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
 *
 * `hoy` es el día de la sesión, que Entrenar fija al arrancar. `ahora` es el
 * día del reloj, y solo es otro cuando la sesión cruzó la medianoche: avisar
 * una molestia en ese rato la escribe en la fila del día nuevo
 * (`guardarMolestiaDeHoy`), y sin mirarla la sesión retomada pedía entera la
 * cadena que Hoy ya anunciaba bajada. La molestia es una señal de cómo está
 * el cuerpo ahora, no del día que se planificó.
 */
export function molestiasDeLaSesion(
  estados: readonly Estado[],
  hoy: string,
  delBorrador: readonly Patron[] = [],
  ahora: string = hoy,
): Set<Patron> {
  return new Set([
    ...molestiasDeHoy(estados, hoy),
    ...molestiasDeHoy(estados, ahora),
    ...delBorrador,
  ])
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

// ─── Los pasos de la reestructura: rutinas propias, mixes y cualquier cosa ───

/**
 * Qué se hace con los pasos fijos de una cadena con molestia.
 *
 * - `regla-del-plan`: la misma regla que el plan, que es la que va por
 *   defecto. Marcar la molestia ya fue el pedido: cargar igual la zona que
 *   avisó porque ese ejercicio lo eligió la persona sería ignorar lo último
 *   que pidió.
 * - `como-los-armaste`: los fijos quedan exactamente como estaban. Es
 *   "Dejarlo como lo armé", a un toque y solo para esa sesión. Los pasos de
 *   cadena y de volumen bajan igual: esos los pone el motor, no la persona.
 */
export type FijosConMolestia = 'regla-del-plan' | 'como-los-armaste'

/** Lo que la molestia le hizo a un paso, para decirlo en su línea. */
export interface CambioDelPaso {
  /** El id del paso; en un paso viejo sin id, el de su ejercicio. */
  paso: string
  /** La cadena con molestia que lo cambió. */
  patron: Patron
  cambio: CambioPorMolestia
  /** El ejercicio que tenía el paso. */
  de: string
  /** Adónde bajó. Solo con `baja`. */
  a?: string
  /**
   * Si era un paso fijo, de los que eligió la persona (o el mix, en una
   * variante o un accesorio). Es el que lleva "Dejarlo como lo armé"; los de
   * cadena y volumen se dicen con la línea de siempre (`lineaDeMolestia`).
   */
  fijo: boolean
}

export interface PasosConMolestia {
  /** Los pasos de la sesión, con lo bajado en su lugar y sin lo salteado. */
  pasos: PasoDelBorrador[]
  /** Lo que cambió, en el orden de los pasos. Vacío si no cambió nada. */
  cambios: CambioDelPaso[]
}

/**
 * La clase de un paso, también de un borrador viejo que no la guardaba.
 *
 * La misma deducción que `normalizarBorrador`, sin el avance: lo que traía
 * `bajada` es volumen, lo que traía `fijo` es fijo, y el resto es el eslabón
 * del motor. En el plan de antes, todo lo que no era el eslabón (la bajada,
 * el volumen, los accesorios) iba con `bajada`.
 */
function claseDelPaso(paso: PasoDelBorrador): ClaseDePaso {
  return paso.clase ?? (paso.bajada ? 'volumen' : paso.fijo ? 'fijo' : 'cadena')
}

/** La molestia como conjunto, venga como venga: una cadena, varias o ninguna. */
function comoConjunto(molestia: Patron | Iterable<Patron> | null | undefined): ReadonlySet<Patron> {
  if (!molestia) return new Set()
  if (typeof molestia === 'string') return new Set([molestia])
  return new Set(molestia)
}

/**
 * La regla del plan, aplicada a un ejercicio que eligió alguien y no el motor.
 *
 * Devuelve `null` si el ejercicio no carga ninguna cadena con molestia: el
 * paso queda como estaba.
 *
 * - **Un eslabón de su cadena** baja al anterior, como el del motor
 *   (`bajadaDe`); en el primero no hay dónde bajar y se saltea.
 * - **Una variante** baja al eslabón `equivale.nivel − 1` de su cadena. No hay
 *   otra forma: `bajadaDe` busca el ejercicio en la cadena, y una variante no
 *   está en ninguna. La de nivel 1 no tiene dónde bajar y se saltea.
 * - **Un accesorio, o algo con barra con discos**, se saltea: es carga extra
 *   sobre la misma zona, igual que en el plan.
 *
 * Lo bajado va como en el plan: dos series al piso de la ventana del eslabón
 * de abajo, sin kilos.
 */
function fijoConMolestia(
  ejercicio: Ejercicio,
  objetivo: Objetivo,
  molestias: ReadonlySet<Patron>,
  ejercicios: Map<string, Ejercicio>,
):
  | { patron: Patron; cambio: 'saltea' }
  | { patron: Patron; cambio: 'baja'; ejercicio: Ejercicio; objetivo: Objetivo }
  | null {
  const equivale = ejercicio.equivale
  const patron = molestias.has(ejercicio.patron)
    ? ejercicio.patron
    : equivale && molestias.has(equivale.patron)
      ? equivale.patron
      : null
  if (!patron) return null

  const bajado = (abajo: Ejercicio) => ({
    patron,
    cambio: 'baja' as const,
    ejercicio: abajo,
    objetivo: {
      series: Math.min(SERIES_CON_MOLESTIA, objetivo.series),
      cantidad: abajo.ventana.min,
    },
  })

  if (ejercicio.accesorio) return { patron, cambio: 'saltea' }

  const suCadena = CADENA_POR_PATRON.get(ejercicio.patron)
  if (suCadena?.ejercicios.includes(ejercicio.id)) {
    const abajo = bajadaDe(ejercicio, suCadena, ejercicios)
    return abajo ? bajado(abajo.ejercicio) : { patron, cambio: 'saltea' }
  }

  if (equivale) {
    // `nivel` cuenta desde 1 y el arreglo desde 0: el eslabón `nivel − 1`
    // está en la posición `nivel − 2`.
    const id = CADENA_POR_PATRON.get(equivale.patron)?.ejercicios[equivale.nivel - 2]
    const abajo = id === undefined ? undefined : ejercicios.get(id)
    return abajo ? bajado(abajo) : { patron, cambio: 'saltea' }
  }

  return { patron, cambio: 'saltea' }
}

/**
 * Los pasos de una sesión armada con pasos, con la molestia aplicada.
 *
 * Es lo mismo que `bloqueConMolestia` hace con los bloques del plan, para lo
 * que ahora se puede empezar: una rutina tuya, un mix, un ejercicio solo o lo
 * que falta de una sesión en curso ("Me molesta algo" en la hoja La sesión).
 *
 * - **Los pasos `cadena`** pasan por `bloqueConMolestia`, como hoy: bajan un
 *   eslabón o, en el primero, se saltean. Lo bajado se guarda como volumen
 *   (`bajada`), que es lo que es: un eslabón más fácil que no lee la cadena.
 * - **Los de `volumen`** se saltean, como en el plan: ya son el eslabón de
 *   abajo, y dejarlos sería cargar dos veces lo que tenía que bajar una.
 * - **Los fijos**, también la entrada en calor, reciben por defecto la regla
 *   del plan (`fijoConMolestia`); con `fijos: 'como-los-armaste'` quedan
 *   como estaban. Lo bajado lleva `bajada` además de su `fijo`: un eslabón de
 *   abajo con dos series al piso no puede hundir la curva de fuerza.
 * - **La movilidad**, un id que no está en el catálogo y lo que ya tiene
 *   series anotadas quedan como estaban. Cambiar a mitad de camino algo que ya
 *   empezó dejaría esas series fuera de lo que se guarda.
 *
 * Recibe los pasos como salieron de la rutina o del mix, sin la molestia
 * aplicada, igual que `bloqueConMolestia` recibe el bloque del motor: pasados
 * dos veces bajarían dos eslabones. Por eso la sesión guarda las molestias con
 * las que se armó (`SesionEnCurso.molestias`) y el plan se vuelve a armar
 * desde lo que se eligió, no desde lo que ya bajó.
 *
 * `hechas` es lo anotado en la sesión, por id de paso (o de ejercicio, en un
 * borrador viejo). Pura: no toca los pasos que recibe.
 */
export function pasosConMolestia(
  pasos: readonly PasoDelBorrador[],
  molestia: Patron | Iterable<Patron> | null | undefined,
  opciones: {
    fijos?: FijosConMolestia
    hechas?: Readonly<Record<string, readonly Serie[]>>
    ejercicios?: Map<string, Ejercicio>
  } = {},
): PasosConMolestia {
  const molestias = comoConjunto(molestia)
  const { fijos = 'regla-del-plan', hechas = {}, ejercicios = POR_ID } = opciones
  const quedan: PasoDelBorrador[] = []
  const cambios: CambioDelPaso[] = []

  for (const paso of pasos) {
    const clave = paso.id ?? paso.ejercicioId
    const ejercicio = ejercicios.get(paso.ejercicioId)
    const clase = claseDelPaso(paso)
    const yaEmpezado = (hechas[clave]?.length ?? 0) > 0
    if (molestias.size === 0 || !ejercicio || clase === 'movilidad' || yaEmpezado) {
      quedan.push(paso)
      continue
    }

    if (clase === 'cadena' || clase === 'volumen') {
      const cadena = CADENA_POR_PATRON.get(ejercicio.patron)
      if (!cadena) {
        quedan.push(paso)
        continue
      }
      const hoy = bloqueConMolestia(
        { ejercicio, objetivo: paso.objetivo, accesorio: clase === 'volumen' },
        molestias,
        ejercicios,
        cadena,
      )
      if (hoy.cambio === null) {
        quedan.push(paso)
        continue
      }
      const base = { paso: clave, patron: cadena.patron, de: ejercicio.id, fijo: false }
      if (hoy.cambio === 'saltea') {
        cambios.push({ ...base, cambio: 'saltea' })
        continue
      }
      quedan.push({
        ...paso,
        ejercicioId: hoy.ejercicio.id,
        objetivo: hoy.objetivo,
        bajada: true,
        clase: 'volumen',
      })
      cambios.push({ ...base, cambio: 'baja', a: hoy.ejercicio.id })
      continue
    }

    if (fijos === 'como-los-armaste') {
      quedan.push(paso)
      continue
    }
    const hoy = fijoConMolestia(ejercicio, paso.objetivo, molestias, ejercicios)
    if (!hoy) {
      quedan.push(paso)
      continue
    }
    const base = { paso: clave, patron: hoy.patron, de: ejercicio.id, fijo: true }
    if (hoy.cambio === 'saltea') {
      cambios.push({ ...base, cambio: 'saltea' })
      continue
    }
    quedan.push({ ...paso, ejercicioId: hoy.ejercicio.id, objetivo: hoy.objetivo, bajada: true })
    cambios.push({ ...base, cambio: 'baja', a: hoy.ejercicio.id })
  }

  return { pasos: quedan, cambios }
}
