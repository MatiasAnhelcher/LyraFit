/**
 * El catálogo: todo lo que se puede hacer, para buscarlo, filtrarlo y
 * agruparlo.
 *
 * Hasta acá la app tenía una sola manera de mirar los ejercicios: las cinco
 * escaleras de la Cadenas, en orden. Alcanzaba con 47 eslabones. Con las
 * variantes, los accesorios y la movilidad, la misma lista tiene que poder
 * leerse por músculo (desde un Sector o desde el selector del Constructor),
 * por equipo y por nivel, con un buscador que no pida tildes. Ninguna de esas
 * decisiones es de una pantalla: si Ejercicios, el selector y la hoja Cambiar
 * agruparan cada una a su manera, el mismo ejercicio diría "Nivel II" en una y
 * "Nivel I" en otra. Así que viven acá, como funciones puras.
 *
 * ## Dos colecciones, un catálogo
 *
 * La fuerza (`EJERCICIOS`) y la movilidad (`MOVILIDAD`) siguen separadas en el
 * dominio, por las razones de `movilidad.ts`: una ficha de movilidad no tiene
 * ventana, ni `ccr`, ni cadena, y meterla en `EJERCICIOS` le inventaría esos
 * números al motor. Para la persona, en cambio, son la misma lista: "109
 * ejercicios · 97 de fuerza y 12 de movilidad". `ITEMS` es esa lista, con cada
 * ficha envuelta en su clase, y la cifra que dice cada pantalla sale de
 * contarla (§6.1 de la reestructura).
 *
 * ## Lo que no decide
 *
 * Qué propone un mix (`mixes.ts`) ni qué entra en una rutina
 * (`rutinasPropias.ts`). Esos archivos le preguntan a este el nivel de un
 * ejercicio, sus vecinos y si su requisito está cumplido, y deciden con eso.
 */

import * as biblioteca from './biblioteca'
import {
  CADENAS,
  EJERCICIOS,
  FUERA_DE_CADENA,
  NOMBRE_PATRON,
  REQUISITOS,
  cadenaDe,
  type Requisito,
} from './biblioteca'
import { EQUIPOS, alcanza } from './equipo'
import { MOVILIDAD, type FichaMovilidad } from './movilidad'
import { APORTE, MUSCULOS_CUBIERTOS, NOMBRE_MUSCULO, type Musculo, type Vector } from './musculos'
import { PRINCIPALES, SECTORES, SECUNDARIOS, ZONAS, type Zona } from './sectores'
import type { Avance, Ejercicio, Equipo, Patron, RutinaPropia, Sector, Sesion } from './tipos'

// ─── Los ítems ──────────────────────────────────────────────────────────

/** Lo que tienen todos los ítems, sean de fuerza o de movilidad. */
interface ItemComun {
  /** El id de la ficha. Los de fuerza y los de movilidad no se pisan nunca. */
  id: string
  nombre: string
  /** Otros nombres con los que se lo busca ("pike"). Vacío si no tiene. */
  alias: readonly string[]
  /**
   * Lo que pide, todo junto (ver `alcanza`). Lista y no conjunto porque así
   * la guarda la ficha, y en el orden de la ficha.
   */
  equipo: Equipo[]
}

/**
 * Una fila posible del catálogo.
 *
 * Unión discriminada y no un tipo con campos opcionales: quien dibuja una fila
 * necesita saber si tiene una ventana que mostrar o una dosis, y con `clase`
 * el compilador no deja leer la ventana de una ficha de movilidad.
 */
export type ItemDelCatalogo =
  | (ItemComun & { clase: 'fuerza'; ejercicio: Ejercicio })
  | (ItemComun & { clase: 'movilidad'; ficha: FichaMovilidad })

type ItemDeFuerza = Extract<ItemDelCatalogo, { clase: 'fuerza' }>

export function itemDeEjercicio(ejercicio: Ejercicio): ItemDelCatalogo {
  return {
    clase: 'fuerza',
    id: ejercicio.id,
    nombre: ejercicio.nombre,
    alias: ejercicio.alias ?? [],
    equipo: ejercicio.equipo ?? [],
    ejercicio,
  }
}

export function itemDeMovilidad(ficha: FichaMovilidad): ItemDelCatalogo {
  return {
    clase: 'movilidad',
    id: ficha.id,
    nombre: ficha.nombre,
    alias: [],
    equipo: ficha.equipo,
    ficha,
  }
}

/**
 * Todo el catálogo: la fuerza en el orden de la biblioteca y, después, la
 * movilidad en el de `catalogo.md`.
 *
 * El orden importa: es el que conservan la búsqueda y los filtros, y dentro de
 * cada grupo de `agruparCatalogo` (salvo las escaleras, que van en el orden de
 * su cadena). La biblioteca ya está escrita de más accesible a más exigente en
 * cada patrón, así que la lista se lee bien sin reordenar nada.
 */
export const ITEMS: readonly ItemDelCatalogo[] = [
  ...EJERCICIOS.map(itemDeEjercicio),
  ...MOVILIDAD.map(itemDeMovilidad),
]

export const ITEM_POR_ID: ReadonlyMap<string, ItemDelCatalogo> = new Map(
  ITEMS.map((i) => [i.id, i]),
)

/** Un ítem por id: la Ficha de `/biblioteca/:id` abre los dos tipos. */
export function buscarItem(id: string): ItemDelCatalogo | undefined {
  return ITEM_POR_ID.get(id)
}

/**
 * La cifra del catálogo como se dice: "109 ejercicios · 97 de fuerza y 12 de
 * movilidad", o "6 ejercicios" cuando todo es de una sola clase. `null` sin
 * ítems: cada pantalla dice su propio vacío ("Ningún ejercicio con esos
 * filtros.", "Ningún ejercicio con «remoo»"), porque el porqué del vacío es
 * distinto en cada una.
 *
 * El desglose aparece solo cuando las dos partes tienen algo. "6 ejercicios ·
 * 6 de fuerza y 0 de movilidad" sería cierto, pero nombra lo que no hay.
 */
export function cifraDelCatalogo(items: readonly ItemDelCatalogo[]): string | null {
  const total = items.length
  if (total === 0) return null
  const fuerza = items.filter((i) => i.clase === 'fuerza').length
  const movilidad = total - fuerza
  const cuantos = total === 1 ? '1 ejercicio' : `${total} ejercicios`
  if (fuerza === 0 || movilidad === 0) return cuantos
  return `${cuantos} · ${fuerza} de fuerza y ${movilidad} de movilidad`
}

// ─── La búsqueda ────────────────────────────────────────────────────────

/**
 * Un texto como se compara al buscar: en minúsculas, sin tildes ni diéresis,
 * con la eñe como ene y los espacios de más colapsados.
 *
 * NFD separa cada letra de su marca ("ó" pasa a "o" más el acento suelto) y
 * después se borran las marcas. Así "Flexión", "flexion" y "FLEXIÓN" son lo
 * mismo, y también un texto que llegó ya descompuesto (pasa con lo que se
 * pega desde otra app). Que la eñe se vuelva ene es a propósito: en el
 * teclado de un teléfono la eñe está escondida, y "munecas" tiene que
 * encontrar "Muñecas en cuatro patas".
 */
export function textoBuscable(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lo que se puede buscar: un ítem del catálogo, y también una rutina propia. */
export interface Buscable {
  nombre: string
  alias?: readonly string[]
}

/**
 * Lo que coincide con lo escrito, en el orden en que venía.
 *
 * Cada palabra de la búsqueda tiene que aparecer en el nombre o en un alias,
 * en cualquier orden: "remo bajo" encuentra "Remo australiano bajo", y "pike
 * elevada" encuentra una pica elevada que tenga "pike" de alias. Por palabras
 * y no por frase entera porque así se busca escribiendo en un teléfono, de a
 * pedazos.
 *
 * Una búsqueda vacía (o solo espacios) no filtra: devuelve todo, como la lista
 * antes de escribir.
 *
 * Es genérica porque el buscador de Entrenar busca también "tus rutinas", y
 * una rutina tiene que coincidir con la misma regla que un ejercicio.
 */
export function buscar<T extends Buscable>(q: string, items: readonly T[]): T[] {
  const palabras = textoBuscable(q).split(' ').filter((p) => p.length > 0)
  if (palabras.length === 0) return [...items]
  return items.filter((item) => {
    const texto = textoBuscable([item.nombre, ...(item.alias ?? [])].join(' '))
    return palabras.every((p) => texto.includes(p))
  })
}

// ─── El nivel ───────────────────────────────────────────────────────────

/** La banda de nivel: I inicial, II intermedio, III avanzado. */
export type BandaDeNivel = 1 | 2 | 3

export const NOMBRE_BANDA: Record<BandaDeNivel, string> = { 1: 'I', 2: 'II', 3: 'III' }

/**
 * Hasta qué eslabón llega cada banda en cada cadena: `I` es el último eslabón
 * de la banda I y `II` el último de la II; lo que sigue es III.
 *
 * Es la tabla de `catalogo.md` §3, del rol de calistenia, y va escrita y no
 * como una cuenta porque no reparte cada cadena en tercios: en empuje la II
 * empieza en la flexión de rodillas, la primera con las manos en el piso, y
 * en tracción en la dominada negativa, la primera en la barra fija.
 */
export const BANDAS: Record<Patron, { I: number; II: number }> = {
  empuje: { I: 4, II: 7 },
  traccion: { I: 4, II: 7 },
  piernas: { I: 3, II: 6 },
  core: { I: 3, II: 6 },
  bisagra: { I: 3, II: 5 },
}

/** La banda de un lugar en una cadena (el eslabón 1 es el primero). */
export function bandaDelEslabon(patron: Patron, nivel: number): BandaDeNivel {
  const banda = BANDAS[patron]
  if (nivel <= banda.I) return 1
  if (nivel <= banda.II) return 2
  return 3
}

/** Dónde está cada eslabón: su cadena y su lugar en ella, empezando en 1. */
const ESLABONES: ReadonlyMap<string, { patron: Patron; posicion: number }> = new Map(
  CADENAS.flatMap((c) =>
    c.ejercicios.map((id, i) => [id, { patron: c.patron, posicion: i + 1 }] as const),
  ),
)

/**
 * El nivel que se muestra de un ejercicio: "Nivel II".
 *
 * - **El `grado`, si lo tiene.** Lo llevan los que no son eslabón ni variante
 *   (los accesorios y los seis de discos), y lo escribió el rol de calistenia
 *   ficha por ficha.
 * - **Una variante**, la banda de su eslabón equivalente: "≈ empuje 6" es
 *   nivel II porque el eslabón 6 de empuje lo es. Es lo que pide §5.2: una
 *   variante no lleva `grado`, y su nivel sale de su `equivale`.
 * - **Un eslabón**, la banda por su lugar en la cadena.
 * - **Cualquier otro**, I. Hoy son los seis de discos, que reciben su `grado`
 *   1 en la ola 1; un accesorio sin `grado` caería acá también. Es lo más
 *   bajo por la misma razón que §5.2 toma lo más bajo de cada rango: si sale
 *   fácil, la progresión lo sube; si sale difícil, no hubo daño.
 *
 * No usa `Ejercicio.nivel`: en lo que no es eslabón ese número es un relleno
 * obligatorio por el tipo (el `equivale.nivel` o 1), y en un eslabón dice el
 * lugar en la cadena, no la banda.
 */
export function nivelDe(ejercicio: Pick<Ejercicio, 'id' | 'grado' | 'equivale'>): BandaDeNivel {
  if (ejercicio.grado !== undefined) return ejercicio.grado
  const eslabon = ESLABONES.get(ejercicio.id)
  if (eslabon) return bandaDelEslabon(eslabon.patron, eslabon.posicion)
  const equivale = ejercicio.equivale
  if (equivale) return bandaDelEslabon(equivale.patron, equivale.nivel)
  return 1
}

// ─── Qué es cada ejercicio ──────────────────────────────────────────────

/**
 * El lugar de un ejercicio de fuerza respecto de las cadenas.
 *
 * - `eslabon`: está en `CADENAS`, y es lo único que el motor puede mover.
 * - `variante`: tiene `equivale`; se elige como si fuera ese eslabón.
 * - `con-la-barra`: los de `FUERA_DE_CADENA` (barra con discos), que
 *   progresan por peso.
 * - `accesorio`: marcado `accesorio`; suma trabajo y no se compara con nada.
 * - `sin-cadena`: ninguna de las anteriores. Con los datos de la biblioteca
 *   no pasa, y si pasara (un ejercicio nuevo al que se le olvidó la marca),
 *   va a un grupo que dice la verdad sobre él en vez de esconderse.
 */
export type ClaseDeEjercicio = 'eslabon' | 'variante' | 'con-la-barra' | 'accesorio' | 'sin-cadena'

export function claseDeEjercicio(
  ejercicio: Pick<Ejercicio, 'id' | 'equivale' | 'accesorio'>,
): ClaseDeEjercicio {
  if (ESLABONES.has(ejercicio.id)) return 'eslabon'
  if (ejercicio.equivale) return 'variante'
  if (FUERA_DE_CADENA.has(ejercicio.id)) return 'con-la-barra'
  if (ejercicio.accesorio) return 'accesorio'
  return 'sin-cadena'
}

/**
 * La cadena a la que pertenece un ítem para el filtro y el agrupado por
 * Cadena, o `null` si no pertenece a ninguna.
 *
 * Un eslabón, a la suya; una variante, a la de su `equivale`; un accesorio, a
 * la de su patrón (va en "También de empuje", §4.7). Los de discos no: son
 * `FUERA_DE_CADENA` por definición, tienen su sección CON LA BARRA y no son
 * eslabón de nada. La movilidad tampoco.
 */
function cadenaDelItem(item: ItemDelCatalogo): Patron | null {
  if (item.clase === 'movilidad') return null
  const ejercicio = item.ejercicio
  switch (claseDeEjercicio(ejercicio)) {
    case 'eslabon':
      return ESLABONES.get(ejercicio.id)?.patron ?? null
    case 'variante':
      return ejercicio.equivale?.patron ?? null
    case 'accesorio':
      return ejercicio.patron
    case 'con-la-barra':
    case 'sin-cadena':
      return null
  }
}

/** Los músculos que un ejercicio tiene como principales: los de aporte 1. */
function principalesDe(
  ejercicioId: string,
  aporte: Readonly<Record<string, Vector>> = APORTE,
): Musculo[] {
  const vector = aporte[ejercicioId]
  if (!vector) return []
  return (Object.keys(vector) as Musculo[]).filter((m) => vector[m] === 1)
}

/**
 * Las zonas de un ítem, para el filtro GRUPO.
 *
 * Un ejercicio de fuerza es de una zona si alguno de sus principales es
 * principal o secundario de ella: la misma regla de `ejerciciosDeZona`, así
 * "GRUPO / Pecho" en Ejercicios muestra lo mismo que EJERCICIOS DE PECHO en el
 * Sector (`catalogo.test.ts` lo compara zona por zona). Con los secundarios
 * adentro, un ejercicio de gemelos o de agarre tiene zona aunque su músculo
 * no sea principal de ninguna.
 *
 * Una ficha de movilidad es de las zonas de su `cuando`, que existe para eso
 * (`movilidad.ts`).
 */
function zonasDelItem(item: ItemDelCatalogo): Zona[] {
  if (item.clase === 'movilidad') {
    return ZONAS.filter((z) => item.ficha.cuando.includes(z))
  }
  const suyos = principalesDe(item.id)
  return ZONAS.filter((z) =>
    suyos.some((m) => PRINCIPALES[z].includes(m) || SECUNDARIOS[z].includes(m)),
  )
}

// ─── Los filtros ────────────────────────────────────────────────────────

/**
 * Los filtros de la grilla de Ejercicios y del selector: GRUPO · EQUIPO ·
 * NIVEL · CADENA.
 *
 * **Dentro de un filtro, las opciones suman** ("Espalda o Brazos"); **entre
 * filtros, se combinan** ("Espalda, y además con banda"), §4.7.
 *
 * **Una lista vacía es lo mismo que no tener el filtro**: la hoja de un
 * filtro sin nada tildado dice "Todos", y un filtro que con nada tildado
 * escondiera todo sería una pantalla vacía que nadie pidió.
 */
export interface FiltrosDelCatalogo {
  /** GRUPO: de alguna de estas zonas. */
  grupos?: readonly Zona[]
  /**
   * EQUIPO, las opciones de a una: que pida alguno de estos. "Con banda" es
   * lo que usa una banda, no lo que se puede hacer con una banda (que sería
   * casi todo, empezando por las flexiones).
   */
  equipos?: readonly Equipo[]
  /**
   * EQUIPO › "Con lo que tengo": lo que da `equipoDe` para el perfil. Esta
   * opción sí es "se puede hacer con esto" (`alcanza`): una dominada asistida
   * pide la barra y la banda, y con solo la barra no entra.
   *
   * Es una opción más del mismo filtro, así que suma con `equipos`: "Con lo
   * que tengo" y "Banda" muestran lo que alcanzás y, además, lo que usa banda.
   */
  conLoQueTengo?: readonly Equipo[] | ReadonlySet<Equipo>
  /** NIVEL: de alguna de estas bandas. La movilidad no tiene nivel. */
  niveles?: readonly BandaDeNivel[]
  /** CADENA: de alguna de estas cadenas (ver `cadenaDelItem`). */
  cadenas?: readonly Patron[]
}

const tamano = (lista: readonly unknown[] | ReadonlySet<unknown> | undefined) =>
  lista === undefined ? 0 : 'size' in lista ? lista.size : lista.length

/** Si hay algún filtro puesto: es lo que muestra Limpiar. */
export function hayFiltros(filtros: FiltrosDelCatalogo): boolean {
  return (
    tamano(filtros.grupos) > 0 ||
    tamano(filtros.equipos) > 0 ||
    tamano(filtros.conLoQueTengo) > 0 ||
    tamano(filtros.niveles) > 0 ||
    tamano(filtros.cadenas) > 0
  )
}

/**
 * Los ítems que pasan todos los filtros, en el orden en que venían.
 *
 * Un filtro que pregunta algo que el ítem no tiene lo deja afuera: la
 * movilidad no tiene nivel ni cadena, así que con NIVEL o CADENA puestos no
 * aparece. Sin esos filtros, sí.
 */
export function filtrarCatalogo(
  items: readonly ItemDelCatalogo[],
  filtros: FiltrosDelCatalogo,
): ItemDelCatalogo[] {
  const { grupos, equipos, conLoQueTengo, niveles, cadenas } = filtros
  const porEquipo = tamano(equipos) > 0 || tamano(conLoQueTengo) > 0

  return items.filter((item) => {
    if (grupos && grupos.length > 0) {
      const suyas = zonasDelItem(item)
      if (!grupos.some((z) => suyas.includes(z))) return false
    }
    if (porEquipo) {
      const loTengo =
        conLoQueTengo !== undefined && tamano(conLoQueTengo) > 0 && alcanza(item, conLoQueTengo)
      const loUsa = equipos !== undefined && item.equipo.some((e) => equipos.includes(e))
      if (!loTengo && !loUsa) return false
    }
    if (niveles && niveles.length > 0) {
      if (item.clase !== 'fuerza' || !niveles.includes(nivelDe(item.ejercicio))) return false
    }
    if (cadenas && cadenas.length > 0) {
      const cadena = cadenaDelItem(item)
      if (cadena === null || !cadenas.includes(cadena)) return false
    }
    return true
  })
}

// ─── El agrupado ────────────────────────────────────────────────────────

/** Las formas de agrupar de la regleta, en su orden (§4.7). */
export type Agrupacion = 'cadena' | 'musculo' | 'equipo' | 'nivel'

export const AGRUPACIONES: readonly Agrupacion[] = ['cadena', 'musculo', 'equipo', 'nivel']

export const NOMBRE_AGRUPACION: Record<Agrupacion, string> = {
  cadena: 'Cadena',
  musculo: 'Músculo',
  equipo: 'Equipo',
  nivel: 'Nivel',
}

/**
 * Si un texto es una forma de agrupar. Llega por `?agrupar=`, y uno
 * inventado tiene que dar la de siempre, no una lista rota.
 */
export function esAgrupacion(valor: unknown): valor is Agrupacion {
  return typeof valor === 'string' && (AGRUPACIONES as readonly string[]).includes(valor)
}

/**
 * Los nombres del equipo como encabezados de grupo, en el orden de `EQUIPOS`.
 *
 * Son los de §4.7. La toalla, los objetos de la casa y el escalón no están en
 * esa lista, que se escribió antes de que el tipo los tuviera, y van igual: un
 * ejercicio que pide solo una toalla no puede quedarse sin grupo al agrupar
 * por equipo.
 */
export const NOMBRE_EQUIPO: Record<Equipo, string> = {
  nada: 'Nada',
  silla: 'Silla o banco',
  pared: 'Pared',
  marco: 'Marco de puerta',
  toalla: 'Toalla',
  objetos: 'Objetos de la casa',
  escalon: 'Escalón',
  'barra-baja': 'Barra baja o mesa',
  barra: 'Barra fija',
  banda: 'Banda',
  paralelas: 'Paralelas',
  anillas: 'Anillas',
  discos: 'Barra con discos',
}

/** Una fila de un grupo. */
export interface FilaDelCatalogo {
  item: ItemDelCatalogo
  /** En un eslabón, su lugar en la escalera (el "01…11" del canal). */
  eslabon?: number
  /**
   * En un eslabón, dónde está la persona en esa cadena: ESTÁS ACÁ en el suyo
   * y YA PASASTE en los de abajo. Va en cualquier agrupado, porque la fila
   * dice lo mismo agrupada por cadena que por músculo.
   */
  marca?: 'estas-aca' | 'ya-pasaste'
}

export interface GrupoDelCatalogo {
  /**
   * Única dentro del agrupado y estable entre renders: `cadena:empuje`,
   * `tambien:empuje`, `musculo:pectoral`, `equipo:banda`, `nivel:2`,
   * `movilidad`. Sirve de `key` y para la memoria del scroll.
   */
  clave: string
  /** El encabezado, en minúsculas de frase: el rótulo lo pasa a mayúsculas. */
  titulo: string
  /** La cadena del grupo, para el glifo: en su escalera y en "También de…". */
  patron?: Patron
  filas: FilaDelCatalogo[]
}

/** La marca de un eslabón según el avance de su cadena. */
function marcaDe(
  posicion: { patron: Patron; posicion: number },
  avances: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId'>>,
): FilaDelCatalogo['marca'] {
  const actual = avances.get(posicion.patron)
  if (!actual) return undefined
  const donde = ESLABONES.get(actual.ejercicioId)
  if (!donde || donde.patron !== posicion.patron) return undefined
  if (posicion.posicion === donde.posicion) return 'estas-aca'
  if (posicion.posicion < donde.posicion) return 'ya-pasaste'
  return undefined
}

function filaDe(
  item: ItemDelCatalogo,
  avances: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId'>>,
): FilaDelCatalogo {
  const eslabon = item.clase === 'fuerza' ? ESLABONES.get(item.id) : undefined
  if (!eslabon) return { item }
  const marca = marcaDe(eslabon, avances)
  return marca ? { item, eslabon: eslabon.posicion, marca } : { item, eslabon: eslabon.posicion }
}

/** Arma los grupos en el orden dado y saca los que quedaron vacíos. */
function sinVacios(grupos: GrupoDelCatalogo[]): GrupoDelCatalogo[] {
  return grupos.filter((g) => g.filas.length > 0)
}

/**
 * Los ítems agrupados, con los grupos vacíos afuera.
 *
 * - **Por cadena** (la de siempre, la Cadenas de hoy): cada escalera en el
 *   orden de su cadena; debajo, "También de empuje" con las variantes por su
 *   nivel equivalente y después los accesorios de ese patrón por su banda; al
 *   final "Sin cadena", "Con la barra" y "Movilidad". Cada ítem va en un solo
 *   grupo, así las filas suman lo mismo que la cifra.
 * - **Por músculo:** un grupo por cada músculo principal, en el orden de
 *   pantalla de `MUSCULOS_CUBIERTOS`. Un ejercicio con dos principales va en
 *   los dos (un remo es de dorsal y de media espalda). La movilidad va aparte,
 *   al final: no suma al mapa, así que no tiene músculos que nombrar.
 * - **Por equipo:** un grupo por equipo, en el orden de `EQUIPOS`, y un
 *   ejercicio con dos equipos va en los dos. La movilidad entra en el suyo.
 * - **Por nivel:** I, II y III con `nivelDe`, y la movilidad aparte, al final.
 *
 * Fuera del agrupado por cadena, cada grupo conserva el orden en que llegaron
 * los ítems. Un ítem al que le falta el dato de su agrupado (un ejercicio sin
 * principal o sin equipo) va a un grupo al final que lo dice, en vez de
 * desaparecer al cambiar de agrupado.
 *
 * `avances` marca ESTÁS ACÁ y YA PASASTE en los eslabones, en cualquier
 * agrupado. Sin avances (nadie hizo el alta todavía), no se marca nada.
 */
export function agruparCatalogo(
  items: readonly ItemDelCatalogo[],
  por: Agrupacion,
  avances: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId'>>,
): GrupoDelCatalogo[] {
  const fila = (item: ItemDelCatalogo) => filaDe(item, avances)
  const movilidad: GrupoDelCatalogo = {
    clave: 'movilidad',
    titulo: 'Movilidad',
    filas: items.filter((i) => i.clase === 'movilidad').map(fila),
  }
  const fuerza = items.filter((i): i is ItemDeFuerza => i.clase === 'fuerza')

  switch (por) {
    case 'cadena':
      return sinVacios([...gruposPorCadena(fuerza, fila), movilidad])

    case 'musculo': {
      const principales = new Map(fuerza.map((i) => [i.id, principalesDe(i.id)]))
      const de = (i: ItemDeFuerza) => principales.get(i.id) ?? []
      const grupos = MUSCULOS_CUBIERTOS.map(
        (m): GrupoDelCatalogo => ({
          clave: `musculo:${m}`,
          titulo: NOMBRE_MUSCULO[m],
          filas: fuerza.filter((i) => de(i).includes(m)).map(fila),
        }),
      )
      const sinPrincipal: GrupoDelCatalogo = {
        clave: 'musculo:ninguno',
        titulo: 'Sin músculo principal',
        filas: fuerza.filter((i) => !de(i).some((m) => MUSCULOS_CUBIERTOS.includes(m))).map(fila),
      }
      return sinVacios([...grupos, sinPrincipal, movilidad])
    }

    case 'equipo': {
      const grupos = EQUIPOS.map(
        (e): GrupoDelCatalogo => ({
          clave: `equipo:${e}`,
          titulo: NOMBRE_EQUIPO[e],
          filas: items.filter((i) => i.equipo.includes(e)).map(fila),
        }),
      )
      const sinDato: GrupoDelCatalogo = {
        clave: 'equipo:ninguno',
        titulo: 'Sin dato de equipo',
        filas: items.filter((i) => !i.equipo.some((e) => EQUIPOS.includes(e))).map(fila),
      }
      return sinVacios([...grupos, sinDato])
    }

    case 'nivel': {
      const bandas: BandaDeNivel[] = [1, 2, 3]
      const grupos = bandas.map(
        (b): GrupoDelCatalogo => ({
          clave: `nivel:${b}`,
          titulo: `Nivel ${NOMBRE_BANDA[b]}`,
          filas: fuerza.filter((i) => nivelDe(i.ejercicio) === b).map(fila),
        }),
      )
      return sinVacios([...grupos, movilidad])
    }
  }
}

/** Ordena sin perder el orden de llegada entre iguales (`sort` ya es estable). */
function ordenadosPor<T>(lista: readonly T[], clave: (t: T) => number): T[] {
  return [...lista].sort((a, b) => clave(a) - clave(b))
}

/** Los grupos del agrupado por cadena, sin la movilidad. */
function gruposPorCadena(
  fuerza: readonly ItemDeFuerza[],
  fila: (item: ItemDelCatalogo) => FilaDelCatalogo,
): GrupoDelCatalogo[] {
  const deClase = (clase: ClaseDeEjercicio) =>
    fuerza.filter((i) => claseDeEjercicio(i.ejercicio) === clase)
  const variantes = deClase('variante')
  const accesorios = deClase('accesorio')

  const porCadena = CADENAS.flatMap((cadena): GrupoDelCatalogo[] => {
    const nombre = NOMBRE_PATRON[cadena.patron]
    const escalera = ordenadosPor(
      fuerza.filter((i) => ESLABONES.get(i.id)?.patron === cadena.patron),
      (i) => ESLABONES.get(i.id)?.posicion ?? 0,
    )
    const tambien = [
      ...ordenadosPor(
        variantes.filter((i) => i.ejercicio.equivale?.patron === cadena.patron),
        (i) => i.ejercicio.equivale?.nivel ?? 0,
      ),
      ...ordenadosPor(
        accesorios.filter((i) => i.ejercicio.patron === cadena.patron),
        (i) => nivelDe(i.ejercicio),
      ),
    ]
    return [
      {
        clave: `cadena:${cadena.patron}`,
        titulo: nombre,
        patron: cadena.patron,
        filas: escalera.map(fila),
      },
      {
        clave: `tambien:${cadena.patron}`,
        titulo: `También de ${nombre.toLowerCase()}`,
        patron: cadena.patron,
        filas: tambien.map(fila),
      },
    ]
  })

  return [
    ...porCadena,
    { clave: 'sin-cadena', titulo: 'Sin cadena', filas: deClase('sin-cadena').map(fila) },
    { clave: 'con-la-barra', titulo: 'Con la barra', filas: deClase('con-la-barra').map(fila) },
  ]
}

// ─── Más fácil y más difícil ────────────────────────────────────────────

export interface Vecinos {
  masFacil: Ejercicio | null
  masDificil: Ejercicio | null
}

const SIN_VECINOS: Vecinos = { masFacil: null, masDificil: null }

/**
 * El más cercano por debajo (o por arriba) de `referencia`, según `nivel`.
 *
 * Entre los que quedan a la misma distancia gana el que comparte más
 * principales con el ejercicio, y después el id, que es el desempate de los
 * mixes (§6.3): así la respuesta es siempre la misma con la misma biblioteca.
 */
function elMasCercano(
  candidatos: readonly Ejercicio[],
  nivel: (e: Ejercicio) => number,
  referencia: number,
  hacia: 'abajo' | 'arriba',
  compartidos: (e: Ejercicio) => number,
): Ejercicio | null {
  const delLado = candidatos.filter((c) =>
    hacia === 'abajo' ? nivel(c) < referencia : nivel(c) > referencia,
  )
  delLado.sort(
    (a, b) =>
      Math.abs(nivel(a) - referencia) - Math.abs(nivel(b) - referencia) ||
      compartidos(b) - compartidos(a) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  return delLado[0] ?? null
}

/**
 * MÁS FÁCIL y MÁS DIFÍCIL de un ejercicio (§4.8): lo que muestra la Ficha, lo
 * que ofrece la hoja Cambiar y el "Más difícil" del Cierre cuando un fijo
 * llegó dos veces al techo (§5.6 B8).
 *
 * - **Un eslabón:** el anterior y el siguiente de su cadena. En las puntas,
 *   `null`.
 * - **Una variante, por nivel equivalente:** la variante de su misma cadena
 *   equivalente más cercana por debajo y por arriba, entre las que comparten
 *   un músculo principal con ella. Sin compartir músculo, "≈ empuje 6" tendría
 *   de vecinas a una pica y a unos fondos a la vez, dos gestos distintos. Si de
 *   un lado no hay ninguna, va el eslabón de al lado de su nivel equivalente
 *   (N − 1 o N + 1): la cadena es la referencia con la que se la eligió, y
 *   N − 1 es además adonde la baja la molestia (§5.6 E).
 * - **Un accesorio** (y los de discos, que progresan por peso como un
 *   accesorio): el de la banda de nivel más cercana, por debajo o por arriba,
 *   para un mismo músculo principal, entre los que no son eslabón ni
 *   variante. "De al lado" quiere decir la más cercana que exista: si de I se
 *   salta a III porque en II no hay nada, la III es la de al lado.
 * - **La movilidad**, o un id que no existe: ninguno. La movilidad no
 *   progresa (`movilidad.ts`).
 *
 * `catalogo` y `aporte` son la biblioteca y la matriz de siempre; se pueden
 * pasar para probar con fichas que la biblioteca todavía no tiene.
 */
export function vecinos(
  ejercicioId: string,
  catalogo: readonly Ejercicio[] = EJERCICIOS,
  aporte: Readonly<Record<string, Vector>> = APORTE,
): Vecinos {
  const ejercicio = catalogo.find((e) => e.id === ejercicioId)
  if (!ejercicio) return SIN_VECINOS
  const porId = new Map(catalogo.map((e) => [e.id, e]))
  const suyo = (id: string | undefined) => (id === undefined ? null : (porId.get(id) ?? null))

  const eslabon = ESLABONES.get(ejercicio.id)
  if (eslabon) {
    const cadena = cadenaDe(eslabon.patron).ejercicios
    return {
      masFacil: suyo(cadena[eslabon.posicion - 2]),
      masDificil: suyo(cadena[eslabon.posicion]),
    }
  }

  const principales = principalesDe(ejercicio.id, aporte)
  const compartidos = (e: Ejercicio) =>
    principalesDe(e.id, aporte).filter((m) => principales.includes(m)).length
  const otros = catalogo.filter((e) => e.id !== ejercicio.id && compartidos(e) > 0)

  const equivale = ejercicio.equivale
  if (equivale) {
    const nivel = (e: Ejercicio) => e.equivale?.nivel ?? 0
    const familia = otros.filter(
      (e) => claseDeEjercicio(e) === 'variante' && e.equivale?.patron === equivale.patron,
    )
    const cadena = cadenaDe(equivale.patron).ejercicios
    return {
      masFacil:
        elMasCercano(familia, nivel, equivale.nivel, 'abajo', compartidos) ??
        suyo(equivale.nivel >= 2 ? cadena[equivale.nivel - 2] : undefined),
      masDificil:
        elMasCercano(familia, nivel, equivale.nivel, 'arriba', compartidos) ??
        suyo(cadena[equivale.nivel]),
    }
  }

  const sueltos = otros.filter((e) => {
    const clase = claseDeEjercicio(e)
    return clase !== 'eslabon' && clase !== 'variante'
  })
  const banda = nivelDe(ejercicio)
  return {
    masFacil: elMasCercano(sueltos, nivelDe, banda, 'abajo', compartidos),
    masDificil: elMasCercano(sueltos, nivelDe, banda, 'arriba', compartidos),
  }
}

// ─── Dónde aparece ──────────────────────────────────────────────────────

/** Un lugar donde aparece un ejercicio: la fila de APARECE EN de la Ficha. */
export type Aparicion =
  | { clase: 'mix'; sector: Sector }
  | { clase: 'rutina'; rutinaId: string; nombre: string }

/**
 * Los mixes y las rutinas propias que usan un ejercicio (§4.8, APARECE EN).
 * Sin ninguno, la lista vacía: la Ficha no muestra la sección.
 *
 * **Las rutinas:** las que tienen un paso que nombra el ejercicio (un `fijo`
 * o una `movilidad`), cada una una vez aunque lo use en dos pasos, en el
 * orden en que llegan (Mis rutinas ya sabe cómo ordenarlas). Un paso `cadena`
 * o `volumen` no nombra un ejercicio: sigue tu nivel, y el ejercicio que le
 * toca cambia cada vez que la cadena se mueve. Contarlo haría que APARECE EN
 * cambiara solo, sin que nadie tocara la rutina.
 *
 * **Los mixes:** los ids que nombra el mix de cada sector, en `mixes`. Van
 * primero, en el orden de `SECTORES`. Llegan como dato y no se importan de
 * `mixes.ts` porque ese archivo usa este para elegir, y la vuelta haría una
 * importación circular. Por eso son obligatorios, aunque §5.1 escriba la
 * función con dos argumentos: con un valor por defecto vacío, la llamada de
 * dos argumentos compilaba y no devolvía nunca un mix, cuando APARECE EN es
 * "los mixes y tus rutinas que lo usan" (§4.8). Así nadie los deja afuera
 * sin enterarse; quien de verdad no quiere mixes pasa `{}` a la vista. Hay
 * dos fuentes, según lo que la pantalla quiera decir:
 *
 * - **`IDS_DE_LOS_MIXES`** (`mixes.ts`): lo que nombran las tablas de cada
 *   mix, su entrada y las opciones de sus bloques. No trae los bloques de
 *   cadena, que no nombran un ejercicio: siguen tu nivel, por la misma razón
 *   que un paso `cadena` de una rutina no cuenta acá.
 * - **Los ejercicios de los mixes resueltos para la persona** (los `pasos` de
 *   `resolverMix` de cada sector): lo que cada mix le arma hoy, con el
 *   eslabón que pone cada bloque de cadena. Es la única forma de decir con
 *   verdad que el mix de pecho usa tus flexiones completas, y por eso no hay
 *   acá un atajo con los avances: con el avance solo no se sabe, porque si tu
 *   equipo no llega a tu eslabón el bloque pone otro, y el de Cuerpo completo
 *   alterna piernas y bisagra según lo que hiciste.
 */
export function apareceEn(
  ejercicioId: string,
  rutinas: readonly Pick<RutinaPropia, 'id' | 'nombre' | 'pasos'>[],
  mixes: Partial<Record<Sector, readonly string[]>>,
): Aparicion[] {
  const enMixes: Aparicion[] = SECTORES.filter((s) => mixes[s]?.includes(ejercicioId)).map(
    (sector) => ({ clase: 'mix', sector }),
  )
  const enRutinas: Aparicion[] = rutinas
    .filter((r) =>
      r.pasos.some(
        (p) => (p.clase === 'fijo' || p.clase === 'movilidad') && p.ejercicioId === ejercicioId,
      ),
    )
    .map((r) => ({ clase: 'rutina', rutinaId: r.id, nombre: r.nombre }))
  return [...enMixes, ...enRutinas]
}

// ─── Los requisitos ─────────────────────────────────────────────────────

/**
 * Un requisito que se mira contra el historial (§6.6): haber hecho alguna vez
 * `series` series de un ejercicio que no es eslabón, cada una con `cantidad`
 * o más. "Apoyo en paralelas 3 × 30 s" para los fondos negativos.
 */
export interface RequisitoDeHistorial {
  pide: { ejercicioId: string; series: number; cantidad: number }
  /** Por qué existe, en pocas palabras, como en `Requisito`. */
  porque: string
}

function esRequisitoDeHistorial(valor: unknown): valor is RequisitoDeHistorial {
  if (typeof valor !== 'object' || valor === null) return false
  const { pide, porque } = valor as { pide?: unknown; porque?: unknown }
  if (typeof pide !== 'object' || pide === null || typeof porque !== 'string') return false
  const { ejercicioId, series, cantidad } = pide as Record<string, unknown>
  return (
    typeof ejercicioId === 'string' &&
    typeof series === 'number' &&
    Number.isFinite(series) &&
    typeof cantidad === 'number' &&
    Number.isFinite(cantidad)
  )
}

/**
 * Lee lo que la biblioteca declara como `REQUISITOS_DE_HISTORIAL`, si lo
 * declara.
 *
 * Esa lista la suma la ola 1 (C1) en `biblioteca.ts`, y este archivo existe
 * antes. Importarla por nombre no compilaría hasta entonces, y esperar a C1
 * para escribir `requisitoCumplido` dejaría a los mixes sin poder filtrar. Así
 * que se lee del módulo entero: hoy no está y no hay ninguno; el día que C1 la
 * escriba, entra sola, sin tocar este archivo (que C1 no tiene en su lista).
 *
 * Acepta un `Map` o un objeto, y por ejercicio uno o varios requisitos (la
 * flexión en vertical negativa de la ola 2 pide dos). Lo que no tenga la forma
 * de `RequisitoDeHistorial` no se lee, y `catalogo.test.ts` falla si se
 * perdió alguno: un requisito mal escrito que no filtrara nada haría que un
 * mix propusiera fondos negativos a quien nunca se sostuvo en las paralelas.
 */
export function leerRequisitosDeHistorial(
  declarados: unknown,
): Map<string, RequisitoDeHistorial[]> {
  const leidos = new Map<string, RequisitoDeHistorial[]>()
  if (typeof declarados !== 'object' || declarados === null) return leidos
  const entradas: Iterable<[unknown, unknown]> =
    declarados instanceof Map ? declarados.entries() : Object.entries(declarados)
  for (const [id, valor] of entradas) {
    if (typeof id !== 'string') continue
    const lista = (Array.isArray(valor) ? valor : [valor]).filter(esRequisitoDeHistorial)
    if (lista.length > 0) leidos.set(id, lista)
  }
  return leidos
}

/** El nombre de la lista en `biblioteca.ts`, como texto para leerla del módulo. */
export const NOMBRE_DE_LOS_REQUISITOS_DE_HISTORIAL = 'REQUISITOS_DE_HISTORIAL'

type RequisitosDeHistorial = ReadonlyMap<string, readonly RequisitoDeHistorial[]>

const DE_HISTORIAL: RequisitosDeHistorial = leerRequisitosDeHistorial(
  Reflect.get(biblioteca, NOMBRE_DE_LOS_REQUISITOS_DE_HISTORIAL),
)

/** Un requisito de cualquiera de las dos clases, para decirlo en una línea. */
export type RequisitoDelCatalogo =
  | { clase: 'avance'; requisito: Requisito }
  | { clase: 'historial'; requisito: RequisitoDeHistorial }

/**
 * ¿Cumple la persona un requisito de avance? Es la regla de `apertura.ts`
 * (`cumple`, que no se exporta), copiada a propósito y verificada contra
 * `eslabonesCerrados` en `catalogo.test.ts`: pasado el eslabón pedido, sí; en
 * el eslabón, solo si el objetivo actual ya pide el mínimo; antes, no.
 */
function cumpleEnAvances(
  avances: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId' | 'objetivoActual'>>,
  requisito: Requisito,
): boolean {
  const avance = avances.get(requisito.patron)
  if (!avance) return false
  const cadena = cadenaDe(requisito.patron).ejercicios
  const donde = cadena.indexOf(avance.ejercicioId)
  const pedido = cadena.indexOf(requisito.ejercicioId)
  if (donde === -1 || pedido === -1 || donde < pedido) return false
  if (donde > pedido || !requisito.minimo) return true
  const { series, cantidad } = avance.objetivoActual
  return series >= requisito.minimo.series && cantidad >= requisito.minimo.cantidad
}

/**
 * ¿Hay alguna sesión con al menos esas series de ese ejercicio, cada una con
 * lo pedido o más? Las series se cuentan por sesión, sumando los registros
 * del ejercicio (puede estar en dos pasos), y sin los de calentamiento, que
 * no son trabajo. Sin historial, no.
 */
function cumpleEnHistorial(
  historial: readonly Pick<Sesion, 'registros'>[],
  pide: RequisitoDeHistorial['pide'],
): boolean {
  return historial.some((sesion) => {
    let series = 0
    for (const registro of sesion.registros) {
      if (registro.calentamiento || registro.ejercicioId !== pide.ejercicioId) continue
      series += registro.series.filter((s) => s.logrado >= pide.cantidad).length
    }
    return series >= pide.series
  })
}

/** Todos los requisitos de un ejercicio, de las dos clases. */
export function requisitosDe(
  ejercicioId: string,
  deHistorial: RequisitosDeHistorial = DE_HISTORIAL,
): RequisitoDelCatalogo[] {
  const deAvance = REQUISITOS.get(ejercicioId)
  return [
    ...(deAvance ? [{ clase: 'avance', requisito: deAvance } as const] : []),
    ...(deHistorial.get(ejercicioId) ?? []).map(
      (requisito) => ({ clase: 'historial', requisito }) as const,
    ),
  ]
}

/**
 * Los requisitos de un ejercicio que la persona todavía no cumple, para la
 * línea de la Ficha ("Pide antes: apoyo en paralelas 3 × 30 s.").
 */
export function requisitosSinCumplir(
  ejercicioId: string,
  avances: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId' | 'objetivoActual'>>,
  historial: readonly Pick<Sesion, 'registros'>[],
  deHistorial: RequisitosDeHistorial = DE_HISTORIAL,
): RequisitoDelCatalogo[] {
  return requisitosDe(ejercicioId, deHistorial).filter((r) =>
    r.clase === 'avance'
      ? !cumpleEnAvances(avances, r.requisito)
      : !cumpleEnHistorial(historial, r.requisito.pide),
  )
}

/**
 * ¿Están cumplidos los requisitos de un ejercicio? (§6.6)
 *
 * - **Los de `REQUISITOS`** piden un eslabón de otra cadena y se miran contra
 *   los avances, como en `apertura.ts`: la palanca frontal pide 3 series de 8
 *   dominadas completas, o haberlas pasado.
 * - **Los de historial** piden un ejercicio que no es eslabón, y se miran
 *   contra las sesiones (`cumpleEnHistorial`).
 *
 * Hacen falta todos. Un ejercicio sin requisitos los tiene cumplidos: así los
 * mixes pueden filtrar todas las candidatas con la misma pregunta. En los
 * mixes, filtra; en lo que armás vos, en Cambiar y en "Empezar solo este",
 * solo informa (Decisión 45). Este archivo no decide cuál de las dos: dice si
 * está cumplido.
 */
export function requisitoCumplido(
  ejercicioId: string,
  avances: ReadonlyMap<Patron, Pick<Avance, 'ejercicioId' | 'objetivoActual'>>,
  historial: readonly Pick<Sesion, 'registros'>[],
  deHistorial: RequisitosDeHistorial = DE_HISTORIAL,
): boolean {
  return requisitosSinCumplir(ejercicioId, avances, historial, deHistorial).length === 0
}
