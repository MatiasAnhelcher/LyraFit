/**
 * El día: qué se hizo hoy, a qué hora, y qué le queda a Hoy por proponer.
 *
 * Hasta acá Hoy tenía un booleano, `entrenoHoy`, y de ahí salía todo: el
 * "YA ENTRENASTE HOY", "Entrenar otra vez" y la frase de Lyra. Con varias
 * sesiones por día y con la libertad de empezar cualquier cosa, un booleano
 * miente de las dos maneras: un tabata daba el día por entrenado, y un mix de
 * Brazos daba el plan por hecho. Acá se separan las tres preguntas que ese
 * booleano mezclaba (§4.2 de la reestructura):
 *
 * - **`fuerzaHoy`**: si hoy hubo una sesión de fuerza, venga de donde venga.
 * - **`planDeHoyHecho`**: si hoy se hizo el plan, y solo el plan.
 * - **`planPendiente`**: si el plan de hoy sigue esperando, aunque se haya
 *   hecho otra cosa.
 *
 * Y se dice qué hubo en el día con la hora de cada sesión (`inicioDe`), sus
 * zonas con el mismo número que el mapa (`resumenDelDia`) y lo que Entrenar
 * sugiere (`sugerenciasDeHoy`).
 *
 * Todo es puro: el día llega como argumento, en AAAA-MM-DD local, y nada mira
 * el reloj. Ningún texto para la persona sale de acá, salvo los nombres que
 * `origenDe` les pone a las sesiones viejas: las líneas están en `lineas.ts`.
 */

import { cuentaComoSesion, esMovilidad } from './adherencia'
import { fechaDelDia } from './borrador'
import { claseDeDia, semanaActiva } from './rutinas'
import {
  ZONAS,
  seriesDeZona,
  sugerirZona,
  ultimaVezDeZona,
  zonaSinSeries,
  type MixConTrabajo,
  type Zona,
} from './sectores'
import type {
  Equipo,
  OrigenDeSesion,
  Preferencias,
  RegistroEjercicio,
  Semana,
  Sector,
  Sesion,
} from './tipos'

// Están en `adherencia.ts`, que las necesita para contar y que las zonas ya
// importan: definirlas acá cerraría el ciclo dia → sectores → adherencia → dia.
// Se exportan también desde acá porque la especificación las pone en el día.
export { cuentaComoSesion, esMovilidad } from './adherencia'

// ─── De dónde salió y a qué hora empezó ─────────────────────────────────

/**
 * De dónde salió una sesión: el origen guardado o, en una vieja, el deducido.
 *
 * Las sesiones de antes de la reestructura no guardaron origen, y no se les
 * escribe uno: se deduce cada vez que se leen (§5.4), con lo único que esas
 * sesiones sabían de sí mismas, el `tipo`.
 *
 * - `reloj` es el Reloj de RÁPIDAS.
 * - `corta` es "Solo tengo 7 minutos", con el mismo nombre que le pone el
 *   borrador viejo (`origenDelBorrador`).
 * - `fuelle` era el día de fuelle del plan, y `plan` y `vuelta` eran el plan:
 *   las tres son el plan, con el nombre "Plan". El nombre de la rutina de ese
 *   día no se sabe, y poner el de la de hoy sería inventarlo.
 */
export function origenDe(sesion: Pick<Sesion, 'origen' | 'tipo'>): OrigenDeSesion {
  if (sesion.origen) return sesion.origen
  if (sesion.tipo === 'reloj') return { clase: 'rapida', cual: 'reloj', nombre: 'Reloj' }
  if (sesion.tipo === 'corta') {
    return { clase: 'rapida', cual: 'corta', nombre: 'Solo tengo 7 minutos' }
  }
  return { clase: 'plan', nombre: 'Plan' }
}

/** La hora que se muestra de una sesión, y si es la de cierre. */
export interface InicioDeSesion {
  /** El instante, en milisegundos. Se dice con `horaDicha`. */
  hora: number
  /**
   * Si `hora` es la de cierre y no la de inicio: una sesión vieja, que no
   * guardó cuándo empezó. Se rotula como tal ("CERRADA A LAS 9:34") para que
   * no se lea como la hora de arranque.
   */
  esDeCierre: boolean
}

/**
 * A qué hora empezó una sesión, para Tu día, La sesión y la lista de TU DÍA.
 *
 * Con `iniciadaEn`, esa: la primera serie anotada. Sin ella, la de cierre,
 * marcada (`esDeCierre`). Nunca `finalizadaEn` menos la duración: al retomar
 * una sesión la duración se re-ancla, y la resta daría una hora en la que no
 * empezó nada (§5.4).
 *
 * Un `iniciadaEn` posterior al cierre no es una hora de inicio posible (un
 * reloj del teléfono que se corrió, una copia tocada a mano): se muestra la de
 * cierre, que es la única que se sabe cierta.
 */
export function inicioDe(sesion: Pick<Sesion, 'iniciadaEn' | 'finalizadaEn'>): InicioDeSesion {
  const { iniciadaEn, finalizadaEn } = sesion
  if (typeof iniciadaEn === 'number' && Number.isFinite(iniciadaEn) && iniciadaEn <= finalizadaEn) {
    return { hora: iniciadaEn, esDeCierre: false }
  }
  return { hora: finalizadaEn, esDeCierre: true }
}

// ─── Las sesiones del día ───────────────────────────────────────────────

/**
 * Las sesiones de un día, en el orden en que empezaron.
 *
 * El día es el de la sesión (`fecha`) y no el del cierre: una que arrancó a
 * las 23:40 y cerró a las 00:05 es del día en que se entrenó, igual que una
 * vencida que se guardó a la mañana siguiente. Es el mismo criterio que
 * `sesionesDelDia` del repositorio, que las pide por el índice `fecha`.
 *
 * Trae también la movilidad: tiene su fila en Tu día y en TU DÍA, con su hora,
 * aunque no cuente como sesión (`cuentaDelDia` la nombra aparte). El orden es
 * el de la hora que se muestra, así la lista de horas nunca sale desordenada;
 * con la misma hora desempata el cierre y después el id, para que dos
 * pantallas no las pongan en distinto orden.
 */
export function sesionesDelDia(historial: readonly Sesion[], dia: string): Sesion[] {
  return historial
    .filter((s) => s.fecha === dia)
    .sort(
      (a, b) =>
        inicioDe(a).hora - inicioDe(b).hora ||
        a.finalizadaEn - b.finalizadaEn ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
}

/** Cuántas sesiones tuvo un día, y cuántas movilidades aparte. */
export interface CuentaDelDia {
  /** Las que cuentan como sesión (`cuentaComoSesion`). */
  sesiones: number
  /** Las movilidades, que se nombran aparte y no cuentan como sesión. */
  movilidades: number
}

/**
 * Cuántas sesiones hubo en un día, con la movilidad aparte.
 *
 * Es lo que dicen la glosa de Tu día ("2 sesiones y una movilidad") y el
 * encabezado de TU DÍA ("TU DÍA · 2 SESIONES · MOVILIDAD"): la movilidad tiene
 * su fila y su hora, pero no es una sesión más (§4.3).
 */
export function cuentaDelDia(historial: readonly Sesion[], dia: string): CuentaDelDia {
  let sesiones = 0
  let movilidades = 0
  for (const s of historial) {
    if (s.fecha !== dia) continue
    if (cuentaComoSesion(s)) sesiones++
    else movilidades++
  }
  return { sesiones, movilidades }
}

// ─── Por zona ───────────────────────────────────────────────────────────

/** Una zona trabajada en el día, con sus series. */
export interface ZonaDelDia {
  zona: Zona
  /**
   * Las de `seriesDeZona` para ese día solo: el principal más cargado, sin
   * redondear. Se redondean al mostrarlas, como en Progreso.
   */
  series: number
}

/**
 * El día por zona: POR ZONA de Tu día y el resumen del Cierre ("Hoy, por zona:
 * Espalda 14 · Pecho 9").
 *
 * Cada número sale de `seriesDeZona` con una ventana de un día y no de una
 * cuenta propia: así Tu día, el Cierre, el mapa y Progreso dicen la misma
 * cifra para la misma zona (Decisión 27). Tampoco hay que sacar nada antes: la
 * movilidad y la entrada en calor ya las deja afuera `seriesDeZona`.
 *
 * Van de la más trabajada a la menos, y en un empate en el orden de las zonas.
 * Una zona en cero no aparece: es el dato de lo que se hizo, y nombrar lo que
 * no se hizo es justo lo que no se hace (§7.1). No hay total: el día se
 * cuenta por zona.
 */
export function resumenDelDia(historial: Sesion[], dia: string): ZonaDelDia[] {
  return ZONAS.map((zona) => ({ zona, series: seriesDeZona(zona, historial, dia, 1) }))
    .filter((z) => z.series > 0)
    .sort((a, b) => b.series - a.series)
}

/**
 * Desde qué sesión del día el Cierre suma el resumen por zona: la tercera que
 * cuenta (§5.6 C, disparador D). No desde la segunda y sin total, como lo
 * pidió el rol 10: la cantidad no se celebra (Decisión 24, §7.1).
 */
export const SESIONES_PARA_EL_RESUMEN = 3

/**
 * El resumen por zona del Cierre, o `null` si no va.
 *
 * Va desde la tercera sesión del día que cuenta, la movilidad afuera, y solo
 * si alguna zona tiene series: tres sesiones de ráfagas no tienen nada que
 * decir por zona, y "Hoy, por zona:" sin zonas sería un rótulo vacío.
 * `historial` ya trae la sesión que se está cerrando.
 *
 * **El Cierre de una movilidad no lo lleva** (§4.15): la movilidad no cuenta,
 * así que no es la tercera de nada. Contar las del día no alcanza para
 * saberlo, porque una movilidad después de tres sesiones encuentra tres; por
 * eso se recibe `cerrada`, la sesión que se está cerrando.
 */
export function resumenDelCierre(
  historial: Sesion[],
  dia: string,
  cerrada: Pick<Sesion, 'origen'>,
): ZonaDelDia[] | null {
  if (!cuentaComoSesion(cerrada)) return null
  if (cuentaDelDia(historial, dia).sesiones < SESIONES_PARA_EL_RESUMEN) return null
  const zonas = resumenDelDia(historial, dia)
  return zonas.length > 0 ? zonas : null
}

// ─── El estado de Hoy ───────────────────────────────────────────────────

/**
 * Si un registro es trabajo de fuerza: anotado, con algo hecho, y que no sea
 * del Reloj ni de la entrada en calor. Un id que ya no está en la biblioteca
 * sigue siendo fuerza: el ejercicio se retiró, la sesión no.
 */
function esRegistroDeFuerza(registro: RegistroEjercicio): boolean {
  return (
    !registro.reloj && !registro.calentamiento && registro.series.some((s) => s.logrado > 0)
  )
}

/**
 * Si una sesión es de fuerza, para el estado de Hoy.
 *
 * Tiene que traer registros de fuerza y no ser del Reloj ni una movilidad.
 * Un tabata trae registros (las vueltas de flexiones) pero es del Reloj; una
 * movilidad y un fuelle de RÁPIDAS no traen ninguno. El fuelle de RÁPIDAS se
 * deja afuera también por el origen, para que no dependa de cómo guarde sus
 * ráfagas. Un mix, una rutina, "Solo tengo 7 minutos" o una sesión vieja sin
 * origen sí: son fuerza, vengan de donde vengan.
 */
export function esDeFuerza(sesion: Sesion): boolean {
  if (sesion.tipo === 'reloj' || esMovilidad(sesion)) return false
  const origen = origenDe(sesion)
  if (origen.clase === 'rapida' && (origen.cual === 'reloj' || origen.cual === 'fuelle')) {
    return false
  }
  return sesion.registros.some(esRegistroDeFuerza)
}

/**
 * Si hoy hubo una sesión de fuerza, de cualquier origen (§4.2).
 *
 * Es lo que hace que Hoy no empuje una segunda sesión: después de un mix de
 * Brazos, Hoy pasa al estado B. Un tabata, una movilidad o un fuelle de
 * RÁPIDAS no la cumplen, y eso arregla el "YA ENTRENASTE HOY" que salía
 * después de un tabata.
 */
export function fuerzaHoy(historial: readonly Sesion[], dia: string): boolean {
  return historial.some((s) => s.fecha === dia && esDeFuerza(s))
}

/**
 * Si hoy se hizo el plan: una sesión con origen `plan` (§4.2).
 *
 * Solo el plan. Un mix, una rutina propia o un ejercicio solo pueden leer las
 * mismas cadenas, pero no son lo que el plan de hoy proponía, y darlo por
 * hecho escondería EL PLAN DE HOY de Entrenar. El día de fuelle del plan se
 * guarda con origen `plan`, así que también lo cumple, y una sesión vieja sin
 * origen cuenta como el plan que era (`origenDe`). La versión liviana del plan
 * también es el plan: se hizo lo que tocaba, con menos.
 */
export function planDeHoyHecho(historial: readonly Sesion[], dia: string): boolean {
  return historial.some((s) => s.fecha === dia && origenDe(s).clase === 'plan')
}

/**
 * La semana del plan, o `null` si la persona eligió entrenar sin plan
 * (`modoPlan: 'libre'`).
 *
 * Es la forma en que las funciones del día reciben "sin plan": un `null` y no
 * una semana vacía, porque una semana toda de descanso es un plan (raro, pero
 * plan) y sin plan es otra cosa.
 */
export function planSemanal(
  preferencias: Pick<Preferencias, 'modoPlan' | 'rutinaActivaId' | 'semana'>,
): Semana | null {
  return preferencias.modoPlan === 'libre' ? null : semanaActiva(preferencias)
}

/**
 * Si el plan de hoy sigue esperando: hay plan semanal, hoy toca algo (fuerza,
 * las dos cosas o fuelle) y todavía no se hizo (§4.2).
 *
 * **No mira `fuerzaHoy`**, a propósito: después de un mix de Brazos el plan
 * sigue pendiente, y Entrenar lo ofrece primero en PARA VOS HOY aunque Hoy ya
 * esté en el estado B. Lo recomendado no se esconde por haber hecho otra cosa
 * (Decisión 22). En un día de descanso no hay nada pendiente, y sin plan
 * (`semana` en `null`) tampoco: no hay plan que esperar.
 */
export function planPendiente(
  semana: Semana | null,
  historial: readonly Sesion[],
  dia: string,
): boolean {
  if (semana === null) return false
  if (claseDeDia(semana, fechaDelDia(dia)) === 'descanso') return false
  return !planDeHoyHecho(historial, dia)
}

/** Lo que Hoy muestra arriba. */
export interface EstadoDeHoy {
  /**
   * - `A`: hay algo que Hoy te propone, con Empezar en menta. Con plan, el plan
   *   pendiente; sin plan, la sugerencia de `sugerirZona`.
   * - `B`: no hay nada que proponer. Un botón quieto que lleva a Entrenar.
   */
  estado: 'A' | 'B'
  /** Si es día de descanso del plan: "HOY TOCA DESCANSO EN TU PLAN". */
  descanso: boolean
}

/**
 * El estado de Hoy, con las tres funciones de arriba (§4.2).
 *
 * - **A**: el plan pendiente y nada de fuerza hoy; o, sin plan, nada de
 *   fuerza hoy.
 * - **B**: lo demás: hubo fuerza (con plan o sin plan), el plan está hecho, o
 *   es un día de descanso del plan.
 *
 * Que el plan siga pendiente después de otra cosa no lo vuelve A: Hoy no
 * empuja una segunda sesión, y el plan está en Entrenar, a dos toques.
 */
export function estadoDeHoy(
  semana: Semana | null,
  historial: readonly Sesion[],
  dia: string,
): EstadoDeHoy {
  const descanso = semana !== null && claseDeDia(semana, fechaDelDia(dia)) === 'descanso'
  const propone = semana === null || planPendiente(semana, historial, dia)
  return { estado: propone && !fuerzaHoy(historial, dia) ? 'A' : 'B', descanso }
}

// ─── Lo que Entrenar sugiere ────────────────────────────────────────────

/** La última vez que se trabajó una zona, como la da `ultimaVezDeZona`. */
export type UltimaVez = NonNullable<ReturnType<typeof ultimaVezDeZona>>

/**
 * Una tarjeta de PARA VOS HOY. Lleva el dato y no el texto: el rótulo y la
 * línea los arma la pantalla con `lineas.ts`.
 *
 * - `plan`: EL PLAN DE HOY.
 * - `para-hoy`: sin plan, el mix de `sugerirZona` con el rótulo PARA HOY. El
 *   primer día es `cuerpo`, PARA ARRANCAR, y no tiene última vez.
 * - `otra-zona`: OTRA ZONA, con su última vez.
 * - `repetir`: REPETIR, la última sesión antes de hoy.
 * - `movilidad`: MOVILIDAD de la zona más trabajada hoy.
 *
 * Las dos que llevan `ultimaVez` llevan también `sinSeries`, porque un
 * `ultimaVez` en `null` no dice "nunca": dice que ningún día llegó a ser un
 * día de esa zona. Con 1,5 series de hombro de adelante por unas flexiones
 * no hay última vez de Hombros, pero "no hay sesiones anotadas todavía"
 * sería falso. Esa frase va solo con `sinSeries` (`zonaSinSeries`: ni media
 * serie en la zona, nunca); con `ultimaVez` en `null` y `sinSeries` en
 * `false` no hay nada verdadero que decir de la última vez, y no se dice
 * nada. Con una última vez, `sinSeries` es siempre `false`.
 */
export type Sugerencia =
  | { clase: 'plan' }
  | { clase: 'para-hoy'; sector: Sector; ultimaVez: UltimaVez | null; sinSeries: boolean }
  | { clase: 'otra-zona'; sector: Zona; ultimaVez: UltimaVez | null; sinSeries: boolean }
  | { clase: 'repetir'; sesion: Sesion }
  | { clase: 'movilidad'; sector: Zona }

/** Cuántas tarjetas lleva PARA VOS HOY como mucho. */
export const TOPE_DE_SUGERENCIAS = 3

/**
 * Si una sesión se puede repetir desde La sesión o desde REPETIR.
 *
 * Las del Reloj y las del fuelle de RÁPIDAS no: se repiten desde RÁPIDAS, que
 * es donde se elige el formato (§4.4). Todo lo demás sí, también una vieja sin
 * origen y "Solo tengo 7 minutos".
 */
export function sePuedeRepetir(sesion: Sesion): boolean {
  const origen = origenDe(sesion)
  return !(origen.clase === 'rapida' && (origen.cual === 'reloj' || origen.cual === 'fuelle'))
}

/**
 * El mix que empieza una tarjeta, con su versión, o `null` si no empieza un
 * mix. PARA HOY y OTRA ZONA empiezan Completo; REPETIR, la versión que tuvo,
 * porque repetir un mix es `?mix=` con su versión (§5.6 G).
 */
function mixDeLaTarjeta(
  sugerencia: Sugerencia,
): Pick<Extract<OrigenDeSesion, { clase: 'mix' }>, 'sector' | 'version'> | null {
  if (sugerencia.clase === 'para-hoy' || sugerencia.clase === 'otra-zona') {
    return { sector: sugerencia.sector, version: 'completa' }
  }
  if (sugerencia.clase === 'repetir') {
    const origen = origenDe(sugerencia.sesion)
    return origen.clase === 'mix' ? origen : null
  }
  return null
}

/** Lo que lleva la tarjeta de un mix de zona: su última vez y si la zona tiene alguna serie. */
function conLaUltimaVez(
  sector: Sector,
  historial: Sesion[],
): { ultimaVez: UltimaVez | null; sinSeries: boolean } {
  return {
    ultimaVez: sector === 'cuerpo' ? null : ultimaVezDeZona(sector, historial),
    sinSeries: zonaSinSeries(sector, historial),
  }
}

/**
 * PARA VOS HOY: hasta tres tarjetas, en este orden y sin repetir (§4.5).
 *
 * 1. **EL PLAN DE HOY**, mientras `planPendiente`: está aunque Hoy haya pasado
 *    al estado B por otra cosa, y se va recién cuando se hace el plan. Sin
 *    plan, en su lugar va **PARA HOY**, el mix de `sugerirZona`, mientras
 *    `fuerzaHoy` sea falso: es la misma propuesta que hace Hoy.
 * 2. **OTRA ZONA**, la de `sugerirZona` sin la de la primera tarjeta. No va el
 *    primer día: sin nada hecho, todas las zonas empatan en cero y el
 *    desempate no es un dato sobre nadie.
 * 3. **REPETIR**, la última sesión **anterior a hoy** que cuenta y se puede
 *    repetir. Lo de hoy no se propone repetir (Hoy tampoco lo hace): está en
 *    el ⋯ de cada fila y en La sesión.
 * 4. **MOVILIDAD** de la zona más trabajada hoy, si hoy hubo una sesión con
 *    series en alguna zona, y si esa movilidad no se hizo ya hoy.
 *
 * Una tarjeta sin dato real no aparece, y una que empezaría lo mismo que otra
 * de más arriba tampoco: repetir ayer el mix de Glúteos y la OTRA ZONA Glúteos
 * son la misma sesión, y se queda la de más arriba. Con las cuatro, la cuarta
 * no entra: tres es el tope.
 *
 * **Ninguna empieza un mix vacío.** PARA HOY, OTRA ZONA y un REPETIR de un
 * mix van solo si ese mix, armado hoy para esta persona, tiene trabajo
 * (`conTrabajo`): en el eslabón 1, el de Hombros o el de Brazos puede ser la
 * entrada sola, y proponérselo a alguien que empieza sería darle una sesión
 * sin nada que hacer. `conTrabajo` llega armado (`mixesConTrabajo`, en
 * `mixes.ts`) porque este archivo no puede importar `resolverMix`: `mixes.ts`
 * llega acá por `progresion.ts` y `lineas.ts`, y sería un ciclo.
 */
export function sugerenciasDeHoy(entrada: {
  historial: Sesion[]
  /** El día de hoy, AAAA-MM-DD local. */
  hoy: string
  /** La semana del plan, o `null` sin plan (`planSemanal`). */
  semana: Semana | null
  /** "Con lo que tengo" (`equipoDe`): decide qué zonas se pueden armar. */
  equipo: readonly Equipo[] | ReadonlySet<Equipo>
  /**
   * Si el mix de un sector tiene trabajo hoy, de `mixesConTrabajo` con los
   * avances, el equipo, el historial, el día, la rutina activa y las
   * molestias de esta persona.
   */
  conTrabajo: MixConTrabajo
}): Sugerencia[] {
  const { historial, hoy, semana, equipo, conTrabajo } = entrada
  const tarjetas: Sugerencia[] = []
  const sectores = new Set<Sector>()
  const sumar = (tarjeta: Sugerencia) => {
    const mix = mixDeLaTarjeta(tarjeta)
    if (mix !== null && (sectores.has(mix.sector) || !conTrabajo(mix.sector, mix.version))) return
    if (mix !== null) sectores.add(mix.sector)
    tarjetas.push(tarjeta)
  }

  // 1. El plan, o sin plan la sugerencia de Hoy.
  if (semana !== null) {
    if (planPendiente(semana, historial, hoy)) sumar({ clase: 'plan' })
  } else if (!fuerzaHoy(historial, hoy)) {
    const sector = sugerirZona(historial, hoy, equipo, undefined, conTrabajo)
    sumar({ clase: 'para-hoy', sector, ...conLaUltimaVez(sector, historial) })
  }

  // 2. Otra zona, salvo el primer día. `sugerirZona` da `cuerpo` solo el
  //    primer día o sin ninguna zona armable con trabajo, y ninguno de los
  //    dos casos es "otra zona".
  const primerDia = !historial.some((s) => s.fecha <= hoy && cuentaComoSesion(s))
  if (!primerDia) {
    const primera = tarjetas[0]
    const excepto = primera?.clase === 'para-hoy' ? primera.sector : undefined
    const otra = sugerirZona(historial, hoy, equipo, excepto, conTrabajo)
    if (otra !== 'cuerpo') sumar({ clase: 'otra-zona', sector: otra, ...conLaUltimaVez(otra, historial) })
  }

  // 3. La última antes de hoy. Por día y, dentro del día, por la hora de
  //    inicio: la que se ve última en la lista de ese día.
  const anterior = historial
    .filter((s) => s.fecha < hoy && cuentaComoSesion(s) && sePuedeRepetir(s))
    .sort(
      (a, b) =>
        (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0) ||
        inicioDe(b).hora - inicioDe(a).hora ||
        b.finalizadaEn - a.finalizadaEn,
    )[0]
  if (anterior) sumar({ clase: 'repetir', sesion: anterior })

  // 4. La movilidad de lo más trabajado hoy, si todavía no se hizo.
  const masTrabajada = resumenDelDia(historial, hoy)[0]
  if (masTrabajada && !movilidadHechaHoy(historial, hoy, masTrabajada.zona)) {
    sumar({ clase: 'movilidad', sector: masTrabajada.zona })
  }

  return tarjetas.slice(0, TOPE_DE_SUGERENCIAS)
}

/** Si hoy ya se hizo la movilidad de esa zona. */
function movilidadHechaHoy(historial: readonly Sesion[], hoy: string, zona: Zona): boolean {
  return historial.some(
    (s) => s.fecha === hoy && s.origen?.clase === 'movilidad' && s.origen.sector === zona,
  )
}
