/**
 * La copia de seguridad: qué trae un archivo, y si se puede confiar en él.
 *
 * Restaurar reemplaza la única copia de los datos que hay —no hay servidor—,
 * así que acá se deciden dos cosas antes de tocar nada:
 *
 * - **Si el archivo está sano, fila por fila.** Antes se miraba la cáscara: la
 *   versión y que hubiera dos listas. Un archivo con una sola sesión sin
 *   `registros` pasaba, la app decía "Listo" y Hoy y Progreso quedaban en
 *   blanco para siempre, también al recargar. En la app instalada no hay barra
 *   de direcciones para llegar a Ajustes y arreglarlo: quedaba inservible.
 *   Ahora una sola fila rota rechaza el archivo entero, con una frase que dice
 *   cuál, y no se toca nada.
 * - **Qué trae, contado.** Los nombres de las copias se parecen todos
 *   (`lyrafit-AAAA-MM-DD.json`) y equivocarse de fecha es fácil, así que antes
 *   de reemplazar se muestra lo que hay en el archivo al lado de lo que se va
 *   a reemplazar.
 *
 * Se revisa lo que las pantallas necesitan para dibujar y el motor para
 * decidir. Lo que no se conoce se deja pasar tal cual: una copia de una
 * versión más nueva de la misma forma puede traer campos que esta todavía no
 * lee, y eso no la vuelve rota.
 */

import { esDiaValido } from './borrador'
import { contestoElChequeo } from './estado'
import { movimientoGuardado } from './movimiento'
import type { DiaDelDiario } from './nutricion'
import type { Avance, Estado, Patron, Preferencias, Sesion, TipoSesion } from './tipos'

/** Lo que queda de un archivo que pasó la revisión: la forma de hoy, completa. */
export interface CopiaRevisada {
  version: 3
  exportadoEn: string
  sesiones: Sesion[]
  avances: Avance[]
  estados: Estado[]
  preferencias: Preferencias
  diario: DiaDelDiario[]
}

export type RevisionDeCopia = { copia: CopiaRevisada } | { problema: string }

const PATRONES = new Set<Patron>(['empuje', 'traccion', 'piernas', 'core', 'bisagra'])
const TIPOS = new Set<TipoSesion>(['plan', 'corta', 'vuelta', 'fuelle', 'reloj'])

type Fila = Record<string, unknown>

const esFila = (x: unknown): x is Fila => typeof x === 'object' && x !== null && !Array.isArray(x)
const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const esTexto = (x: unknown): x is string => typeof x === 'string' && x.length > 0
/** Un campo opcional: o no está, o tiene la forma pedida. */
const opcional = (x: unknown, forma: (x: unknown) => boolean) => x === undefined || forma(x)

/** Por qué un objetivo no sirve, o null si sirve. */
function objetivoRoto(o: unknown): string | null {
  if (!esFila(o)) return 'no tiene objetivo'
  if (!esNumero(o.series) || !esNumero(o.cantidad)) return 'el objetivo no tiene números'
  if (!opcional(o.kg, esNumero)) return 'los kilos del objetivo no son un número'
  return null
}

function sesionRota(s: unknown): string | null {
  if (!esFila(s)) return 'no es una sesión'
  if (!esTexto(s.id)) return 'no tiene identificador'
  if (!esDiaValido(s.fecha)) return 'la fecha no es válida'
  if (!esNumero(s.finalizadaEn)) return 'falta cuándo se cerró'
  if (!esNumero(s.duracionSegundos)) return 'falta la duración'
  if (!opcional(s.tipo, (t) => TIPOS.has(t as TipoSesion))) return 'el tipo de sesión no existe'
  if (!Array.isArray(s.registros)) return 'le faltan los ejercicios'
  for (const [i, r] of s.registros.entries()) {
    if (!esFila(r) || !esTexto(r.ejercicioId)) return `el ejercicio ${i + 1} no dice cuál es`
    const objetivo = objetivoRoto(r.objetivo)
    if (objetivo) return `en el ejercicio ${i + 1}, ${objetivo}`
    if (!Array.isArray(r.series)) return `el ejercicio ${i + 1} no tiene series`
    for (const serie of r.series) {
      if (!esFila(serie) || !esNumero(serie.logrado)) {
        return `una serie del ejercicio ${i + 1} no tiene número`
      }
      if (![serie.kg, serie.predicho, serie.reservas].every((x) => opcional(x, esNumero))) {
        return `una serie del ejercicio ${i + 1} tiene un dato que no es un número`
      }
    }
  }
  if (
    !opcional(
      s.rafagas,
      (lista) =>
        Array.isArray(lista) &&
        lista.every(
          (r) =>
            esFila(r) &&
            esTexto(r.rafagaId) &&
            esNumero(r.segundos) &&
            (r.despuesDe === null || esTexto(r.despuesDe)),
        ),
    )
  ) {
    return 'una ráfaga está incompleta'
  }
  if (
    !opcional(
      s.decisiones,
      (lista) =>
        Array.isArray(lista) &&
        lista.every((d) => esFila(d) && typeof d.explicacion === 'string'),
    )
  ) {
    return 'una decisión del motor está incompleta'
  }
  if (![s.esfuerzo, s.vitalidadPre, s.vitalidadPost, s.animo].every((x) => opcional(x, esNumero))) {
    return 'una de las respuestas del final no es un número'
  }
  return null
}

/**
 * Por qué un avance no sirve, o null si sirve.
 *
 * Las copias v1 son de antes del motor de hoy: traen las dos rachas en vez de
 * la señal. Esas no están rotas, son viejas, y se traducen afuera de acá.
 */
function avanceRoto(a: unknown, version: number): string | null {
  if (!esFila(a)) return 'no es un nivel'
  if (!PATRONES.has(a.patron as Patron)) return 'la cadena no existe'
  if (!esTexto(a.ejercicioId)) return 'no dice en qué ejercicio está'
  const objetivo = objetivoRoto(a.objetivoActual)
  if (objetivo) return objetivo
  if (!esNumero(a.actualizadoEn)) return 'falta cuándo cambió'
  const motorDeHoy = esNumero(a.senal) && esNumero(a.sesionesEnObjetivo) && esNumero(a.graciaRestante)
  if (!motorDeHoy && version !== 1) return 'le faltan los números del motor'
  if (!opcional(a.protegidasSeguidas, (x) => esNumero(x) && x >= 0)) {
    return 'la racha de protegidas no es un número'
  }
  return null
}

/**
 * Un avance de la v1 traducido al motor de hoy, con la misma cuenta que hace
 * la migración v2 de la base (`db.ts`). Restaurar una copia vieja tiene que
 * dejar lo mismo que habría dejado actualizar la app con esos datos adentro.
 */
function avanceDeHoy(a: Fila): Avance {
  if (esNumero(a.senal) && esNumero(a.sesionesEnObjetivo) && esNumero(a.graciaRestante)) {
    return a as unknown as Avance
  }
  const { rachaExitos, rachaFallos, ...resto } = a
  const exitos = Number(rachaExitos ?? 0)
  const fallos = Number(rachaFallos ?? 0)
  return {
    ...resto,
    senal: fallos > 0 ? 0.8 : exitos > 0 ? 1 : 0.95,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
  } as unknown as Avance
}

function estadoRoto(e: unknown): string | null {
  if (!esFila(e)) return 'no es un chequeo'
  if (!esDiaValido(e.fecha)) return 'la fecha no es válida'
  // Una molestia avisada con el chequeo apagado deja una fila con la molestia
  // sola, sin las tres respuestas (`guardarMolestiaDeHoy`). Esa fila está sana:
  // rechazarla dejaría sin poder restaurar su propia copia a quien avisó una
  // molestia. Lo que la app no escribe nunca es una fila con algunas
  // respuestas y otras no, o sin respuestas y sin molestia.
  const respuestas = [e.sueno, e.energia, e.musculos]
  const soloLaMolestia =
    PATRONES.has(e.molestia as Patron) && respuestas.every((x) => x === undefined)
  if (!soloLaMolestia && !respuestas.every(esNumero)) {
    return 'le falta una de las tres respuestas'
  }
  if (!opcional(e.molestia, (m) => PATRONES.has(m as Patron))) return 'la molestia no es una cadena'
  return null
}

function diaRoto(d: unknown): string | null {
  if (!esFila(d)) return 'no es un día'
  if (!esDiaValido(d.fecha)) return 'la fecha no es válida'
  if (![d.porcionesDeProteina, d.ultimaCafeina, d.horaDeDormir].every((x) => opcional(x, esNumero))) {
    return 'un número no es un número'
  }
  if (![d.sueno, d.alcohol].every((x) => opcional(x, esTexto))) return 'una respuesta está rota'
  const binarias = [d.verduraEnDos, d.creatina, d.horaDeDormirContestada]
  if (!binarias.every((x) => opcional(x, (b) => typeof b === 'boolean'))) {
    return 'una respuesta de sí o no está rota'
  }
  return null
}

/** El primer valor repetido de una lista, o undefined. */
function repetido(valores: unknown[]): unknown {
  const vistos = new Set<unknown>()
  for (const v of valores) {
    if (vistos.has(v)) return v
    vistos.add(v)
  }
  return undefined
}

/**
 * Revisa un archivo entero y lo devuelve en la forma de hoy, o dice qué está
 * roto. No lanza: el que llama decide cómo decirlo.
 *
 * Las copias viejas se completan con lo que no existía cuando se hicieron —a
 * la v1 le falta el chequeo diario y el tipo de sesión; a la v2, el diario—, y
 * todo eso tiene un valor por defecto sensato: vacío. Lo que no se completa
 * nunca es una fila rota.
 */
export function revisarCopia(dato: unknown): RevisionDeCopia {
  if (!esFila(dato)) return { problema: 'El archivo no tiene el formato de una copia de LyraFit.' }
  const version = dato.version
  if (version !== 1 && version !== 2 && version !== 3) {
    return { problema: 'La copia es de una versión que esta app todavía no entiende.' }
  }
  if (!Array.isArray(dato.sesiones) || !Array.isArray(dato.avances)) {
    return { problema: 'A la copia le faltan las sesiones o los avances.' }
  }
  if (!opcional(dato.estados, Array.isArray) || !opcional(dato.diario, Array.isArray)) {
    return { problema: 'A la copia se le rompió la lista del chequeo diario o la del diario.' }
  }
  if (typeof dato.exportadoEn !== 'string' || Number.isNaN(Date.parse(dato.exportadoEn))) {
    return { problema: 'A la copia le falta la fecha en que se hizo.' }
  }

  const sesiones = dato.sesiones as unknown[]
  const avances = dato.avances as unknown[]
  const estados = (dato.estados ?? []) as unknown[]
  const diario = (dato.diario ?? []) as unknown[]

  for (const [i, s] of sesiones.entries()) {
    const motivo = sesionRota(s)
    if (motivo) return { problema: `La sesión ${i + 1} de la copia está rota: ${motivo}.` }
  }
  for (const [i, a] of avances.entries()) {
    const motivo = avanceRoto(a, version)
    if (motivo) return { problema: `El nivel ${i + 1} de la copia está roto: ${motivo}.` }
  }
  for (const [i, e] of estados.entries()) {
    const motivo = estadoRoto(e)
    if (motivo) return { problema: `El chequeo ${i + 1} de la copia está roto: ${motivo}.` }
  }
  for (const [i, d] of diario.entries()) {
    const motivo = diaRoto(d)
    if (motivo) return { problema: `El día ${i + 1} del diario de la copia está roto: ${motivo}.` }
  }

  // Sin preferencias no hay alta completada, y la app manda al test de nivel,
  // que al terminar pisa los niveles que se acaban de restaurar.
  const preferencias = dato.preferencias
  if (!esFila(preferencias) || preferencias.id !== 'unico') {
    return { problema: 'A la copia le faltan las preferencias.' }
  }

  // Dos filas con la misma clave se pisan al guardarse, y el resumen contaría
  // de más: diría que trae algo que después no queda.
  const claves: [unknown[], string][] = [
    [sesiones.map((s) => (s as Fila).id), 'Hay dos sesiones con el mismo identificador en la copia.'],
    [avances.map((a) => (a as Fila).patron), 'La copia tiene dos niveles para la misma cadena.'],
    [estados.map((e) => (e as Fila).fecha), 'La copia tiene dos chequeos del mismo día.'],
    [diario.map((d) => (d as Fila).fecha), 'La copia tiene dos días del diario con la misma fecha.'],
  ]
  for (const [valores, problema] of claves) {
    if (repetido(valores) !== undefined) return { problema }
  }

  return {
    copia: {
      version: 3,
      exportadoEn: dato.exportadoEn,
      sesiones: (sesiones as Fila[]).map(
        (s) => ({ ...s, tipo: s.tipo ?? 'plan' }) as unknown as Sesion,
      ),
      avances: (avances as Fila[]).map(avanceDeHoy),
      estados: estados as Estado[],
      // El movimiento viaja como el resto de las preferencias. Una copia de
      // antes del interruptor no lo trae y se lee como "seguir al teléfono",
      // que es lo que esa persona tenía; y un valor que no se entiende no
      // rompe la copia, porque no es un dato: se vuelve a seguir al teléfono.
      preferencias: {
        ...preferencias,
        movimiento: movimientoGuardado(preferencias),
      } as unknown as Preferencias,
      diario: diario as DiaDelDiario[],
    },
  }
}

// ─── El resumen ──────────────────────────────────────────────────────────

/** Lo que trae una copia (o lo que hay hoy en el teléfono), contado. */
export interface ResumenDeCopia {
  sesiones: number
  /** Días del diario con algo anotado. */
  diario: number
  /** Chequeos diarios contestados. Una molestia avisada sola no es uno. */
  chequeos: number
  /** El primer y el último día con algo guardado, AAAA-MM-DD, o null si no hay nada. */
  desde: string | null
  hasta: string | null
}

export function resumenDeCopia(
  copia: Pick<CopiaRevisada, 'sesiones' | 'estados' | 'diario'>,
): ResumenDeCopia {
  const dias = [
    ...copia.sesiones.map((s) => s.fecha),
    ...copia.estados.map((e) => e.fecha),
    ...copia.diario.map((d) => d.fecha),
  ].sort()
  return {
    sesiones: copia.sesiones.length,
    diario: copia.diario.length,
    // Una fila con la molestia sola no es un chequeo: no se contestó nada.
    // Entra en el rango de días, porque es algo guardado ese día.
    chequeos: copia.estados.filter(contestoElChequeo).length,
    desde: dias[0] ?? null,
    hasta: dias.at(-1) ?? null,
  }
}

/** Un día AAAA-MM-DD como lo escribe alguien de acá: 3/10/2026. */
export function fechaCorta(dia: string): string {
  const [anio, mes, numero] = dia.split('-').map(Number)
  return `${numero}/${mes}/${anio}`
}

const enPlural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** "1 sesión", "12 sesiones". */
export function cuantasSesiones(n: number): string {
  return enPlural(n, 'sesión', 'sesiones')
}

/**
 * El renglón chico de una fila del resumen: de cuándo a cuándo, y lo demás
 * que trae además de las sesiones.
 */
export function detalleDelResumen(r: ResumenDeCopia): string {
  const partes: string[] = []
  if (r.desde && r.hasta) {
    partes.push(
      r.desde === r.hasta
        ? `del ${fechaCorta(r.desde)}`
        : `del ${fechaCorta(r.desde)} al ${fechaCorta(r.hasta)}`,
    )
  } else {
    partes.push('sin nada anotado')
  }
  if (r.diario > 0) partes.push(enPlural(r.diario, 'día del diario', 'días del diario'))
  if (r.chequeos > 0) partes.push(enPlural(r.chequeos, 'chequeo', 'chequeos'))
  return partes.join(' · ')
}

/**
 * La frase que se lee antes de confirmar. Pone primero lo que se pierde,
 * porque es lo único que no se puede deshacer desde la app.
 */
export function fraseDelReemplazo(deLaCopia: ResumenDeCopia, actual: ResumenDeCopia): string {
  if (actual.sesiones === 0) {
    return `Hoy no tenés sesiones guardadas. El archivo trae ${cuantasSesiones(deLaCopia.sesiones)}.`
  }
  return `Vas a reemplazar ${cuantasSesiones(actual.sesiones)} por ${deLaCopia.sesiones}.`
}

/**
 * El aviso de después de restaurar. Antes se armaba en la pantalla con el
 * número delante y el plural fijo, y con una sola sesión decía "1 sesión
 * restauradas".
 */
export function avisoDeRestaurada(sesiones: number, conCopia: boolean): string {
  const cuantas = `${cuantasSesiones(sesiones)} ${sesiones === 1 ? 'restaurada' : 'restauradas'}`
  return `Listo: ${cuantas}.${conCopia ? ' Lo que tenías quedó en una copia automática.' : ''}`
}
