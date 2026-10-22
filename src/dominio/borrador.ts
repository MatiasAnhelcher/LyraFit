/**
 * El borrador: la sesión a medio hacer, y qué se hace con ella.
 *
 * Vive en el dominio porque las tres preguntas que lo gobiernan son reglas y
 * no plomería: de qué día es la sesión, si todavía se retoma o ya hay que
 * preguntarle a la persona, y qué se guarda cuando dice "Guardarla". Antes las
 * tres estaban repartidas entre la base y la pantalla, y las tres perdían
 * trabajo en silencio:
 *
 * - **El día se recalculaba con el reloj.** Una sesión que arrancó el
 *   miércoles a las 23:40 y se retomó a las 00:05 rearmaba el plan del
 *   jueves: cambiaba el bloque que alterna piernas y bisagra, y las series ya
 *   hechas quedaban afuera de la sesión guardada. `arrancadaEn` no alcanza
 *   para saber el día, porque al retomar se re-ancla a lo entrenado.
 * - **El vencido se borraba sin mostrarse.** Seis horas sin tocar "Cerrar la
 *   sesión" y la sesión entera desaparecía la próxima vez que se abría
 *   Entrenar, aunque tuviera doce series.
 * - **Lo que se guarda salía del plan del momento**, así que una sesión de
 *   ayer no se podía guardar hoy sin rearmar un plan que ya no es el mismo.
 */

import { diasEntre, esVuelta } from './adherencia'
import { NOMBRE_DIA, diaDeLaSemana } from './rutinas'
import type {
  Avance,
  ClaseDePaso,
  Objetivo,
  OrigenDeSesion,
  PasoDelBorrador,
  RegistroEjercicio,
  RegistroRafaga,
  Serie,
  Sesion,
  SesionEnCurso,
  TipoSesion,
} from './tipos'

/**
 * Cuánto vale un borrador antes de dejar de retomarse solo.
 *
 * Seis horas cubre cualquier sesión real con sus interrupciones. Más que eso y
 * lo que se restauraría ya no es "la sesión de la que me sacó un llamado": es
 * la de ayer, y retomarla en silencio sería anotar series nuevas encima de una
 * sesión vieja. Pero vencer no es perderse: un borrador vencido con trabajo
 * adentro se le muestra a la persona, que decide si guardarlo o descartarlo.
 */
export const VIGENCIA_DEL_BORRADOR = 6 * 60 * 60 * 1000

const dd = (n: number) => String(n).padStart(2, '0')

/** El día local de un instante, en AAAA-MM-DD. Nunca el de UTC. */
export function diaLocal(instante: number): string {
  const f = new Date(instante)
  return `${f.getFullYear()}-${dd(f.getMonth() + 1)}-${dd(f.getDate())}`
}

/** Si un texto es un día AAAA-MM-DD que existe en el calendario. */
export function esDiaValido(dia: unknown): dia is string {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false
  const f = new Date(`${dia}T12:00:00`)
  return !Number.isNaN(f.getTime()) && diaLocal(f.getTime()) === dia
}

/**
 * El día de la sesión como fecha, para las reglas que miran el día de la
 * semana (`claseDeDia`, `patronDelBloque`).
 *
 * Al mediodía y no a la medianoche: hay husos donde el cambio de horario cae
 * justo a las 00:00, y esa hora no existe. El mediodía existe siempre.
 */
export function fechaDelDia(dia: string): Date {
  return new Date(`${dia}T12:00:00`)
}

/**
 * A qué día pertenece la sesión del borrador.
 *
 * El campo propio manda: se escribe al arrancar y no se vuelve a calcular. Los
 * borradores de antes de que existiera no lo tienen, y para esos queda el día
 * local de `arrancadaEn`. No es perfecto —una sesión ya retomada una vez tiene
 * el arranque re-anclado— pero es lo único que esos borradores guardaron.
 */
export function diaDelBorrador(borrador: Pick<SesionEnCurso, 'dia' | 'arrancadaEn'>): string {
  return esDiaValido(borrador.dia) ? borrador.dia : diaLocal(borrador.arrancadaEn)
}

/** Las series con algo hecho adentro: las mismas que `cerrarSesion` guarda. */
function seriesHechas(borrador: Pick<SesionEnCurso, 'hechas'>): number {
  return Object.values(borrador.hechas ?? {})
    .flat()
    .filter((s) => s.logrado > 0).length
}

/** Si el borrador tiene algo que se perdería al borrarlo. */
export function tieneTrabajo(borrador: Pick<SesionEnCurso, 'hechas' | 'rafagas'>): boolean {
  return seriesHechas(borrador) > 0 || (borrador.rafagas?.length ?? 0) > 0
}

/**
 * Qué hacer con el borrador que hay en la base.
 *
 * - `retomar`: está vigente; Entrenar entra donde se había quedado, en
 *   silencio, como siempre.
 * - `ofrecer`: venció y tiene trabajo adentro. Nadie lo borra sin mostrarlo:
 *   Hoy (y Entrenar, si se llega directo) pregunta "Guardarla" o
 *   "Descartarla".
 * - `descartar`: venció y no tiene nada que guardar —ni una serie con algo
 *   hecho ni una ráfaga—. Preguntar por una sesión vacía sería pedir una
 *   decisión sobre nada, y guardarla escribiría una sesión sin registros.
 */
export type DestinoDelBorrador = 'retomar' | 'ofrecer' | 'descartar'

export function destinoDelBorrador(
  borrador: Pick<SesionEnCurso, 'actualizadoEn' | 'hechas' | 'rafagas'>,
  ahora: number,
): DestinoDelBorrador {
  if (ahora - borrador.actualizadoEn <= VIGENCIA_DEL_BORRADOR) return 'retomar'
  return tieneTrabajo(borrador) ? 'ofrecer' : 'descartar'
}

/**
 * Si queda una sesión por cerrar: una que todavía se retoma, o una vencida
 * con trabajo adentro que espera "Guardarla" o "Descartarla".
 *
 * Para lo que mueve el plan por debajo, las dos son lo mismo: una sesión que
 * todavía puede cerrarse. "Guardarla" la cierra como si se hubiera cerrado esa
 * noche, con el motor de esa noche, así que mover un avance antes de que la
 * persona decida le cambia el resultado. Lo pregunta la revisión única de la
 * palanca frontal (`revisarRequisitosUnaVez`): si corriera con una vencida en
 * espera, bajaría el core por no tener 3 series de 8 dominadas justo antes de
 * que "Guardarla" sumara la sesión que las daba, y esa sesión, al guardarse,
 * apagaría el aviso de por qué bajó.
 *
 * Una vencida y vacía no cuenta: no hay nada que cerrar, y Entrenar la tira.
 */
export function quedaPorCerrar(
  borrador: Pick<SesionEnCurso, 'actualizadoEn' | 'hechas' | 'rafagas'>,
  ahora: number,
): boolean {
  return destinoDelBorrador(borrador, ahora) !== 'descartar'
}

/**
 * Qué le pasa al borrador cuando se mueve un nivel a mano (`fijarNivel`,
 * "Empezar la cadena acá" en una ficha).
 *
 * - `cerrar`, si tiene trabajo adentro: se guarda con lo hecho, desde afuera,
 *   antes de mover el nivel. Antes se tiraba el que todavía se retomaba,
 *   porque Entrenar lo rearmaba con el eslabón nuevo y las series del viejo
 *   quedaban afuera; tirarlo era perderlas igual, con un paso menos. Cerrarlo
 *   las guarda, con el motor que tenía esa sesión, y un paso de cadena a
 *   medias no se lee.
 * - `tirar`, si no tiene nada: no hay series que guardar, y cerrarlo
 *   escribiría una sesión vacía.
 *
 * No mira la hora a propósito: la ficha dice antes de tocar qué va a pasar
 * ("se cierra con lo hecho"), y eso no puede dejar de ser cierto porque el
 * borrador venza mientras la pantalla está abierta.
 */
export function alCambiarDeNivel(
  borrador: Pick<SesionEnCurso, 'hechas' | 'rafagas'>,
): 'cerrar' | 'tirar' {
  return tieneTrabajo(borrador) ? 'cerrar' : 'tirar'
}

/**
 * Los registros de una sesión: lo que pedía el plan y lo que se anotó.
 *
 * Es la cuenta que hace "Cerrar la sesión" y la que hace "Guardarla" con un
 * borrador vencido. Que sea una sola función es lo que hace que las dos sean
 * el mismo cierre y no dos parecidos.
 */
export function registrosDeLaSesion(
  pasos: PasoDelBorrador[],
  hechas: Record<string, Serie[]>,
): RegistroEjercicio[] {
  return pasos.map(({ id, ejercicioId, objetivo, bajada, fijo, calentamiento }) => ({
    ejercicioId,
    objetivo,
    // Por el id del paso si lo tiene, que es la clave con la que se anota
    // desde que un ejercicio puede ir dos veces. Los pasos viejos no tienen id
    // y sus series siguen bajo el id del ejercicio.
    series: hechas[id ?? ejercicioId] ?? [],
    ...(id !== undefined ? { paso: id } : {}),
    ...(bajada ? { bajada: true as const } : {}),
    ...(fijo ? { fijo: true as const } : {}),
    ...(calentamiento ? { calentamiento: true as const } : {}),
  }))
}

/** Lo que hace falta para cerrar un borrador como cualquier otra sesión. */
export interface CierreDelBorrador {
  fecha: string
  registros: RegistroEjercicio[]
  duracionSegundos: number
  tipo: TipoSesion
  rafagas?: RegistroRafaga[]
  densa?: true
  /**
   * Se cierra desde afuera de la sesión: "Guardarla" en la placa de una sesión
   * sin cerrar, "Guardarla y empezar" o un cambio de nivel a mano. Entonces un
   * paso de cadena con menos series que las del objetivo no se lee (`a-medias`
   * en `leerLaSesion`): la persona no eligió terminar ahí, eligió otra cosa.
   */
  desdeAfuera?: true
}

/**
 * El cierre de un borrador vencido, con los mismos datos que habría usado
 * "Cerrar la sesión" esa noche.
 *
 * Los borradores nuevos traen el plan (`pasos`) y el tipo, guardados mientras
 * la sesión corría. Los de antes no, y para esos:
 *
 * - el tipo se deduce igual que en Entrenar —fuelle, corta, de vuelta o del
 *   plan—, con el día de la sesión y no con el de hoy;
 * - el objetivo de cada ejercicio lo da `objetivoDe`, que en la base es el que
 *   proponía el avance (no cambió desde entonces: cerrar otra sesión o fijar
 *   un nivel habrían pisado o borrado el borrador). Si ni eso hay, el
 *   registro se queda con lo hecho como objetivo: no se inventa una vara que
 *   nadie propuso, y las series no se pierden.
 */
export function cierreDelBorrador(
  borrador: SesionEnCurso,
  contexto: {
    historial: Sesion[]
    objetivoDe: (ejercicioId: string) => Objetivo | undefined
    /** Ver `CierreDelBorrador.desdeAfuera`. */
    desdeAfuera?: boolean
  },
): CierreDelBorrador {
  const fecha = diaDelBorrador(borrador)
  const hechas = borrador.hechas ?? {}

  const pasos: PasoDelBorrador[] = borrador.pasos?.length
    ? borrador.pasos
    : Object.entries(hechas).map(([ejercicioId, series]) => ({
        ejercicioId,
        objetivo: contexto.objetivoDe(ejercicioId) ?? {
          series: series.length,
          cantidad: Math.max(0, ...series.map((s) => s.logrado)),
        },
      }))

  const tipo: TipoSesion =
    borrador.tipo ??
    (borrador.diaDeFuelle
      ? 'fuelle'
      : borrador.corta
        ? 'corta'
        : esVuelta(contexto.historial, fecha)
          ? 'vuelta'
          : 'plan')

  return {
    fecha,
    registros: registrosDeLaSesion(pasos, hechas),
    duracionSegundos: Math.max(0, Math.round(borrador.duracionAcumulada ?? 0)),
    tipo,
    ...(borrador.rafagas?.length ? { rafagas: borrador.rafagas } : {}),
    // La misma regla que en Entrenar: la corta nunca lleva el bloque denso.
    ...(borrador.densa && !borrador.corta ? { densa: true as const } : {}),
    ...(contexto.desdeAfuera ? { desdeAfuera: true as const } : {}),
  }
}

// ─── El borrador de la reestructura: de dónde salió, sus pasos y su hora ───

/**
 * De dónde salió un borrador de antes de que se guardara.
 *
 * La misma cuenta que `origenDe` hace con las sesiones viejas: lo único que
 * esos borradores sabían de sí mismos era si eran la corta. El fuelle y el día
 * denso eran el día del plan, así que son el plan.
 */
function origenDeUnViejo(borrador: Pick<SesionEnCurso, 'corta'>): OrigenDeSesion {
  return borrador.corta
    ? { clase: 'rapida', cual: 'corta', nombre: 'Solo tengo 7 minutos' }
    : { clase: 'plan', nombre: 'Plan' }
}

/** De dónde salió el borrador: el guardado o, en uno viejo, el deducido. */
export function origenDelBorrador(
  borrador: Pick<SesionEnCurso, 'origen' | 'corta'>,
): OrigenDeSesion {
  return borrador.origen ?? origenDeUnViejo(borrador)
}

/**
 * Un borrador de cualquier versión, con todo lo que la reestructura espera.
 *
 * - Sin `origen`, el deducido (`origenDelBorrador`).
 * - Un paso sin `id` toma el de su ejercicio, que es la clave con la que sus
 *   series ya están en `hechas`: ninguna queda huérfana. Si el mismo
 *   ejercicio aparece dos veces, el segundo lleva un id propio y queda sin
 *   series, porque las que hay ya las tiene el primero: contarlas dos veces
 *   inventaría trabajo.
 * - Un paso sin `clase`: `volumen` si era la bajada, `cadena` si es el
 *   eslabón actual de su avance y `fijo` si no.
 * - Sin `iniciadaEn`, sigue sin él. Ningún otro campo guarda la hora de
 *   arranque (`arrancadaEn` se re-ancla al retomar), y una hora inventada
 *   quedaría escrita en el historial como si fuera cierta.
 *
 * Nunca descarta nada por no entenderlo, igual que `diaDelBorrador`: lo que no
 * se reconoce se deja como estaba. Es pura y no escribe; la base guarda lo que
 * devuelve recién cuando la sesión vuelve a anotarse.
 */
export function normalizarBorrador(
  borrador: SesionEnCurso,
  avances: Iterable<Pick<Avance, 'ejercicioId'>>,
): SesionEnCurso {
  const actuales = new Set([...avances].map((a) => a.ejercicioId))
  const vistos = new Set<string>()

  const pasos = borrador.pasos?.map((paso): PasoDelBorrador => {
    let id = paso.id ?? paso.ejercicioId
    for (let n = 2; vistos.has(id); n++) id = `${paso.ejercicioId}#${n}`
    vistos.add(id)
    const clase: ClaseDePaso =
      paso.clase ??
      (paso.bajada ? 'volumen' : !paso.fijo && actuales.has(paso.ejercicioId) ? 'cadena' : 'fijo')
    return { ...paso, id, clase }
  })

  return {
    ...borrador,
    origen: origenDelBorrador(borrador),
    ...(pasos ? { pasos } : {}),
  }
}

/** Lo que identifica a qué se empezó, sin el nombre: renombrar no lo vuelve otra cosa. */
function claveDelOrigen(origen: OrigenDeSesion): string {
  switch (origen.clase) {
    case 'plan':
      return `plan|${origen.liviana ? 'liviana' : ''}`
    case 'rutina':
      return `rutina|${origen.rutinaId}|${origen.liviana ? 'liviana' : ''}`
    case 'mix':
      return `mix|${origen.sector}|${origen.version}`
    case 'ejercicio':
      return `ejercicio|${origen.ejercicioId}|${origen.liviana ? 'liviana' : ''}`
    case 'repetir':
      return `repetir|${origen.sesionId}|${origen.liviana ? 'liviana' : ''}`
    case 'libre':
      return 'libre'
    case 'movilidad':
      return `movilidad|${origen.sector}`
    case 'rapida':
      return `rapida|${origen.cual}`
  }
}

/**
 * Si lo que se quiere empezar es la sesión que ya está a medio hacer.
 *
 * Con sí, `empezar` navega y la sesión se retoma; con no, pregunta antes de
 * pisarla. Compara qué se empezó, no cómo se llama: la misma rutina con otro
 * nombre es la misma, y la versión liviana de algo es otra sesión que la
 * completa, porque arma otros números. Un borrador viejo cuenta con el origen
 * deducido.
 */
export function mismaSesion(
  borrador: Pick<SesionEnCurso, 'origen' | 'corta'>,
  origen: OrigenDeSesion,
): boolean {
  return claveDelOrigen(origenDelBorrador(borrador)) === claveDelOrigen(origen)
}

/**
 * La hora de inicio que va en el borrador al anotar una serie.
 *
 * La primera serie la escribe; después no se mueve, aunque la sesión se
 * retome horas más tarde. Un borrador viejo que ya tenía trabajo adentro
 * sigue sin hora: la primera serie fue antes de que esto existiera, y poner
 * la de ahora sería mostrar en Tu día una hora en la que no empezó nada.
 */
export function iniciadaEn(
  previo: Pick<SesionEnCurso, 'iniciadaEn' | 'hechas' | 'rafagas'> | null | undefined,
  ahora: number,
): number | undefined {
  if (previo?.iniciadaEn !== undefined) return previo.iniciadaEn
  if (previo && tieneTrabajo(previo)) return undefined
  return ahora
}

const enPlural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

type BorradorQueSeNombra = Pick<SesionEnCurso, 'dia' | 'arrancadaEn' | 'hechas' | 'rafagas'>

/**
 * La frase con la que Hoy ofrece un borrador vencido.
 *
 * Dice de cuándo es y cuánto trabajo tiene, que es todo lo que hace falta para
 * decidir. "De hoy" y "de ayer" antes que la fecha: es como lo diría una
 * persona, y la fecha sola obliga a hacer la cuenta.
 */
export function textoDeSinCerrar(borrador: BorradorQueSeNombra, hoy: string): string {
  const { cuando, trabajo } = cuandoYCuanto(borrador, hoy)
  return `Quedó sin cerrar una sesión ${cuando}, con ${trabajo}.`
}

/**
 * Lo que se dice antes de restaurar una copia si hay una sesión a medio hacer.
 *
 * Restaurar borra el borrador —viene de un plan que la copia no conoce— y el
 * borrador no va en ninguna copia, tampoco en la automática que se guarda
 * antes de reemplazar. Sin esta frase, restaurar era la última forma de
 * perder una sesión con series sin que nadie la mostrara.
 */
export function textoDelBorradorAlRestaurar(borrador: BorradorQueSeNombra, hoy: string): string {
  const { cuando, trabajo } = cuandoYCuanto(borrador, hoy)
  return (
    `La sesión ${cuando} que quedó sin cerrar, con ${trabajo}, también se borra: ` +
    'no entra en ninguna copia. Si la querés, guardala antes.'
  )
}

/** De cuándo es la sesión del borrador y cuánto trabajo tiene, dicho como se dice. */
function cuandoYCuanto(
  borrador: BorradorQueSeNombra,
  hoy: string,
): { cuando: string; trabajo: string } {
  const dia = diaDelBorrador(borrador)
  const hace = diasEntre(dia, hoy)
  const [, mes, numero] = dia.split('-').map(Number)
  const cuando =
    hace === 0
      ? 'de hoy'
      : hace === 1
        ? 'de ayer'
        : `del ${NOMBRE_DIA[diaDeLaSemana(fechaDelDia(dia))]!.toLowerCase()} ${numero}/${mes}`

  const series = seriesHechas(borrador)
  const rafagas = borrador.rafagas?.length ?? 0
  const trabajo = [
    ...(series > 0 ? [enPlural(series, 'serie', 'series')] : []),
    ...(rafagas > 0 ? [enPlural(rafagas, 'ráfaga', 'ráfagas')] : []),
  ].join(' y ')

  return { cuando, trabajo }
}
