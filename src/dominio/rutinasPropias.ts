/**
 * Las rutinas propias: lo que la persona arma, y cómo se vuelve una sesión.
 *
 * Una rutina guarda pasos y no ejercicios con números, y la diferencia es todo
 * el archivo. Un paso `cadena` no nombra un ejercicio: dice "lo que toque de
 * empuje", y el día que la cadena se mueve, la rutina se mueve con ella. Un
 * paso `fijo` sí lo nombra, con los números que escribió la persona, y sube
 * solo dentro de la ventana de su ficha (la doble progresión, §5.6 B8). Así la
 * misma rutina sirve dentro de seis meses sin que nadie la toque.
 *
 * Todo lo que decide vive acá y es puro: el plan de hoy (`planDeRutina`), los
 * avisos del Constructor (`revisarRutina`), las tres formas de nacer de otra
 * cosa (`pasoDesdeEjercicio`, `rutinaDesdeSesion`, `rutinaDesdeMix`), lo que
 * hace **Actualizar la rutina** en el Cierre (`aplicarCambios`, y
 * `cambiosQueSeAplican` para que el Cierre nombre eso mismo) y el nombre que
 * no pisa a otro (`nombreLibre`). Nada lee la base ni el reloj: los ids,
 * el momento y el historial llegan como argumentos, y con la misma entrada
 * sale siempre lo mismo.
 *
 * ## Lo que no decide
 *
 * Cómo lee la sesión el motor: eso es `progresion.ts`, y un paso fijo no lee
 * nunca aunque sea tu eslabón (§5.6 B1). Ni la molestia, ni el chequeo, ni el
 * equipo: los aplican `molestia.ts`, `estado.ts` y `equipo.ts`, y acá solo se
 * los llama, para que una rutina, un mix y el plan bajen exactamente igual.
 */

import { RECORTE_DE_VUELTA } from './adherencia'
import { ejercicioDelBloque } from './bajada'
import { CADENA_POR_PATRON, NOMBRE_PATRON, POR_ID } from './biblioteca'
import { requisitosSinCumplir, textoBuscable } from './catalogo'
import { TOPE_DE_PASOS } from './copia'
import { DADOS_POR_TENIDOS, alcanza } from './equipo'
import { ajusteParaFijos, type AjusteDelDia } from './estado'
import { laVezPasada } from './estadisticas'
import {
  arribaDeTuNivel,
  cambiosPorPaso,
  enLista,
  enMinuscula,
  equipoDicho,
  lineaArribaDeTuNivel,
  lineaDeRequisito,
  type LoDelPaso,
} from './lineas'
import { pasosConMolestia, type FijosConMolestia } from './molestia'
import { buscarMovilidad, type FichaMovilidad } from './movilidad'
import { NOMBRE_MUSCULO, principalMasCargado, type Musculo } from './musculos'
import { PREFATIGA, cumpleCadaSerie, incremento } from './progresion'
import { NOMBRE_SECTOR } from './sectores'
import type {
  Avance,
  CambioEnSesion,
  Ejercicio,
  Equipo,
  Objetivo,
  PasoDeRutina,
  PasoDelBorrador,
  Patron,
  RegistroEjercicio,
  RutinaPropia,
  SeccionDelPaso,
  Sector,
  Serie,
  Sesion,
} from './tipos'

/**
 * Una rutina llega hasta 30 pasos (Decisión 81): más no entra en una sesión
 * razonable ni en la pantalla. Vive en `copia.ts`, que la necesitó primero
 * para rechazar una copia con más, y se exporta desde acá también porque es
 * una regla de la rutina: una sola constante, así la copia y el Constructor
 * no pueden decir dos topes distintos.
 */
export { TOPE_DE_PASOS }

/** Lo más largo que puede ser un nombre de rutina, el mismo que revisa la copia. */
export const LARGO_DEL_NOMBRE = 40

/** El nombre de una rutina a la que nadie le escribió uno (§4.11). */
export const RUTINA_NUEVA = 'Rutina nueva'

/**
 * El orden de las secciones en la sesión. La Rutina y el Constructor dibujan
 * ENTRADA, PRINCIPAL y FINAL en este orden, así que la sesión corre igual:
 * un paso que se pasó a Final sin moverlo de lugar va al final.
 */
const ORDEN_DE_SECCION: Record<SeccionDelPaso, number> = { entrada: 0, principal: 1, final: 2 }

/** Los avances por cadena, como los da la base. */
type Avances = ReadonlyMap<Patron, Avance>

// ─── Lo chico que se repite ─────────────────────────────────────────────

/** Un número entero dentro de un rango: lo que la copia acepta de cada campo. */
function entre(min: number, max: number, valor: number): number {
  return Math.min(max, Math.max(min, Math.round(valor)))
}

const seriesValidas = (n: number) => entre(1, 10, n)
const cantidadValida = (n: number) => entre(1, 300, n)
const descansoValido = (n: number) => entre(0, 600, n)

/**
 * Un texto cortado a `largo` unidades, sin partir un emoji al medio. La copia
 * mide con `length`, que cuenta unidades de UTF-16, y un emoji son dos.
 */
function recortar(texto: string, largo: number): string {
  let cortado = ''
  for (const letra of texto) {
    if (cortado.length + letra.length > largo) break
    cortado += letra
  }
  return cortado
}

/** Los pasos en el orden en que corren: por sección, y adentro como vienen. */
function enOrden<T extends { seccion?: SeccionDelPaso }>(pasos: readonly T[]): T[] {
  return pasos
    .map((paso, i) => ({ paso, i }))
    .sort(
      (a, b) =>
        ORDEN_DE_SECCION[a.paso.seccion ?? 'principal'] -
          ORDEN_DE_SECCION[b.paso.seccion ?? 'principal'] || a.i - b.i,
    )
    .map(({ paso }) => paso)
}

/** La cadena de la que un ejercicio es eslabón, o `null` si no está en `CADENAS`. */
function cadenaDelEslabon(ejercicio: Pick<Ejercicio, 'id' | 'patron'>): Patron | null {
  return CADENA_POR_PATRON.get(ejercicio.patron)?.ejercicios.includes(ejercicio.id)
    ? ejercicio.patron
    : null
}

/** Si el ejercicio es el eslabón en el que está tu cadena hoy. */
function esTuEslabon(
  ejercicio: Pick<Ejercicio, 'id' | 'patron'>,
  avances: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId'>>,
): boolean {
  const patron = cadenaDelEslabon(ejercicio)
  return patron !== null && avances.get(patron)?.ejercicioId === ejercicio.id
}

/**
 * Lo que nombra un id: un ejercicio de fuerza, una ficha de movilidad o nada.
 *
 * Se mira el id y no la clase del paso: los dos catálogos no se pisan
 * (`movilidad.test.ts`), así que el id solo alcanza para saber qué es. Si un
 * paso `fijo` llegara a nombrar una ficha de movilidad, se corre como lo que
 * es, y no se dice "ya no está" de algo que sí está.
 */
type Nombrado =
  | { clase: 'fuerza'; ejercicio: Ejercicio }
  | { clase: 'movilidad'; ficha: FichaMovilidad }
  | null

function nombrado(id: string | undefined): Nombrado {
  if (id === undefined) return null
  const ejercicio = POR_ID.get(id)
  if (ejercicio) return { clase: 'fuerza', ejercicio }
  const ficha = buscarMovilidad(id)
  return ficha ? { clase: 'movilidad', ficha } : null
}

// ─── Un paso nuevo ──────────────────────────────────────────────────────

/** Lo que hace falta para un paso nuevo, además del ejercicio. */
export interface PasoNuevo {
  /** El id del paso: en la pantalla, `nuevoId()` (`crypto.randomUUID()`). */
  id: string
  /**
   * Dónde va. Sin decirlo: la fuerza en Principal (la hoja Agregar a una
   * rutina agrega "al final de Principal", §4.1), la movilidad en Entrada y
   * los estiramientos de `despues` en Final, que es donde los pone §6.4.
   */
  seccion?: SeccionDelPaso
  /**
   * Los avances, para saber si es tu eslabón. Sin ellos, todo entra fijo: no
   * se puede afirmar que algo es tu eslabón sin mirar dónde está tu cadena.
   */
  avances?: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId'>>
  /** Los pasos que ya tiene la rutina, para no sumar un segundo que lea la misma cadena. */
  pasos?: readonly Pick<PasoDeRutina, 'clase' | 'patron'>[]
}

/**
 * Un paso nuevo a partir de un ejercicio del catálogo (el selector, la hoja
 * Agregar a una rutina), o `null` si el id no es de nada que la app conozca.
 *
 * - **Fuerza:** entra fijo con lo bajo de la ventana de su ficha y sus
 *   series: "3 × 8–12 · 90 s" queda en 3 × 8 (§3, R4). El descanso no se
 *   escribe: un paso sin descanso usa el de la ficha (§5.2), que es el mismo
 *   número y sigue a la ficha si algún día cambia.
 * - **Tu eslabón actual** entra como paso `cadena` ("Hoy: 3 × 8, lo pone tu
 *   nivel"), la misma regla que `?ejercicio=` (§2.4). Salvo que la rutina ya
 *   tenga un paso que siga esa cadena: dos pasos que leen la misma cadena no
 *   se arman nunca (§5.6 G4), así que el segundo entra fijo.
 * - **Movilidad:** con la dosis de su ficha.
 *
 * Sin `editadoEn`: lo bajo de la ventana no lo eligió nadie, es el punto de
 * partida, así que la doble progresión sigue desde la última vez que hiciste
 * ese ejercicio, en cualquier lado (`objetivoDelFijo`). `editadoEn` lo pone
 * la pantalla cuando la persona escribe sus propios números.
 */
export function pasoDesdeEjercicio(ejercicioId: string, nuevo: PasoNuevo): PasoDeRutina | null {
  const item = nombrado(ejercicioId)
  if (!item) return null

  if (item.clase === 'movilidad') {
    const { ficha } = item
    return {
      id: nuevo.id,
      clase: 'movilidad',
      ejercicioId: ficha.id,
      series: seriesValidas(ficha.dosis.series),
      cantidad: cantidadValida(ficha.dosis.cantidad),
      seccion: nuevo.seccion ?? (ficha.despues ? 'final' : 'entrada'),
    }
  }

  const { ejercicio } = item
  const seccion = nuevo.seccion ?? 'principal'
  const patron = cadenaDelEslabon(ejercicio)
  const yaLaSigue = (nuevo.pasos ?? []).some((p) => p.clase === 'cadena' && p.patron === patron)
  if (patron !== null && nuevo.avances && esTuEslabon(ejercicio, nuevo.avances) && !yaLaSigue) {
    return {
      id: nuevo.id,
      clase: 'cadena',
      patron,
      series: seriesValidas(ejercicio.series),
      seccion,
    }
  }
  return {
    id: nuevo.id,
    clase: 'fijo',
    ejercicioId: ejercicio.id,
    series: seriesValidas(ejercicio.series),
    cantidad: cantidadValida(ejercicio.ventana.min),
    seccion,
  }
}

// ─── La doble progresión de un fijo ─────────────────────────────────────

/**
 * Lo que se le pide hoy a un ejercicio fijo: la doble progresión (§5.6 B8,
 * Decisión 41).
 *
 * Mira la última vez que se hizo ese ejercicio, venga de donde venga (una
 * rutina, un mix, una sesión libre):
 *
 * - **Si todas las series llegaron al objetivo**, el objetivo más
 *   `incremento(medida, cantidad)` (10 % con mínimo de 1 repetición, 15 %
 *   con mínimo de 3 s), hasta el techo de la ventana. Es la misma cuenta del
 *   motor, así que un fijo y un eslabón suben al mismo ritmo.
 * - **Si no**, repite el objetivo: ni sube ni baja. Bajar un número que
 *   escribió la persona es decidir por ella, y un mal día no es una regla.
 * - **Sin historial**, `paso.cantidad` o lo bajo de la ventana.
 *
 * Un objetivo que ya pasaba el techo (lo escribió así la persona) no se
 * recorta: el techo frena la subida, no baja nada.
 *
 * Qué cuenta como "la última vez":
 *
 * - **En una rutina, solo después de `paso.editadoEn`.** Si la persona
 *   escribió sus números, los de antes ya no mandan.
 * - **Ni la entrada en calor, ni el Reloj, ni la serie de cierre:** es la
 *   misma "vez pasada" que muestra la sesión al lado de cada casillero
 *   (`laVezPasada`), así el número propuesto y la vara dicen lo mismo.
 * - **Ni las sesiones `corta`** (las livianas y "Solo tengo 7 minutos"):
 *   bajan el objetivo a propósito, y una liviana cumplida subiría desde ese
 *   número bajado, o sea que el fijo retrocedería por haber hecho la versión
 *   liviana. Las versiones livianas suman volumen y no mueven nada (§5.6 F).
 * - Con dos sesiones el mismo día, la que cerró más tarde.
 *
 * Las series son las del paso (las que eligió la persona) o las de la ficha;
 * los kilos, los del paso o, si no tiene, los que se levantaron esa última
 * vez. Levantados y no propuestos: Entrenar anota los kilos en cada serie
 * (los discos se cambian entre serie y serie), y el objetivo guarda lo que se
 * propuso. Es el `kg` de `laVezPasada`, el más alto de las series sin la de
 * cierre: la misma vara que la sesión muestra al lado y que usa el plan para
 * un accesorio. Con el propuesto, quien subió de 20 a 25 kg volvería a ver
 * 20, y quien nunca tuvo kilos propuestos no vería los que levantó.
 */
export function objetivoDelFijo(
  paso: Partial<Pick<PasoDeRutina, 'series' | 'cantidad' | 'kg' | 'editadoEn'>>,
  ejercicio: Pick<Ejercicio, 'id' | 'medida' | 'ventana' | 'series'>,
  historial: readonly Sesion[],
): Objetivo {
  const desde = paso.editadoEn
  // De la más nueva a la más vieja por la hora de cierre: `laVezPasada` ordena
  // por fecha y deja como estaban las del mismo día, así que gana la última.
  const validas = historial
    .filter((s) => s.tipo !== 'corta' && (desde === undefined || s.finalizadaEn > desde))
    .sort((a, b) => b.finalizadaEn - a.finalizadaEn)
  // El día de referencia solo cuenta los días desde entonces, que acá no se usa.
  const vez = laVezPasada(validas, ejercicio.id, validas[0]?.fecha ?? '')

  const series = paso.series ?? ejercicio.series
  const kg = paso.kg ?? vez?.kg
  const conKilos = (cantidad: number): Objetivo => ({
    series,
    cantidad: Math.max(1, cantidad),
    ...(kg !== undefined ? { kg } : {}),
  })

  if (!vez) return conKilos(paso.cantidad ?? ejercicio.ventana.min)

  const antes = vez.objetivo.cantidad
  // Los logros de `laVezPasada` ya vienen sin la serie de cierre y sin las
  // vacías, que tampoco cumplen: rearmados como series, la cuenta es la del
  // motor.
  const cumplio = cumpleCadaSerie(
    vez.objetivo,
    vez.logros.map((logrado): Serie => ({ logrado })),
  )
  if (!cumplio) return conKilos(antes)
  const subido = Math.min(antes + incremento(ejercicio.medida, antes), ejercicio.ventana.max)
  return conKilos(Math.max(antes, subido))
}

// ─── El plan de una rutina ──────────────────────────────────────────────

/** Lo que hace falta para armar la sesión de una rutina. */
export interface ContextoDelPlan {
  avances: Avances
  /** Las sesiones guardadas, para la doble progresión de los fijos. */
  historial: readonly Sesion[]
  /**
   * El ajuste del chequeo de hoy (`ajusteDelDia`). Baja los pasos de cadena,
   * como en el plan, venga de donde venga la sesión (§5.6 D). Sin él, nada.
   */
  ajuste?: Pick<AjusteDelDia, 'factor'>
  /** Una sesión de vuelta: los pasos de cadena bajan además `RECORTE_DE_VUELTA`, como en el plan. */
  vuelta?: boolean
  /**
   * **Bajar también los tuyos**: el ajuste del chequeo también a los fijos
   * (`ajusteParaFijos`). Nunca corre solo: los números de un fijo los escribió
   * la persona.
   */
  bajarLosTuyos?: boolean
  /** Las cadenas con molestia de hoy (§5.6 E). Sin ninguna, el plan no cambia. */
  molestias?: Patron | Iterable<Patron> | null
  /** "Dejarlo como lo armé": `como-los-armaste`. Por defecto, la regla del plan. */
  fijos?: FijosConMolestia
  /** Lo anotado en la sesión en curso, por id de paso: lo empezado no cambia. */
  hechas?: Readonly<Record<string, readonly Serie[]>>
}

/** La misma cuenta del chequeo (la de `ajusteParaFijos`), aplicada a un paso de cadena. */
function conElFactor(paso: PasoDelBorrador, factor: number): PasoDelBorrador {
  // `ajusteParaFijos` es la única cuenta del ajuste; se le pasa este paso
  // como fijo para usar esa misma y no una copia, como hace `lineas.ts`.
  const [bajado] = ajusteParaFijos([{ ...paso, clase: 'fijo' }], { factor })
  return bajado && bajado.objetivo !== paso.objetivo ? { ...paso, objetivo: bajado.objetivo } : paso
}

/**
 * Un paso de la rutina como lo corre la sesión, sin molestia ni ajuste, o
 * `null` si hoy no se puede armar.
 *
 * Un paso fijo o de volumen en Entrada va como entrada en calor
 * (`calentamiento`): es la serie fácil de la entrada de un mix (§6.3), la que
 * vuelve en `rutinaDesdeMix`, y no es trabajo, así que no suma al mapa, no es
 * "la vez pasada" y el chequeo no la baja. Un paso de cadena en Entrada sigue
 * leyendo: "Sigue tu nivel" lo eligió la persona.
 */
function pasoDelPlan(paso: PasoDeRutina, contexto: ContextoDelPlan): PasoDelBorrador | null {
  const enLaEntrada = paso.seccion === 'entrada'
  const comun = {
    id: paso.id,
    seccion: paso.seccion,
    ...(paso.descansoSegundos !== undefined ? { descansoSegundos: paso.descansoSegundos } : {}),
  }

  if (paso.clase === 'cadena' || paso.clase === 'volumen') {
    const cadena = paso.patron === undefined ? undefined : CADENA_POR_PATRON.get(paso.patron)
    if (!cadena) return null
    // La misma resolución que el plan de siempre: el eslabón del motor con
    // su objetivo, o el anterior con la dosis de la bajada. En el primer
    // eslabón no hay uno más fácil y el paso de volumen no va.
    const resuelto = ejercicioDelBloque(
      paso.clase === 'volumen' ? { patron: cadena.patron, volumen: true } : { patron: cadena.patron },
      contexto.avances.get(cadena.patron),
      POR_ID,
      cadena,
      { tieneBarraCargable: true },
    )
    if (!resuelto) return null
    if (paso.clase === 'cadena') {
      return { ...comun, ejercicioId: resuelto.ejercicio.id, objetivo: resuelto.objetivo, clase: 'cadena' }
    }
    return {
      ...comun,
      ejercicioId: resuelto.ejercicio.id,
      objetivo: resuelto.objetivo,
      bajada: true,
      clase: 'volumen',
      ...(enLaEntrada ? { calentamiento: true as const } : {}),
    }
  }

  const item = nombrado(paso.ejercicioId)
  if (!item) return null
  if (item.clase === 'movilidad') {
    return {
      ...comun,
      ejercicioId: item.ficha.id,
      objetivo: {
        series: paso.series,
        cantidad: paso.cantidad ?? item.ficha.dosis.cantidad,
      },
      clase: 'movilidad',
    }
  }
  return {
    ...comun,
    ejercicioId: item.ejercicio.id,
    objetivo: objetivoDelFijo(paso, item.ejercicio, contexto.historial),
    clase: 'fijo',
    fijo: true,
    ...(enLaEntrada ? { calentamiento: true as const } : {}),
  }
}

/**
 * La sesión de una rutina: un `PasoDelBorrador` por paso, en el orden de las
 * secciones.
 *
 * - **Un paso `cadena`** toma el eslabón y el objetivo del motor
 *   (`ejercicioDelBloque`), y es lo único que lee su cadena.
 * - **Un paso `volumen`**, el eslabón anterior con la dosis de la bajada, y
 *   se guarda con `bajada` (§5.2).
 * - **Un fijo**, su ejercicio con sus números, subidos por la doble
 *   progresión (`objetivoDelFijo`). Se guarda con `fijo`: no lee aunque sea
 *   tu eslabón (§5.6 B1).
 * - **La movilidad**, con su dosis.
 * - **Un id desconocido se saltea**, y también un paso de volumen sin dónde
 *   bajar: la sesión nunca se rompe por un paso (§5.4, punto 6). La pantalla
 *   lo dice con `revisarRutina`.
 * - Una rutina sin pasos da un plan vacío.
 *
 * Con el contexto, en este orden: el ajuste del día y la vuelta a los pasos de
 * cadena; **Bajar también los tuyos** a los fijos (`ajusteParaFijos`); y la
 * molestia (`pasosConMolestia`), al final, porque lo que baja por molestia se
 * rearma desde lo bajo de la ventana del eslabón de abajo y no tiene que
 * llevar encima otro recorte. Ni la molestia ni el chequeo saltean ni cambian
 * un paso sin que el contexto lo pida: sin esos campos, sale lo que la
 * persona armó.
 *
 * La versión liviana (`&liviana=1`, §5.6 F) no va acá: es la misma para el
 * plan, una rutina y una repetición, y la arma quien resuelve el pedido.
 */
export function planDeRutina(
  rutina: Pick<RutinaPropia, 'pasos'>,
  contexto: ContextoDelPlan,
): PasoDelBorrador[] {
  const factor = (contexto.ajuste?.factor ?? 1) * (contexto.vuelta ? RECORTE_DE_VUELTA : 1)
  let pasos = enOrden(rutina.pasos)
    .map((paso) => pasoDelPlan(paso, contexto))
    .filter((paso): paso is PasoDelBorrador => paso !== null)
    .map((paso) => (paso.clase === 'cadena' && factor < 1 ? conElFactor(paso, factor) : paso))

  if (contexto.bajarLosTuyos && contexto.ajuste) pasos = ajusteParaFijos(pasos, contexto.ajuste)

  if (contexto.molestias) {
    pasos = pasosConMolestia(pasos, contexto.molestias, {
      ...(contexto.fijos ? { fijos: contexto.fijos } : {}),
      ...(contexto.hechas ? { hechas: contexto.hechas } : {}),
    }).pasos
  }
  return pasos
}

// ─── Los avisos del Constructor ─────────────────────────────────────────

/**
 * Un aviso debajo de un paso (§4.11, §7.6), con el dato que lo sostiene para
 * que la pantalla ponga su botón ("Sí, que siga", "Subirlo al principio").
 */
export type AvisoDeRutina =
  | { clase: 'ya-no-esta'; pasoId: string; texto: string }
  | { clase: 'que-siga'; pasoId: string; patron: Patron; texto: string }
  | { clase: 'arriba'; pasoId: string; patron: Patron; eslabones: number; texto: string }
  | { clase: 'requisito'; pasoId: string; texto: string }
  | { clase: 'ya-hay-uno'; pasoId: string; patron: Patron; texto: string }
  | { clase: 'prefatiga'; pasoId: string; musculo: Musculo; series: number; texto: string }
  | { clase: 'equipo'; pasoId: string; faltan: Equipo[]; texto: string }

/** Lo que hace falta para revisar una rutina. */
export interface ContextoDeLaRevision {
  avances: Avances
  /** Las sesiones guardadas: los requisitos de historial y la progresión de los fijos. */
  historial: readonly Sesion[]
  /** "Con lo que tengo" (`equipoDe`). */
  equipo: readonly Equipo[] | ReadonlySet<Equipo>
}

/** Lo que dice un paso con un id que la app ya no tiene (§4.10, §5.4). */
const YA_NO_ESTA = 'Este ejercicio ya no está en la app.'

/** Una cadena en minúscula, como va en el medio de un aviso: "empuje", "tracción". */
const cadenaDicha = (patron: Patron) => NOMBRE_PATRON[patron].toLowerCase()

/**
 * Los avisos de cada paso de una rutina, en el orden en que corren (§4.11):
 *
 * - **"Este ejercicio ya no está en la app."** Un id que no existe: se ve en
 *   su fila y la sesión lo saltea.
 * - **"Es tu eslabón de empuje. ¿Que siga tu nivel?"** Un fijo con tu eslabón
 *   actual, si la rutina todavía no tiene un paso que siga esa cadena y la
 *   persona no eligió "Dejarlo fijo" (`dejarFijo`). Uno en Entrada no: es la
 *   entrada en calor, y que siga tu nivel la haría leer la cadena.
 * - **"Está dos eslabones arriba de tu empuje."** Un fijo arriba de tu nivel.
 * - **"Pide antes: apoyo en paralelas 3 × 30 s."** Un fijo con un requisito
 *   que no cumplís. Informa y no bloquea (§6.6).
 * - **"Ya hay un paso que sigue tu nivel de empuje: este suma volumen."** Un
 *   segundo paso de cadena del mismo patrón: decide el primero (§5.6 B3).
 * - **"Va después de 7 series de pectoral: si sale menos, tu nivel no baja."**
 *   El paso que lee su cadena, cuando los pasos de antes ya le cargaron
 *   `PREFATIGA` series fraccionales o más a un principal del eslabón (§5.6
 *   B5): la lectura va protegida. La cifra es la del mapa, redondeada como en
 *   Progreso. La entrada en calor no cuenta, como en el motor.
 * - **"Pide banda elástica, que no marcaste."** Algo que tu equipo no tiene.
 *   Solo lo que se marca en el perfil: decir "que no marcaste" de una pared
 *   sería falso, porque la pared no se marca.
 *
 * Los pasos son los de `planDeRutina` sin molestia ni ajuste, así lo que se
 * avisa es lo que va a correr.
 */
export function revisarRutina(
  rutina: Pick<RutinaPropia, 'pasos' | 'dejarFijo'>,
  contexto: ContextoDeLaRevision,
): AvisoDeRutina[] {
  const { avances, historial, equipo } = contexto
  const plan = planDeRutina(rutina, { avances, historial })
  const lugar = new Map(plan.map((paso, indice) => [paso.id, indice]))
  const conCadena = new Set(rutina.pasos.filter((p) => p.clase === 'cadena').map((p) => p.patron))
  const dejarFijo = new Set(rutina.dejarFijo ?? [])
  const tiene = (e: Equipo) => ('has' in equipo ? equipo.has(e) : equipo.includes(e))
  const siguen = new Set<Patron>()
  const avisos: AvisoDeRutina[] = []

  for (const paso of enOrden(rutina.pasos)) {
    const pasoId = paso.id
    const indice = lugar.get(pasoId)
    const delPlan = indice === undefined ? undefined : plan[indice]
    if (indice === undefined || !delPlan) {
      const nombraAlgo = paso.clase === 'fijo' || paso.clase === 'movilidad'
      if (nombraAlgo && !nombrado(paso.ejercicioId)) avisos.push({ clase: 'ya-no-esta', pasoId, texto: YA_NO_ESTA })
      continue
    }
    const ejercicio = POR_ID.get(delPlan.ejercicioId)
    if (delPlan.clase === 'movilidad' || !ejercicio) continue

    if (delPlan.clase === 'fijo') {
      const patron = cadenaDelEslabon(ejercicio)
      if (
        patron !== null &&
        !delPlan.calentamiento &&
        esTuEslabon(ejercicio, avances) &&
        !conCadena.has(patron) &&
        !dejarFijo.has(pasoId)
      ) {
        avisos.push({
          clase: 'que-siga',
          pasoId,
          patron,
          texto: `Es tu eslabón de ${cadenaDicha(patron)}. ¿Que siga tu nivel?`,
        })
      }
      const arriba = arribaDeTuNivel(ejercicio, avances)
      const textoArriba = lineaArribaDeTuNivel(ejercicio, avances)
      if (arriba && textoArriba) avisos.push({ clase: 'arriba', pasoId, ...arriba, texto: textoArriba })
      const requisito = lineaDeRequisito(requisitosSinCumplir(ejercicio.id, avances, historial))
      if (requisito) avisos.push({ clase: 'requisito', pasoId, texto: requisito })
    }

    if (delPlan.clase === 'cadena') {
      const patron = paso.patron
      if (patron !== undefined && siguen.has(patron)) {
        avisos.push({
          clase: 'ya-hay-uno',
          pasoId,
          patron,
          texto: `Ya hay un paso que sigue tu nivel de ${cadenaDicha(patron)}: este suma volumen.`,
        })
      } else if (patron !== undefined) {
        siguen.add(patron)
        const previos = plan
          .slice(0, indice)
          .filter((p) => p.clase !== 'movilidad' && !p.calentamiento)
          .map((p) => ({ ejercicioId: p.ejercicioId, series: Array.from({ length: p.objetivo.series }) }))
        const cargado = principalMasCargado(ejercicio.id, previos)
        if (cargado && cargado.series >= PREFATIGA) {
          const series = Math.round(cargado.series)
          avisos.push({
            clase: 'prefatiga',
            pasoId,
            musculo: cargado.musculo,
            series,
            texto: `Va después de ${series} series de ${enMinuscula(NOMBRE_MUSCULO[cargado.musculo])}: si sale menos, tu nivel no baja.`,
          })
        }
      }
    }

    if (!alcanza(ejercicio, equipo)) {
      const faltan = [...new Set(ejercicio.equipo ?? [])].filter(
        (e) => e !== 'nada' && !tiene(e) && !DADOS_POR_TENIDOS.includes(e),
      )
      if (faltan.length > 0) {
        avisos.push({
          clase: 'equipo',
          pasoId,
          faltan,
          texto: `Pide ${enLista(faltan.map(equipoDicho))}, que no marcaste.`,
        })
      }
    }
  }
  return avisos
}

// ─── Una rutina que nace de otra cosa ───────────────────────────────────

/** Lo que hace falta para crear una rutina. */
export interface RutinaNueva {
  /** El id de la rutina: en la pantalla, `nuevoId()` (`crypto.randomUUID()`). */
  id: string
  /** Cuándo se crea: va a `creadaEn` y a `actualizadaEn`. */
  ahora: number
}

/**
 * El id de cada paso de una rutina recién creada: el de la rutina y su lugar.
 * Únicos adentro de la rutina, que es lo que pide la copia, y sin pedirle al
 * que llama un id por paso. Los que se suman después los pone la pantalla.
 */
const idDelPaso = (rutinaId: string, lugar: number) => `${rutinaId}-p${lugar + 1}`

/** Un nombre que la copia acepta: sin espacios en las puntas y de 1 a 40. */
function nombreValido(nombre: string): string {
  return recortar(nombre.trim(), LARGO_DEL_NOMBRE).trimEnd() || RUTINA_NUEVA
}

/** Una rutina con sus pasos numerados, como mucho `TOPE_DE_PASOS`. */
function rutinaCon(
  nueva: RutinaNueva,
  nombre: string,
  pasos: readonly Omit<PasoDeRutina, 'id'>[],
  desde: NonNullable<RutinaPropia['desde']>,
): RutinaPropia {
  return {
    id: nueva.id,
    nombre: nombreValido(nombre),
    pasos: pasos.slice(0, TOPE_DE_PASOS).map((paso, i) => ({ id: idDelPaso(nueva.id, i), ...paso })),
    creadaEn: nueva.ahora,
    actualizadaEn: nueva.ahora,
    desde,
  }
}

/**
 * La rutina de **Guardar como rutina** (§4.1, §7.5): la sesión hecha, como
 * pasos, con las cinco reglas de §5.6 G, las mismas de `pasosParaRepetir`:
 *
 * 1. **No vuelven** la entrada en calor ni el Reloj; de lo que vuelve se
 *    sacan las series de cierre (acá no queda ninguna serie: la rutina guarda
 *    pasos, y la progresión las lee del historial).
 * 2. **Lo que se guardó con `bajada`** vuelve como volumen de su cadena.
 * 3. **Lo que se guardó como fijo, o no está en `CADENAS`** (una variante, un
 *    accesorio, algo con discos), vuelve fijo con su ejercicio y el objetivo
 *    de `objetivoDelFijo`. Se mira antes que la regla 2: las sesiones de
 *    antes guardaban los accesorios con `bajada`, y volverlos "uno más fácil
 *    de empuje" cambiaría un press militar por una flexión.
 * 4. **El primer registro de cada cadena** vuelve como paso `cadena`, que hoy
 *    toma tu eslabón y el objetivo del motor; otro de la misma cadena vuelve
 *    fijo con su ejercicio: nunca hay dos pasos que lean la misma cadena.
 * 5. **La movilidad** (`Sesion.movilidad`) vuelve en Entrada, con la dosis
 *    de su ficha.
 *
 * Lo de las reglas 2 a 4 va a Principal, en el orden de los registros, y
 * después de la movilidad. Un registro que se salteó vuelve igual: saltear
 * una vez no es querer sacarlo (§7.5). Un ejercicio que la app ya no tiene no
 * vuelve: una rutina nueva no nace con un paso que ya no está.
 *
 * `historial` es para la doble progresión (con la sesión adentro, si todavía
 * no está guardada). `nombre` es el del campo de la hoja, que llega lleno.
 */
export function rutinaDesdeSesion(
  sesion: Sesion,
  nueva: RutinaNueva & { nombre: string; historial?: readonly Sesion[] },
): RutinaPropia {
  const historial = nueva.historial ?? []
  const conLaSesion = historial.some((s) => s.id === sesion.id) ? historial : [...historial, sesion]
  const pasos: Omit<PasoDeRutina, 'id'>[] = []

  for (const registro of sesion.movilidad ?? []) {
    const ficha = buscarMovilidad(registro.ejercicioId)
    if (!ficha) continue
    pasos.push({
      clase: 'movilidad',
      ejercicioId: ficha.id,
      series: seriesValidas(ficha.dosis.series),
      cantidad: cantidadValida(ficha.dosis.cantidad),
      seccion: 'entrada',
    })
  }

  const leidas = new Set<Patron>()
  for (const registro of sesion.registros) {
    const paso = pasoDelRegistro(registro, leidas, conLaSesion)
    if (paso) pasos.push(paso)
  }

  return rutinaCon(nueva, nueva.nombre, pasos, { clase: 'sesion', sesionId: sesion.id })
}

/** Un registro de una sesión hecha, como paso de Principal (§5.6 G, reglas 1 a 4). */
function pasoDelRegistro(
  registro: RegistroEjercicio,
  leidas: Set<Patron>,
  historial: readonly Sesion[],
): Omit<PasoDeRutina, 'id'> | null {
  if (registro.calentamiento || registro.reloj) return null
  const ejercicio = POR_ID.get(registro.ejercicioId)
  if (!ejercicio) return null
  const series = seriesValidas(registro.objetivo.series)
  const patron = cadenaDelEslabon(ejercicio)

  if (patron !== null && registro.bajada) {
    return { clase: 'volumen', patron, series, seccion: 'principal' }
  }
  if (patron !== null && !registro.fijo && !leidas.has(patron)) {
    leidas.add(patron)
    return { clase: 'cadena', patron, series, seccion: 'principal' }
  }
  // Sin los kilos del objetivo: son los que se propusieron, y como kilos del
  // paso mandarían sobre los que se levantaron. Así los pone `objetivoDelFijo`,
  // de las series de la última vez, como la cantidad.
  const objetivo = objetivoDelFijo(
    { series, cantidad: cantidadValida(registro.objetivo.cantidad) },
    ejercicio,
    historial,
  )
  return {
    clase: 'fijo',
    ejercicioId: ejercicio.id,
    series,
    cantidad: cantidadValida(objetivo.cantidad),
    ...(objetivo.kg !== undefined ? { kg: Math.max(0, objetivo.kg) } : {}),
    seccion: 'principal',
  }
}

/**
 * Lo que `rutinaDesdeMix` necesita de un mix: sus pasos, como los resolvió
 * `resolverMix` (`mixes.ts`) y con lo cambiado en el Sector. Un `MixResuelto`
 * entra tal cual (lo prueba `rutinasPropias.test.ts` con cada sector y
 * versión), pero el tipo pide solo los pasos y no el `PasoDelMix` entero: un
 * paso que la hoja Cambiar reemplazó, o uno de un borrador viejo sin `clase`,
 * también se copia, deduciendo la clase como el resto de la app.
 */
export interface MixParaCopiar {
  pasos: readonly PasoDelBorrador[]
}

/**
 * La rutina de **Copiar y editar** en un Sector (§3, R2): los bloques como
 * estaban en pantalla, lo cambiado incluido.
 *
 * - **Los bloques de cadena** quedan "Sigue tu nivel": un paso `cadena` de su
 *   cadena, que se mueve con ella.
 * - **El resto, fijos**, con el ejercicio y los números del mix (que ya
 *   vienen con la doble progresión), también el eslabón anterior que el mix
 *   puso donde no tenía otra opción.
 * - **La movilidad**, con su dosis.
 * - **La serie fácil de la entrada** vuelve fija y en Entrada, y la sesión la
 *   vuelve a correr como entrada en calor (`planDeRutina`).
 *
 * El nombre es "Mix de pecho", o "Mix de pecho 2" si ya hay una que se llama
 * así (`nombreLibre`), y la rutina recuerda de qué mix salió.
 */
export function rutinaDesdeMix(
  sector: Sector,
  mix: MixParaCopiar,
  nueva: RutinaNueva & { nombres: Iterable<string> },
): RutinaPropia {
  const pasos: Omit<PasoDeRutina, 'id'>[] = []
  for (const paso of mix.pasos) {
    const item = nombrado(paso.ejercicioId)
    if (!item) continue
    const seccion: SeccionDelPaso = paso.calentamiento ? 'entrada' : (paso.seccion ?? 'principal')
    const descanso =
      paso.descansoSegundos !== undefined ? { descansoSegundos: descansoValido(paso.descansoSegundos) } : {}
    const series = seriesValidas(paso.objetivo.series)
    const cantidad = cantidadValida(paso.objetivo.cantidad)

    if (item.clase === 'movilidad') {
      pasos.push({ clase: 'movilidad', ejercicioId: item.ficha.id, series, cantidad, seccion, ...descanso })
      continue
    }
    const patron = cadenaDelEslabon(item.ejercicio)
    const clase = paso.clase ?? (paso.bajada ? 'volumen' : paso.fijo ? 'fijo' : 'cadena')
    if (clase === 'cadena' && patron !== null) {
      pasos.push({ clase: 'cadena', patron, series, seccion, ...descanso })
      continue
    }
    pasos.push({
      clase: 'fijo',
      ejercicioId: item.ejercicio.id,
      series,
      cantidad,
      ...(paso.objetivo.kg !== undefined ? { kg: Math.max(0, paso.objetivo.kg) } : {}),
      seccion,
      ...descanso,
    })
  }
  const nombre = nombreLibre(nueva.nombres, `Mix de ${NOMBRE_SECTOR[sector].toLowerCase()}`)
  return rutinaCon(nueva, nombre, pasos, { clase: 'mix', sector })
}

// ─── Actualizar la rutina ───────────────────────────────────────────────

/** Un id que no tiene ningún otro paso de la rutina: el pedido o, si está usado, con un número. */
function idLibre(pedido: string, usados: Set<string>): string {
  let id = pedido
  for (let n = 2; usados.has(id); n++) id = `${pedido}-${n}`
  usados.add(id)
  return id
}

/** Dónde termina una sección: el lugar después de su último paso, o donde empezaría. */
function finDeLaSeccion(pasos: readonly PasoDeRutina[], seccion: SeccionDelPaso): number {
  for (let i = pasos.length - 1; i >= 0; i--) {
    if (ORDEN_DE_SECCION[pasos[i]!.seccion] <= ORDEN_DE_SECCION[seccion]) return i + 1
  }
  return 0
}

/**
 * De los pasos de una sección que se pasaron al final, los que cambian su
 * orden: lo que quedó, y no cada toque.
 *
 * Pasar un paso al final lo deja último de su sección, así que el orden que
 * queda es el de los que no se movieron y, detrás, los movidos en el orden en
 * que se movieron. Pero no todo movimiento deja algo: pasar al final el que
 * ya era el último no cambia nada, y en [A, B] pasar A y después B deja [A, B]
 * otra vez. Lo que cuenta es la cola más corta de ese orden final que, sacada
 * y puesta detrás de los demás, da el mismo orden: los pasos de esa cola, en
 * su orden. Movidos así, cada uno cambia el orden de verdad, y el resultado es
 * el mismo que con todos.
 *
 * `antes` son los ids de la sección en su orden; `movidos`, los que se
 * pasaron al final, en el orden del último toque de cada uno.
 */
function alFinalQueCambia(antes: readonly string[], movidos: readonly string[]): string[] {
  let orden = [...antes]
  for (const id of movidos) {
    if (orden.includes(id)) orden = [...orden.filter((otro) => otro !== id), id]
  }
  for (let desde = orden.length; desde > 0; desde--) {
    const cola = new Set(orden.slice(desde))
    const resto = antes.filter((id) => !cola.has(id))
    if (resto.every((id, i) => orden[i] === id)) return orden.slice(desde)
  }
  return orden
}

/** Lo que **Actualizar la rutina** hace de verdad: la rutina que queda y qué tocó de cada paso. */
interface LoQueSeAplica {
  pasos: PasoDeRutina[]
  /** Los pasos que quedaron con otro ejercicio. */
  cambiados: Set<string>
  /** Los que se pasaron al final y con eso cambiaron el orden de su sección. */
  alFinal: Set<string>
  /** Los agregados que entraron, por el id que tuvieron en la sesión. */
  agregados: Set<string>
}

/**
 * La cuenta de **Actualizar la rutina**, una sola: la usan `aplicarCambios`
 * para armar la rutina y `cambiosQueSeAplican` para que el Cierre nombre
 * exactamente eso. Si fueran dos, una podría decir algo que la otra no hace.
 */
function loQueSeAplica(
  rutina: Pick<RutinaPropia, 'pasos'>,
  porPaso: ReadonlyMap<string, LoDelPaso>,
): LoQueSeAplica {
  const cambiados = new Set<string>()
  let pasos = rutina.pasos.map((paso) => {
    const del = porPaso.get(paso.id)
    if (!del || del.agregado !== undefined || del.a === undefined || del.a === del.de) return paso
    const otro = pasoDesdeEjercicio(del.a, { id: paso.id, seccion: paso.seccion })
    if (!otro) return paso
    cambiados.add(paso.id)
    const eligioSeries = paso.clase === 'fijo' || paso.clase === 'movilidad'
    return {
      ...otro,
      ...(eligioSeries && otro.clase === paso.clase ? { series: paso.series } : {}),
      ...(paso.editadoEn !== undefined ? { editadoEn: paso.editadoEn } : {}),
    }
  })

  // Pasar al final, sección por sección: un cambio de ejercicio no mueve a
  // nadie de lugar ni de sección, así que el orden de antes es el de la rutina.
  const movidos = [...porPaso]
    .filter(([id, del]) => del.alFinal && del.agregado === undefined && pasos.some((p) => p.id === id))
    .sort(([, a], [, b]) => (a.alFinalEn ?? 0) - (b.alFinalEn ?? 0))
    .map(([id]) => id)
  const alFinal = new Set<string>()
  for (const seccion of Object.keys(ORDEN_DE_SECCION) as SeccionDelPaso[]) {
    const deLaSeccion = new Set(pasos.filter((p) => p.seccion === seccion).map((p) => p.id))
    const antes = pasos.filter((p) => deLaSeccion.has(p.id)).map((p) => p.id)
    for (const id of alFinalQueCambia(antes, movidos.filter((m) => deLaSeccion.has(m)))) alFinal.add(id)
  }
  for (const pasoId of movidos) {
    if (!alFinal.has(pasoId)) continue
    const i = pasos.findIndex((p) => p.id === pasoId)
    const movido = pasos[i]
    if (!movido) continue
    const sin = pasos.filter((_, j) => j !== i)
    const fin = finDeLaSeccion(sin, movido.seccion)
    pasos = [...sin.slice(0, fin), movido, ...sin.slice(fin)]
  }

  const agregados = new Set<string>()
  const usados = new Set(pasos.map((p) => p.id))
  for (const [pasoId, del] of porPaso) {
    if (del.agregado === undefined || pasos.length >= TOPE_DE_PASOS) continue
    if (!nombrado(del.agregado)) continue
    const nuevo = pasoDesdeEjercicio(del.agregado, { id: idLibre(pasoId, usados) })
    if (!nuevo) continue
    const fin = finDeLaSeccion(pasos, nuevo.seccion)
    pasos = [...pasos.slice(0, fin), nuevo, ...pasos.slice(fin)]
    agregados.add(pasoId)
  }

  return { pasos, cambiados, alFinal, agregados }
}

/**
 * Los cambios de la sesión que **Actualizar la rutina** aplica de verdad, en
 * el orden en que vinieron: lo que el Cierre le pasa a `lineaDeCambios`.
 *
 * Quedan afuera los salteados y todo lo que `aplicarCambios` no hace: pasar
 * al final uno que ya era el último de su sección (o movimientos que dejan la
 * sección como estaba), un agregado que no entra porque la rutina llegó a
 * `TOPE_DE_PASOS`, y un cambio o un agregado con un ejercicio que la app no
 * tiene. Así la línea nombra exactamente lo que cambia, y es `null` cuando la
 * rutina quedaría igual: ofrecer **Actualizar la rutina** para que después
 * diga "Rutina actualizada." sin haber tocado nada sería decir algo falso.
 *
 * Aplicar estos da la misma rutina que aplicar todos.
 */
export function cambiosQueSeAplican(
  rutina: Pick<RutinaPropia, 'pasos'>,
  cambios: readonly CambioEnSesion[],
): CambioEnSesion[] {
  const porPaso = cambiosPorPaso(cambios)
  const hecho = loQueSeAplica(rutina, porPaso)
  return cambios.filter((cambio) => {
    const del = porPaso.get(cambio.pasoId)
    if (cambio.clase === 'salteado' || !del) return false
    // Un paso que se sumó en la sesión es una cosa sola, con sus cambios y
    // todo: entra entero o no entra.
    if (del.agregado !== undefined) return hecho.agregados.has(cambio.pasoId)
    if (cambio.clase === 'al-final') return hecho.alFinal.has(cambio.pasoId)
    return hecho.cambiados.has(cambio.pasoId)
  })
}

/**
 * **Actualizar la rutina** en el Cierre (§4.15, §7.5): la rutina con lo que
 * se cambió en la sesión.
 *
 * - **Los salteados no cuentan:** saltear una vez no es querer sacarlo.
 * - **Un cambio** deja el paso con el ejercicio nuevo, fijo (un paso de cadena
 *   cambiado por otro ejercicio pasa a fijo, §4.14), con lo bajo de su
 *   ventana y el mismo lugar, sección y `editadoEn`: la vez que se hizo en
 *   esta sesión queda después, así que la doble progresión sigue desde ahí.
 *   Las series del paso quedan si las había elegido la persona (un fijo o una
 *   movilidad); el descanso y los kilos eran del ejercicio de antes y se van.
 *   Cambiarlo y volver al de antes no es ningún cambio.
 * - **Un agregado** entra al final de su sección (la fuerza, de Principal),
 *   con el id que tuvo en la sesión si está libre. Uno que se sumó y después
 *   se cambió entra con el último.
 * - **Pasar al final** lo deja último en su sección: un paso de Entrada que
 *   pasa al final de la sesión sigue siendo la entrada. Varios se mueven en
 *   el orden en que se movieron por última vez en la sesión, que es como
 *   quedaron; el que ya era el último de su sección queda donde está, y lo
 *   que deja una sección como estaba no se aplica (`alFinalQueCambia`).
 * - Un cambio a un ejercicio que la app no tiene no se aplica, y nada pasa de
 *   `TOPE_DE_PASOS`.
 *
 * Lo que aplica es exactamente lo que devuelve `cambiosQueSeAplican`, la
 * lista que nombra el Cierre: las dos salen de la misma cuenta.
 *
 * Un paso cambiado sale de `dejarFijo`: "Dejarlo fijo" se eligió para el
 * ejercicio de antes. `actualizadaEn` lo pone `guardarRutina` al guardar. Sin
 * nada que aplicar, devuelve la misma rutina, sin copiarla.
 */
export function aplicarCambios(rutina: RutinaPropia, cambios: readonly CambioEnSesion[]): RutinaPropia {
  const porPaso = cambiosPorPaso(cambios)
  if (porPaso.size === 0) return rutina

  const { pasos, cambiados, alFinal, agregados } = loQueSeAplica(rutina, porPaso)
  if (cambiados.size + alFinal.size + agregados.size === 0) return rutina
  const actualizada: RutinaPropia = { ...rutina, pasos }
  const dejarFijo = rutina.dejarFijo?.filter((id) => !cambiados.has(id))
  if (dejarFijo && dejarFijo.length > 0) actualizada.dejarFijo = dejarFijo
  else delete actualizada.dejarFijo
  return actualizada
}

// ─── El nombre ──────────────────────────────────────────────────────────

/** Dos nombres son el mismo si se leen igual: sin mayúsculas, tildes ni espacios en las puntas. */
const clave = (nombre: string) => textoBuscable(nombre.trim())

/**
 * `texto` cortado a `largo` sin dejar media palabra: si el corte cae adentro
 * de una, se va entera. Media palabra puede ser un número que dice otra cosa
 * ("Verano 2026" cortado en "Verano 202"). Si es una sola palabra, se corta
 * igual: algo tiene que quedar.
 */
function recortarEntero(texto: string, largo: number): string {
  const cortado = recortar(texto, largo)
  if (cortado.length === texto.length || /\s/.test(texto.charAt(cortado.length))) return cortado.trimEnd()
  const hastaElEspacio = cortado.replace(/\s+\S*$/, '')
  return hastaElEspacio === cortado ? cortado : hastaElEspacio.trimEnd()
}

/**
 * Un nombre que no tenga ninguna otra rutina: `base` si está libre, y si no
 * "base 2", "base 3", … (§4.10, §4.11). "Rutina nueva" sin base.
 *
 * - **Se compara como se lee**, sin mayúsculas ni tildes: "rutina nueva" y
 *   "Rutina nueva" en la misma lista parecerían la misma.
 * - **Duplicar "Pecho en casa 2" da "Pecho en casa 3"** y no "Pecho en casa 2
 *   2", si "Pecho en casa" también está: ahí el 2 es el que puso esta misma
 *   función, y se sigue desde ahí. Solo ahí. Un número al final puede ser
 *   parte del nombre ("Semana 10", "Verano 2026"), y seguirlo daría "Semana
 *   11", que dice otra cosa: sin el nombre de antes en la lista, la copia es
 *   "Semana 10 2". El 1 no es nunca una copia ("Día 1").
 * - **Nunca pasa de 40:** si el número no entra, se corta la base y no el
 *   número, sin dejar media palabra (`recortarEntero`).
 */
export function nombreLibre(nombres: Iterable<string>, base: string = RUTINA_NUEVA): string {
  const usados = new Set([...nombres].map(clave))
  const limpia = nombreValido(base)
  if (!usados.has(clave(limpia))) return limpia

  const numerada = /^(.*\S) ([2-9]|[1-9]\d{1,4})$/.exec(limpia)
  const esCopia = numerada?.[1] !== undefined && usados.has(clave(numerada[1]))
  const raiz = esCopia ? numerada![1]! : limpia
  const desde = esCopia ? Number(numerada![2]) + 1 : 2
  for (let n = desde; ; n++) {
    const sufijo = ` ${n}`
    const candidato = `${recortarEntero(raiz, LARGO_DEL_NOMBRE - sufijo.length)}${sufijo}`
    if (!usados.has(clave(candidato))) return candidato
  }
}
