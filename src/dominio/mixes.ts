/**
 * Los ocho mixes por zona: qué bloques tiene cada uno y cómo se arman para una
 * persona, con su nivel, su equipo y su historial.
 *
 * ## Por qué los bloques son datos y no código
 *
 * Las tablas son las de `catalogo.md` §3 (roles 7 y 8), copiadas tal cual en
 * `MIXES`: bloque, clase, opciones por equipo y por banda. Escritas como datos
 * se pueden recorrer —APARECE EN de la Ficha, el test que verifica que cada id
 * es de verdad del catálogo, la hoja Cambiar con OTRAS DEL BLOQUE— y una
 * corrección de kinesiología es cambiar una fila, no una rama de un `if`.
 *
 * ## Cómo se resuelve un bloque (§6.3 de la reestructura)
 *
 * - **Cadena:** el eslabón actual con el objetivo del motor. Es el único que
 *   lee, una vez por día y por cadena.
 * - **Variante:** las opciones con nivel equivalente entre N − 2 y N, con tu
 *   equipo, sus requisitos cumplidos y sin cargar una cadena marcada en
 *   Molestia, ordenadas por nivel y después por id.
 *   Va la primera que no esté superada (dos sesiones seguidas en el techo de
 *   su ventana); si todas lo están, la última. Así la variante es estable y
 *   cambia sola recién al llegar al techo.
 * - **Accesorio:** lo mismo, por banda de nivel en vez de ventana.
 * - **Sin nada en el rango** (la Decisión 44, para lo que todavía no está en
 *   la app): un bloque opcional se saltea con su nota; uno obligatorio baja a
 *   la opción que exista más cercana por debajo, del mismo bloque, nunca a una
 *   más difícil; si no hay ninguna, al eslabón anterior, que es la bajada de
 *   hoy.
 * - **Tu eslabón como opción:** si el mix ya tiene un bloque de cadena de ese
 *   patrón, va N − 1; si no, el bloque pasa a ser de cadena. Una decisión por
 *   patrón (§5.6 B3).
 *
 * ## Lo que este archivo no hace
 *
 * - **La molestia, salvo al elegir.** Acá solo se descarta: una variante, un
 *   accesorio o lo que la semana dejó atrás que carga una cadena marcada en
 *   Molestia no es candidata (§6.3), y el bloque toma la siguiente que sirve.
 *   Bajar es de `pasosConMolestia` (`molestia.ts`), que recibe los pasos del
 *   mix sin bajar nada, igual que `bloqueConMolestia` recibe el bloque del
 *   motor: baja los pasos `cadena`, saltea los de volumen y aplica la regla
 *   del plan a los fijos que quedan. Bajado acá y allá, un paso bajaría dos
 *   eslabones. Lo aplica quien arma la sesión (`arranque.ts`).
 * - **El chequeo del día.** Baja los pasos `cadena` como hoy, venga de donde
 *   venga la sesión, y a los fijos solo con "Bajar también los tuyos"
 *   (`ajusteParaFijos`, §5.6 D): es un botón de la persona, no una regla del
 *   mix.
 * - **El `tipo` de la sesión.** Liviano se guarda como `corta` y no lee
 *   ninguna cadena; eso lo decide `arranque.ts`. Acá Liviano devuelve `mueve`
 *   vacío para que la pantalla no prometa lo que la sesión no va a hacer.
 *
 * Todo es puro y determinista: la misma entrada da siempre el mismo mix. El
 * tiempo llega como `hoy` y el historial, como dato.
 */

import { DESCANSO_DE_BAJADA, bajadaDe, minutosDeSesion } from './bajada'
import { CADENAS, CADENA_POR_PATRON, EJERCICIOS } from './biblioteca'
import {
  BANDAS,
  bandaDelEslabon,
  nivelDe,
  requisitoCumplido,
  type BandaDeNivel,
  type RequisitoDeHistorial,
} from './catalogo'
import { alcanza } from './equipo'
import { pasosConMolestia } from './molestia'
import { MOVILIDAD_POR_ID, movilidadParaEntrada } from './movilidad'
import { APORTE, loQueFalta, loQueFaltaSinPlan, type LoQueFalta, type Musculo } from './musculos'
import { cumpleCadaSerie, yaLeidaHoy } from './progresion'
import { objetivoDelFijo } from './rutinasPropias'
import type { MixConTrabajo } from './sectores'
import type {
  Avance,
  Ejercicio,
  Equipo,
  Objetivo,
  OrigenDeSesion,
  PasoDelBorrador,
  Patron,
  RegistroEjercicio,
  Rutina,
  Sector,
  Sesion,
} from './tipos'

// ─── Los datos ──────────────────────────────────────────────────────────

/** Completo, Corto o Liviano: los mismos tres del origen de la sesión (§5.6 F). */
export type VersionDeMix = Extract<OrigenDeSesion, { clase: 'mix' }>['version']

export const VERSIONES: readonly VersionDeMix[] = ['completa', 'corta', 'liviana']

/**
 * Qué hace un bloque. `entrada` y `cierre` están en la tabla pero no se
 * eligen: la entrada tiene su propia forma (`EntradaDelMix`) y el cierre es la
 * serie de cierre que la sesión ya tiene, prendida en Completo en los mixes
 * cuya tabla tiene la fila Cierre, que hoy es solo Pecho (Decisión 94).
 * `semana` es "lo que la semana dejó atrás" del Cuerpo completo, que se elige
 * con `loQueFalta`.
 */
export type ClaseDeBloque = 'entrada' | 'cadena' | 'variante' | 'accesorio' | 'cierre' | 'semana'

/**
 * Una opción que solo va según lo que hizo un bloque anterior del mismo mix.
 *
 * - `colgado` / `sin-colgarse`: Espalda, "si el bloque 1 fue dominada… si fue
 *   remo…". Colgado es todo lo que pide la barra fija.
 * - `sosten` / `repeticiones`: Core, "si el 1 fue un sostén… si fue una
 *   elevación…". Un sostén es lo que se mide en segundos.
 */
export interface CondicionDeOpcion {
  bloque: string
  fue: 'colgado' | 'sin-colgarse' | 'sosten' | 'repeticiones'
}

export interface OpcionDelBloque {
  id: string
  /**
   * En un accesorio, las bandas de nivel en que va, como las escribe la tabla
   * ("I: extensión en la mesada · II: fondos en banco"). Sin el dato, va en
   * cualquiera: son las columnas de equipo sin banda.
   */
  bandas?: readonly BandaDeNivel[]
  /**
   * En una variante, que va con cualquier nivel: los de barra con discos, que
   * progresan por peso y no tienen un eslabón al que equivalgan.
   */
  cualquierNivel?: true
  /** Solo si un bloque anterior fue de esa clase. */
  si?: CondicionDeOpcion
  /** Series propias, cuando la tabla les da otras que al bloque. */
  series?: number
}

/** Cómo nombra la nota a un bloque, para que cada frase concuerde. */
export interface NombreEnLaNota {
  /** Con artículo, como sujeto: "el hombro de costado queda con…". */
  con: string
  /** Sin artículo, después de "para": "no hay opción para agarre". */
  sin: string
  /** El pronombre que lo retoma: "este mix lo saltea". */
  lo: 'lo' | 'la' | 'los' | 'las'
}

export interface BloqueDelMix {
  /** Kebab-case, único dentro del mix; es también el id del paso. */
  id: string
  /** Como lo dice la tabla, para la fila del Sector. */
  nombre: string
  clase: ClaseDeBloque
  /**
   * La cadena de referencia: de dónde sale N para la ventana, la banda para
   * el accesorio y el eslabón anterior cuando no hay ninguna opción.
   */
  patron: Patron
  /** Cuerpo completo: piernas o bisagra, la que hace más que no se hace. */
  alterna?: Patron
  /** Corto lo saca; Completo y Liviano lo llevan (§5.6 F). */
  opcional?: true
  /**
   * El bloque sin el cual el mix no es el de esa zona: el de cadena, o los
   * primeros de Hombros y de Brazos. Es la misma idea que `mixArmable`.
   */
  central?: true
  /** Solo desde ese eslabón, o desde esa banda, de `patron`. */
  desde?: { nivel?: number; banda?: BandaDeNivel }
  /** Series en Completo. De un rango de la tabla se toma lo más bajo (§5.2). */
  series: number
  /** Un tope de series para algunos ejercicios: el nórdico, con 2. */
  tope?: { ids: readonly string[]; series: number }
  opciones: readonly OpcionDelBloque[]
  nota: NombreEnLaNota
}

/** Un ejercicio de fuerza de la entrada, con sus números fijos. */
export interface ItemDeEntrada {
  id: string
  series: number
  cantidad: number
}

/**
 * La entrada de un mix (§6.3). Va prendida por defecto en los ocho, también
 * en Corto y en Liviano: lo que se acorta es el trabajo, no la preparación.
 */
export interface EntradaDelMix {
  /** Fichas de movilidad, en orden. Nunca una de las marcadas `despues`. */
  movilidad: readonly string[]
  /** Ejercicios de fuerza fijos, en orden. */
  fuerza: readonly ItemDeEntrada[]
  /**
   * Uno solo de estos: el primero que tu equipo alcanza. Es la fila 0 de
   * Espalda, que cambia por columna: aperturas con banda, dominada escapular
   * con barra, Y-T-W en casa.
   */
  unaDe?: readonly ItemDeEntrada[]
  /** Una serie fácil del eslabón anterior al del primer bloque de cadena. */
  serieFacil: boolean
  /** Lo que dice la tabla, cuando lo dice. */
  minutos?: number
}

export interface Mix {
  /** `mix-` y la zona. Está congelado como los ids de los ejercicios. */
  id: string
  sector: Sector
  /** Como se guarda en el origen de la sesión: "Mix de glúteos". */
  nombre: string
  /**
   * Lo que la tabla anuncia: "unos 25 min, de 9 a 11 series". Es la
   * referencia del encabezado del Sector; lo que se arma para la persona
   * sale de `resolverMix`.
   */
  referencia: { minutos: number; series: { min: number; max: number } }
  entrada: EntradaDelMix
  bloques: readonly BloqueDelMix[]
}

/** Lo que va igual en los ocho mixes, con su fuente y cuánto la respalda. */
export interface ReglaDeLosMixes {
  criterio: string
  regla: string
  fuente: string
  evidencia: string
}

/**
 * Las reglas comunes de `catalogo.md` §3. Están para que la fuente viaje con
 * el dato: la pantalla de fuentes las lee de acá, no de una copia.
 */
export const REGLAS_DE_LOS_MIXES: readonly ReglaDeLosMixes[] = [
  {
    criterio: 'Volumen semanal',
    regla: 'Unas 10 series por músculo por semana como referencia. Más suma, pero cada vez menos.',
    fuente: 'Schoenfeld, Ogborn y Krieger 2017; Pelland et al. 2025',
    evidencia: 'Metaanálisis; metarregresión',
  },
  {
    criterio: 'Volumen por sesión',
    regla: 'De 6 a 10 series directas al músculo principal del sector, con un techo de unas 11 fraccionales.',
    fuente: 'Remmert et al., preprint',
    evidencia: 'Metarregresión en un preprint sin revisión por pares: el techo orienta, no es una regla',
  },
  {
    criterio: 'Frecuencia',
    regla: 'Cada grupo, al menos 2 días por semana. Con el mismo volumen, el reparto casi no cambia el crecimiento.',
    fuente: 'ACSM 2026; OMS 2020; Schoenfeld, Grgic y Krieger 2019',
    evidencia: 'Guía y consenso; metaanálisis',
  },
  {
    criterio: 'Carga',
    regla: 'La ventana de cada ficha: de 6 a 15 repeticiones o hasta 30 s.',
    fuente: 'Schoenfeld et al. 2017; Kotarsky et al. 2018',
    evidencia: 'Metaanálisis; ensayo chico (n = 23, 4 semanas)',
  },
  {
    criterio: 'Cercanía al fallo',
    regla: 'Terminar con 1 a 3 repeticiones en reserva; en la segunda o tercera sesión del día, 2 o 3.',
    fuente: 'Robinson et al. 2024; Morán-Navarro et al. 2017',
    evidencia: 'Metarregresión; ensayo chico (n = 10)',
  },
  {
    criterio: 'Descanso entre series',
    regla: 'El de cada ficha: de 60 a 180 s en lo principal y de 45 a 75 s en los accesorios.',
    fuente: 'Singer et al. 2024',
    evidencia: 'Metaanálisis bayesiano de 9 estudios: diferencias chicas e inciertas',
  },
  {
    criterio: 'Orden',
    regla: 'Lo explosivo y lo más exigente primero; accesorios y core al final.',
    fuente: 'Nunes et al. 2021',
    evidencia: 'Metaanálisis: más fuerza en lo que va primero, crecimiento parecido en cualquier orden',
  },
  {
    criterio: 'Entrada en calor y movilidad',
    regla: 'De 3 a 5 minutos de movilidad del sector y una serie fácil del eslabón anterior.',
    fuente: 'Criterio de kinesiología',
    evidencia: 'Opinión. Es para moverte con comodidad y llegar al recorrido, y no promete nada sobre lesiones',
  },
]

/** Las tres opciones de "hombro de atrás", iguales en Espalda y en Hombros. */
const HOMBRO_DE_ATRAS: readonly OpcionDelBloque[] = [
  { id: 'ytw-piso' },
  { id: 'remo-australiano-abierto' },
  { id: 'aperturas-banda' },
  { id: 'tiron-cara-banda' },
]

/** El agarre opcional de Espalda y de Brazos. */
const AGARRE: readonly OpcionDelBloque[] = [{ id: 'caminata-granjero' }, { id: 'colgado-activo' }]

/** Cómo nombra la nota a cada cadena cuando es su bloque. */
const NOTA_DE_CADENA: Readonly<Record<Patron, NombreEnLaNota>> = {
  empuje: { con: 'el empuje', sin: 'empuje', lo: 'lo' },
  traccion: { con: 'la tracción', sin: 'tracción', lo: 'la' },
  piernas: { con: 'las piernas', sin: 'piernas', lo: 'las' },
  core: { con: 'el core', sin: 'core', lo: 'lo' },
  bisagra: { con: 'la bisagra', sin: 'bisagra', lo: 'la' },
}

const NOMBRE_DE_CADENA: Readonly<Record<Patron, string>> = {
  empuje: 'Empuje',
  traccion: 'Tracción',
  piernas: 'Piernas',
  core: 'Core',
  bisagra: 'Bisagra',
}

/** Un bloque de cadena: el eslabón actual con el objetivo del motor. */
function bloqueDeCadena(patron: Patron, extra: Partial<BloqueDelMix> = {}): BloqueDelMix {
  return {
    id: patron,
    nombre: NOMBRE_DE_CADENA[patron],
    clase: 'cadena',
    patron,
    central: true,
    series: 3,
    opciones: [],
    nota: NOTA_DE_CADENA[patron],
    ...extra,
  }
}

/**
 * La movilidad de la entrada de los mixes que toman la regla común (Core,
 * Glúteos, Cuerpo completo y Brazos): la fila de la zona en §6.4, sin las de
 * `despues`. Sale de `movilidadParaEntrada` y no se escribe a mano, así una
 * ficha que cambia de marca cambia también acá.
 */
const movilidadDeLaZona = (sector: Sector) => movilidadParaEntrada([sector]).map((f) => f.id)

/**
 * Los ocho, en el orden de `SECTORES`. Cada bloque es una fila de su tabla;
 * los comentarios dicen dónde una fila se lee de una forma y no de otra.
 */
export const MIXES: readonly Mix[] = [
  {
    id: 'mix-pecho',
    sector: 'pecho',
    nombre: 'Mix de pecho',
    referencia: { minutos: 25, series: { min: 9, max: 11 } },
    entrada: {
      movilidad: ['munecas-cuatro-patas'],
      fuerza: [{ id: 'flexion-escapular', series: 1, cantidad: 10 }],
      serieFacil: true,
      minutos: 3,
    },
    bloques: [
      {
        id: 'explosivo',
        nombre: 'Explosivo',
        clase: 'variante',
        patron: 'empuje',
        opcional: true,
        desde: { nivel: 7 },
        series: 2,
        opciones: [{ id: 'flexion-explosiva' }],
        nota: { con: 'lo explosivo', sin: 'lo explosivo', lo: 'lo' },
      },
      bloqueDeCadena('empuje'),
      {
        id: 'otra-palanca',
        nombre: 'Pecho, otra palanca',
        clase: 'variante',
        patron: 'empuje',
        series: 3,
        // La tabla pone umbrales por columna (fondos negativos con empuje ≥ 6,
        // fondos con ≥ 8, anillas con ≥ 7); la ventana de N − 2 a N con el
        // `equivale` de cada ficha es la regla de §6.3 y los cubre.
        opciones: [
          { id: 'flexion-pausa' },
          { id: 'flexion-deficit' },
          { id: 'fondos-negativos' },
          { id: 'fondos-paralelas' },
          { id: 'flexion-anillas' },
        ],
        nota: { con: 'el pecho con otra palanca', sin: 'pecho con otra palanca', lo: 'lo' },
      },
      {
        id: 'triceps',
        nombre: 'Tríceps',
        clase: 'accesorio',
        patron: 'empuje',
        series: 2,
        opciones: [
          { id: 'extension-triceps-mesada', bandas: [1] },
          { id: 'fondos-banco', bandas: [2] },
          { id: 'flexion-esfinge', bandas: [2] },
          { id: 'fondos-banco-pies-elevados', bandas: [3] },
          { id: 'apoyo-paralelas', bandas: [1] },
          { id: 'extension-triceps-barra' },
        ],
        nota: { con: 'el tríceps', sin: 'tríceps', lo: 'lo' },
      },
      {
        id: 'cierre',
        nombre: 'Cierre',
        clase: 'cierre',
        patron: 'empuje',
        opcional: true,
        series: 1,
        opciones: [],
        nota: { con: 'el cierre', sin: 'cierre', lo: 'lo' },
      },
    ],
  },
  {
    id: 'mix-espalda',
    sector: 'espalda',
    nombre: 'Mix de espalda',
    referencia: { minutos: 28, series: { min: 10, max: 12 } },
    entrada: {
      movilidad: ['pasaje-hombros'],
      fuerza: [],
      // De la columna de la derecha a la de la izquierda: lo que pide más
      // equipo gana si lo tenés, y la casa queda de piso.
      unaDe: [
        { id: 'aperturas-banda', series: 1, cantidad: 12 },
        { id: 'dominada-escapular', series: 1, cantidad: 8 },
        { id: 'ytw-piso', series: 1, cantidad: 6 },
      ],
      serieFacil: false,
      minutos: 3,
    },
    bloques: [
      bloqueDeCadena('traccion'),
      {
        id: 'otro-plano',
        nombre: 'Tirón en el otro plano',
        clase: 'variante',
        patron: 'traccion',
        series: 3,
        opciones: [
          { id: 'remo-marco-puerta' },
          { id: 'remo-australiano-alto', si: { bloque: 'traccion', fue: 'colgado' } },
          { id: 'remo-australiano-medio', si: { bloque: 'traccion', fue: 'colgado' } },
          { id: 'remo-australiano-bajo', si: { bloque: 'traccion', fue: 'colgado' } },
          { id: 'remo-australiano-pies-elevados', si: { bloque: 'traccion', fue: 'colgado' } },
          { id: 'remo-australiano-supino', si: { bloque: 'traccion', fue: 'colgado' } },
          { id: 'dominada-escapular', si: { bloque: 'traccion', fue: 'sin-colgarse' } },
          { id: 'dominada-supina', si: { bloque: 'traccion', fue: 'sin-colgarse' } },
          { id: 'remo-banda' },
          { id: 'remo-anillas' },
          { id: 'jalon-banda' },
        ],
        nota: { con: 'el tirón en el otro plano', sin: 'tirón en el otro plano', lo: 'lo' },
      },
      {
        id: 'hombro-atras',
        nombre: 'Hombro de atrás y media espalda',
        clase: 'accesorio',
        patron: 'traccion',
        series: 2,
        opciones: HOMBRO_DE_ATRAS,
        nota: { con: 'el hombro de atrás', sin: 'hombro de atrás', lo: 'lo' },
      },
      {
        id: 'espalda-baja',
        nombre: 'Espalda baja',
        clase: 'accesorio',
        // La banda la da la bisagra: los buenos días son "≈ bisagra 3–4".
        patron: 'bisagra',
        series: 2,
        opciones: [
          { id: 'nadador', bandas: [1] },
          { id: 'perro-de-caza', bandas: [1] },
          { id: 'buenos-dias', bandas: [2] },
        ],
        nota: { con: 'la espalda baja', sin: 'espalda baja', lo: 'la' },
      },
      {
        id: 'agarre',
        nombre: 'Agarre',
        clase: 'accesorio',
        patron: 'traccion',
        opcional: true,
        series: 2,
        opciones: AGARRE,
        nota: { con: 'el agarre', sin: 'agarre', lo: 'lo' },
      },
    ],
  },
  {
    id: 'mix-hombros',
    sector: 'hombros',
    nombre: 'Mix de hombros',
    referencia: { minutos: 22, series: { min: 9, max: 11 } },
    entrada: {
      // La pica y la vertical cargan la muñeca doblada hacia atrás: la
      // entrada de muñecas va prendida por defecto, como en los ocho.
      movilidad: ['munecas-cuatro-patas', 'pasaje-hombros'],
      fuerza: [{ id: 'flexion-escapular', series: 1, cantidad: 10 }],
      serieFacil: false,
      minutos: 3,
    },
    bloques: [
      {
        id: 'sobre-la-cabeza',
        nombre: 'Empuje por encima de la cabeza',
        clase: 'variante',
        patron: 'empuje',
        central: true,
        series: 3,
        // La declinada y la pseudo plancha están porque la tabla dice que
        // este bloque mueve el empuje cuando coincide con ellas.
        opciones: [
          { id: 'flexion-pica-inclinada' },
          { id: 'flexion-pica' },
          { id: 'flexion-pica-elevada' },
          { id: 'flexion-vertical-negativa' },
          { id: 'flexion-vertical' },
          { id: 'flexion-declinada' },
          { id: 'flexion-pseudoplancha' },
          { id: 'press-militar-barra', cualquierNivel: true },
        ],
        nota: {
          con: 'el empuje por encima de la cabeza',
          sin: 'empuje por encima de la cabeza',
          lo: 'lo',
        },
      },
      {
        id: 'adelante-serrato',
        nombre: 'Hombro adelante y serrato',
        clase: 'variante',
        patron: 'empuje',
        series: 2,
        opciones: [
          { id: 'flexion-escapular' },
          { id: 'vertical-pared', series: 3 },
          { id: 'flexion-pseudoplancha', series: 3 },
          { id: 'apoyo-paralelas', series: 3 },
        ],
        nota: { con: 'el hombro de adelante y el serrato', sin: 'hombro de adelante y serrato', lo: 'los' },
      },
      {
        id: 'costado',
        nombre: 'Hombro de costado',
        clase: 'accesorio',
        patron: 'empuje',
        series: 3,
        opciones: [{ id: 'empuje-lateral-pared' }, { id: 'elevacion-lateral-banda' }],
        nota: { con: 'el hombro de costado', sin: 'hombro de costado', lo: 'lo' },
      },
      {
        id: 'atras',
        nombre: 'Hombro de atrás',
        clase: 'accesorio',
        patron: 'traccion',
        series: 3,
        opciones: HOMBRO_DE_ATRAS,
        nota: { con: 'el hombro de atrás', sin: 'hombro de atrás', lo: 'lo' },
      },
    ],
  },
  {
    id: 'mix-brazos',
    sector: 'brazos',
    nombre: 'Mix de brazos',
    referencia: { minutos: 22, series: { min: 10, max: 12 } },
    entrada: { movilidad: movilidadDeLaZona('brazos'), fuerza: [], serieFacil: false },
    bloques: [
      {
        id: 'tiron-biceps',
        nombre: 'Tirón con bíceps',
        clase: 'variante',
        patron: 'traccion',
        central: true,
        series: 3,
        opciones: [
          { id: 'remo-marco-puerta' },
          { id: 'remo-australiano-supino' },
          { id: 'dominada-supina' },
          { id: 'curl-peso-corporal' },
        ],
        nota: { con: 'el tirón con bíceps', sin: 'tirón con bíceps', lo: 'lo' },
      },
      {
        id: 'empuje-triceps',
        nombre: 'Empuje con tríceps',
        clase: 'variante',
        patron: 'empuje',
        central: true,
        series: 3,
        opciones: [
          { id: 'fondos-banco' },
          { id: 'flexion-esfinge' },
          { id: 'flexion-diamante' },
          { id: 'fondos-banco-pies-elevados' },
          { id: 'fondos-paralelas' },
        ],
        nota: { con: 'el empuje con tríceps', sin: 'empuje con tríceps', lo: 'lo' },
      },
      {
        id: 'biceps',
        nombre: 'Bíceps',
        clase: 'accesorio',
        patron: 'traccion',
        series: 2,
        opciones: [
          { id: 'curl-isometrico-toalla' },
          { id: 'curl-peso-corporal' },
          { id: 'curl-barra' },
          { id: 'curl-banda' },
        ],
        nota: { con: 'el bíceps', sin: 'bíceps', lo: 'lo' },
      },
      {
        id: 'triceps',
        nombre: 'Tríceps',
        clase: 'accesorio',
        patron: 'empuje',
        series: 2,
        opciones: [{ id: 'extension-triceps-mesada' }, { id: 'extension-triceps-barra' }],
        nota: { con: 'el tríceps', sin: 'tríceps', lo: 'lo' },
      },
      {
        id: 'agarre',
        nombre: 'Agarre',
        clase: 'accesorio',
        patron: 'traccion',
        opcional: true,
        series: 2,
        opciones: AGARRE,
        nota: { con: 'el agarre', sin: 'agarre', lo: 'lo' },
      },
    ],
  },
  {
    id: 'mix-core',
    sector: 'core',
    nombre: 'Mix de core',
    referencia: { minutos: 16, series: { min: 9, max: 11 } },
    entrada: { movilidad: movilidadDeLaZona('core'), fuerza: [], serieFacil: true },
    bloques: [
      bloqueDeCadena('core'),
      {
        id: 'lateral',
        nombre: 'Lateral',
        clase: 'accesorio',
        patron: 'core',
        series: 2,
        opciones: [
          { id: 'plancha-lateral-rodillas', bandas: [1] },
          { id: 'plancha-lateral', bandas: [2] },
          { id: 'copenhague-corta', bandas: [2] },
          { id: 'plancha-lateral-abduccion', bandas: [2] },
          { id: 'copenhague-larga', bandas: [3] },
        ],
        nota: { con: 'el core lateral', sin: 'core lateral', lo: 'lo' },
      },
      {
        id: 'complemento',
        nombre: 'Lo que el bloque 1 no hizo',
        clase: 'variante',
        patron: 'core',
        series: 2,
        // Bicho muerto y posición hueca van después de un sostén y después de
        // una elevación, así que no llevan condición.
        opciones: [
          { id: 'bicho-muerto' },
          { id: 'crunch-inverso', si: { bloque: 'core', fue: 'sosten' } },
          { id: 'cuerpo-hueco' },
          { id: 'rueda-toalla', si: { bloque: 'core', fue: 'sosten' } },
          { id: 'sentada-l-agrupada' },
          { id: 'sentada-l' },
        ],
        nota: { con: 'el abdomen', sin: 'abdomen', lo: 'lo' },
      },
      {
        id: 'rotacion',
        nombre: 'Rotación',
        clase: 'accesorio',
        patron: 'core',
        series: 2,
        opciones: [
          { id: 'limpiaparabrisas-piso' },
          { id: 'plancha-brazo-alternado' },
          { id: 'pallof-banda' },
        ],
        nota: { con: 'la rotación', sin: 'rotación', lo: 'la' },
      },
      {
        id: 'espalda-baja',
        nombre: 'Espalda baja',
        clase: 'accesorio',
        patron: 'core',
        series: 2,
        opciones: [{ id: 'perro-de-caza' }, { id: 'nadador' }],
        nota: { con: 'la espalda baja', sin: 'espalda baja', lo: 'la' },
      },
    ],
  },
  {
    id: 'mix-piernas',
    sector: 'piernas',
    nombre: 'Mix de piernas',
    referencia: { minutos: 30, series: { min: 11, max: 13 } },
    entrada: {
      movilidad: ['rodilla-pared', 'sentadilla-profunda-sostenida', 'zancada-rotacion'],
      fuerza: [],
      serieFacil: false,
      minutos: 4,
    },
    bloques: [
      bloqueDeCadena('piernas'),
      // Con el nórdico, 2 series: su ficha avisa que deja el muslo dolorido
      // tres días.
      bloqueDeCadena('bisagra', { tope: { ids: ['curl-nordico-negativo', 'curl-nordico'], series: 2 } }),
      {
        id: 'una-pierna',
        nombre: 'Rodilla, a una pierna',
        clase: 'variante',
        patron: 'piernas',
        series: 2,
        opciones: [
          { id: 'sentadilla-pared' },
          { id: 'zancada-atras' },
          { id: 'subida-cajon' },
          { id: 'sentadilla-cosaca' },
          { id: 'sentadilla-sissy-asistida' },
          { id: 'sentadilla-patinador' },
        ],
        nota: { con: 'la rodilla a una pierna', sin: 'rodilla a una pierna', lo: 'la' },
      },
      {
        id: 'pantorrilla',
        nombre: 'Pantorrilla',
        clase: 'accesorio',
        patron: 'piernas',
        series: 3,
        opciones: [
          { id: 'talones-escalon', bandas: [1] },
          { id: 'talones-una-pierna', bandas: [2, 3] },
          { id: 'talones-rodilla-doblada', bandas: [2, 3] },
          { id: 'elevacion-talones-barra' },
        ],
        nota: { con: 'la pantorrilla', sin: 'pantorrilla', lo: 'la' },
      },
      {
        id: 'aductores',
        nombre: 'Aductores',
        clase: 'accesorio',
        patron: 'bisagra',
        opcional: true,
        desde: { banda: 2 },
        series: 2,
        opciones: [{ id: 'copenhague-corta' }],
        nota: { con: 'los aductores', sin: 'aductores', lo: 'los' },
      },
    ],
  },
  {
    id: 'mix-gluteos',
    sector: 'gluteos',
    nombre: 'Mix de glúteos',
    referencia: { minutos: 24, series: { min: 10, max: 12 } },
    entrada: { movilidad: movilidadDeLaZona('gluteos'), fuerza: [], serieFacil: true },
    bloques: [
      bloqueDeCadena('bisagra'),
      {
        id: 'empuje-cadera',
        nombre: 'Empuje de cadera',
        clase: 'variante',
        patron: 'bisagra',
        series: 3,
        opciones: [{ id: 'empuje-cadera-sillon' }, { id: 'empuje-cadera-una-pierna' }],
        nota: { con: 'el empuje de cadera', sin: 'empuje de cadera', lo: 'lo' },
      },
      {
        id: 'una-pierna',
        nombre: 'Glúteo a una pierna',
        clase: 'variante',
        patron: 'piernas',
        series: 3,
        opciones: [{ id: 'subida-cajon' }, { id: 'zancada-atras' }, { id: 'sentadilla-bulgara' }],
        nota: { con: 'el glúteo a una pierna', sin: 'glúteo a una pierna', lo: 'lo' },
      },
      {
        id: 'gluteo-medio',
        nombre: 'Glúteo medio',
        clase: 'accesorio',
        patron: 'piernas',
        series: 2,
        opciones: [
          { id: 'abduccion-de-costado', bandas: [1] },
          { id: 'plancha-lateral-abduccion', bandas: [2] },
          { id: 'caminata-lateral-banda' },
        ],
        nota: { con: 'el glúteo medio', sin: 'glúteo medio', lo: 'lo' },
      },
      {
        id: 'isquios',
        nombre: 'Isquiotibiales',
        clase: 'variante',
        patron: 'bisagra',
        opcional: true,
        series: 2,
        opciones: [{ id: 'puente-palanca-larga' }, { id: 'curl-deslizando-una-pierna' }],
        nota: { con: 'los isquiotibiales', sin: 'isquiotibiales', lo: 'los' },
      },
    ],
  },
  {
    id: 'mix-cuerpo-completo',
    sector: 'cuerpo',
    nombre: 'Mix de cuerpo completo',
    referencia: { minutos: 32, series: { min: 13, max: 15 } },
    entrada: { movilidad: movilidadDeLaZona('cuerpo'), fuerza: [], serieFacil: true },
    bloques: [
      bloqueDeCadena('traccion'),
      bloqueDeCadena('empuje'),
      bloqueDeCadena('piernas', {
        id: 'piernas-o-bisagra',
        nombre: 'Piernas o bisagra',
        alterna: 'bisagra',
      }),
      bloqueDeCadena('core'),
      {
        id: 'semana',
        nombre: 'Lo que la semana dejó atrás',
        clase: 'semana',
        patron: 'core',
        series: 2,
        opciones: [],
        nota: {
          con: 'lo que la semana dejó atrás',
          sin: 'lo que la semana dejó atrás',
          lo: 'lo',
        },
      },
    ],
  },
]

export const MIX_POR_SECTOR: Readonly<Record<Sector, Mix>> = Object.fromEntries(
  MIXES.map((m) => [m.sector, m]),
) as Record<Sector, Mix>

/**
 * Los ids que nombra cada mix: las opciones de sus bloques y lo de su
 * entrada. Es lo que `apareceEn` (`catalogo.ts`) recibe para APARECE EN de la
 * Ficha; llega como dato porque `catalogo.ts` no puede importar este archivo,
 * que lo importa a él.
 */
export const IDS_DE_LOS_MIXES: Readonly<Record<Sector, readonly string[]>> = Object.fromEntries(
  MIXES.map((m) => [m.sector, idsDelMix(m)] as const),
) as Record<Sector, readonly string[]>

function idsDelMix(mix: Mix): readonly string[] {
  const ids = [
    ...mix.entrada.movilidad,
    ...mix.entrada.fuerza.map((i) => i.id),
    ...(mix.entrada.unaDe ?? []).map((i) => i.id),
    ...mix.bloques.flatMap((b) => b.opciones.map((o) => o.id)),
  ]
  return [...new Set(ids)]
}

// ─── Lo que se arma ─────────────────────────────────────────────────────

/** Un paso del mix: siempre con id, clase y sección. */
export type PasoDelMix = PasoDelBorrador & Required<Pick<PasoDelBorrador, 'id' | 'clase' | 'seccion'>>

/** Un bloque ya resuelto, para la fila del Sector y la hoja Cambiar. */
export interface BloqueResueltoDelMix {
  id: string
  nombre: string
  clase: ClaseDeBloque
  opcional: boolean
  /** Lo que quedó: un paso, o ninguno si se salteó; la entrada, varios. */
  pasos: PasoDelMix[]
  /** Por qué cambió o se salteó, si hay algo que decir. */
  nota: string | null
  /** OTRAS DEL BLOQUE: las que también entraban, en el orden de elección. */
  candidatas: string[]
}

export interface MixResuelto {
  pasos: PasoDelMix[]
  /** Las notas de los bloques, en su orden. */
  notas: string[]
  /** De `minutosDeSesion`, con los pasos de fuerza (la movilidad cae en su margen). */
  minutos: number
  /** Series de trabajo: sin la entrada ni la movilidad. */
  series: number
  /** Las cadenas que esta sesión puede leer hoy: sus pasos `cadena`, sin las ya leídas. */
  mueve: Patron[]
  /**
   * La serie de cierre: sale del bloque opcional Cierre (§4.14), así que va
   * solo en Completo y solo en un mix que lo tiene en su tabla (hoy, Pecho).
   * Un mix sin esa fila no puede sumar una serie que el Sector no muestra.
   */
  cierre: boolean
  bloques: BloqueResueltoDelMix[]
}

export interface ContextoDelMix {
  avances: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId' | 'objetivoActual'>>
  /** "Con lo que tengo" (`equipoDe`). */
  equipo: readonly Equipo[] | ReadonlySet<Equipo>
  historial: readonly Sesion[]
  /** AAAA-MM-DD local. */
  hoy: string
  /** La rutina activa, si hay plan semanal: "lo que la semana dejó atrás" usa `loQueFalta`. */
  plan?: Rutina | null
  /** El interruptor de la entrada. Prendido si falta. */
  entrada?: boolean
  /** La biblioteca; se pasa para probar con fichas que todavía no están. */
  catalogo?: readonly Ejercicio[]
  /** Los requisitos de historial (§6.6); se pasan para probar. */
  requisitosDeHistorial?: ReadonlyMap<string, readonly RequisitoDeHistorial[]>
  /**
   * Las cadenas marcadas en Molestia, las mismas que recibe
   * `pasosConMolestia`. Lo que carga una de ellas no es candidata de una
   * variante ni de un accesorio (§6.3). Sin el dato, ninguna.
   */
  molestias?: ReadonlySet<Patron>
}

// ─── Las cuentas de nivel ───────────────────────────────────────────────

/** Dónde está cada eslabón: su cadena y su lugar en ella, desde 1. */
const ESLABON: ReadonlyMap<string, { patron: Patron; posicion: number }> = new Map(
  CADENAS.flatMap((c) =>
    c.ejercicios.map((id, i) => [id, { patron: c.patron, posicion: i + 1 }] as const),
  ),
)

/** N(p): el lugar del eslabón actual en su cadena, o null sin avance. */
function nivelActual(patron: Patron, contexto: ContextoDelMix): number | null {
  const avance = contexto.avances.get(patron)
  if (!avance) return null
  const lugar = ESLABON.get(avance.ejercicioId)
  return lugar && lugar.patron === patron ? lugar.posicion : null
}

/** El primer eslabón de una banda, para ubicar en una cadena lo que no tiene `equivale`. */
function primerNivelDeLaBanda(patron: Patron, banda: BandaDeNivel): number {
  if (banda === 1) return 1
  return banda === 2 ? BANDAS[patron].I + 1 : BANDAS[patron].II + 1
}

/**
 * Dónde cae un ejercicio en la escalera de `patron`, para la ventana de una
 * variante.
 *
 * Un eslabón, en su lugar; una variante de ese patrón, en su `equivale`. Lo
 * que no tiene ninguno de los dos (una activación como la flexión escapular,
 * un accesorio) cae en el primer eslabón de su banda: así entra en la ventana
 * de quien está empezando esa banda y, más arriba, sirve de "la más cercana
 * por debajo" sin pasar nunca por más difícil.
 */
function nivelEnLaCadena(ejercicio: Ejercicio, patron: Patron): number {
  const lugar = ESLABON.get(ejercicio.id)
  if (lugar && lugar.patron === patron) return lugar.posicion
  if (ejercicio.equivale && ejercicio.equivale.patron === patron) return ejercicio.equivale.nivel
  return primerNivelDeLaBanda(patron, nivelDe(ejercicio))
}

/** Un eslabón por encima del tuyo en su cadena: más difícil, y nunca se propone. */
function masDificilQueTuEslabon(ejercicio: Ejercicio, contexto: ContextoDelMix): boolean {
  const lugar = ESLABON.get(ejercicio.id)
  if (!lugar) return false
  return lugar.posicion > (nivelActual(lugar.patron, contexto) ?? 1)
}

/** Si un ejercicio es justo tu eslabón actual de su cadena. */
function cadenaSiEsTuEslabon(ejercicio: Ejercicio, contexto: ContextoDelMix): Patron | null {
  const lugar = ESLABON.get(ejercicio.id)
  if (!lugar) return null
  return contexto.avances.get(lugar.patron)?.ejercicioId === ejercicio.id ? lugar.patron : null
}

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// ─── El estado mientras se arma ─────────────────────────────────────────

interface Armado {
  contexto: ContextoDelMix
  version: VersionDeMix
  /** Por id. Un `Map` y no de solo lectura porque `bajadaDe` lo pide así; nadie lo escribe. */
  catalogo: Map<string, Ejercicio>
  /** El historial, de lo más nuevo a lo más viejo. */
  recientes: readonly Sesion[]
  /** Los ejercicios de trabajo ya puestos: el mix no repite (`sinEjerciciosRepetidos`, §10). */
  usados: Set<string>
  /** Las cadenas que ya tienen su paso `cadena` en este mix. */
  conCadena: Set<Patron>
  /** Lo que puso cada bloque, para las opciones que dependen de uno anterior. */
  porBloque: Map<string, PasoDelMix[]>
}

/**
 * Los registros de un ejercicio, del más nuevo al más viejo, uno por sesión y
 * sin la entrada en calor, que no es trabajo (§5.6 A: "la vez pasada" de
 * cualquier sesión, salvo calentamiento).
 */
function registrosDe(id: string, armado: Armado, cuantos: number): RegistroEjercicio[] {
  const encontrados: RegistroEjercicio[] = []
  for (const sesion of armado.recientes) {
    const registro = sesion.registros.find((r) => r.ejercicioId === id && !r.calentamiento)
    if (!registro) continue
    encontrados.push(registro)
    if (encontrados.length >= cuantos) break
  }
  return encontrados
}

/**
 * Superada: las dos últimas veces, cada serie llegó al techo de su ventana.
 * En cualquier origen: una variante que ya dominaste en tu rutina también
 * está dominada en el mix.
 */
function superada(ejercicio: Ejercicio, armado: Armado): boolean {
  const [ultima, anterior] = registrosDe(ejercicio.id, armado, 2)
  if (!ultima || !anterior) return false
  const enElTecho = (r: RegistroEjercicio) =>
    cumpleCadaSerie({ series: r.objetivo.series, cantidad: ejercicio.ventana.max }, r.series)
  return enElTecho(ultima) && enElTecho(anterior)
}

/**
 * La primera que no está superada; si todas lo están, la última. Es lo que
 * hace estable a una variante: no rota por rotar, cambia al llegar al techo.
 */
function primeraNoSuperada(lista: readonly Ejercicio[], armado: Armado): Ejercicio | undefined {
  return lista.find((e) => !superada(e, armado)) ?? lista[lista.length - 1]
}

/**
 * La dosis de un fijo con la doble progresión (§5.6 B8).
 *
 * Es `objetivoDelFijo`, la misma que la de un fijo de una rutina, y no una
 * copia: la misma "última vez" (sin la entrada en calor, el Reloj, la serie
 * de cierre ni las sesiones `corta`), el mismo `incremento` y la misma
 * repetición si no se cumplió. Dos cuentas distintas harían que una variante
 * suba distinto en el mix que en tu rutina.
 *
 * Lo único que el mix agrega es quedar dentro de la ventana de la ficha
 * ("guardan la ventana de su ficha"), por arriba y por abajo: la última vez
 * pudo ser el fijo de una rutina con un número que la persona escribió fuera
 * de la ventana, o uno que "Bajar también los tuyos" dejó bajo el piso. En
 * su rutina ese número se respeta; el mix no tiene números de nadie.
 */
function dosisDelFijo(ejercicio: Ejercicio, series: number, armado: Armado): Objetivo {
  const { min, max } = ejercicio.ventana
  const objetivo = objetivoDelFijo({ series }, ejercicio, armado.contexto.historial)
  const enLaVentana: Objetivo = { ...objetivo, cantidad: Math.min(max, Math.max(min, objetivo.cantidad)) }
  return alPisoSiEsLiviana(enLaVentana, ejercicio, armado)
}

/**
 * Liviano: 2 series y la cantidad más baja entre la de hoy y lo bajo de la
 * ventana (§5.6 F). Se aplica a todo lo que no es entrada.
 */
function alPisoSiEsLiviana(objetivo: Objetivo, ejercicio: Ejercicio, armado: Armado): Objetivo {
  if (armado.version !== 'liviana') return objetivo
  return { ...objetivo, series: 2, cantidad: Math.min(objetivo.cantidad, ejercicio.ventana.min) }
}

/** El tope de series del bloque, si este ejercicio lo tiene. */
function conTope(objetivo: Objetivo, ejercicio: Ejercicio, bloque: BloqueDelMix): Objetivo {
  const tope = bloque.tope
  if (!tope || !tope.ids.includes(ejercicio.id) || objetivo.series <= tope.series) return objetivo
  return { ...objetivo, series: tope.series }
}

// ─── Los pasos ──────────────────────────────────────────────────────────

function pasoDeCadena(
  bloque: BloqueDelMix,
  ejercicio: Ejercicio,
  avance: Pick<Avance, 'objetivoActual'>,
  armado: Armado,
): PasoDelMix {
  const objetivo = alPisoSiEsLiviana({ ...avance.objetivoActual }, ejercicio, armado)
  return {
    id: bloque.id,
    ejercicioId: ejercicio.id,
    objetivo: conTope(objetivo, ejercicio, bloque),
    clase: 'cadena',
    seccion: 'principal',
  }
}

function pasoFijo(bloque: BloqueDelMix, ejercicio: Ejercicio, series: number, armado: Armado): PasoDelMix {
  return {
    id: bloque.id,
    ejercicioId: ejercicio.id,
    objetivo: conTope(dosisDelFijo(ejercicio, series, armado), ejercicio, bloque),
    clase: 'fijo',
    seccion: 'principal',
    fijo: true,
  }
}

/**
 * La bajada de hoy: el eslabón anterior, con la dosis de la bajada del plan
 * (`bajadaDe`: 2 series al techo, 45 s). Se guarda como volumen, con
 * `bajada`, igual que en el plan (§5.2).
 */
function pasoDeVolumen(
  bloque: BloqueDelMix,
  abajo: { ejercicio: Ejercicio; objetivo: Objetivo },
  armado: Armado,
): PasoDelMix {
  return {
    id: bloque.id,
    ejercicioId: abajo.ejercicio.id,
    objetivo: conTope(alPisoSiEsLiviana(abajo.objetivo, abajo.ejercicio, armado), abajo.ejercicio, bloque),
    clase: 'volumen',
    seccion: 'principal',
    bajada: true,
    descansoSegundos: DESCANSO_DE_BAJADA,
  }
}

/** Las series de una opción: las del bloque en Completo, 2 en Corto y Liviano. */
function seriesDe(bloque: BloqueDelMix, opcion: OpcionDelBloque | undefined, armado: Armado): number {
  if (armado.version !== 'completa') return 2
  return opcion?.series ?? bloque.series
}

// ─── Las notas ──────────────────────────────────────────────────────────

/** Cómo se nombra cada equipo adentro de una frase. */
const EQUIPO_EN_LA_FRASE: Readonly<Record<Equipo, string>> = {
  nada: 'nada',
  silla: 'silla o banco',
  pared: 'pared',
  marco: 'marco de puerta',
  toalla: 'toalla',
  objetos: 'objetos de la casa',
  escalon: 'escalón',
  'barra-baja': 'barra baja o mesa',
  barra: 'barra',
  banda: 'banda',
  paralelas: 'paralelas',
  anillas: 'anillas',
  discos: 'barra con discos',
}

/**
 * Lo que se compra y abre opciones. Con esto se arma el bloque "si lo
 * tuvieras", y la nota nombra solo lo que de verdad cambiaría la elección.
 * Los discos no están: la barra con discos aparece en las tablas como un
 * extra, y nombrarla en cada mix sería vender.
 */
const EQUIPO_QUE_ABRE: readonly Equipo[] = ['escalon', 'barra', 'banda', 'paralelas', 'anillas']

const ORDEN_DE_EQUIPO: readonly Equipo[] = [
  'nada',
  'silla',
  'pared',
  'marco',
  'toalla',
  'objetos',
  'escalon',
  'barra-baja',
  'barra',
  'banda',
  'paralelas',
  'anillas',
  'discos',
]

function tiene(equipo: readonly Equipo[] | ReadonlySet<Equipo>, e: Equipo): boolean {
  return e === 'nada' || ('has' in equipo ? equipo.has(e) : equipo.includes(e))
}

/** Lo que pide un ejercicio y no está, en el orden de siempre. */
function loQueFaltaDe(ejercicio: Ejercicio, equipo: readonly Equipo[] | ReadonlySet<Equipo>): Equipo[] {
  const pide = ejercicio.equipo ?? []
  return ORDEN_DE_EQUIPO.filter((e) => pide.includes(e) && !tiene(equipo, e))
}

/** "Flexión diamante" adentro de una frase es "flexión diamante"; "Y-T-W" queda. */
function enLaFrase(nombre: string): string {
  const segunda = nombre.charAt(1)
  return segunda !== '' && segunda === segunda.toLowerCase() && segunda !== segunda.toUpperCase()
    ? nombre.charAt(0).toLowerCase() + nombre.slice(1)
    : nombre
}

const queda = (nota: NombreEnLaNota) => (nota.lo === 'los' || nota.lo === 'las' ? 'quedan' : 'queda')

/** "Sin banda, el hombro de costado queda con empuje lateral contra la pared." */
function notaDeEquipo(nota: NombreEnLaNota, faltan: readonly Equipo[], ejercicio: Ejercicio): string {
  const sin = faltan.map((e) => EQUIPO_EN_LA_FRASE[e]).join(' ni ')
  return `Sin ${sin}, ${nota.con} ${queda(nota)} con ${enLaFrase(ejercicio.nombre)}.`
}

/** "Con tu equipo no hay opción para agarre: este mix lo saltea." */
const notaSinEquipo = (nota: NombreEnLaNota) =>
  `Con tu equipo no hay opción para ${nota.sin}: este mix ${nota.lo} saltea.`

/** Lo que todavía no está en la app (Decisión 44). */
const notaSinOpciones = (nota: NombreEnLaNota) =>
  `Las opciones para ${nota.sin} todavía no están en la app: este mix ${nota.lo} saltea.`

/** Lo que existe, pero más arriba de tu eslabón o con un requisito sin cumplir. */
const notaSinNivel = (nota: NombreEnLaNota) =>
  `Con tu nivel no hay opción para ${nota.sin}: este mix ${nota.lo} saltea.`

/** Lo único que quedaba ya estaba en otro bloque. */
const notaRepetido = (nota: NombreEnLaNota, ejercicio: Ejercicio) =>
  `Este mix ya tiene ${enLaFrase(ejercicio.nombre)}: saltea ${nota.con}.`

/**
 * Lo que había cargaba una cadena marcada en Molestia: "Molestia en tracción:
 * hoy este mix saltea el agarre.", con la forma de `lineaDeMolestia`. Dice
 * "hoy" porque la molestia es de hoy: mañana, sin ella, el bloque vuelve.
 */
const notaDeMolestia = (nota: NombreEnLaNota, patron: Patron) =>
  `Molestia en ${NOTA_DE_CADENA[patron].sin}: hoy este mix saltea ${nota.con}.`

// ─── La elección de un bloque ───────────────────────────────────────────

/** Lo que sale de elegir: un ejercicio, una bajada o nada, con su motivo. */
type Eleccion =
  | { clase: 'opcion'; ejercicio: Ejercicio; opcion: OpcionDelBloque | undefined }
  | { clase: 'bajada'; ejercicio: Ejercicio; objetivo: Objetivo }
  | { clase: 'nada'; motivo: MotivoSinOpcion }
  | { clase: 'nada'; motivo: 'repetido'; ejercicio: Ejercicio }
  | { clase: 'nada'; motivo: 'molestia'; patron: Patron }

/**
 * Por qué un bloque se queda sin nada, para que la nota diga la razón
 * verdadera y no otra:
 *
 * - `falta-en-la-app`: ninguna de sus opciones está todavía en el catálogo.
 * - `equipo`: las que están piden algo que no tenés (los discos incluidos,
 *   aunque la nota no los nombre).
 * - `nivel`: alguna está a tu alcance por equipo, pero más arriba de tu
 *   eslabón o con un requisito sin cumplir.
 *
 * La molestia es otro motivo, con su cadena, y lo pone `elegirSinLaMolestia`.
 */
type MotivoSinOpcion = 'falta-en-la-app' | 'equipo' | 'nivel'

interface ConCandidatas {
  eleccion: Eleccion
  candidatas: string[]
}

/** Si una opción con condición va, según lo que puso el bloque al que mira. */
function condicionCumplida(opcion: OpcionDelBloque, armado: Armado): boolean {
  const si = opcion.si
  if (!si) return true
  const paso = armado.porBloque.get(si.bloque)?.[0]
  const ejercicio = paso ? armado.catalogo.get(paso.ejercicioId) : undefined
  if (!ejercicio) return false
  const colgado = (ejercicio.equipo ?? []).includes('barra')
  switch (si.fue) {
    case 'colgado':
      return colgado
    case 'sin-colgarse':
      return !colgado
    case 'sosten':
      return ejercicio.medida === 'segundos'
    case 'repeticiones':
      return ejercicio.medida === 'repeticiones'
  }
}

/** Un candidato con dónde cae respecto de tu nivel. */
interface Candidato {
  ejercicio: Ejercicio
  opcion: OpcionDelBloque | undefined
  rango: 'dentro' | 'abajo' | 'arriba'
  /** Para ordenar: nivel equivalente en una variante, banda en un accesorio. */
  orden: number
  /** Entre los de abajo, más alto es más cerca. */
  cercania: number
}

function ubicar(
  bloque: BloqueDelMix,
  patron: Patron,
  ejercicio: Ejercicio,
  opcion: OpcionDelBloque | undefined,
  contexto: ContextoDelMix,
): Candidato {
  const n = nivelActual(patron, contexto) ?? 1
  if (bloque.clase === 'variante') {
    const nivel = opcion?.cualquierNivel ? n : nivelEnLaCadena(ejercicio, patron)
    const rango = nivel > n ? 'arriba' : nivel >= n - 2 ? 'dentro' : 'abajo'
    return { ejercicio, opcion, rango, orden: nivel, cercania: nivel }
  }
  const banda = bandaDelEslabon(patron, n)
  const bandas = opcion?.bandas
  const alto = bandas ? Math.max(...bandas) : banda
  const rango = !bandas || bandas.includes(banda) ? 'dentro' : alto < banda ? 'abajo' : 'arriba'
  return { ejercicio, opcion, rango, orden: nivelDe(ejercicio), cercania: alto }
}

const porOrden = (a: Candidato, b: Candidato) =>
  a.orden - b.orden || comparar(a.ejercicio.id, b.ejercicio.id)

/**
 * Lo que entra con este equipo: está en el catálogo, tu equipo lo alcanza,
 * cumplís sus requisitos (en los mixes filtran, §6.6) y no es un eslabón por
 * encima del tuyo.
 */
function sePuede(
  ejercicio: Ejercicio,
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
  armado: Armado,
): boolean {
  const { contexto } = armado
  return (
    alcanza(ejercicio, equipo) &&
    !masDificilQueTuEslabon(ejercicio, contexto) &&
    requisitoCumplido(ejercicio.id, contexto.avances, contexto.historial, contexto.requisitosDeHistorial)
  )
}

/**
 * El eslabón anterior de `patron`, la bajada de hoy, si existe y tu equipo lo
 * alcanza. Es lo último antes de saltear un bloque obligatorio.
 */
function bajadaDelPatron(
  patron: Patron,
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
  armado: Armado,
): { ejercicio: Ejercicio; objetivo: Objetivo } | null {
  const avance = armado.contexto.avances.get(patron)
  const actual = avance ? armado.catalogo.get(avance.ejercicioId) : undefined
  const cadena = CADENA_POR_PATRON.get(patron)
  if (!actual || !cadena) return null
  const abajo = bajadaDe(actual, cadena, armado.catalogo)
  return abajo && alcanza(abajo.ejercicio, equipo) ? abajo : null
}

/**
 * Elige entre candidatos, con la regla de §6.3 y la de la Decisión 44.
 *
 * Los ya usados en este mix no cuentan como candidatos, así el bloque pasa a
 * la opción siguiente en vez de repetir; si lo único que quedaba era uno
 * repetido, el bloque se saltea y la nota lo dice.
 *
 * La excepción es tu eslabón N de un patrón cuya cadena ya está en el mix:
 * sigue en la fila, en su lugar, porque §6.3 dice que si la elegida es tu
 * eslabón y el mix ya lee esa cadena, va N − 1. Sacarlo de la fila haría que,
 * con todo lo de abajo superado, quedara la última superada en vez de la
 * bajada. No figura entre las candidatas: ya está en el bloque de cadena.
 */
function elegirEntre(
  candidatos: readonly Candidato[],
  motivo: MotivoSinOpcion,
  bloque: BloqueDelMix,
  patron: Patron,
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
  armado: Armado,
): ConCandidatas {
  const yaLeido = (e: Ejercicio) => {
    const cadena = cadenaSiEsTuEslabon(e, armado.contexto)
    return cadena !== null && armado.conCadena.has(cadena)
  }
  const libres = candidatos.filter((c) => !armado.usados.has(c.ejercicio.id) || yaLeido(c.ejercicio))
  const dentro = libres.filter((c) => c.rango === 'dentro').sort(porOrden)
  const elegido = primeraNoSuperada(
    dentro.map((c) => c.ejercicio),
    armado,
  )
  if (elegido) {
    return {
      eleccion: { clase: 'opcion', ejercicio: elegido, opcion: dentro.find((c) => c.ejercicio === elegido)?.opcion },
      candidatas: dentro.filter((c) => !yaLeido(c.ejercicio)).map((c) => c.ejercicio.id),
    }
  }

  const repetido = candidatos.find((c) => c.rango !== 'arriba' && armado.usados.has(c.ejercicio.id))
  const sinNada = (): ConCandidatas => ({
    eleccion: repetido
      ? { clase: 'nada', motivo: 'repetido', ejercicio: repetido.ejercicio }
      : { clase: 'nada', motivo },
    candidatas: [],
  })
  if (bloque.opcional) return sinNada()

  // La más cercana por debajo, del mismo bloque: nunca una más difícil.
  const abajo = libres.filter((c) => c.rango === 'abajo')
  const cercania = Math.max(...abajo.map((c) => c.cercania))
  const cercanos = abajo.filter((c) => c.cercania === cercania).sort(porOrden)
  const deAbajo = primeraNoSuperada(
    cercanos.map((c) => c.ejercicio),
    armado,
  )
  if (deAbajo) {
    return {
      eleccion: { clase: 'opcion', ejercicio: deAbajo, opcion: cercanos.find((c) => c.ejercicio === deAbajo)?.opcion },
      candidatas: cercanos.map((c) => c.ejercicio.id),
    }
  }

  // El eslabón anterior: la bajada de hoy.
  const bajada = bajadaDelPatron(patron, equipo, armado)
  if (bajada && !armado.usados.has(bajada.ejercicio.id)) {
    return { eleccion: { clase: 'bajada', ...bajada }, candidatas: [] }
  }
  if (bajada) {
    return { eleccion: { clase: 'nada', motivo: 'repetido', ejercicio: bajada.ejercicio }, candidatas: [] }
  }
  return sinNada()
}

/**
 * La cadena marcada en Molestia que carga un ejercicio, o `null`.
 *
 * Es la regla de `fijoConMolestia` (`molestia.ts`) y no otra: la de su patrón
 * o, si no, la de su `equivale`. Con dos reglas, una candidata podría salir
 * del mix por la molestia y la sesión bajarla igual, o al revés.
 */
function cargaUnaMolestia(ejercicio: Ejercicio, contexto: ContextoDelMix): Patron | null {
  const molestias = contexto.molestias
  if (!molestias || molestias.size === 0) return null
  if (molestias.has(ejercicio.patron)) return ejercicio.patron
  const equivale = ejercicio.equivale
  return equivale && molestias.has(equivale.patron) ? equivale.patron : null
}

/**
 * `elegirEntre` sin las candidatas que cargan una cadena marcada en Molestia
 * (§6.3: "no cargan el patrón marcado en Molestia").
 *
 * Se descartan antes de elegir, así el bloque toma la siguiente que sirve y
 * OTRAS DEL BLOQUE no ofrece ninguna de esas. Elegirla y dejar que
 * `pasosConMolestia` la bajara después daba otro ejercicio y otra dosis que
 * los de §6.3. Si no queda ninguna, la regla es la de siempre: la más cercana
 * por debajo y después el eslabón anterior, que es volumen y que
 * `pasosConMolestia` saltea si es de la cadena con molestia.
 *
 * Si el bloque se queda sin nada y sin la molestia habría tenido algo, el
 * motivo es la molestia, con la cadena de la que habría ido: la nota no puede
 * decir "con tu nivel" cuando lo que vació la ventana fue otra cosa. Gana
 * también sobre "ya está en otro bloque": en Espalda con molestia en
 * tracción, el eslabón anterior suele ser la dominada que ya puso el bloque
 * de tracción, y decir eso escondería que mañana, sin la molestia, el bloque
 * vuelve.
 */
function elegirSinLaMolestia(
  candidatos: readonly Candidato[],
  motivo: MotivoSinOpcion,
  bloque: BloqueDelMix,
  patron: Patron,
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
  armado: Armado,
): ConCandidatas {
  const libres = candidatos.filter((c) => cargaUnaMolestia(c.ejercicio, armado.contexto) === null)
  const elegida = elegirEntre(libres, motivo, bloque, patron, equipo, armado)
  if (libres.length === candidatos.length || elegida.eleccion.clase !== 'nada') return elegida

  const sinLaMolestia = elegirEntre(candidatos, motivo, bloque, patron, equipo, armado).eleccion
  if (sinLaMolestia.clase !== 'opcion') return elegida
  const cadena = cargaUnaMolestia(sinLaMolestia.ejercicio, armado.contexto)
  return cadena === null ? elegida : { eleccion: { clase: 'nada', motivo: 'molestia', patron: cadena }, candidatas: [] }
}

function motivoSinOpcion(
  existentes: readonly Ejercicio[],
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
): MotivoSinOpcion {
  if (existentes.length === 0) return 'falta-en-la-app'
  return existentes.some((e) => alcanza(e, equipo)) ? 'nivel' : 'equipo'
}

/** Variante o accesorio: sus opciones, con las condiciones que tengan. */
function elegirOpcion(
  bloque: BloqueDelMix,
  patron: Patron,
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
  armado: Armado,
): ConCandidatas {
  const existentes = bloque.opciones
    .filter((o) => condicionCumplida(o, armado))
    .flatMap((o) => {
      const ejercicio = armado.catalogo.get(o.id)
      return ejercicio ? [{ opcion: o, ejercicio }] : []
    })
  const candidatos = existentes
    .filter(({ ejercicio }) => sePuede(ejercicio, equipo, armado))
    .map(({ opcion, ejercicio }) => ubicar(bloque, patron, ejercicio, opcion, armado.contexto))
  const motivo = motivoSinOpcion(
    existentes.map((x) => x.ejercicio),
    equipo,
  )
  return elegirSinLaMolestia(candidatos, motivo, bloque, patron, equipo, armado)
}

/**
 * "Lo que la semana dejó atrás" (Cuerpo completo): el músculo que da
 * `loQueFalta` con plan, o `loQueFaltaSinPlan` sin él. Si la semana está
 * pareja, o todavía no hay con qué decirlo, no se agrega nada.
 *
 * Los candidatos son todo lo que tiene a ese músculo como principal (aporte
 * 1) sin pasar de tu nivel: un eslabón por debajo del tuyo, una variante que
 * no pasa de tu eslabón, un accesorio, uno de discos. Tu eslabón no, porque
 * es un accesorio: el que lee la cadena es su bloque. Se eligen como un
 * accesorio, por la banda de nivel del patrón de ese músculo y sin lo que
 * carga una cadena con molestia; sin ninguno, va el eslabón anterior de ese
 * patrón, como en cualquier bloque obligatorio.
 */
function elegirDeLaSemana(
  bloque: BloqueDelMix,
  falta: { musculo: Musculo; patron: Patron },
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
  armado: Armado,
): ConCandidatas {
  const { contexto } = armado
  const banda = bandaDelEslabon(falta.patron, nivelActual(falta.patron, contexto) ?? 1)
  const existentes = [...armado.catalogo.values()].filter((e) => APORTE[e.id]?.[falta.musculo] === 1)
  const candidatos = existentes
    .filter((e) => sePuede(e, equipo, armado) && cadenaSiEsTuEslabon(e, contexto) === null)
    .filter((e) => !e.equivale || e.equivale.nivel <= (nivelActual(e.equivale.patron, contexto) ?? 1))
    .map((e): Candidato => {
      const suya = nivelDe(e)
      const rango = suya === banda ? 'dentro' : suya < banda ? 'abajo' : 'arriba'
      const patron = ESLABON.get(e.id)?.patron ?? e.equivale?.patron ?? e.patron
      return { ejercicio: e, opcion: undefined, rango, orden: nivelEnLaCadena(e, patron), cercania: suya }
    })
  return elegirSinLaMolestia(candidatos, motivoSinOpcion(existentes, equipo), bloque, falta.patron, equipo, armado)
}

/** El músculo y el patrón que dice la semana, o null si no hay nada que agregar. */
function loQueDejoLaSemana(armado: Armado): { musculo: Musculo; patron: Patron } | null {
  const { contexto } = armado
  const historial = [...contexto.historial]
  const falta: LoQueFalta = contexto.plan
    ? loQueFalta({
        sesiones: historial,
        hoy: contexto.hoy,
        rutina: contexto.plan,
        tieneBarra: tiene(contexto.equipo, 'barra'),
        tieneBarraCargable: tiene(contexto.equipo, 'discos'),
      })
    : loQueFaltaSinPlan(historial, contexto.equipo, contexto.hoy)
  if (falta.clase === 'flojo') return { musculo: falta.musculo, patron: falta.patron }
  if (falta.clase === 'patron-ausente') {
    const musculo = falta.musculos[0]
    return musculo ? { musculo, patron: falta.patron } : null
  }
  return null
}

/** El equipo de la persona más todo lo que abre opciones. */
function conTodoElEquipo(equipo: readonly Equipo[] | ReadonlySet<Equipo>): Set<Equipo> {
  return new Set<Equipo>([...equipo, ...EQUIPO_QUE_ABRE])
}

/**
 * Convierte una elección en el paso del bloque.
 *
 * Una opción que resulta ser tu eslabón N sigue la regla de §6.3: si el mix ya
 * tiene la cadena de ese patrón, va N − 1; si no, el bloque pasa a ser de
 * cadena y lee. Así "Brazos mueve el empuje si la diamante es tu eslabón" sale
 * de la regla y no de un caso escrito a mano.
 */
function pasoDeLaEleccion(
  bloque: BloqueDelMix,
  eleccion: Eleccion,
  armado: Armado,
): { paso: PasoDelMix } | { nada: Extract<Eleccion, { clase: 'nada' }> } {
  if (eleccion.clase === 'nada') return { nada: eleccion }
  if (eleccion.clase === 'bajada') return { paso: pasoDeVolumen(bloque, eleccion, armado) }

  const { ejercicio, opcion } = eleccion
  const cadena = cadenaSiEsTuEslabon(ejercicio, armado.contexto)
  if (cadena === null) return { paso: pasoFijo(bloque, ejercicio, seriesDe(bloque, opcion, armado), armado) }

  if (!armado.conCadena.has(cadena)) {
    const avance = armado.contexto.avances.get(cadena)!
    armado.conCadena.add(cadena)
    return { paso: pasoDeCadena(bloque, ejercicio, avance, armado) }
  }
  const abajo = bajadaDelPatron(cadena, armado.contexto.equipo, armado)
  if (!abajo) return { nada: { clase: 'nada', motivo: 'nivel' } }
  if (armado.usados.has(abajo.ejercicio.id)) {
    return { nada: { clase: 'nada', motivo: 'repetido', ejercicio: abajo.ejercicio } }
  }
  return { paso: pasoDeVolumen(bloque, abajo, armado) }
}

/** El id del ejercicio que eligió, si eligió uno. */
const idElegido = (e: Eleccion): string | null => (e.clase === 'nada' ? null : e.ejercicio.id)

/**
 * Un bloque de variante, accesorio o semana, con su nota.
 *
 * La nota de equipo sale de comparar dos elecciones: con tu equipo y con todo
 * lo que abre opciones. Si cambian, la diferencia es el equipo, y la nota
 * nombra solo lo que pide la que habría ido. Así "Sin banda…" es verdad
 * siempre, y no se dice si con banda iría lo mismo.
 */
function resolverElegible(
  bloque: BloqueDelMix,
  patron: Patron,
  armado: Armado,
): { pasos: PasoDelMix[]; nota: string | null; candidatas: string[] } {
  const { contexto } = armado
  let elegir: (equipo: readonly Equipo[] | ReadonlySet<Equipo>) => ConCandidatas
  if (bloque.clase === 'semana') {
    const falta = loQueDejoLaSemana(armado)
    if (!falta) return { pasos: [], nota: null, candidatas: [] }
    elegir = (equipo) => elegirDeLaSemana(bloque, falta, equipo, armado)
  } else {
    elegir = (equipo) => elegirOpcion(bloque, patron, equipo, armado)
  }

  const mia = elegir(contexto.equipo)
  const conTodo = elegir(conTodoElEquipo(contexto.equipo))
  const resultado = pasoDeLaEleccion(bloque, mia.eleccion, armado)

  const otra = idElegido(conTodo.eleccion)
  const faltan =
    otra !== null && otra !== idElegido(mia.eleccion) && conTodo.eleccion.clase !== 'nada'
      ? loQueFaltaDe(conTodo.eleccion.ejercicio, contexto.equipo)
      : []

  if ('paso' in resultado) {
    const ejercicio = armado.catalogo.get(resultado.paso.ejercicioId)!
    const nota = faltan.length > 0 ? notaDeEquipo(bloque.nota, faltan, ejercicio) : null
    return { pasos: [resultado.paso], nota, candidatas: mia.candidatas }
  }
  // La molestia va primero: sin ella habría ido algo con tu equipo, así que
  // "Con tu equipo no hay opción" escondería la razón de hoy.
  const nada = resultado.nada
  const nota =
    nada.motivo === 'molestia'
      ? notaDeMolestia(bloque.nota, nada.patron)
      : faltan.length > 0 || nada.motivo === 'equipo'
        ? notaSinEquipo(bloque.nota)
        : nada.motivo === 'repetido'
          ? notaRepetido(bloque.nota, nada.ejercicio)
          : nada.motivo === 'falta-en-la-app'
            ? notaSinOpciones(bloque.nota)
            : notaSinNivel(bloque.nota)
  return { pasos: [], nota, candidatas: [] }
}

/**
 * Un bloque de cadena: tu eslabón con el objetivo del motor.
 *
 * Si tu equipo ya no lo alcanza (cambiaste el perfil y el avance quedó en una
 * dominada), va el eslabón más alto de abajo que sí, como fijo y con su nota:
 * es "va la opción de casa" de §6.5, y como fijo no lee una cadena con un
 * ejercicio que no es el del avance. Sin avance no hay nada que proponer, y
 * la pantalla espera a que lleguen los avances.
 */
function resolverCadena(
  bloque: BloqueDelMix,
  patron: Patron,
  armado: Armado,
): { pasos: PasoDelMix[]; nota: string | null } {
  const { contexto } = armado
  const nota = NOTA_DE_CADENA[patron]
  const avance = contexto.avances.get(patron)
  const actual = avance ? armado.catalogo.get(avance.ejercicioId) : undefined
  if (!avance || !actual) return { pasos: [], nota: null }

  if (alcanza(actual, contexto.equipo) && !armado.usados.has(actual.id)) {
    armado.conCadena.add(patron)
    return { pasos: [pasoDeCadena(bloque, actual, avance, armado)], nota: null }
  }
  if (armado.usados.has(actual.id)) return { pasos: [], nota: notaRepetido(nota, actual) }

  const cadena = CADENA_POR_PATRON.get(patron)?.ejercicios ?? []
  const lugar = cadena.indexOf(actual.id)
  for (let i = lugar - 1; i >= 0; i--) {
    const abajo = armado.catalogo.get(cadena[i]!)
    if (!abajo || !alcanza(abajo, contexto.equipo) || armado.usados.has(abajo.id)) continue
    const series = armado.version === 'liviana' ? 2 : avance.objetivoActual.series
    return {
      pasos: [pasoFijo(bloque, abajo, series, armado)],
      nota: notaDeEquipo(nota, loQueFaltaDe(actual, contexto.equipo), abajo),
    }
  }
  return { pasos: [], nota: notaSinEquipo(nota) }
}

/**
 * Cuerpo completo: piernas o bisagra, la que hace más que no se hace. En un
 * empate (las dos nunca, o el mismo instante), la del bloque, que es piernas.
 * Es la alternancia de las rutinas de hoy contada con el historial, porque un
 * mix no tiene semana contra la cual contar.
 */
function patronQueToca(bloque: BloqueDelMix, armado: Armado): Patron {
  const otro = bloque.alterna
  if (!otro) return bloque.patron
  const ultimaVez = (patron: Patron) => {
    for (const sesion of armado.recientes) {
      const hizo = sesion.registros.some((r) => {
        if (r.calentamiento) return false
        const e = armado.catalogo.get(r.ejercicioId)
        return (e?.equivale?.patron ?? e?.patron) === patron
      })
      if (hizo) return sesion.finalizadaEn
    }
    return -Infinity
  }
  return ultimaVez(otro) < ultimaVez(bloque.patron) ? otro : bloque.patron
}

/** El eslabón anterior de un ejercicio en su cadena, o null en el primero. */
function eslabonAnterior(ejercicioId: string, armado: Armado): Ejercicio | null {
  const lugar = ESLABON.get(ejercicioId)
  if (!lugar || lugar.posicion < 2) return null
  const id = CADENA_POR_PATRON.get(lugar.patron)?.ejercicios[lugar.posicion - 2]
  return id ? (armado.catalogo.get(id) ?? null) : null
}

/**
 * La entrada (§6.3): movilidad sin las de `despues`, los ejercicios fijos de
 * la tabla y, donde va, una serie fácil del eslabón anterior al del primer
 * bloque de cadena, marcada `calentamiento` para que no sume ni lea.
 *
 * Lo que la tabla nombra y todavía no está en la app, o lo que tu equipo no
 * alcanza, no entra y no deja nota: la entrada no es un bloque que se pueda
 * saltear, es una lista que la pantalla muestra entera ("ENTRADA · 3 MIN ·
 * MUÑECAS Y PASAJE DE HOMBROS").
 */
function armarEntrada(mix: Mix, primerPasoDeCadena: PasoDelMix | undefined, armado: Armado): PasoDelMix[] {
  const { equipo } = armado.contexto
  const pasos: PasoDelMix[] = []
  for (const id of mix.entrada.movilidad) {
    const ficha = MOVILIDAD_POR_ID.get(id)
    if (!ficha || ficha.despues || !alcanza(ficha, equipo)) continue
    pasos.push({
      id: `entrada-${id}`,
      ejercicioId: id,
      objetivo: { series: ficha.dosis.series, cantidad: ficha.dosis.cantidad },
      clase: 'movilidad',
      seccion: 'entrada',
    })
  }
  const deFuerza = (item: ItemDeEntrada): PasoDelMix | null => {
    const ejercicio = armado.catalogo.get(item.id)
    if (!ejercicio || !alcanza(ejercicio, equipo)) return null
    return {
      id: `entrada-${item.id}`,
      ejercicioId: item.id,
      objetivo: { series: item.series, cantidad: item.cantidad },
      clase: 'fijo',
      seccion: 'entrada',
      fijo: true,
      calentamiento: true,
    }
  }
  for (const item of mix.entrada.fuerza) {
    const paso = deFuerza(item)
    if (paso) pasos.push(paso)
  }
  for (const item of mix.entrada.unaDe ?? []) {
    const paso = deFuerza(item)
    if (!paso) continue
    pasos.push(paso)
    break
  }
  if (mix.entrada.serieFacil && primerPasoDeCadena) {
    const anterior = eslabonAnterior(primerPasoDeCadena.ejercicioId, armado)
    if (anterior && alcanza(anterior, equipo)) {
      pasos.push({
        id: 'entrada-serie-facil',
        ejercicioId: anterior.id,
        objetivo: { series: 1, cantidad: anterior.ventana.min },
        clase: 'fijo',
        seccion: 'entrada',
        fijo: true,
        calentamiento: true,
      })
    }
  }
  return pasos
}

/** Si un bloque va en esta versión y con este nivel. */
function vaElBloque(bloque: BloqueDelMix, armado: Armado): boolean {
  if (bloque.opcional && armado.version === 'corta') return false
  const desde = bloque.desde
  if (!desde) return true
  const n = nivelActual(bloque.patron, armado.contexto)
  if (n === null) return false
  if (desde.nivel !== undefined && n < desde.nivel) return false
  if (desde.banda !== undefined && bandaDelEslabon(bloque.patron, n) < desde.banda) return false
  return true
}

/** Un mix que no existe: nada que hacer, y nada que prometer. Nuevo cada vez, para que nadie comparta arreglos. */
const vacio = (): MixResuelto => ({ pasos: [], notas: [], minutos: 0, series: 0, mueve: [], cierre: false, bloques: [] })

/**
 * El mix de una zona, armado para esta persona hoy (§6.3 y §5.6 F).
 *
 * - **Completo:** todos los bloques, también el Cierre donde la tabla lo
 *   tiene, que prende la serie de cierre.
 * - **Corto:** sin los opcionales; 2 series en variantes y accesorios; la
 *   cadena con la dosis del motor, que lee.
 * - **Liviano:** 2 series en todo con la cantidad más baja entre la de hoy y
 *   lo bajo de la ventana; no lee nada (`mueve` vacío). Los opcionales van,
 *   porque Liviano baja la dosis de "todos los bloques" y no saca ninguno.
 *
 * Las tres llevan la entrada, salvo que el interruptor la apague.
 */
export function resolverMix(
  sector: Sector,
  version: VersionDeMix,
  contexto: ContextoDelMix,
): MixResuelto {
  // `hasOwn` y no un índice pelado: el sector puede llegar de una URL.
  const mix = Object.hasOwn(MIX_POR_SECTOR, sector) ? MIX_POR_SECTOR[sector] : undefined
  if (!mix) return vacio()

  const catalogo = new Map((contexto.catalogo ?? EJERCICIOS).map((e) => [e.id, e]))
  const armado: Armado = {
    contexto,
    version,
    catalogo,
    recientes: [...contexto.historial].sort((a, b) => b.finalizadaEn - a.finalizadaEn),
    usados: new Set(),
    conCadena: new Set(),
    porBloque: new Map(),
  }

  const trabajo: BloqueResueltoDelMix[] = []
  let primerPasoDeCadena: PasoDelMix | undefined
  for (const bloque of mix.bloques) {
    if (!vaElBloque(bloque, armado)) continue
    if (bloque.clase === 'entrada') continue
    if (bloque.clase === 'cierre') {
      if (version !== 'completa') continue
      trabajo.push({ id: bloque.id, nombre: bloque.nombre, clase: 'cierre', opcional: true, pasos: [], nota: null, candidatas: [] })
      continue
    }

    const patron = patronQueToca(bloque, armado)
    const resuelto =
      bloque.clase === 'cadena'
        ? { ...resolverCadena(bloque, patron, armado), candidatas: [] }
        : resolverElegible(bloque, patron, armado)

    for (const paso of resuelto.pasos) armado.usados.add(paso.ejercicioId)
    armado.porBloque.set(bloque.id, resuelto.pasos)
    if (bloque.clase === 'cadena' && !primerPasoDeCadena) primerPasoDeCadena = resuelto.pasos[0]

    trabajo.push({
      id: bloque.id,
      nombre: bloque.clase === 'cadena' ? NOMBRE_DE_CADENA[patron] : bloque.nombre,
      clase: bloque.clase,
      opcional: bloque.opcional === true,
      pasos: resuelto.pasos,
      nota: resuelto.nota,
      candidatas: resuelto.candidatas,
    })
  }

  const entrada = contexto.entrada === false ? [] : armarEntrada(mix, primerPasoDeCadena, armado)
  const bloques: BloqueResueltoDelMix[] = [
    { id: 'entrada', nombre: 'Entrada', clase: 'entrada', opcional: false, pasos: entrada, nota: null, candidatas: [] },
    ...trabajo,
  ]
  const pasos = bloques.flatMap((b) => b.pasos)

  const deFuerza = pasos.filter((p) => p.clase !== 'movilidad')
  const minutos =
    pasos.length === 0
      ? 0
      : minutosDeSesion(
          deFuerza.map((p) => ({
            ejercicio: catalogo.get(p.ejercicioId)!,
            objetivo: p.objetivo,
            ...(p.descansoSegundos !== undefined ? { descansoSegundos: p.descansoSegundos } : {}),
          })),
        )
  const series = deFuerza.filter((p) => !p.calentamiento).reduce((suma, p) => suma + p.objetivo.series, 0)

  const mueve: Patron[] = []
  if (version !== 'liviana') {
    for (const paso of pasos) {
      if (paso.clase !== 'cadena') continue
      const patron = ESLABON.get(paso.ejercicioId)?.patron
      if (!patron || mueve.includes(patron)) continue
      if (yaLeidaHoy(patron, contexto.hoy, contexto.historial) !== null) continue
      mueve.push(patron)
    }
  }

  return {
    pasos,
    notas: bloques.flatMap((b) => (b.nota ? [b.nota] : [])),
    minutos,
    series,
    mueve,
    cierre: bloques.some((b) => b.clase === 'cierre'),
    bloques,
  }
}

// ─── Si un mix tiene algo que hacer ─────────────────────────────────────

/**
 * Si unos pasos tienen trabajo: alguno que no sea movilidad ni entrada en
 * calor. La entrada sola no es una sesión: es la preparación de algo que no
 * viene.
 */
export function tieneTrabajo(pasos: readonly PasoDelBorrador[]): boolean {
  return pasos.some((p) => p.clase !== 'movilidad' && !p.calentamiento)
}

/**
 * Si el mix de cada sector, armado para esta persona hoy, tiene trabajo: lo
 * que reciben `sugerirZona` y `sugerenciasDeHoy` para no sugerir nunca un mix
 * vacío.
 *
 * `mixArmable` mira solo el equipo, y no alcanza: con la biblioteca de hoy,
 * en el eslabón 1 de empuje y de tracción y sin discos, el mix de Hombros y
 * el de Brazos son la entrada sola. Lo que hay para sus bloques es más
 * difícil que tu eslabón o todavía no está en la app, y antes del eslabón 1
 * no hay bajada. Esto se le pregunta a `resolverMix`, que es quien arma lo
 * que se empezaría, y no a una copia de sus reglas.
 *
 * Con molestia, cuenta lo que queda después de `pasosConMolestia` con la
 * regla por defecto, que es lo que corre si nadie toca nada: un mix cuyo
 * único trabajo es un paso de la cadena con molestia en su primer eslabón
 * también empezaría vacío. Sin `version`, Completo, que es lo que empiezan
 * PARA HOY, OTRA ZONA y el panel del mapa.
 *
 * Cada sector se arma una sola vez por versión: `sugerirZona` pregunta por
 * los siete y `sugerenciasDeHoy` la llama dos veces con el mismo contexto.
 */
export function mixesConTrabajo(contexto: ContextoDelMix): MixConTrabajo {
  const ya = new Map<string, boolean>()
  return (sector, version = 'completa') => {
    const clave = `${sector}·${version}`
    const sabido = ya.get(clave)
    if (sabido !== undefined) return sabido
    const { pasos } = resolverMix(sector, version, contexto)
    const quedan = contexto.molestias?.size ? pasosConMolestia(pasos, contexto.molestias).pasos : pasos
    const hay = tieneTrabajo(quedan)
    ya.set(clave, hay)
    return hay
  }
}
