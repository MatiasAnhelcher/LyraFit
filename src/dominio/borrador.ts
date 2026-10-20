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
  Objetivo,
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
  return pasos.map(({ ejercicioId, objetivo, bajada }) => ({
    ejercicioId,
    objetivo,
    series: hechas[ejercicioId] ?? [],
    ...(bajada ? { bajada: true as const } : {}),
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
  contexto: { historial: Sesion[]; objetivoDe: (ejercicioId: string) => Objetivo | undefined },
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
  }
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
