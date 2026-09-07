/**
 * La biblioteca es datos, y los datos también se rompen.
 *
 * Un id mal escrito en una cadena, una ventana invertida o un salto de carga
 * demasiado grande entre dos eslabones no rompen la compilación: rompen el
 * entrenamiento de alguien. Esto los agarra antes.
 */

import { describe, expect, it } from 'vitest'
import { CADENAS, EJERCICIOS, POR_ID } from './biblioteca'

/**
 * Salto máximo de carga entre dos eslabones consecutivos.
 *
 * Por encima de esto la progresión deja de ser una escalera y pasa a ser un
 * escalón: es donde la gente se lastima el hombro y donde abandona. Los
 * primeros eslabones de cada cadena tienen permitido un salto mayor porque son
 * tan livianos que un cuarenta por ciento de casi nada sigue siendo poco.
 */
const SALTO_MAXIMO = 0.25
const SALTO_MAXIMO_INICIAL = 0.55
const CARGA_LIVIANA = 0.5

describe('integridad de las cadenas', () => {
  it('todos los ids de las cadenas existen', () => {
    for (const cadena of CADENAS) {
      for (const id of cadena.ejercicios) {
        expect(POR_ID.get(id), `${cadena.patron} → ${id}`).toBeDefined()
      }
    }
  })

  it('todos los ejercicios están en su cadena, y en una sola', () => {
    const enCadenas = CADENAS.flatMap((c) => c.ejercicios)
    expect(new Set(enCadenas).size).toBe(enCadenas.length)
    for (const ejercicio of EJERCICIOS) {
      expect(enCadenas, ejercicio.id).toContain(ejercicio.id)
    }
  })

  it('cada ejercicio pertenece al patrón de su cadena', () => {
    for (const cadena of CADENAS) {
      for (const id of cadena.ejercicios) {
        expect(POR_ID.get(id)!.patron, id).toBe(cadena.patron)
      }
    }
  })

  it('los niveles van en orden dentro de cada cadena', () => {
    for (const cadena of CADENAS) {
      const niveles = cadena.ejercicios.map((id) => POR_ID.get(id)!.nivel)
      expect(niveles, cadena.patron).toEqual([...niveles].sort((a, b) => a - b))
    }
  })

  it('la carga sube en cada eslabón, sin saltos que lastimen', () => {
    for (const cadena of CADENAS) {
      const ejercicios = cadena.ejercicios.map((id) => POR_ID.get(id)!)
      for (let i = 1; i < ejercicios.length; i++) {
        const previo = ejercicios[i - 1]!
        const actual = ejercicios[i]!
        expect(actual.ccr, `${previo.id} → ${actual.id}`).toBeGreaterThan(previo.ccr)

        const salto = actual.ccr / previo.ccr - 1
        const permitido = previo.ccr < CARGA_LIVIANA ? SALTO_MAXIMO_INICIAL : SALTO_MAXIMO
        expect(salto, `${previo.id} → ${actual.id} salta ${Math.round(salto * 100)}%`)
          .toBeLessThanOrEqual(permitido)
      }
    }
  })
})

describe('cada ejercicio está bien formado', () => {
  it.each(EJERCICIOS.map((e) => [e.id, e] as const))('%s', (_id, ejercicio) => {
    expect(ejercicio.ventana.min).toBeGreaterThan(0)
    expect(ejercicio.ventana.max).toBeGreaterThan(ejercicio.ventana.min)
    expect(ejercicio.series).toBeGreaterThanOrEqual(1)
    expect(ejercicio.ccr).toBeGreaterThan(0)
    expect(ejercicio.descansoSegundos).toBeGreaterThanOrEqual(30)
    expect(ejercicio.tecnica.length).toBeGreaterThanOrEqual(3)
    expect(ejercicio.erroresComunes.length).toBeGreaterThanOrEqual(2)
    expect(ejercicio.resumen.length).toBeGreaterThan(20)
  })

  it('los topes son de trabajo, no de resistencia', () => {
    // Ventanas larguísimas convierten la progresión en un test de aguante y
    // dejan a la gente meses en el mismo eslabón sintiendo que no avanza.
    for (const e of EJERCICIOS) {
      const techo = e.medida === 'segundos' ? 30 : 15
      expect(e.ventana.max, e.id).toBeLessThanOrEqual(techo)
    }
  })
})

describe('el vocabulario no promete lo que no puede', () => {
  const PROHIBIDAS = [
    'bdnf',
    'neuroplasticidad',
    'cortisol',
    'parasimpátic',
    'detox',
    'quema grasa',
    'tonifica',
    'sistema inmune',
    'coherencia cardíaca',
  ]

  it('ningún texto de la biblioteca afirma un mecanismo que no se pueda sostener', () => {
    for (const e of EJERCICIOS) {
      const texto = [e.resumen, ...e.tecnica, ...e.erroresComunes].join(' ').toLowerCase()
      for (const palabra of PROHIBIDAS) {
        expect(texto, `${e.id} dice "${palabra}"`).not.toContain(palabra)
      }
    }
  })
})
