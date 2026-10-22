/**
 * Las zonas del cuerpo: qué músculos cuenta cada una y qué se hizo en ellas.
 *
 * Es la capa que le faltaba al mapa muscular para que Entrenar pueda empezar
 * con el cuerpo: `musculos.ts` sabe cuánto carga cada ejercicio a cada uno de
 * los veinte músculos, y acá se agrupan en las siete zonas que la persona toca
 * en el mapa (Pecho, Espalda, Hombros, Brazos, Core, Piernas, Glúteos), más el
 * cuerpo completo, que no es una zona sino un mix.
 *
 * Todo número de una zona sale de `seriesDeZona`, y en ningún otro lado se
 * vuelve a sumar: el mapa, la baldosa, el Sector, Tu día, Progreso y el
 * resumen por zona del Cierre dicen la misma cifra para la misma pregunta. Dos
 * cuentas distintas darían dos verdades (Decisión 27).
 *
 * Nada de esto lleva texto para la persona salvo los nombres: las líneas que
 * salen de estos datos están en `lineas.ts`.
 */

import { VENTANA_DIAS, enLaVentana, esMovilidad } from './adherencia'
import { ANCHO, ESPALDA, FRENTE } from './anatomia'
import { CADENAS, EJERCICIOS, POR_ID } from './biblioteca'
import { alcanza } from './equipo'
import { APORTE, PISO_DE_DOSIS, seriesPorMusculo, type Musculo } from './musculos'
import type { Ejercicio, Equipo, OrigenDeSesion, Sector, Sesion } from './tipos'

/** Las siete zonas del mapa. El cuerpo completo no es una zona: es un mix. */
export type Zona = Exclude<Sector, 'cuerpo'>

/**
 * El orden de siempre: el del mapa en la vista Lista, el de las baldosas y el
 * del foco con Tab. También desempata `sugerirZona` (Decisión 98), así que
 * cambiarlo cambia lo que la app sugiere.
 */
export const SECTORES: readonly Sector[] = [
  'pecho',
  'espalda',
  'hombros',
  'brazos',
  'core',
  'piernas',
  'gluteos',
  'cuerpo',
]

/** Los mismos, sin el cuerpo completo. */
export const ZONAS: readonly Zona[] = SECTORES.filter((s): s is Zona => s !== 'cuerpo')

/**
 * Si un texto es un sector que existe. Lo que llega por la URL
 * (`/centro/sector/:sector`, `?mix=`) puede ser cualquier cosa, y una zona
 * inventada tiene que dar "Esa zona no está.", no una pantalla rota.
 */
export function esSector(valor: unknown): valor is Sector {
  return typeof valor === 'string' && (SECTORES as readonly string[]).includes(valor)
}

export const NOMBRE_SECTOR: Record<Sector, string> = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombros: 'Hombros',
  brazos: 'Brazos',
  core: 'Core',
  piernas: 'Piernas',
  gluteos: 'Glúteos',
  cuerpo: 'Cuerpo completo',
}

/**
 * Los músculos que definen cada zona: los que cuentan en `seriesDeZona` y se
 * encienden fuerte (tinta 0,9) al elegirla en el mapa.
 *
 * La tabla es la de la propuesta B que tomó la especificación final, validada
 * por el rol de calistenia. Cada uno de los veinte músculos de la matriz está
 * en alguna zona, como principal o como secundario, así que nada de lo que el
 * mapa dibuja queda sin dueño (`sectores.test.ts` lo verifica).
 *
 * Hombros lleva los tres deltoides aunque el lateral y el posterior casi no
 * tengan ejercicios todavía: la zona es la que es, y lo que falta es catálogo,
 * que la ola 1 trae.
 */
export const PRINCIPALES: Record<Zona, readonly Musculo[]> = {
  pecho: ['pectoral'],
  espalda: ['dorsal', 'espalda-media'],
  hombros: ['deltoide-anterior', 'deltoide-lateral', 'deltoide-posterior'],
  brazos: ['biceps', 'triceps'],
  core: ['recto-abdominal', 'oblicuos'],
  piernas: ['cuadriceps', 'isquiotibial'],
  gluteos: ['gluteo-mayor', 'gluteo-medio'],
}

/**
 * Los que acompañan: se encienden a la mitad (tinta 0,45), entran en la
 * lista de ejercicios del Sector y en la glosa ("Pectoral · hombro de
 * adelante · tríceps"), pero no suman a la cifra de la zona. Si sumaran, un
 * día de pecho diría también "brazos", por el tríceps de cada flexión.
 */
export const SECUNDARIOS: Record<Zona, readonly Musculo[]> = {
  pecho: ['deltoide-anterior', 'triceps'],
  espalda: ['deltoide-posterior', 'erectores', 'biceps'],
  hombros: ['serrato'],
  brazos: ['antebrazo'],
  core: ['erectores', 'psoas'],
  piernas: ['aductor', 'gemelo'],
  gluteos: ['isquiotibial'],
}

// ─── Las anclas del mapa ────────────────────────────────────────────────

/** Las dos caras del cuerpo en el mapa. La vista Lista no tiene anclas. */
export type Vista = 'frente' | 'espalda'

/** Las zonas de una vista, según el lado donde va su botón. */
export interface ZonasPorLado {
  izquierda: readonly Zona[]
  derecha: readonly Zona[]
}

/**
 * Qué zonas tiene cada vista y de qué lado van sus botones (§4.5).
 *
 * Hombros, Brazos y Piernas están en las dos vistas y son la misma zona:
 * elegida en una, sigue elegida en la otra.
 */
export const ZONAS_DE_LA_VISTA: Record<Vista, ZonasPorLado> = {
  frente: { izquierda: ['hombros', 'brazos', 'piernas'], derecha: ['pecho', 'core'] },
  espalda: { izquierda: ['hombros', 'brazos', 'gluteos'], derecha: ['espalda', 'piernas'] },
}

/** Dónde termina la línea que une el botón de una zona con su músculo. */
export interface Ancla {
  /** En el lienzo de 100 × 210 de `anatomia.ts`, ya del lado del botón. */
  x: number
  y: number
  lado: 'izquierda' | 'derecha'
  /** El principal de la zona sobre el que cae el punto. */
  musculo: Musculo
}

/** La caja que encierra un trazo: sus números van de a pares x, y. */
function cajaDe(trazo: string): { x0: number; y0: number; x1: number; y1: number } {
  const numeros = (trazo.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const xs = numeros.filter((_, i) => i % 2 === 0)
  const ys = numeros.filter((_, i) => i % 2 === 1)
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/**
 * El centro de la caja del principal más grande de cada zona, en cada vista.
 *
 * Sale de los trazos de `anatomia.ts` y no de números escritos a mano, así que
 * si alguien redibuja un músculo el punto lo sigue solo. "Más grande" es la
 * caja de mayor área: los músculos dibujados son manchas convexas, y la caja
 * alcanza para elegir entre dos o tres sin parsear curvas.
 *
 * `anatomia.ts` dibuja media persona, del eje (x = 50) a la derecha, y el
 * componente pone la otra mitad en espejo. Un botón de la izquierda apunta a
 * esa mitad espejada, por eso su `x` ya viene dada vuelta (100 − x).
 */
export const ANCLAS: Record<Vista, Partial<Record<Zona, Ancla>>> = {
  frente: anclasDe('frente'),
  espalda: anclasDe('espalda'),
}

function anclasDe(vista: Vista): Partial<Record<Zona, Ancla>> {
  const dibujo = vista === 'frente' ? FRENTE : ESPALDA
  const anclas: Partial<Record<Zona, Ancla>> = {}
  for (const lado of ['izquierda', 'derecha'] as const) {
    for (const zona of ZONAS_DE_LA_VISTA[vista][lado]) {
      let mejor: { musculo: Musculo; area: number; x: number; y: number } | null = null
      for (const musculo of PRINCIPALES[zona]) {
        const trazo = dibujo[musculo]
        if (!trazo) continue
        const { x0, y0, x1, y1 } = cajaDe(trazo)
        const area = (x1 - x0) * (y1 - y0)
        if (mejor === null || area > mejor.area) {
          mejor = { musculo, area, x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
        }
      }
      if (mejor === null) continue
      anclas[zona] = {
        x: lado === 'izquierda' ? ANCHO - mejor.x : mejor.x,
        y: mejor.y,
        lado,
        musculo: mejor.musculo,
      }
    }
  }
  return anclas
}

// ─── Lo hecho en cada zona ──────────────────────────────────────────────

/** La ventana de la baldosa, del Sector, de Progreso y de `sugerirZona`. */
export const VENTANA_DE_ZONA = 7

/**
 * Cuántas series fraccionales tiene que recibir un principal en un día para
 * que ese día cuente para su zona.
 *
 * Sin piso, tres series de flexiones contaban como un día de core —el abdomen
 * sostiene a 0,5 en cada una— y el botón de Core decía "HOY" sin haber hecho
 * core. Con 2, una serie suelta no hace un día y dos series de un principal
 * sí: la cuenta es la misma que la de `seriesDeZona`, con el mismo redondeo.
 */
export const UMBRAL_DE_ZONA = 2

/**
 * Si una sesión entra en las cuentas de las zonas.
 *
 * La movilidad no suma al mapa (§5.6 A): se guarda aparte, en
 * `Sesion.movilidad`, y su sesión no trae registros, pero se la deja afuera
 * por su origen además, para que no dependa de eso. La regla es la de
 * `esMovilidad` y no una copia, para que Tu día, el mapa y la recuperación no
 * puedan discrepar sobre qué fue movilidad.
 */
function cuentaParaLasZonas(sesion: Sesion): boolean {
  return !esMovilidad(sesion)
}

/**
 * Lo que recibió cada músculo en estas sesiones, con la regla del mapa.
 *
 * La cuenta es la de `seriesPorMusculo` y no una copia: cada serie por su
 * aporte, del piso de dosis para arriba, la de cierre y la bajada incluidas.
 * Lo único que se saca antes es lo que §5.6 A deja afuera del volumen: la
 * movilidad y la entrada en calor, que no son trabajo.
 *
 * `seriesPorMusculo` vuelve a recortar a su ventana de 28 días contando desde
 * `hoy`; por eso las ventanas de acá no pasan de esos 28.
 */
function recibido(sesiones: Sesion[], hoy: string): Map<Musculo, number> {
  const trabajo = sesiones.filter(cuentaParaLasZonas).map((s) =>
    s.registros.some((r) => r.calentamiento)
      ? { ...s, registros: s.registros.filter((r) => !r.calentamiento) }
      : s,
  )
  return seriesPorMusculo(trabajo, hoy)
}

/** La cifra de una zona: el principal más cargado, nunca la suma. */
function cifraDe(zona: Zona, porMusculo: ReadonlyMap<Musculo, number>): number {
  return Math.max(0, ...PRINCIPALES[zona].map((m) => porMusculo.get(m) ?? 0))
}

/**
 * Las series de una zona en los `dias` que terminan en `hoy`, contado.
 *
 * **Es el máximo entre los principales, no la suma.** Una flexión carga el
 * pectoral y nada más de Pecho, pero un remo carga el dorsal y la media
 * espalda a la vez: sumados, tres remos serían seis series de espalda, y la
 * persona hizo tres. El principal más cargado dice cuánto trabajó la zona sin
 * contar dos veces la misma serie.
 *
 * Para un día solo (Tu día, el resumen del Cierre), `dias` es 1 y `hoy` es
 * ese día. El número sale sin redondear, en la escala de `PISO_DE_DOSIS`
 * (múltiplos de 0,5): se redondea al mostrarlo, igual que en Progreso.
 */
export function seriesDeZona(
  zona: Zona,
  historial: Sesion[],
  hoy: string,
  dias = VENTANA_DE_ZONA,
): number {
  const dentro = enLaVentana(historial, hoy, Math.min(dias, VENTANA_DIAS))
  return cifraDe(zona, recibido(dentro, hoy))
}

/** Las sesiones que cuentan, agrupadas por día. */
function porDia(sesiones: Sesion[]): Map<string, Sesion[]> {
  const dias = new Map<string, Sesion[]>()
  for (const sesion of sesiones) {
    if (!cuentaParaLasZonas(sesion)) continue
    const delDia = dias.get(sesion.fecha) ?? []
    delDia.push(sesion)
    dias.set(sesion.fecha, delDia)
  }
  return dias
}

/**
 * En cuántos días de la ventana se trabajó cada zona, y en cuántos hubo
 * alguna sesión.
 *
 * Un día cuenta para una zona si alguno de sus principales recibió
 * `UMBRAL_DE_ZONA` series fraccionales o más ese día, sumando todas las
 * sesiones del día: tres sesiones de pecho en una tarde son un día de pecho.
 *
 * `cuerpo` no es una zona y cuenta otra cosa: los días con alguna sesión que
 * cuenta, que es lo que dice la baldosa de Cuerpo completo ("3 días con sesión
 * en 7"). La movilidad no cuenta para nada de esto.
 */
export function diasPorZona(
  historial: Sesion[],
  hoy: string,
  dias = VENTANA_DE_ZONA,
): Record<Sector, number> {
  const cuenta = Object.fromEntries(SECTORES.map((s) => [s, 0])) as Record<Sector, number>
  for (const [fecha, delDia] of porDia(enLaVentana(historial, hoy, dias))) {
    cuenta.cuerpo++
    const porMusculo = recibido(delDia, fecha)
    for (const zona of ZONAS) {
      if (cifraDe(zona, porMusculo) >= UMBRAL_DE_ZONA) cuenta[zona]++
    }
  }
  return cuenta
}

/**
 * La última vez que se trabajó una zona: el día y la sesión, o `null` si
 * nunca.
 *
 * El día es el último que cuenta para la zona con la misma regla que
 * `diasPorZona`, así el botón del mapa y la baldosa no se contradicen. La
 * sesión es la última de ese día que cargó un principal de la zona: con pecho
 * a las 9:10 y a las 19:05, la última vez es a las 19:05. La hora no se
 * calcula acá: sale de la sesión con `inicioDe`, que sabe qué hacer con las
 * viejas que no guardaron cuándo empezaron.
 */
export function ultimaVezDeZona(
  zona: Zona,
  historial: Sesion[],
): { fecha: string; sesion: Sesion } | null {
  const dias = [...porDia(historial)].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
  for (const [fecha, delDia] of dias) {
    if (cifraDe(zona, recibido(delDia, fecha)) < UMBRAL_DE_ZONA) continue
    const cargaron = delDia
      .filter((s) => s.registros.some((r) => !r.calentamiento && cargaLaZona(r.ejercicioId, zona)))
      .sort((a, b) => b.finalizadaEn - a.finalizadaEn)
    const sesion = cargaron[0]
    if (sesion) return { fecha, sesion }
  }
  return null
}

/**
 * Si una zona no tiene ninguna serie fraccional en todo el historial: ni una
 * sola media serie en uno de sus principales, en ninguna sesión que cuente.
 *
 * Es lo que necesita la glosa cuando `ultimaVezDeZona` da `null`, porque ese
 * `null` dice "ningún día llegó a `UMBRAL_DE_ZONA`" y no "nunca": tres
 * flexiones son 1,5 series de hombro de adelante, ningún día de Hombros, y
 * "Hombros: no hay sesiones anotadas todavía." sería falso. Con esto la frase
 * va solo cuando es verdad.
 *
 * La regla es la del mapa (`recibido`): cada serie por su aporte, desde el
 * piso de dosis, sin la movilidad ni la entrada en calor. Sin ventana, como
 * `ultimaVezDeZona`, de la que es la otra mitad. El cuerpo completo no es
 * una zona: no tiene series cuando ninguna de las siete tiene.
 */
export function zonaSinSeries(sector: Sector, historial: readonly Sesion[]): boolean {
  if (sector === 'cuerpo') return ZONAS.every((zona) => zonaSinSeries(zona, historial))
  return !historial.some(
    (s) =>
      cuentaParaLasZonas(s) &&
      s.registros.some((r) => !r.calentamiento && r.series.length > 0 && cargaLaZona(r.ejercicioId, sector)),
  )
}

/** Si un ejercicio le da dosis a algún principal de la zona. */
function cargaLaZona(ejercicioId: string, zona: Zona): boolean {
  const vector = APORTE[ejercicioId]
  if (!vector) return false
  return PRINCIPALES[zona].some((m) => (vector[m] ?? 0) >= PISO_DE_DOSIS)
}

/** Los músculos que un ejercicio tiene como principales: los de aporte 1. */
function principalesDe(ejercicioId: string): Musculo[] {
  const vector = APORTE[ejercicioId]
  if (!vector) return []
  return (Object.keys(vector) as Musculo[]).filter((m) => vector[m] === 1)
}

// ─── Qué hay para cada zona ─────────────────────────────────────────────

/**
 * Los ejercicios de una zona, en el orden de la biblioteca: los que tienen
 * como principal (aporte 1) a alguno de los músculos de la zona, sea
 * principal o secundario de ella.
 *
 * Por principal de la ficha y no por dosis: con dosis, Brazos se llevaba las
 * once flexiones y los diez remos, porque el tríceps y el bíceps trabajan a
 * 0,5 en todos. Y con los secundarios de la zona adentro, Pecho trae los de
 * tríceps, que son los que usa su mix después de la cadena.
 *
 * Con `equipo`, solo los que se pueden hacer con eso (`alcanza`): es "Con lo
 * que tengo", el valor por defecto del Sector. Sin `equipo`, todos.
 */
export function ejerciciosDeZona(
  zona: Zona,
  equipo?: readonly Equipo[] | ReadonlySet<Equipo>,
): Ejercicio[] {
  const suyos = new Set<Musculo>([...PRINCIPALES[zona], ...SECUNDARIOS[zona]])
  return EJERCICIOS.filter(
    (e) =>
      principalesDe(e.id).some((m) => suyos.has(m)) && (equipo === undefined || alcanza(e, equipo)),
  )
}

/**
 * Si con este equipo se puede armar el mix de un sector.
 *
 * Se define sobre los ejercicios y no sobre `MIXES`, que se escriben aparte:
 * una zona se puede armar si hay al menos un ejercicio al alcance que tenga
 * como principal a un principal de la zona, porque ese es el bloque que el
 * mix no puede saltear (el de cadena, o los primeros de Hombros y de Brazos).
 * Los demás bloques, si no tienen opción, se saltean y la pantalla lo dice
 * (§6.3), pero un mix sin su bloque central no es el mix de esa zona.
 *
 * El cuerpo completo son las cinco cadenas: se puede armar si cada una tiene
 * algún eslabón al alcance.
 *
 * Con lo dado por tenido, todas se pueden armar; deja de ser así solo con un
 * equipo más chico que eso, que `equipoDe` no da nunca.
 *
 * Mira el equipo y nada más: no sabe tu nivel. Que el mix de hoy tenga algo
 * que hacer lo dice `MixConTrabajo`, que sale de `resolverMix`.
 */
export function mixArmable(sector: Sector, equipo: readonly Equipo[] | ReadonlySet<Equipo>): boolean {
  if (sector === 'cuerpo') {
    return CADENAS.every((cadena) =>
      cadena.ejercicios.some((id) => {
        const ejercicio = POR_ID.get(id)
        return ejercicio !== undefined && alcanza(ejercicio, equipo)
      }),
    )
  }
  const principales = new Set<Musculo>(PRINCIPALES[sector])
  return EJERCICIOS.some(
    (e) => principalesDe(e.id).some((m) => principales.has(m)) && alcanza(e, equipo),
  )
}

/**
 * La zona que se sugiere: la que tiene menos series en los últimos 7 días
 * entre las que se pueden armar con tu equipo; en un empate, la primera en el
 * orden de `SECTORES` (Decisión 98).
 *
 * **El primer día va Cuerpo completo**: sin ninguna sesión que cuente, todas
 * las zonas están en cero y el desempate mandaría a Pecho a alguien que
 * todavía no entrenó nada. Fuera del primer día no sugiere nunca el cuerpo
 * completo, así que quien llama sabe que `'cuerpo'` es "para arrancar".
 *
 * `excepto` deja afuera un sector: el botón "Otro sector" no puede llevar al
 * mismo Sector donde está, y OTRA ZONA no puede repetir la primera tarjeta.
 *
 * Mira las series y no los días porque dos días flojos de una zona no la
 * dejan más atendida que uno completo.
 *
 * **Con `conTrabajo`, nunca un mix vacío.** Una zona entra solo si su mix,
 * armado para esta persona hoy, tiene trabajo. El primer día el cuerpo
 * completo pide lo mismo; sin trabajo, se busca entre las zonas como
 * cualquier otro día. `mixArmable` no alcanza: mira el equipo y no el nivel,
 * y en el eslabón 1 el mix de Hombros o el de Brazos puede ser la entrada
 * sola. Si nada tiene trabajo (sin avances, por ejemplo) da `'cuerpo'`, como
 * sin ninguna zona armable, y quien llama lo puede preguntar con el mismo
 * `conTrabajo`. Sin el argumento, todo lo armable cuenta, como antes.
 */
export function sugerirZona(
  historial: Sesion[],
  hoy: string,
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
  excepto?: Sector,
  conTrabajo?: MixConTrabajo,
): Sector {
  const tieneTrabajo = (sector: Sector) => conTrabajo?.(sector) ?? true
  const primerDia = !historial.some((s) => s.fecha <= hoy && cuentaParaLasZonas(s))
  if (primerDia && excepto !== 'cuerpo' && tieneTrabajo('cuerpo')) return 'cuerpo'

  let sugerida: Zona | null = null
  let menos = Infinity
  for (const zona of ZONAS) {
    if (zona === excepto || !mixArmable(zona, equipo)) continue
    const series = seriesDeZona(zona, historial, hoy)
    if (series < menos && tieneTrabajo(zona)) {
      sugerida = zona
      menos = series
    }
  }
  // Sin ninguna zona armable no queda otra que el mix de las cadenas, que
  // usa el eslabón de cada una. No pasa con lo que da `equipoDe`: las
  // flexiones no piden nada. Con `conTrabajo`, pasa también sin ninguna con
  // trabajo, y el mix de las cadenas puede estar vacío: lo dice `conTrabajo`.
  return sugerida ?? 'cuerpo'
}

/** Completo, Corto o Liviano, como los guarda el origen de un mix. */
type VersionDelMix = Extract<OrigenDeSesion, { clase: 'mix' }>['version']

/**
 * Si el mix de un sector, armado para esta persona hoy, tiene algún paso de
 * trabajo (ni movilidad ni entrada en calor). Sin `version`, Completo.
 *
 * Lo da `mixesConTrabajo` (`mixes.ts`) con `resolverMix`. Llega como función
 * porque este archivo no puede importar `mixes.ts`, que lo importa a él por
 * `catalogo.ts`, ni `dia.ts` tampoco: `mixes.ts` llega a `dia.ts` por
 * `progresion.ts` y `lineas.ts`.
 */
export type MixConTrabajo = (sector: Sector, version?: VersionDelMix) => boolean
