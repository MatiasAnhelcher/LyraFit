/**
 * El equipo: qué hay donde entrena cada persona, y si un ejercicio entra ahí.
 *
 * Hasta acá la app conocía cuatro datos sueltos (`tieneBarra`,
 * `cargaMaximaKg`, `puedeSaltar`, `tieneEscalon`) y dos listas escritas a mano
 * en `musculos.ts`, `NECESITAN_BARRA` y `NECESITAN_BARRA_CARGABLE`. Alcanzaba
 * mientras lo único que cambiaba el plan era colgarse o no. Con los mixes, el
 * catálogo filtrado por "Con lo que tengo" y las bandas, paralelas y anillas,
 * cada ejercicio dice lo que pide (`Ejercicio.equipo`) y este archivo dice lo
 * que hay. Cruzarlos es `alcanza`, y es lo único que cualquier pantalla o mix
 * tiene que preguntar.
 *
 * Las dos listas viejas siguen vivas y mandan sobre esto: `biblioteca.test.ts`
 * exige que la barra y los discos de cada ficha cuadren con ellas, así que un
 * ejercicio no puede empezar a colgar de una barra en el mapa muscular y no en
 * el catálogo, ni al revés.
 */

import type { Ejercicio, Equipo, Preferencias } from './tipos'

/**
 * Todo el equipo que la app conoce, en el orden en que se nombra: de lo que
 * hay en cualquier casa a lo que hay que comprar.
 */
export const EQUIPOS: readonly Equipo[] = [
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

/**
 * Lo que la app da por tenido sin preguntar.
 *
 * Preguntar por la pared o por una toalla sería una pantalla más del alta
 * para un sí que contesta todo el mundo. La `barra-baja` es la mesa: la app ya
 * la daba por hecha (`Alta.tsx` ubica a quien no tiene dónde colgarse en el
 * remo bajo una mesa), y las fichas de los remos suman la opción de la mesa
 * con su aviso de seguridad en la ola 1 (§6.5 de la reestructura). El escalón
 * queda afuera porque ya tiene su interruptor, `tieneEscalon`, que el fuelle
 * lee desde antes: darlo por tenido acá le haría decir lo contrario al Reloj.
 */
export const DADOS_POR_TENIDOS: readonly Equipo[] = [
  'nada',
  'silla',
  'pared',
  'marco',
  'toalla',
  'objetos',
  'barra-baja',
]

/** Lo que el perfil dice del equipo. El resto de las preferencias no importa acá. */
export type PerfilDeEquipo = Pick<
  Preferencias,
  'tieneBarra' | 'cargaMaximaKg' | 'tieneEscalon' | 'tieneBanda' | 'tieneParalelas' | 'tieneAnillas'
>

/**
 * "Con lo que tengo": lo dado por tenido más lo marcado en el perfil, en el
 * orden de `EQUIPOS`.
 *
 * Cada ausente se lee como lo lee hoy el resto de la app, para que el mix y el
 * motor no digan dos cosas distintas de la misma persona:
 *
 * - **La barra ausente cuenta como sí**, igual que en `apertura.ts`, Hoy,
 *   Progreso y la Ficha. Si acá contara como no, a quien nunca contestó la
 *   pregunta el motor le pondría una dominada en el bloque de cadena y el mix
 *   le escondería las demás.
 * - **Los discos salen de `cargaMaximaKg`**, que ausente o en cero quiere decir
 *   que no hay barra cargable (`Hoy.tsx`, `Progreso.tsx`).
 * - **El escalón, la banda, las paralelas y las anillas ausentes cuentan como
 *   no**: son las preguntas nuevas, y nadie las contestó todavía.
 */
export function equipoDe(preferencias: PerfilDeEquipo): Equipo[] {
  const marcado: Partial<Record<Equipo, boolean>> = {
    barra: preferencias.tieneBarra !== false,
    discos: (preferencias.cargaMaximaKg ?? 0) > 0,
    escalon: preferencias.tieneEscalon === true,
    banda: preferencias.tieneBanda === true,
    paralelas: preferencias.tieneParalelas === true,
    anillas: preferencias.tieneAnillas === true,
  }
  return EQUIPOS.filter((e) => DADOS_POR_TENIDOS.includes(e) || marcado[e] === true)
}

/**
 * Si un ejercicio se puede hacer con este equipo: hace falta TODO lo que pide.
 *
 * La lista de una ficha es de requisitos y no de alternativas. Una dominada
 * asistida pide la barra Y la banda; las alternativas reales ya vienen
 * agrupadas en una sola palabra (`silla` es silla, banco o mueble firme;
 * `barra-baja` es la barra a la cintura o la mesa pesada).
 *
 * `nada` es el piso y alcanza siempre, aunque el equipo que llega no lo
 * nombre: decir que una flexión no se puede hacer porque falta "nada" sería
 * un error de tipeo convertido en consejo.
 *
 * Una ficha sin el dato no alcanza. No pasa en la biblioteca, porque el test
 * lo exige en cada ejercicio, pero si pasara, proponer algo sin saber qué pide
 * es proponerle una barra a quien no tiene dónde colgarse.
 *
 * Acepta el equipo como lista o como conjunto: lo arma `equipoDe` y también
 * la hoja de filtros, que tilda de a uno.
 */
export function alcanza(
  ejercicio: Pick<Ejercicio, 'equipo'>,
  equipo: readonly Equipo[] | ReadonlySet<Equipo>,
): boolean {
  const pide = ejercicio.equipo
  if (!pide || pide.length === 0) return false
  const hay = (e: Equipo) =>
    e === 'nada' || ('has' in equipo ? equipo.has(e) : equipo.includes(e))
  return pide.every(hay)
}
