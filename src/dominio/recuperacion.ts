/**
 * La recuperación, antes de empezar: si hay un dato que decir, cuál es.
 *
 * Con la libertad de empezar cualquier cosa, cuando quieras y las veces que
 * quieras, puede pasar que alguien repita a la tarde el mix de la mañana, o
 * que vuelva a un grupo que ayer llevó hasta casi no poder más. La app no lo
 * frena ni lo desaconseja: lo informa, con la cifra y la hora, en la pantalla
 * previa a empezar (§5.6 C y §7.3 de la reestructura). Empezar queda donde
 * está, del mismo color, y las alternativas van como botones al lado.
 *
 * Acá se decide **si** hay algo que decir y **con qué datos**; el texto está en
 * `lineas.ts`. Hay tres casos, y uno no dice nada:
 *
 * - **A**: grupos distintos. Nada que decir, y la función devuelve `null`.
 * - **B**: un principal de lo que vas a empezar ya tiene series hoy, y lo de
 *   hoy más lo que suma esta sesión pasa de `UMBRAL_MISMO_DIA`.
 * - **C**: si no saltó B, la última vez de ese grupo fue en las últimas
 *   24 horas y tuvo una serie con 1 repetición o menos en reserva.
 *
 * **Nunca hay un nivel de alarma.** El resultado no trae color, ni gravedad,
 * ni un "cuánto": trae la cifra, la hora y el nombre. Un nivel invitaría a
 * pintar la línea de ámbar o de rojo, y la línea informa, no prohíbe.
 *
 * Todo es puro: el instante llega como argumento (`ahora`) y nada mira el
 * reloj. Las series se cuentan con la regla del mapa (`musculos.ts`), así la
 * cifra que se dice es la misma que muestra Progreso, y la última vez de un
 * grupo es la de `ultimaVezDeZona` (`sectores.ts`), la misma que dice el
 * Sector justo arriba de esta línea.
 */

import { esMovilidad } from './adherencia'
import { CADENAS } from './biblioteca'
import { diaLocal } from './borrador'
import { inicioDe, type InicioDeSesion } from './dia'
import type { CadenaLeida } from './lineas'
import {
  APORTE,
  MUSCULOS_CUBIERTOS,
  PISO_DE_DOSIS,
  seriesPorMusculo,
  type Aporte,
  type Musculo,
} from './musculos'
import { yaLeidaHoy } from './progresion'
import { PRINCIPALES, ZONAS, ultimaVezDeZona, type Zona } from './sectores'
import type { ClaseDePaso, PasoDelBorrador, Patron, Sesion } from './tipos'

/**
 * De cuántas series fraccionales de un principal en el día para arriba se
 * informa, contando lo de hoy más lo que suma esta sesión (disparador B).
 *
 * Es criterio del equipo, apoyado en un preprint que encontró que, pasadas
 * unas 11 series por músculo en una sesión, no se detecta más crecimiento. El
 * estudio habla de una sesión; sumar el día entero lo decidimos nosotros. Con
 * 11, repetir el mix de Pecho avisa (9 + 9 = 18) y el primero del día no (9).
 * Con 10 ya hechas no avisaba nunca al repetir un mix, y con 6 en el día
 * hablaba en casi cualquier segunda sesión (Decisión 34). Cambiarlo es un PR
 * de una línea.
 */
export const UMBRAL_MISMO_DIA = 11

/**
 * Hasta cuántas repeticiones en reserva una serie cuenta como cerca del
 * fallo (disparador C): 1 o menos.
 */
export const CERCA_DEL_FALLO = 1

/**
 * Cuánto mira hacia atrás el disparador C, en milisegundos: 24 horas.
 *
 * Son horas y no días a propósito: la serie de anoche a las 21:40 está a
 * menos de un día de las 19:00 de hoy, aunque sea "ayer". Se cuentan en
 * milisegundos, así un cambio de hora no estira ni achica la ventana.
 */
export const VENTANA_CERCA_DEL_FALLO = 24 * 60 * 60 * 1000

/**
 * La sesión que se nombra: la última que trabajó el músculo o el grupo.
 *
 * Trae lo que la línea necesita para decir "la última a las 9:10" o "la última
 * vez fue ayer a las 21:40": el día de la sesión y su hora, que es la de
 * `inicioDe`, la misma de TU DÍA y de Tu día. En una sesión vieja que no
 * guardó cuándo empezó, la hora es la de cierre, y `esDeCierre` lo dice para
 * que no se lea como hora de arranque.
 */
export interface UltimaQueTrabajo extends InicioDeSesion {
  sesionId: string
  /** El día de la sesión, en AAAA-MM-DD local. */
  fecha: string
}

interface DatosDelDisparador {
  /**
   * El músculo que se nombra. En B, el principal con más series hoy entre los
   * que pasan del umbral; en C, el principal del grupo que más series tiene
   * hoy entre los que trabaja lo que vas a empezar.
   */
  musculo: Musculo
  /**
   * Las series fraccionales que el músculo ya recibió hoy, sin redondear. Se
   * redondean al mostrarlas, como en Progreso.
   */
  seriesHoy: number
  /** Las de hoy más las que suma esta sesión, sin redondear: "con esta, 14". */
  conEsta: number
  /** La última sesión que trabajó el músculo (B) o el grupo (C). */
  ultima: UltimaQueTrabajo
  /**
   * Las cadenas que esta sesión leería y que ya se leyeron hoy, con la hora
   * de esa lectura y en el orden de los pasos. En B la línea las nombra
   * ("Tracción ya se leyó hoy: esta sesión suma volumen y no la mueve.");
   * vacío si no hay ninguna.
   */
  cadenasLeidas: CadenaLeida[]
}

/**
 * Lo que hay que decir antes de empezar, cuando hay algo.
 *
 * `zona` es el grupo: la zona donde `musculo` es principal. En C es lo que la
 * línea nombra ("Espalda: la última vez fue ayer…"), y por eso ahí siempre
 * está. En B la línea nombra el músculo, y `zona` es `null` si el músculo no
 * es principal de ninguna zona (el serrato, los gemelos).
 */
export type DisparadorDeRecuperacion =
  | (DatosDelDisparador & { clase: 'B'; zona: Zona | null })
  | (DatosDelDisparador & { clase: 'C'; zona: Zona })

/**
 * Si hay algo que decir antes de empezar estos pasos, y con qué datos.
 *
 * Devuelve `null` cuando no hay nada que decir (disparador A, o ningún dato),
 * y si no, B o C, nunca los dos: C solo se mira si B no saltó.
 *
 * **B.** Los principales de lo que vas a empezar son los músculos que algún
 * paso carga con aporte 1, como en la prefatiga (`principalMasCargado`). Para
 * cada uno se suman las series que ya recibió hoy y las que suma esta sesión,
 * con la regla del mapa: cada serie por su aporte, del piso de dosis para
 * arriba. Salta si alguno ya tiene series hoy y el total pasa de
 * `UMBRAL_MISMO_DIA`. Una sesión sola de 15 no avisa: B habla de volver al
 * mismo músculo en el día, no del tamaño de una sesión.
 *
 * **C.** Los grupos de lo que vas a empezar son las zonas que tienen como
 * principal a alguno de esos músculos. Salta si la última vez de uno de esos
 * grupos (`ultimaVezDeZona`) terminó hace 24 horas o menos y tuvo una serie
 * del grupo con `CERCA_DEL_FALLO` repeticiones o menos en reserva. Mira la
 * última vez y no cualquier sesión de las 24 horas porque la línea dice "la
 * última vez fue ayer a las 21:40, con una serie con 1 repetición o menos en
 * reserva": si después hubo otra sesión de ese grupo sin una serie así, esa
 * frase sería falsa, y contradiría el "ÚLTIMA VEZ" que el Sector muestra justo
 * arriba. En ese caso no se dice nada, que es lo que se hace sin dato.
 *
 * Lo que vas a empezar no incluye la entrada en calor ni la movilidad, que no
 * son trabajo (§5.6 A); lo de hoy tampoco: ni la movilidad, ni los registros de
 * calentamiento. Hoy es el día local de `ahora`, y las sesiones de hoy son las
 * de esa `fecha`: una que arrancó ayer a las 23:40 y cerró a las 00:05 es de
 * ayer, como en Tu día.
 */
export function disparadorAntesDeEmpezar(
  pasos: readonly PasoDelBorrador[],
  historial: readonly Sesion[],
  ahora: number,
): DisparadorDeRecuperacion | null {
  const trabajo = pasos.filter(esTrabajo)
  const estaSesion = seriesDeLosPasos(trabajo)
  const principales = principalesDe(trabajo)
  if (principales.size === 0) return null

  const hoy = diaLocal(ahora)
  const deHoy = historial.filter((s) => s.fecha === hoy && !esMovilidad(s)).map(sinCalentamiento)
  const recibidoHoy = seriesPorMusculo(deHoy, hoy)
  const cuenta = (musculo: Musculo): CuentaDelMusculo => {
    const seriesHoy = recibidoHoy.get(musculo) ?? 0
    return { musculo, seriesHoy, conEsta: seriesHoy + (estaSesion.get(musculo) ?? 0) }
  }

  const enB = [...principales]
    .map(cuenta)
    .filter((c) => c.seriesHoy > 0 && c.conEsta > UMBRAL_MISMO_DIA)
    .sort(masCargado)[0]
  // `ultima` siempre está: si el músculo tiene series hoy, alguna sesión de
  // hoy se las dio. La guarda es para el compilador.
  const ultimaDeB = enB ? ultimaDeHoyQueCargo(enB.musculo, deHoy) : null
  if (enB && ultimaDeB) {
    return {
      clase: 'B',
      ...enB,
      zona: zonaDe(enB.musculo),
      ultima: ultimaDeB,
      cadenasLeidas: cadenasYaLeidas(pasos, hoy, historial),
    }
  }

  const todas = [...historial]
  const grupos: { zona: Zona; sesion: Sesion }[] = []
  for (const zona of ZONAS) {
    if (!PRINCIPALES[zona].some((m) => principales.has(m))) continue
    const vez = ultimaVezDeZona(zona, todas)
    if (vez && fueCercaDelFallo(zona, vez.sesion, ahora)) grupos.push({ zona, sesion: vez.sesion })
  }
  // Con dos grupos posibles se nombra el que más trabaja lo que vas a empezar
  // (en un mix de pecho, Pecho y no Brazos); después, el más reciente, y
  // después el orden de siempre.
  const enC = grupos.sort(
    (a, b) =>
      cifraEnEstaSesion(b.zona, estaSesion) - cifraEnEstaSesion(a.zona, estaSesion) ||
      b.sesion.finalizadaEn - a.sesion.finalizadaEn ||
      ZONAS.indexOf(a.zona) - ZONAS.indexOf(b.zona),
  )[0]
  if (!enC) return null

  // Siempre hay uno: la zona entró porque alguno de sus principales está en
  // lo que vas a empezar.
  const delGrupo = PRINCIPALES[enC.zona]
    .filter((m) => principales.has(m))
    .map(cuenta)
    .sort(masCargado)[0]
  if (!delGrupo) return null

  return {
    clase: 'C',
    ...delGrupo,
    zona: enC.zona,
    ultima: ultimaDe(enC.sesion),
    cadenasLeidas: cadenasYaLeidas(pasos, hoy, historial),
  }
}

/** Las series de un músculo: las de hoy y con esta sesión. */
interface CuentaDelMusculo {
  musculo: Musculo
  seriesHoy: number
  conEsta: number
}

/**
 * El orden para elegir el músculo que se nombra: el que más series tiene hoy
 * (§7.3); con las mismas, el que más suma con esta, y después el orden de
 * pantalla, para que dos pantallas no nombren músculos distintos para la
 * misma sesión.
 */
function masCargado(a: CuentaDelMusculo, b: CuentaDelMusculo): number {
  return b.seriesHoy - a.seriesHoy || b.conEsta - a.conEsta || ordenDe(a.musculo) - ordenDe(b.musculo)
}

// ─── Lo que vas a empezar ───────────────────────────────────────────────

/**
 * La clase de un paso, también de un borrador viejo que no la guardaba: la
 * misma deducción que `normalizarBorrador` y `molestia.ts`.
 */
function claseDelPaso(paso: PasoDelBorrador): ClaseDePaso {
  return paso.clase ?? (paso.bajada ? 'volumen' : paso.fijo ? 'fijo' : 'cadena')
}

/**
 * Si un paso es trabajo: ni la entrada en calor ni la movilidad, que no suman
 * al volumen (§5.6 A), ni un paso sin series, que no carga nada.
 */
function esTrabajo(paso: PasoDelBorrador): boolean {
  return !paso.calentamiento && claseDelPaso(paso) !== 'movilidad' && paso.objetivo.series > 0
}

/** Los aportes de dosis de un ejercicio: los de 0,5 para arriba. */
function dosisDe(ejercicioId: string): [Musculo, Aporte][] {
  const vector = APORTE[ejercicioId]
  if (!vector) return []
  return (Object.entries(vector) as [Musculo, Aporte][]).filter(([, a]) => a >= PISO_DE_DOSIS)
}

/**
 * Lo que suma esta sesión a cada músculo: las series del objetivo de cada
 * paso por su aporte. Es la cuenta de `seriesPorMusculo` antes de hacerlo; la
 * serie de cierre no entra porque todavía no existe.
 */
function seriesDeLosPasos(pasos: readonly PasoDelBorrador[]): Map<Musculo, number> {
  const suma = new Map<Musculo, number>()
  for (const paso of pasos) {
    for (const [musculo, aporte] of dosisDe(paso.ejercicioId)) {
      suma.set(musculo, (suma.get(musculo) ?? 0) + paso.objetivo.series * aporte)
    }
  }
  return suma
}

/** Los principales de lo que vas a empezar: lo que algún paso carga con aporte 1. */
function principalesDe(pasos: readonly PasoDelBorrador[]): Set<Musculo> {
  const principales = new Set<Musculo>()
  for (const paso of pasos) {
    for (const [musculo, aporte] of dosisDe(paso.ejercicioId)) {
      if (aporte === 1) principales.add(musculo)
    }
  }
  return principales
}

/** La cifra de una zona en esta sesión: su principal más cargado, como en el mapa. */
function cifraEnEstaSesion(zona: Zona, estaSesion: ReadonlyMap<Musculo, number>): number {
  return Math.max(0, ...PRINCIPALES[zona].map((m) => estaSesion.get(m) ?? 0))
}

/** El lugar de un músculo en la pantalla, para desempatar siempre igual. */
function ordenDe(musculo: Musculo): number {
  const i = MUSCULOS_CUBIERTOS.indexOf(musculo)
  return i === -1 ? MUSCULOS_CUBIERTOS.length : i
}

/** La zona donde un músculo es principal, o `null`. Ninguno lo es de dos. */
function zonaDe(musculo: Musculo): Zona | null {
  return ZONAS.find((zona) => PRINCIPALES[zona].includes(musculo)) ?? null
}

// ─── Lo que ya se hizo ──────────────────────────────────────────────────

/** La sesión sin sus registros de calentamiento, que no son trabajo. */
function sinCalentamiento(sesion: Sesion): Sesion {
  return sesion.registros.some((r) => r.calentamiento)
    ? { ...sesion, registros: sesion.registros.filter((r) => !r.calentamiento) }
    : sesion
}

function ultimaDe(sesion: Sesion): UltimaQueTrabajo {
  return { sesionId: sesion.id, fecha: sesion.fecha, ...inicioDe(sesion) }
}

/**
 * La última sesión de hoy que le dio series al músculo: la de cierre más
 * tarde, como en `ultimaVezDeZona`. Con pecho a las 9:10 y glúteos a las
 * 13:30, la última de pectoral es la de las 9:10. Un registro sin series no le
 * dio nada, y no hace "la última".
 */
function ultimaDeHoyQueCargo(musculo: Musculo, deHoy: readonly Sesion[]): UltimaQueTrabajo | null {
  const cargaron = deHoy
    .filter((s) =>
      s.registros.some(
        (r) => r.series.length > 0 && (APORTE[r.ejercicioId]?.[musculo] ?? 0) >= PISO_DE_DOSIS,
      ),
    )
    .sort((a, b) => b.finalizadaEn - a.finalizadaEn || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const ultima = cargaron[0]
  return ultima ? ultimaDe(ultima) : null
}

/** Si un ejercicio le da dosis a algún principal de la zona: la regla de `sectores.ts`. */
function cargaLaZona(ejercicioId: string, zona: Zona): boolean {
  return PRINCIPALES[zona].some((m) => (APORTE[ejercicioId]?.[m] ?? 0) >= PISO_DE_DOSIS)
}

/**
 * Si esta sesión terminó hace 24 horas o menos y tuvo una serie de la zona
 * con 1 repetición o menos en reserva.
 *
 * Se mide desde el cierre porque la hora de cada serie no se guarda y el
 * cierre es lo único que toda sesión tiene; las reservas se preguntan en la
 * última serie de cada ejercicio, que es la más cercana al cierre. Una sesión
 * que dice haber terminado después de `ahora` (un reloj que se corrió) no
 * entra: sin una hora creíble no hay dato.
 */
function fueCercaDelFallo(zona: Zona, sesion: Sesion, ahora: number): boolean {
  const hace = ahora - sesion.finalizadaEn
  if (!(hace >= 0 && hace <= VENTANA_CERCA_DEL_FALLO)) return false
  return sesion.registros.some(
    (r) =>
      !r.calentamiento &&
      cargaLaZona(r.ejercicioId, zona) &&
      r.series.some((s) => typeof s.reservas === 'number' && s.reservas <= CERCA_DEL_FALLO),
  )
}

/** De qué cadena es eslabón cada ejercicio. */
const CADENA_DEL_ESLABON: ReadonlyMap<string, Patron> = new Map(
  CADENAS.flatMap((c) => c.ejercicios.map((id): [string, Patron] => [id, c.patron])),
)

/**
 * Las cadenas que estos pasos leerían y que ya se leyeron hoy.
 *
 * Solo lee un paso `cadena` que sea eslabón de su cadena; un fijo, un volumen
 * (`bajada`) o la entrada en calor no leen nunca (§5.6 B), así que de esos no
 * hay nada que decir. La hora es la de la lectura de hoy (`yaLeidaHoy`).
 */
function cadenasYaLeidas(
  pasos: readonly PasoDelBorrador[],
  hoy: string,
  historial: readonly Sesion[],
): CadenaLeida[] {
  const leidas: CadenaLeida[] = []
  for (const paso of pasos) {
    if (claseDelPaso(paso) !== 'cadena' || paso.fijo || paso.bajada || paso.calentamiento) continue
    const patron = CADENA_DEL_ESLABON.get(paso.ejercicioId)
    if (!patron || leidas.some((l) => l.patron === patron)) continue
    const hora = yaLeidaHoy(patron, hoy, historial)
    if (hora !== null) leidas.push({ patron, hora })
  }
  return leidas
}
