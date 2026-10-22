/**
 * Las líneas que salen de un dato.
 *
 * Cada una es una función pura que devuelve el texto, o `null` si falta el
 * dato que la sostiene. Ese `null` es la regla entera: una línea sin dato no
 * se inventa ni se rellena, no aparece. Las reglas de la voz (§7.1 de la
 * reestructura) valen todas acá: primero el dato y nada más, la hora en 24 h,
 * ningún signo de exclamación, nada de `PROHIBIDAS` y 140 caracteres como
 * mucho. `lineas.test.ts` las verifica una por una.
 *
 * No es Lyra: las frases de la mascota están en `frases.ts`, con su banco y su
 * tope de 96. Esto es lo que dice el motor cuando hay algo que decir.
 *
 * Las de arriba son del Cierre (R0). Las de abajo (R2) son las del centro:
 * antes de empezar, en la Ficha, en el Constructor, en Tu día y en la hoja de
 * la sesión a medio hacer. Ninguna decide nada: reciben lo que ya decidieron
 * `recuperacion.ts`, `molestia.ts`, `estado.ts`, `catalogo.ts` o `dia.ts`, y
 * lo dicen.
 *
 * ## Lo que no se puede importar
 *
 * `progresion.ts` importa este archivo, y `recuperacion.ts` importa
 * `progresion.ts`. Así que de `recuperacion.ts` (y de `molestia.ts`, por las
 * dudas) acá solo entran tipos, con `import type`, que se borra al compilar:
 * un `import` de verdad cerraría el ciclo lineas → recuperacion → progresion →
 * lineas. Con `verbatimModuleSyntax`, un `import { type X }` deja un import
 * vacío que igual se ejecuta, por eso es `import type` y no eso.
 */

import { diasEntre } from './adherencia'
import { CADENA_POR_PATRON, NOMBRE_PATRON, POR_ID } from './biblioteca'
import { esDiaValido, fechaDelDia, origenDelBorrador } from './borrador'
import {
  NOMBRE_BANDA,
  NOMBRE_EQUIPO,
  buscarItem,
  nivelDe,
  type RequisitoDelCatalogo,
} from './catalogo'
import { cuentaDelDia, inicioDe, sesionesDelDia } from './dia'
import { DADOS_POR_TENIDOS } from './equipo'
import { ajusteParaFijos, hayFijosParaBajar, type AjusteDelDia } from './estado'
import type { CambioDelPaso } from './molestia'
import { MUSCULOS_CUBIERTOS, NOMBRE_MUSCULO, type Musculo } from './musculos'
import type {
  CERCA_DEL_FALLO,
  DisparadorDeRecuperacion,
  UMBRAL_MISMO_DIA,
} from './recuperacion'
import { NOMBRE_DIA, diaDeLaSemana } from './rutinas'
import { NOMBRE_SECTOR } from './sectores'
import type {
  Avance,
  CambioEnSesion,
  ClaseDePaso,
  Ejercicio,
  Equipo,
  Medida,
  PasoDelBorrador,
  Patron,
  Sector,
  Sesion,
  SesionEnCurso,
  TipoSesion,
} from './tipos'

/** Lo más largo que puede ser una línea (§7.1). Las frases de Lyra tienen su propio tope. */
export const LARGO_DE_LINEA = 140

/**
 * La llave de las afirmaciones del cuerpo.
 *
 * Toda línea que diga algo de la recuperación, del volumen o del orden lleva
 * una fuente, y la fuente sale recién cuando alguien la confirma contra el
 * trabajo original. Hasta entonces va solo el dato. Prenderla es un cambio de
 * una línea, y apagada ninguna línea de este archivo afirma nada del cuerpo.
 */
export const RECUPERACION_CON_FUENTE = false

/** La hora de un instante como se dice: "9:10", "13:30". Hora local, 24 h. */
export function horaDicha(instante: number): string {
  const fecha = new Date(instante)
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`
}

/** Si una hora dicha es la una: la única que va en singular ("la 1:20", "las 13:20"). */
const esLaUna = (dicha: string) => dicha.startsWith('1:')

/** "a las 9:10", y "a la 1:20": la una va en singular. */
function aLaHora(dicha: string): string {
  return esLaUna(dicha) ? `a la ${dicha}` : `a las ${dicha}`
}

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** "a", "a y b", "a, b y c". Exportada para que el Constructor enumere igual (`rutinasPropias.ts`). */
export function enLista(cosas: readonly string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? ''
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`
}

/** Los nombres de las cadenas en minúscula, en lista: "tracción, empuje y core". */
const cadenas = (patrones: readonly Patron[]) =>
  enLista(patrones.map((p) => NOMBRE_PATRON[p].toLowerCase()))

export interface CadenaLeida {
  patron: Patron
  /** Cuándo se leyó, en milisegundos. */
  hora: number
}

/**
 * Las cadenas que esta sesión no leyó porque ya se habían leído ese día.
 *
 * "Empuje ya se leyó hoy a las 9:10: esta sesión sumó volumen." Con varias a la
 * misma hora van juntas; con horas distintas, cada una con la suya y en el
 * orden en que se leyeron. La hora es lo que hace que no suene a reto: dice
 * cuándo pasó lo que cuenta, no qué está mal con esta.
 *
 * `esHoy` es si el día de la sesión es hoy. Una que arrancó a las 23:40 y
 * cierra a las 00:05 es del día de antes, y "hoy a las 9:10" ya no es cierto:
 * dice "ese día".
 */
export function lineaYaLeida(
  leidas: readonly CadenaLeida[],
  { esHoy }: { esHoy: boolean } = { esHoy: true },
): string | null {
  if (leidas.length === 0) return null

  const grupos: { hora: string; patrones: Patron[] }[] = []
  for (const { patron, hora } of [...leidas].sort((a, b) => a.hora - b.hora)) {
    if (grupos.some((g) => g.patrones.includes(patron))) continue
    const dicha = horaDicha(hora)
    const grupo = grupos.find((g) => g.hora === dicha)
    if (grupo) grupo.patrones.push(patron)
    else grupos.push({ hora: dicha, patrones: [patron] })
  }

  const [primero, ...resto] = grupos
  if (!primero) return null
  const varias = primero.patrones.length > 1
  const verbo = esHoy
    ? `${varias ? 'se leyeron' : 'se leyó'} hoy`
    : `${varias ? 'se habían leído' : 'se había leído'} ese día`
  const cierre = ': esta sesión sumó volumen.'

  if (resto.length === 0) {
    return `${conMayuscula(cadenas(primero.patrones))} ya ${verbo} ${aLaHora(primero.hora)}${cierre}`
  }

  const tramos = [
    `${conMayuscula(cadenas(primero.patrones))} ${verbo} ${aLaHora(primero.hora)}`,
    ...resto.map((g) => `${cadenas(g.patrones)} ${aLaHora(g.hora)}`),
  ]
  // Si un tramo ya trae su propia "y" ("bisagra y core a las 13:30"), los
  // tramos se separan con coma también antes de la última "y": sin eso, "a las
  // 9:10 y bisagra y core a las 13:30" se lee como tres cadenas a una hora.
  const conY = grupos.some((g) => g.patrones.length > 1)
  const unidos = conY
    ? `${tramos.slice(0, -1).join(', ')}, y ${tramos[tramos.length - 1]}`
    : enLista(tramos)
  return `${unidos}${cierre}`
}

/**
 * Una sesión sin pasos que sigan tu nivel: un día de fuelle, o lo que no traía
 * ningún eslabón de una cadena.
 *
 * Es la razón verdadera de que las cadenas no se muevan, y por eso solo sale
 * cuando es cierta. Si la sesión tenía pasos de cadena y no se hicieron, no
 * hubo nada que leer y no se dice nada del plan: nombrar lo que no se hizo es
 * exactamente lo que esta app no hace. El Reloj tampoco: nunca lee, y su final
 * no habla del motor.
 */
export function lineaSinCadenas(sesion: {
  tipo: TipoSesion
  /** Cuántos pasos seguían tu nivel, hechos o no. */
  pasosDeCadena: number
}): string | null {
  if (sesion.pasosDeCadena > 0 || sesion.tipo === 'reloj') return null
  return 'Esta sesión no tenía pasos que sigan tu nivel: tus cadenas quedan como estaban.'
}

/**
 * Los pasos de cadena que se cambiaron por otro ejercicio en la sesión: hecho
 * otro, la cadena no se lee, y se dice por qué.
 */
export function lineaCambiado(patrones: readonly Patron[]): string | null {
  const unicos = [...new Set(patrones)]
  if (unicos.length === 0) return null
  return unicos.length === 1
    ? `${conMayuscula(cadenas(unicos))} queda como estaba: hoy hiciste otro ejercicio.`
    : `${conMayuscula(cadenas(unicos))} quedan como estaban: hoy hiciste otros ejercicios.`
}

/** La versión liviana suma volumen y no lee ninguna cadena, y lo dice. */
export function lineaLiviana(liviana: boolean): string | null {
  return liviana ? 'La versión liviana suma volumen y no mueve tus cadenas.' : null
}

/**
 * Los pasos de cadena que quedaron a medias al guardar una sesión desde
 * afuera: no se leyeron, y por eso no gastaron la lectura del día.
 *
 * "se puede leer hoy" solo si la sesión es de hoy. Una de ayer que se guarda
 * a la mañana no deja nada pendiente para ese día, que ya pasó: decirlo sería
 * prometer algo que no existe.
 */
export function lineaAMedias({
  patrones,
  esHoy,
}: {
  patrones: readonly Patron[]
  /** Si la sesión es del día en que se guarda. */
  esHoy: boolean
}): string | null {
  const unicos = [...new Set(patrones)]
  if (unicos.length === 0) return null
  const varias = unicos.length > 1
  const quedo = varias ? 'quedaron a medias: no se movieron' : 'quedó a medias: no se movió'
  const despues = esHoy ? (varias ? ' y se pueden leer hoy' : ' y se puede leer hoy') : ''
  return `${conMayuscula(cadenas(unicos))} ${quedo}${despues}.`
}

// ═══ R2 · Las líneas del centro ═══════════════════════════════════════════

// ─── Cómo se dicen las cosas ────────────────────────────────────────────

/** "1 serie", "2 series". */
const enPlural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** "de las 13:30", y "de la 1:20". */
function deLaHora(dicha: string): string {
  return esLaUna(dicha) ? `de la ${dicha}` : `de las ${dicha}`
}

/**
 * Las palabras que terminan en vocal y "s" y sin embargo son singulares. Hoy
 * la biblioteca no tiene ninguna; "Limpiaparabrisas en el piso" está en el
 * catálogo que viene (`catalogo.md`), y sin esto diría "están".
 */
const SINGULARES_EN_S: ReadonlySet<string> = new Set(['limpiaparabrisas'])

/**
 * Si el nombre de un ejercicio es plural: "Flexiones diamante", "Dominadas
 * negativas", "Sentadillas completas", "Zancadas".
 *
 * El número lo pone la primera palabra, que es el sustantivo: terminada en
 * vocal y "s" es plural ("Flexiones", "Fondos"), y cualquier otra cosa es
 * singular ("Flexión pica", "Press militar de pie", "Bíceps"). Hace falta
 * cuando el nombre es el sujeto de la línea: "Flexiones diamante está arriba
 * de tu empuje" se lee mal, y es un renglón que aparece seguido.
 */
function esPlural(nombre: string): boolean {
  const primera = (nombre.trim().split(/\s+/)[0] ?? '').toLowerCase()
  return /[aeiouáéíóú]s$/u.test(primera) && !SINGULARES_EN_S.has(primera)
}

/**
 * El nombre de algo en el medio de una frase: "este paso bajó a remo
 * australiano bajo". Baja solo la primera letra, y solo si la que sigue ya es
 * minúscula: así una sigla ("Y-T-W en el piso") queda como está. Exportada
 * para que los avisos del Constructor nombren igual que estas líneas.
 */
export function enMinuscula(texto: string): string {
  return /^\p{Lu}\p{Ll}/u.test(texto) ? texto.charAt(0).toLowerCase() + texto.slice(1) : texto
}

/** "3 × 8", y "3 × 30 s" en lo que se mide en segundos. */
function dosisDicha({ series, cantidad }: { series: number; cantidad: number }, medida: Medida): string {
  return `${series} × ${cantidad}${medida === 'segundos' ? ' s' : ''}`
}

/** Una cadena con su posesivo: "tu empuje", "tu tracción", y "tus piernas". */
function tuCadena(patron: Patron): string {
  return patron === 'piernas' ? 'tus piernas' : `tu ${NOMBRE_PATRON[patron].toLowerCase()}`
}

/**
 * Cuándo fue un día, mirado desde `hoy`, como lo dice el mapa: "hoy", "ayer",
 * el día de la semana hasta 6 días atrás ("el viernes") y la fecha corta más
 * atrás ("el 12/10"), sin cero adelante, como en `borrador.ts`.
 *
 * A los 7 días el día de la semana ya es el mismo de hoy y "el miércoles"
 * podría ser cualquiera de dos: por eso desde ahí va la fecha. Un día que no
 * existe o que todavía no llegó (un reloj que se corrió) no se dice: `null`.
 */
function cuandoFue(fecha: string, hoy: string): string | null {
  if (!esDiaValido(fecha) || !esDiaValido(hoy)) return null
  const hace = diasEntre(fecha, hoy)
  if (hace < 0) return null
  if (hace === 0) return 'hoy'
  if (hace === 1) return 'ayer'
  if (hace <= 6) {
    const nombre = NOMBRE_DIA[diaDeLaSemana(fechaDelDia(fecha))]
    if (nombre) return `el ${nombre.toLowerCase()}`
  }
  const [, mes, dia] = fecha.split('-').map(Number)
  return `el ${dia}/${mes}`
}

/**
 * La clase de un paso, también de un borrador viejo que no la guardaba. Es la
 * misma deducción que `normalizarBorrador`, `molestia.ts`, `estado.ts` y
 * `recuperacion.ts`, que la tienen cada uno para sí.
 */
function claseDelPaso(paso: PasoDelBorrador): ClaseDePaso {
  return paso.clase ?? (paso.bajada ? 'volumen' : paso.fijo ? 'fijo' : 'cadena')
}

/** Dónde está un ejercicio en la cadena de ese patrón, contando desde 1, o `null`. */
function lugarEnLaCadena(patron: Patron, ejercicioId: string): number | null {
  const i = CADENA_POR_PATRON.get(patron)?.ejercicios.indexOf(ejercicioId) ?? -1
  return i === -1 ? null : i + 1
}

/** El lugar de un músculo en la pantalla, para desempatar siempre igual. */
function ordenDelMusculo(musculo: Musculo): number {
  const i = MUSCULOS_CUBIERTOS.indexOf(musculo)
  return i === -1 ? MUSCULOS_CUBIERTOS.length : i
}

// ─── Antes de empezar: la recuperación ──────────────────────────────────

/**
 * Las reservas que `recuperacion.ts` llama "cerca del fallo", repetidas acá
 * porque este archivo no puede importar sus valores (ver arriba). El tipo las
 * ata: si allá cambian, esto deja de compilar, y la línea no puede quedar
 * diciendo "1 repetición" cuando la regla mira otra cosa.
 */
const RESERVAS_DICHAS: typeof CERCA_DEL_FALLO = 1

/**
 * Una línea que dice algo del cuerpo: el dato, que sale siempre, y lo que suma
 * la fuente cuando la llave está prendida.
 *
 * Son dos textos y no uno porque se muestran distinto (el dato en tinta, lo
 * demás en glosa) y porque juntos pasarían de 140. La pantalla los pone en el
 * mismo párrafo, en este orden.
 */
export interface LineaConFuente {
  dato: string
  /** Lo que la llave prendida agrega, o `null` mientras está apagada. */
  conFuente: string | null
}

/**
 * La línea de recuperación, con las cadenas que ya se leyeron hoy si las hay.
 * Las tres partes van en el mismo párrafo: `dato`, `cadenas`, `conFuente`.
 */
export interface LineaDeRecuperacion extends LineaConFuente {
  /**
   * "Tracción ya se leyó hoy: esta sesión suma volumen y no la mueve." Solo
   * en B, que es cuando la sesión vuelve sobre lo que ya hizo hoy.
   */
  cadenas: string | null
}

/**
 * La línea de recuperación de §7.3: lo que `disparadorAntesDeEmpezar` decidió
 * que hay que decir, dicho con la cifra y la hora.
 *
 * - **B**: "Dorsal: 10 series hoy, la última a las 9:10; con esta, 14." Las
 *   series se redondean como en Progreso; como el músculo que se nombra es
 *   uno que esta sesión carga entero, "con esta" siempre da más.
 * - **C**: "Espalda: la última vez fue ayer a las 21:40, con una serie con 1
 *   repetición o menos en reserva."
 * - **A**, o sin disparador: `null`. No hay nada que decir.
 *
 * La hora es la de `inicioDe`. En una sesión vieja que no guardó cuándo
 * empezó es la de cierre, y se dice así ("la última, cerrada a las 9:34"):
 * leerla como hora de arranque sería decir que algo empezó cuando no empezó.
 *
 * Nunca trae un nivel ni un color: es un dato en el flujo, arriba de la lista,
 * y Empezar queda donde está (§7.3). `hoy` es el día local en que se muestra;
 * si la sesión de B no es de hoy, "hoy" sería falso y no se dice nada.
 *
 * `conFuente` es la llave (`RECUPERACION_CON_FUENTE`): pasarla acá sirve para
 * probar la línea prendida sin prenderla en la app.
 */
export function lineaDeRecuperacion(
  disparador: DisparadorDeRecuperacion | null,
  hoy: string,
  { conFuente = RECUPERACION_CON_FUENTE }: { conFuente?: boolean } = {},
): LineaDeRecuperacion | null {
  if (!disparador) return null
  const { ultima } = disparador
  const hora = aLaHora(horaDicha(ultima.hora))

  if (disparador.clase === 'B') {
    if (ultima.fecha !== hoy) return null
    const seriesHoy = Math.round(disparador.seriesHoy)
    const conEsta = Math.round(disparador.conEsta)
    const laUltima = ultima.esDeCierre ? `la última, cerrada ${hora}` : `la última ${hora}`
    return {
      dato: `${NOMBRE_MUSCULO[disparador.musculo]}: ${enPlural(seriesHoy, 'serie', 'series')} hoy, ${laUltima}; con esta, ${conEsta}.`,
      cadenas: cadenasYaLeidasAntes(disparador.cadenasLeidas),
      conFuente: conFuente ? 'Si la hacés, esperá menos repeticiones.' : null,
    }
  }

  const cuando = cuandoFue(ultima.fecha, hoy)
  if (cuando === null) return null
  const fue = ultima.esDeCierre ? `fue ${cuando}, cerrada ${hora}` : `fue ${cuando} ${hora}`
  const reservas = enPlural(RESERVAS_DICHAS, 'repetición', 'repeticiones')
  return {
    dato: `${NOMBRE_SECTOR[disparador.zona]}: la última vez ${fue}, con una serie con ${reservas} o menos en reserva.`,
    cadenas: null,
    conFuente: conFuente ? 'Si hoy sale menos, es esperable.' : null,
  }
}

/**
 * "Tracción ya se leyó hoy: esta sesión suma volumen y no la mueve.", o con
 * varias "…ya se leyeron hoy: esta sesión suma volumen y no las mueve." Sin
 * la hora: la víspera, justo abajo, ya la dice.
 */
function cadenasYaLeidasAntes(leidas: readonly CadenaLeida[]): string | null {
  const unicos = [...new Set(leidas.map((l) => l.patron))]
  if (unicos.length === 0) return null
  const varias = unicos.length > 1
  return `${conMayuscula(cadenas(unicos))} ya ${varias ? 'se leyeron' : 'se leyó'} hoy: esta sesión suma volumen y no ${varias ? 'las' : 'la'} mueve.`
}

// ─── El Constructor: el volumen de un músculo ───────────────────────────

/**
 * De cuántas series de un músculo para arriba habla el Constructor: el mismo
 * 11 que la recuperación (`UMBRAL_MISMO_DIA`), atado por el tipo como
 * `RESERVAS_DICHAS`.
 */
const MAS_DE_POR_MUSCULO: typeof UMBRAL_MISMO_DIA = 11

/**
 * "Pectoral: 14 series en esta rutina.", si algún músculo pasa de 11 (§4.11).
 *
 * Recibe las series fraccionales de la rutina por músculo, contadas como en
 * Progreso (cada serie por su aporte, del piso de dosis para arriba), y nombra
 * el que más tiene; con las mismas, el que va primero en pantalla, para que el
 * Constructor y la Rutina no nombren dos distintos. Sin ninguno arriba de 11,
 * `null`: el número de cada músculo no es una línea que haya que decir siempre.
 *
 * Con la llave prendida suma lo que dice el preprint, que no tiene revisión
 * por pares todavía y por eso lo dice.
 */
export function lineaDeVolumen(
  seriesPorMusculo: ReadonlyMap<Musculo, number>,
  { conFuente = RECUPERACION_CON_FUENTE }: { conFuente?: boolean } = {},
): LineaConFuente | null {
  const [mas] = [...seriesPorMusculo]
    .filter(([, series]) => series > MAS_DE_POR_MUSCULO)
    .sort((a, b) => b[1] - a[1] || ordenDelMusculo(a[0]) - ordenDelMusculo(b[0]))
  if (!mas) return null
  const [musculo, series] = mas
  return {
    dato: `${NOMBRE_MUSCULO[musculo]}: ${enPlural(Math.round(series), 'serie', 'series')} en esta rutina.`,
    conFuente: conFuente
      ? 'Un análisis todavía sin revisión por pares estima que, pasadas unas 11 por sesión, cada serie suma poco.'
      : null,
  }
}

// ─── El nivel ───────────────────────────────────────────────────────────

/** Los avances, por cadena. Solo importa en qué eslabón está cada una. */
export type AvancesPorCadena = ReadonlyMap<Patron, Pick<Avance, 'ejercicioId'>>

/**
 * Cuántos eslabones arriba de tu nivel está un ejercicio, o `null` si no lo
 * está (o no se puede saber).
 *
 * Un eslabón se compara por su lugar en su cadena; una variante, por el
 * eslabón al que equivale (`equivale.nivel`). Un accesorio o algo con discos
 * no se compara con ninguna cadena, y sin el avance de esa cadena tampoco hay
 * con qué. Es el dato de "Está dos eslabones arriba de tu empuje".
 */
export function arribaDeTuNivel(
  ejercicio: Pick<Ejercicio, 'id' | 'patron' | 'equivale'>,
  avances: AvancesPorCadena,
): { patron: Patron; eslabones: number } | null {
  const comoEslabon = lugarEnLaCadena(ejercicio.patron, ejercicio.id)
  const vara =
    comoEslabon !== null ? { patron: ejercicio.patron, nivel: comoEslabon } : ejercicio.equivale
  if (!vara) return null
  const avance = avances.get(vara.patron)
  const actual = avance ? lugarEnLaCadena(vara.patron, avance.ejercicioId) : null
  if (actual === null) return null
  const eslabones = vara.nivel - actual
  return eslabones > 0 ? { patron: vara.patron, eslabones } : null
}

/** Los eslabones en palabras, como los dice §7.7: "un eslabón", "dos eslabones". */
const CUANTOS = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']
const eslabonesDichos = (n: number) => `${CUANTOS[n] ?? String(n)} ${n === 1 ? 'eslabón' : 'eslabones'}`

/**
 * "Está dos eslabones arriba de tu empuje." (§7.7), o `null` si no lo está.
 *
 * Es la línea de la Ficha, el aviso del Constructor y, en mayúsculas, el
 * rótulo de la hoja Cambiar. Informa y no frena: la elección ya fue tuya.
 */
export function lineaArribaDeTuNivel(
  ejercicio: Pick<Ejercicio, 'id' | 'patron' | 'equivale'>,
  avances: AvancesPorCadena,
): string | null {
  const arriba = arribaDeTuNivel(ejercicio, avances)
  return arriba ? `Está ${eslabonesDichos(arriba.eslabones)} arriba de ${tuCadena(arriba.patron)}.` : null
}

/**
 * La línea de nivel de la Ficha (§4.8): "Nivel II.", de `nivelDe`.
 *
 * Una variante suma por qué se elige así: "Se elige como el eslabón 6 de
 * empuje." Y con los avances, si está arriba de tu nivel, lo dice. Siempre hay
 * un nivel que decir, así que esta no devuelve `null`.
 */
export function lineaDeNivel(
  ejercicio: Pick<Ejercicio, 'id' | 'patron' | 'grado' | 'equivale'>,
  avances?: AvancesPorCadena,
): string {
  const partes = [`Nivel ${NOMBRE_BANDA[nivelDe(ejercicio)]}.`]
  const { equivale } = ejercicio
  if (equivale && lugarEnLaCadena(ejercicio.patron, ejercicio.id) === null) {
    partes.push(
      `Se elige como el eslabón ${equivale.nivel} de ${NOMBRE_PATRON[equivale.patron].toLowerCase()}.`,
    )
  }
  const arriba = avances ? lineaArribaDeTuNivel(ejercicio, avances) : null
  if (arriba) partes.push(arriba)
  return partes.join(' ')
}

// ─── La seguridad, la primera vez ───────────────────────────────────────

/**
 * Las formas de un error común, de la más completa a la más corta: entero, su
 * primera oración, y lo que va antes de los dos puntos. Lo que se corta es la
 * explicación; el error queda dicho con las palabras de la ficha.
 */
function formasDelError(error: string): string[] {
  const entero = error.trim()
  const primera = entero.split(/(?<=\.)\s/)[0] ?? entero
  const antesDeLosDosPuntos = primera.includes(': ') ? `${primera.split(': ')[0]}.` : primera
  return [...new Set([entero, primera, antesDeLosDosPuntos])].filter((f) => f.length > 1)
}

/**
 * La línea de seguridad (§6.6): la primera vez con un ejercicio, o con uno
 * arriba de tu nivel, uno de sus errores comunes, en el lugar de la víspera.
 *
 * "Primera vez con Flexiones diamante. Error común: poner las manos muy
 * adelante y cargar los hombros." Arriba de tu nivel sin ser la primera vez:
 * "Flexiones arqueras están arriba de tu empuje. Error común: …", o "Sentadilla
 * búlgara está arriba de tus piernas. …": el verbo va con el número del nombre
 * (`esPlural`).
 *
 * El error va con su rótulo y no como una orden suelta ("Primera vez con
 * Plancha: bajar la cadera…" se leería como una indicación de hacerlo): esta
 * línea se lee de reojo, en el renglón de la víspera, y por eso la ficha no
 * pone sus errores en el descanso (`Descanso.tsx`). Va el primer error de la
 * ficha que entra en 140 caracteres, entero o, si no entra, sin su
 * explicación; si ninguno entra, no hay línea.
 *
 * `primeraVez` lo sabe quien llama (que mira el historial); `avances`, si
 * llega, deja saber si está arriba de tu nivel. Informa y no frena.
 */
export function lineaDeSeguridad(
  ejercicio: Pick<Ejercicio, 'id' | 'nombre' | 'patron' | 'equivale' | 'erroresComunes'>,
  contexto: { primeraVez: boolean; avances?: AvancesPorCadena },
): string | null {
  const arriba = contexto.avances ? arribaDeTuNivel(ejercicio, contexto.avances) : null
  const antes = contexto.primeraVez
    ? `Primera vez con ${ejercicio.nombre}.`
    : arriba
      ? `${ejercicio.nombre} ${esPlural(ejercicio.nombre) ? 'están' : 'está'} arriba de ${tuCadena(arriba.patron)}.`
      : null
  if (antes === null) return null
  for (const error of ejercicio.erroresComunes) {
    for (const forma of formasDelError(error)) {
      const linea = `${antes} Error común: ${enMinuscula(forma)}`
      if (linea.length <= LARGO_DE_LINEA) return linea
    }
  }
  return null
}

// ─── La Ficha: equipo y requisito ───────────────────────────────────────

/**
 * Cómo se nombra cada cosa en una frase: el nombre del catálogo en minúscula,
 * salvo la banda, que en la Ficha es "banda elástica" (§7.6) para que nadie
 * piense en una vincha. La Ficha y los avisos del Constructor la nombran igual.
 */
const EQUIPO_EN_UNA_FRASE: Partial<Record<Equipo, string>> = { banda: 'banda elástica' }
export const equipoDicho = (equipo: Equipo) => EQUIPO_EN_UNA_FRASE[equipo] ?? enMinuscula(NOMBRE_EQUIPO[equipo])

/**
 * El pronombre de lo que se marca en el perfil: "No la marcaste" (la banda),
 * "No las marcaste" (las paralelas). Lo dado por tenido no está porque no se
 * marca.
 */
const PRONOMBRE: Partial<Record<Equipo, 'la' | 'lo' | 'las'>> = {
  barra: 'la',
  discos: 'la',
  banda: 'la',
  escalon: 'lo',
  paralelas: 'las',
  anillas: 'las',
}

/**
 * La línea de equipo de la Ficha (§4.8): "Pide: banda elástica."
 *
 * Si algo de lo que pide no está en tu equipo, lo suma: "No la marcaste en tu
 * equipo." (al lado va **Cambiar**, que lleva a Ajustes). Solo lo que se marca
 * en el perfil: lo dado por tenido no se marca, y decir "no lo marcaste" de
 * una pared sería falso. Si falta solo una parte de lo que pide, se nombra
 * ("No marcaste banda elástica en tu equipo."), porque el pronombre no diría
 * cuál.
 *
 * Sin el dato del equipo, o si no pide nada, `null`.
 */
export function lineaDeEquipo(
  ejercicio: Pick<Ejercicio, 'equipo'>,
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
): string | null {
  const pide = [...new Set(ejercicio.equipo ?? [])].filter((e) => e !== 'nada')
  if (pide.length === 0) return null
  const tiene = (e: Equipo) => ('has' in equipo ? equipo.has(e) : equipo.includes(e))
  const pideDicho = `Pide: ${enLista(pide.map(equipoDicho))}.`
  const faltan = pide.filter((e) => !tiene(e) && !DADOS_POR_TENIDOS.includes(e))
  if (faltan.length === 0) return pideDicho
  if (faltan.length < pide.length) {
    return `${pideDicho} No marcaste ${enLista(faltan.map(equipoDicho))} en tu equipo.`
  }
  const pronombres = faltan.map((e) => PRONOMBRE[e] ?? 'lo')
  const pronombre =
    pronombres.length === 1
      ? pronombres[0]
      : pronombres.every((p) => p === 'la' || p === 'las')
        ? 'las'
        : 'los'
  return `${pideDicho} No ${pronombre} marcaste en tu equipo.`
}

/**
 * La línea de requisito de la Ficha (§4.8, §6.6): "Pide antes: apoyo en
 * paralelas 3 × 30 s."
 *
 * Recibe los requisitos que todavía no se cumplen, como los da
 * `requisitosSinCumplir`, de las dos clases: el eslabón de otra cadena (con su
 * mínimo, si lo pide) y el ejercicio del historial con sus series. Sin
 * ninguno, `null`. Si alguno pide un ejercicio que no está en la app, tampoco
 * hay línea: nombrar solo una parte de lo que pide sería decir menos de lo
 * que es. Informa y no bloquea.
 */
export function lineaDeRequisito(sinCumplir: readonly RequisitoDelCatalogo[]): string | null {
  const dichos: string[] = []
  for (const requisito of sinCumplir) {
    const pedido =
      requisito.clase === 'avance'
        ? { id: requisito.requisito.ejercicioId, dosis: requisito.requisito.minimo }
        : { id: requisito.requisito.pide.ejercicioId, dosis: requisito.requisito.pide }
    const ejercicio = POR_ID.get(pedido.id)
    if (!ejercicio) return null
    const dicho = pedido.dosis
      ? `${enMinuscula(ejercicio.nombre)} ${dosisDicha(pedido.dosis, ejercicio.medida)}`
      : enMinuscula(ejercicio.nombre)
    if (!dichos.includes(dicho)) dichos.push(dicho)
  }
  return dichos.length > 0 ? `Pide antes: ${enLista(dichos)}.` : null
}

// ─── El chequeo y la molestia, en lo que armaste ────────────────────────

/** Si el ajuste del día le baja el número a este paso. */
function loBajaElAjuste(paso: PasoDelBorrador, ajuste: Pick<AjusteDelDia, 'factor'>): boolean {
  // La cuenta del chequeo es una sola: la de `ajusteParaFijos`, que es la que
  // reciben también los pasos de cadena. Se le pasa este paso como fijo para
  // usar esa misma cuenta y no una copia.
  const [bajado] = ajusteParaFijos([{ ...paso, clase: 'fijo' }], ajuste)
  return bajado !== undefined && bajado.objetivo.cantidad < paso.objetivo.cantidad
}

/**
 * La línea del chequeo en Rutina y Sector (§5.6 D, §7.8): "El chequeo de hoy
 * dio para bajar un poco: tus pasos de cadena ya bajaron.", con **Bajar
 * también los tuyos** al lado.
 *
 * Sale solo si el botón haría algo (`hayFijosParaBajar`): con un día sin
 * ajuste, o con fijos que el redondeo deja igual, la línea prometería un
 * cambio que no ocurre. Y "tus pasos de cadena ya bajaron" solo si alguno
 * bajó de verdad: un 5 por 0,9 redondea a 5, y una rutina sin pasos de cadena
 * no tiene ninguno que bajar. Entonces va solo la primera parte, que es lo
 * que dice §7.10: "El chequeo de hoy dio para bajar un poco."
 *
 * `pasos` son los de la sesión como salen de la rutina o del mix, antes del
 * ajuste. Con los pasos de cadena ya ajustados la línea puede decir menos,
 * nunca más: lo que ya bajó no vuelve a bajar en la cuenta.
 */
export function lineaDelChequeo(
  pasos: readonly PasoDelBorrador[],
  ajuste: Pick<AjusteDelDia, 'factor'>,
): string | null {
  if (!hayFijosParaBajar(pasos, ajuste)) return null
  const bajaronLosDeCadena = pasos.some(
    (paso) => claseDelPaso(paso) === 'cadena' && !paso.calentamiento && loBajaElAjuste(paso, ajuste),
  )
  return bajaronLosDeCadena
    ? 'El chequeo de hoy dio para bajar un poco: tus pasos de cadena ya bajaron.'
    : 'El chequeo de hoy dio para bajar un poco.'
}

/**
 * La línea de un paso que cambió por una molestia (§5.6 E, §7.8), en ámbar y
 * con **Dejarlo como lo armé** al lado: "Molestia en tracción: este paso bajó
 * a remo australiano bajo." o "Molestia en tracción: este paso se saltea hoy."
 *
 * Recibe un cambio de `pasosConMolestia`. La pantalla la pone en los fijos;
 * los pasos de cadena y de volumen llevan la línea de la sesión de
 * `molestia.ts`, que se llama igual y dice lo mismo de la cadena entera. Si
 * bajó a un ejercicio que no está en la app, `null`.
 */
export function lineaDeMolestia(cambio: Pick<CambioDelPaso, 'patron' | 'cambio' | 'a'>): string | null {
  const cadena = NOMBRE_PATRON[cambio.patron].toLowerCase()
  if (cambio.cambio === 'saltea') return `Molestia en ${cadena}: este paso se saltea hoy.`
  const abajo = cambio.a === undefined ? undefined : POR_ID.get(cambio.a)
  return abajo ? `Molestia en ${cadena}: este paso bajó a ${enMinuscula(abajo.nombre)}.` : null
}

/**
 * La derivación, en su versión corta (§7.8): la que propuso el rol 8 hasta
 * que firme la completa, con las señales de alarma, en P10. No es información
 * sobre recuperación: es cuándo dejar de preguntarle a una app.
 */
export const DERIVACION = 'Si es un dolor punzante o que no se va, pará y consultá a un profesional.'

// ─── El Cierre: lo que cambió en una rutina ─────────────────────────────

/** Lo que quedó de un paso después de todos sus cambios de la sesión. */
export interface LoDelPaso {
  /** Si se sumó en la sesión, con qué ejercicio terminó. */
  agregado?: string
  /** El ejercicio que tenía antes del primer cambio. */
  de?: string
  /** El que tiene después del último. */
  a?: string
  alFinal: boolean
  /**
   * Dónde está, en `cambios`, su último "pasar al final". En la sesión, de
   * los pasos que se pasaron al final queda último el que se pasó último, así
   * que **Actualizar la rutina** los mueve en este orden y no en el de su
   * primer toque.
   */
  alFinalEn?: number
}

/**
 * Los cambios de la sesión por paso, en el orden en que aparecen, sin los
 * salteados. Es la única cuenta de "qué cambió": la usan `lineaDeCambios` y
 * **Actualizar la rutina** (`aplicarCambios`).
 *
 * No sabe de la rutina, y hay cambios que en ella no hacen nada: pasar al
 * final uno que ya era el último de su sección, sumar uno con la rutina llena.
 * Por eso el Cierre no le pasa a `lineaDeCambios` los cambios de la sesión
 * sino `cambiosQueSeAplican` (`rutinasPropias.ts`), que son los que
 * `aplicarCambios` aplica de verdad: así ofrece exactamente lo que después se
 * aplica.
 */
export function cambiosPorPaso(cambios: readonly CambioEnSesion[]): Map<string, LoDelPaso> {
  const porPaso = new Map<string, LoDelPaso>()
  for (const [lugar, cambio] of cambios.entries()) {
    if (cambio.clase === 'salteado') continue
    const del = porPaso.get(cambio.pasoId) ?? { alFinal: false }
    if (cambio.clase === 'agregado') del.agregado = cambio.ejercicioId
    else if (cambio.clase === 'al-final') {
      del.alFinal = true
      del.alFinalEn = lugar
    } else if (del.agregado !== undefined) del.agregado = cambio.a
    else {
      del.de ??= cambio.de
      del.a = cambio.a
    }
    porPaso.set(cambio.pasoId, del)
  }
  return porPaso
}

/**
 * ESTA SESIÓN en una rutina cambiada (§7.5): "Cambiaste 2 cosas: Flexión pica
 * en vez de Flexión pica con pies elevados, y sumaste Plancha lateral."
 *
 * - **Los salteados no cuentan:** saltear una vez no es querer sacarlo.
 * - **Cada paso cuenta por lo que quedó**, no por cada toque: cambiarlo dos
 *   veces es una cosa ("C en vez de A"), y cambiarlo y volver al de antes no
 *   es ninguna. Uno que se sumó y después se cambió es "sumaste" con el
 *   último.
 * - **Pasar al final** es una cosa: cambia el orden de la rutina.
 * - **Hasta tres**, y después "y 2 más". Menos de tres si con tres la línea
 *   pasa de 140; y una cosa cuyo ejercicio ya no está en la app va en "más",
 *   porque no tiene nombre que decir.
 *
 * En una rutina, `cambios` son los de `cambiosQueSeAplican(rutina, cambios)`
 * y no los de la sesión: "pasaste Plancha al final" de un paso que ya era el
 * último de su sección, o "sumaste Plancha" con la rutina en 30 pasos,
 * nombrarían algo que **Actualizar la rutina** no hace. Con esos, la línea es
 * `null` exactamente cuando la rutina quedaría igual.
 *
 * `pasos` son los de la sesión, para nombrar el que pasó al final. Sin nada
 * que cuente, `null`.
 */
export function lineaDeCambios(
  cambios: readonly CambioEnSesion[],
  pasos: readonly Pick<PasoDelBorrador, 'id' | 'ejercicioId'>[] = [],
): string | null {
  const porPaso = cambiosPorPaso(cambios)
  const nombre = (id: string | undefined) => (id === undefined ? undefined : buscarItem(id)?.nombre)
  // Cada cosa que cuenta, con su texto; `null` si no tiene nombre que decir.
  const cosas: (string | null)[] = []
  for (const [pasoId, del] of porPaso) {
    if (del.agregado !== undefined) {
      const sumado = nombre(del.agregado)
      cosas.push(sumado ? `sumaste ${sumado}` : null)
      continue
    }
    if (del.de !== undefined && del.a !== undefined && del.de !== del.a) {
      const [de, a] = [nombre(del.de), nombre(del.a)]
      cosas.push(de && a ? `${a} en vez de ${de}` : null)
    }
    if (del.alFinal) {
      const ahora = del.a ?? pasos.find((p) => (p.id ?? p.ejercicioId) === pasoId)?.ejercicioId
      const movido = nombre(ahora)
      cosas.push(movido ? `pasaste ${movido} al final` : null)
    }
  }
  if (cosas.length === 0) return null

  const cuantas = `Cambiaste ${enPlural(cosas.length, 'cosa', 'cosas')}`
  const conNombre = cosas.filter((c): c is string => c !== null)
  for (let dichas = Math.min(3, conNombre.length); dichas > 0; dichas--) {
    const lista = conNombre.slice(0, dichas)
    const resto = cosas.length - dichas
    const tramos = resto > 0 ? [...lista, `${resto} más`] : lista
    const unidos =
      tramos.length === 1
        ? tramos[0]
        : `${tramos.slice(0, -1).join(', ')}, y ${tramos[tramos.length - 1]}`
    const linea = `${cuantas}: ${unidos}.`
    if (linea.length <= LARGO_DE_LINEA) return linea
  }
  return `${cuantas}.`
}

/**
 * ESTA SESIÓN con un fijo que llegó dos veces seguidas al techo (§5.6 B8,
 * §7.5): "Flexión pica: dos veces 3 × 12. ¿Pasás a Flexión pica elevada?" en
 * una rutina, con **Cambiar en la rutina** al lado; en un mix, "… La próxima
 * del mix va Flexión pica elevada.", porque ahí el cambio lo hace el mix. El
 * nombre es el sujeto de "va", así que con uno plural es "van Flexiones
 * declinadas" (`esPlural`).
 *
 * Quien llama sabe que fueron dos veces en el techo y cuál es el siguiente
 * (`vecinos` en una rutina, la variante que sigue en un mix). Sin siguiente
 * no hay nada que ofrecer, y la cifra sola sería celebrar la cantidad:
 * `null`. Lo mismo con un ejercicio que no está en la app.
 */
export function lineaDelTecho(techo: {
  ejercicioId: string
  /** Las series y la cantidad de esas dos veces. */
  series: number
  cantidad: number
  /** El que sigue, o `null` si no hay. */
  siguienteId: string | null
  en: 'rutina' | 'mix'
}): string | null {
  const ejercicio = POR_ID.get(techo.ejercicioId)
  const siguiente = techo.siguienteId === null ? undefined : POR_ID.get(techo.siguienteId)
  if (!ejercicio || !siguiente || siguiente.id === ejercicio.id) return null
  if (!(Number.isInteger(techo.series) && techo.series > 0 && techo.cantidad > 0)) return null
  const dato = `${ejercicio.nombre}: dos veces ${dosisDicha(techo, ejercicio.medida)}.`
  return techo.en === 'rutina'
    ? `${dato} ¿Pasás a ${siguiente.nombre}?`
    : `${dato} La próxima del mix ${esPlural(siguiente.nombre) ? 'van' : 'va'} ${siguiente.nombre}.`
}

// ─── El día ─────────────────────────────────────────────────────────────

/** "Una sesión", "3 sesiones"; "una movilidad", "2 movilidades". */
function cuantasDelDia(sesiones: number, movilidades: number): string {
  const deSesiones = sesiones === 1 ? 'Una sesión' : `${sesiones} sesiones`
  if (movilidades === 0) return deSesiones
  const deMovilidad = movilidades === 1 ? 'una movilidad' : `${movilidades} movilidades`
  return sesiones === 0 ? conMayuscula(deMovilidad) : `${deSesiones} y ${deMovilidad}`
}

/**
 * La glosa de Tu día (§4.3, §7.9): "3 sesiones: 9:10 · 13:30 · 19:05".
 *
 * La movilidad tiene su hora en la lista pero no cuenta como sesión, así que
 * se nombra aparte: "2 sesiones y una movilidad: 9:10 · 12:00 · 19:05", o
 * "Una movilidad: 12:00" si fue lo único. Las horas son las de `inicioDe`, en
 * el orden de `sesionesDelDia`, el mismo de la lista de abajo.
 *
 * Las sesiones viejas no guardaron cuándo empezaron y muestran la de cierre,
 * rotulada: si todas son así, "3 sesiones, cerradas a las 9:34 · 13:50 ·
 * 19:20"; si son solo algunas, cada una lleva "(cierre)". Sin nada ese día,
 * `null`: el vacío lo dice la pantalla ("Nada anotado este día.").
 *
 * Un solo "a las" sirve para toda la lista mientras todas las horas lleven el
 * mismo artículo. Con la una entre otras, cada hora lleva el suyo ("cerradas
 * a la 1:10 · a las 13:50"): uno solo, sacado de la primera, le pondría "la"
 * a las 13:50.
 */
export function lineaDelDia(historial: readonly Sesion[], dia: string): string | null {
  const delDia = sesionesDelDia(historial, dia)
  if (delDia.length === 0) return null
  const { sesiones, movilidades } = cuentaDelDia(historial, dia)
  const cuantas = cuantasDelDia(sesiones, movilidades)
  const inicios = delDia.map((s) => inicioDe(s))
  if (inicios.every((i) => i.esDeCierre)) {
    const dichas = inicios.map((i) => horaDicha(i.hora))
    const unArticulo = new Set(dichas.map(esLaUna)).size === 1
    const horas = unArticulo ? aLaHora(dichas.join(' · ')) : dichas.map(aLaHora).join(' · ')
    return `${cuantas}, ${delDia.length === 1 ? 'cerrada' : 'cerradas'} ${horas}`
  }
  const horas = inicios.map((i) => `${horaDicha(i.hora)}${i.esDeCierre ? ' (cierre)' : ''}`)
  return `${cuantas}: ${horas.join(' · ')}`
}

/**
 * La última vez de una zona, como glosa (§7.2): "Glúteos · última vez el
 * viernes." en Hoy sin plan y en OTRA ZONA; "Glúteos: no hay sesiones
 * anotadas todavía." si nunca se trabajó.
 *
 * Recibe lo que da `ultimaVezDeZona` (o la `ultimaVez` de una tarjeta de
 * `sugerenciasDeHoy`). Hoy lleva la hora ("hoy a las 9:10"), salvo en una
 * sesión vieja, que solo sabe la de cierre; ayer es "ayer", hasta 6 días el
 * día de la semana y después la fecha corta. El cuerpo completo no es una
 * zona y no tiene última vez: `null`, como un día que todavía no llegó.
 *
 * Una `ultimaVez` en `null` no quiere decir "nunca": quiere decir que ningún
 * día llegó al umbral de la zona, y tres flexiones son series de hombro sin
 * ser un día de Hombros. Por eso "no hay sesiones anotadas todavía" va solo
 * si quien llama dice que la zona no tiene ni una serie (`sinSeries`, de
 * `zonaSinSeries` o de la tarjeta). Sin ese dato, `null`: callar es mejor que
 * decir algo que puede ser falso.
 */
export function lineaUltimaVez(
  sector: Sector,
  ultimaVez: { fecha: string; sesion: Pick<Sesion, 'iniciadaEn' | 'finalizadaEn'> } | null,
  hoy: string,
  { sinSeries = false }: { sinSeries?: boolean } = {},
): string | null {
  if (sector === 'cuerpo') return null
  const nombre = NOMBRE_SECTOR[sector]
  if (!ultimaVez) return sinSeries ? `${nombre}: no hay sesiones anotadas todavía.` : null
  const cuando = cuandoFue(ultimaVez.fecha, hoy)
  if (cuando === null) return null
  const inicio = inicioDe(ultimaVez.sesion)
  const conHora = cuando === 'hoy' && !inicio.esDeCierre ? ` ${aLaHora(horaDicha(inicio.hora))}` : ''
  return `${nombre} · última vez ${cuando}${conHora}.`
}

// ─── La sesión a medio hacer ────────────────────────────────────────────

/**
 * Las series con algo hecho adentro, las mismas que guarda `cerrarSesion`.
 * Es la cuenta de `seriesHechas` de `borrador.ts`, que no se exporta.
 */
function seriesHechas(hechas: SesionEnCurso['hechas'] | undefined): number {
  return Object.values(hechas ?? {})
    .flat()
    .filter((s) => s.logrado > 0).length
}

/**
 * La hoja Sesión a medio hacer (§7.8): "Tenés a medio hacer Mix de glúteos,
 * de las 13:30, con 6 series."
 *
 * El nombre es el del origen (`origenDelBorrador`: un borrador viejo es el
 * "Plan"). La hora es `iniciadaEn`, la primera serie; un borrador viejo no la
 * tiene y no se inventa: va sin hora. El trabajo cuenta las series con algo
 * hecho y las ráfagas, y si no hay ninguna no se nombra lo que no hay. Sin
 * nombre, `null`.
 */
export function lineaDeBorrador(
  borrador: Pick<SesionEnCurso, 'origen' | 'corta' | 'iniciadaEn' | 'hechas' | 'rafagas'>,
): string | null {
  const nombre = origenDelBorrador(borrador).nombre.trim()
  if (nombre === '') return null
  const { iniciadaEn } = borrador
  const hora =
    typeof iniciadaEn === 'number' && Number.isFinite(iniciadaEn)
      ? `, ${deLaHora(horaDicha(iniciadaEn))}`
      : ''
  const series = seriesHechas(borrador.hechas)
  const rafagas = borrador.rafagas?.length ?? 0
  const trabajo = [
    ...(series > 0 ? [enPlural(series, 'serie', 'series')] : []),
    ...(rafagas > 0 ? [enPlural(rafagas, 'ráfaga', 'ráfagas')] : []),
  ]
  const con = trabajo.length > 0 ? `, con ${trabajo.join(' y ')}` : ''
  return `Tenés a medio hacer ${nombre}${hora}${con}.`
}
