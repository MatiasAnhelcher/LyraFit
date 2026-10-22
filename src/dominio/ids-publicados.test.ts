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
 */

import { describe, expect, it } from 'vitest'
import { EJERCICIOS, POR_ID } from './biblioteca'

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
