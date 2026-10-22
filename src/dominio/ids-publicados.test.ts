/**
 * Los ids de los ejercicios no cambian nunca.
 *
 * Un id está escrito en el historial de cada sesión, en los avances, en las
 * rutinas de cada persona y en cada copia de seguridad que alguien guardó en
 * su teléfono. Renombrar uno no rompe nada en el momento: rompe la copia que
 * se restaura dentro de un año, que trae un id que la app ya no conoce, y la
 * cadena de quien estaba en ese eslabón, que deja de saber dónde está.
 *
 * Por eso se congelan a medida que existen. Esta lista son los 53 de antes de
 * la reestructura; cada ola que suma ejercicios suma sus ids acá. Un id
 * congelado tiene que seguir existiendo o estar en `RETIRADOS`, con el id que
 * lo reemplaza. Lo que no está en ninguna de las dos listas falla, y el
 * mensaje dice cuál.
 *
 * Lo mismo vale para las fichas de movilidad y los mixes: sus ids quedan en
 * las sesiones (un paso de movilidad, una sesión que salió de un mix) y en
 * las copias. Y los tres viven en el mismo espacio: un paso guarda un id sin
 * decir de qué lista es, así que una ficha o un mix con el id de un
 * ejercicio haría que la app leyera una cosa por otra.
 */

import { describe, expect, it } from 'vitest'
import { EJERCICIOS, POR_ID } from './biblioteca'
import { MIXES } from './mixes'
import { MOVILIDAD, MOVILIDAD_POR_ID } from './movilidad'

/** Los 53 ejercicios de antes de la reestructura, congelados en R1. */
const CONGELADOS: readonly string[] = [
  'flexion-pared',
  'flexion-inclinada-alta',
  'flexion-inclinada',
  'flexion-inclinada-baja',
  'flexion-rodillas',
  'flexion-completa',
  'flexion-diamante',
  'flexion-declinada',
  'flexion-pseudoplancha',
  'flexion-arquera',
  'flexion-una-mano',
  'remo-australiano-alto',
  'remo-australiano-medio',
  'remo-australiano-bajo',
  'remo-australiano-pies-elevados',
  'dominada-negativa',
  'dominada-asistida',
  'dominada-asistida-leve',
  'dominada-completa',
  'dominada-arquera',
  'dominada-un-brazo-asistida',
  'sentadilla-banco',
  'sentadilla-asistida',
  'sentadilla-completa',
  'zancada',
  'sentadilla-bulgara',
  'sentadilla-a-banco-una-pierna',
  'sentadilla-una-pierna-asistida',
  'pistol-squat',
  'pistol-con-pausa',
  'plancha-rodillas',
  'plancha',
  'plancha-brazo-alternado',
  'elevacion-rodillas-suelo',
  'elevacion-piernas-suelo',
  'elevacion-rodillas-colgado',
  'elevacion-piernas-colgado',
  'palanca-frontal-agrupada',
  'palanca-frontal-negativa',
  'puente-gluteos',
  'puente-gluteos-pies-elevados',
  'puente-una-pierna',
  'bisagra-una-pierna',
  'puente-una-pierna-elevado',
  'curl-talones-deslizando',
  'curl-nordico-negativo',
  'curl-nordico',
  'press-militar-barra',
  'remo-barra',
  'peso-muerto-rumano',
  'elevacion-talones-barra',
  'curl-barra',
  'extension-triceps-barra',
]

/**
 * Los ids que dejaron de existir, con el que los reemplaza. Vacío: todavía no
 * se retiró ninguno. Retirar uno es sumarlo acá en el mismo cambio que lo
 * saca de la biblioteca, y su reemplazo tiene que existir.
 */
const RETIRADOS: ReadonlyMap<string, string> = new Map<string, string>([])

/** Las 12 fichas de movilidad de la reestructura, congeladas en R2. */
const MOVILIDAD_CONGELADA: readonly string[] = [
  'munecas-cuatro-patas',
  'gato-vaca',
  'libro-abierto',
  'zancada-rotacion',
  'sentadilla-profunda-sostenida',
  'rodilla-pared',
  'pasaje-hombros',
  'cadera-90-90',
  'flexor-cadera-arrodillado',
  'pectoral-marco',
  'perro-cobra',
  'isquios-toalla',
]

/** Los 8 mixes de la reestructura, uno por sector, congelados en R2. */
const MIXES_CONGELADOS: readonly string[] = [
  'mix-pecho',
  'mix-espalda',
  'mix-hombros',
  'mix-brazos',
  'mix-core',
  'mix-piernas',
  'mix-gluteos',
  'mix-cuerpo-completo',
]

/**
 * Las fichas de movilidad y los mixes que dejaron de existir, con el que los
 * reemplaza. Vacíos por ahora, con la misma regla que `RETIRADOS`.
 */
const MOVILIDAD_RETIRADA: ReadonlyMap<string, string> = new Map<string, string>([])
const MIXES_RETIRADOS: ReadonlyMap<string, string> = new Map<string, string>([])

const IDS_DE_MIXES: ReadonlySet<string> = new Set(MIXES.map((m) => m.id))

describe('los ids publicados', () => {
  it('cada id congelado sigue existiendo, o se retiró con reemplazo', () => {
    const perdidos = CONGELADOS.filter((id) => !POR_ID.has(id) && !RETIRADOS.has(id))
    expect(perdidos, `ids publicados que ya no existen: ${perdidos.join(', ')}`).toEqual([])
  })

  it('el reemplazo de un retirado existe, y el retirado ya no', () => {
    for (const [viejo, nuevo] of RETIRADOS) {
      expect(POR_ID.has(nuevo), `${viejo} se reemplaza por ${nuevo}, que no existe`).toBe(true)
      expect(POR_ID.has(viejo), `${viejo} figura como retirado y sigue existiendo`).toBe(false)
    }
  })

  it('la lista congelada no tiene repetidos', () => {
    expect(new Set(CONGELADOS).size).toBe(CONGELADOS.length)
  })

  it('ningún ejercicio comparte id con otro', () => {
    const ids = EJERCICIOS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('los ids publicados de movilidad y de mixes', () => {
  it('cada ficha de movilidad congelada sigue existiendo, o se retiró con reemplazo', () => {
    const perdidas = MOVILIDAD_CONGELADA.filter((id) => !MOVILIDAD_POR_ID.has(id) && !MOVILIDAD_RETIRADA.has(id))
    expect(perdidas, `fichas de movilidad publicadas que ya no existen: ${perdidas.join(', ')}`).toEqual([])
  })

  it('cada mix congelado sigue existiendo, o se retiró con reemplazo', () => {
    const perdidos = MIXES_CONGELADOS.filter((id) => !IDS_DE_MIXES.has(id) && !MIXES_RETIRADOS.has(id))
    expect(perdidos, `mixes publicados que ya no existen: ${perdidos.join(', ')}`).toEqual([])
  })

  it('el reemplazo de una ficha o un mix retirado existe, y el retirado ya no', () => {
    for (const [viejo, nuevo] of MOVILIDAD_RETIRADA) {
      expect(MOVILIDAD_POR_ID.has(nuevo), `${viejo} se reemplaza por ${nuevo}, que no existe`).toBe(true)
      expect(MOVILIDAD_POR_ID.has(viejo), `${viejo} figura como retirada y sigue existiendo`).toBe(false)
    }
    for (const [viejo, nuevo] of MIXES_RETIRADOS) {
      expect(IDS_DE_MIXES.has(nuevo), `${viejo} se reemplaza por ${nuevo}, que no existe`).toBe(true)
      expect(IDS_DE_MIXES.has(viejo), `${viejo} figura como retirado y sigue existiendo`).toBe(false)
    }
  })

  it('las listas congeladas no tienen repetidos', () => {
    expect(new Set(MOVILIDAD_CONGELADA).size).toBe(MOVILIDAD_CONGELADA.length)
    expect(new Set(MIXES_CONGELADOS).size).toBe(MIXES_CONGELADOS.length)
  })

  it('ninguna ficha de movilidad ni ningún mix comparte id con otro', () => {
    const fichas = MOVILIDAD.map((f) => f.id)
    const mixes = MIXES.map((m) => m.id)
    expect(new Set(fichas).size).toBe(fichas.length)
    expect(new Set(mixes).size).toBe(mixes.length)
  })

  it('ningún id se repite entre ejercicios, fichas de movilidad y mixes', () => {
    // Las congeladas y las de hoy: un id retirado tampoco se puede reusar
    // en otra lista, porque sigue escrito en sesiones viejas.
    const ejercicios = new Set([...CONGELADOS, ...RETIRADOS.keys(), ...EJERCICIOS.map((e) => e.id)])
    const fichas = new Set([...MOVILIDAD_CONGELADA, ...MOVILIDAD_RETIRADA.keys(), ...MOVILIDAD.map((f) => f.id)])
    const mixes = new Set([...MIXES_CONGELADOS, ...MIXES_RETIRADOS.keys(), ...MIXES.map((m) => m.id)])
    const choques = [
      ...[...fichas].filter((id) => ejercicios.has(id)).map((id) => `${id} (ejercicio y movilidad)`),
      ...[...mixes].filter((id) => ejercicios.has(id)).map((id) => `${id} (ejercicio y mix)`),
      ...[...mixes].filter((id) => fichas.has(id)).map((id) => `${id} (movilidad y mix)`),
    ]
    expect(choques, `ids repetidos entre listas: ${choques.join(', ')}`).toEqual([])
  })
})
