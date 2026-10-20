/**
 * Lo que el alta y el motor no pueden abrir.
 *
 * Los casos salen de la revisión del 20 de octubre de 2026, que los midió con
 * el código real: 90 segundos de plancha ubicaban en "Elevación de piernas
 * colgado 3×5" y 120 en "Palanca frontal negativa 3×13 s", con barra o sin
 * ella e hicieras dominadas o no; y sin barra, el motor después subía igual a
 * las dominadas negativas y a las elevaciones colgado.
 */

import { describe, expect, it } from 'vitest'
import { POR_ID, REQUISITOS, cadenaDe } from './biblioteca'
import { NECESITAN_BARRA } from './musculos'
import {
  eslabonesCerrados,
  techoDeUbicacion,
  ubicarDesdeElAlta,
  ultimoSinBarra,
} from './apertura'
import {
  avanceInicial,
  logradoTipico,
  rendimientoDeSesion,
  siguienteAvance,
  ubicarEnCadena,
} from './progresion'
import type { Avance, Patron, Serie } from './tipos'

const core = cadenaDe('core')
const traccion = cadenaDe('traccion')

function avanceEn(patron: Patron, id: string, cantidad?: number): Avance {
  const e = POR_ID.get(id)
  if (!e) throw new Error(`falta ${id}`)
  return {
    patron,
    ejercicioId: id,
    objetivoActual: { series: e.series, cantidad: cantidad ?? e.ventana.min },
    senal: 1,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
    actualizadoEn: 0,
  }
}

/** Dónde ubica el alta a quien aguanta tantos segundos de plancha. */
function plancha(segundos: number, tieneBarra: boolean): Avance {
  const [avance] = ubicarDesdeElAlta(
    [{ patron: 'core', ejercicioId: 'plancha', logrado: segundos }],
    tieneBarra,
    0,
  )
  return avance!
}

const posicion = (cadena: typeof core, id: string) => cadena.ejercicios.indexOf(id)

describe('la plancha del alta no te ubica colgado', () => {
  const casos = [90, 120].flatMap((segundos) =>
    [true, false].map((barra) => [segundos, barra ? 'con barra' : 'sin barra', barra] as const),
  )

  it.each(casos)('%i s de plancha, %s: elevación de piernas en el suelo', (segundos, _, barra) => {
    const avance = plancha(segundos, barra)
    // El último eslabón del core que no cuelga de una barra.
    expect(avance.ejercicioId).toBe('elevacion-piernas-suelo')
    expect(NECESITAN_BARRA.has(avance.ejercicioId)).toBe(false)
    const e = POR_ID.get(avance.ejercicioId)!
    expect(avance.objetivoActual.cantidad).toBeGreaterThanOrEqual(e.ventana.min)
    expect(avance.objetivoActual.cantidad).toBeLessThanOrEqual(e.ventana.max)
  })

  it('la cuenta sola todavía ubicaría colgado: lo que lo impide es el techo', () => {
    // Si un día alguien saca el techo, este test dice qué vuelve a pasar.
    expect(ubicarEnCadena(core, POR_ID, 'plancha', 90, 0).ejercicioId).toBe(
      'elevacion-piernas-colgado',
    )
    expect(ubicarEnCadena(core, POR_ID, 'plancha', 120, 0).ejercicioId).toBe(
      'palanca-frontal-agrupada',
    )
  })

  it('con ningún número sube más allá del último eslabón que no cuelga', () => {
    const techo = posicion(core, 'elevacion-piernas-suelo')
    for (let segundos = 0; segundos <= 600; segundos += 5) {
      for (const barra of [true, false]) {
        const avance = plancha(segundos, barra)
        expect(posicion(core, avance.ejercicioId), `${segundos} s`).toBeLessThanOrEqual(techo)
      }
    }
  })

  it('por debajo del techo, la ubicación es la de siempre', () => {
    for (const segundos of [0, 10, 20, 30, 45, 60]) {
      expect(plancha(segundos, true), `${segundos} s`).toEqual(
        ubicarEnCadena(core, POR_ID, 'plancha', segundos, 0),
      )
    }
  })
})

describe('tracción en el alta', () => {
  it('con barra, las dominadas ubican como siempre: la prueba ya es colgado', () => {
    for (const n of [0, 1, 2, 3, 5, 8, 12, 20]) {
      const [avance] = ubicarDesdeElAlta(
        [{ patron: 'traccion', ejercicioId: 'dominada-completa', logrado: n }],
        true,
        0,
      )
      expect(avance, `${n} dominadas`).toEqual(
        ubicarEnCadena(traccion, POR_ID, 'dominada-completa', n, 0),
      )
    }
  })

  it('sin barra, ningún número de remos termina en un ejercicio colgado', () => {
    const techo = posicion(traccion, 'remo-australiano-pies-elevados')
    for (let n = 0; n <= 60; n++) {
      const [avance] = ubicarDesdeElAlta(
        [{ patron: 'traccion', ejercicioId: 'remo-australiano-bajo', logrado: n }],
        false,
        0,
      )
      expect(NECESITAN_BARRA.has(avance!.ejercicioId), `${n} remos`).toBe(false)
      expect(posicion(traccion, avance!.ejercicioId)).toBeLessThanOrEqual(techo)
    }
  })
})

describe('ubicarDesdeElAlta', () => {
  it('sin barra, ni las respuestas más altas de la regleta terminan colgadas', () => {
    const avances = ubicarDesdeElAlta(
      [
        { patron: 'empuje', ejercicioId: 'flexion-completa', logrado: 30 },
        { patron: 'traccion', ejercicioId: 'remo-australiano-bajo', logrado: 20 },
        { patron: 'piernas', ejercicioId: 'sentadilla-completa', logrado: 60 },
        { patron: 'core', ejercicioId: 'plancha', logrado: 120 },
      ],
      false,
      0,
    )
    expect(avances).toHaveLength(4)
    for (const avance of avances) {
      expect(NECESITAN_BARRA.has(avance.ejercicioId), avance.ejercicioId).toBe(false)
    }
  })

  it('a la palanca frontal no se entra desde el alta, ni con doce dominadas', () => {
    const avances = ubicarDesdeElAlta(
      [
        { patron: 'traccion', ejercicioId: 'dominada-completa', logrado: 12 },
        { patron: 'core', ejercicioId: 'plancha', logrado: 600 },
      ],
      true,
      0,
    )
    for (const avance of avances) {
      expect(REQUISITOS.has(avance.ejercicioId), avance.ejercicioId).toBe(false)
    }
  })
})

describe('techoDeUbicacion', () => {
  it('desde la plancha, el último eslabón del core que no cuelga, con barra o sin ella', () => {
    expect(techoDeUbicacion(core, 'plancha', true)).toBe('elevacion-piernas-suelo')
    expect(techoDeUbicacion(core, 'plancha', false)).toBe('elevacion-piernas-suelo')
  })

  it('las dominadas no tienen techo; el remo sin barra, el último remo', () => {
    expect(techoDeUbicacion(traccion, 'dominada-completa', true)).toBeUndefined()
    expect(techoDeUbicacion(traccion, 'remo-australiano-bajo', false)).toBe(
      'remo-australiano-pies-elevados',
    )
  })

  it('en las cadenas que no cuelgan no hay techo', () => {
    expect(techoDeUbicacion(cadenaDe('empuje'), 'flexion-completa', false)).toBeUndefined()
    expect(techoDeUbicacion(cadenaDe('piernas'), 'sentadilla-completa', false)).toBeUndefined()
  })
})

describe('ultimoSinBarra', () => {
  it('es donde se frena cada cadena sin barra', () => {
    expect(ultimoSinBarra(traccion)?.id).toBe('remo-australiano-pies-elevados')
    expect(ultimoSinBarra(core)?.id).toBe('elevacion-piernas-suelo')
  })

  it('las cadenas que no cuelgan no tienen dónde frenar', () => {
    for (const patron of ['empuje', 'piernas', 'bisagra'] as Patron[]) {
      expect(ultimoSinBarra(cadenaDe(patron)), patron).toBeNull()
    }
  })
})

describe('eslabonesCerrados', () => {
  const conTraccionEn = (id: string) => new Map<Patron, Avance>([['traccion', avanceEn('traccion', id)]])

  it('sin barra se cierra todo lo que cuelga, y el motivo es la barra', () => {
    for (const cadena of [core, traccion]) {
      // Aun con las dominadas completas en el avance: sin barra, que falten
      // dominadas no es lo que hay que decir.
      const cerrados = eslabonesCerrados(cadena, conTraccionEn('dominada-completa'), false)
      const colgados = cadena.ejercicios.filter((id) => NECESITAN_BARRA.has(id))
      expect([...cerrados.keys()].sort(), cadena.patron).toEqual([...colgados].sort())
      for (const cierre of cerrados.values()) expect(cierre.motivo).toBe('sin-barra')
    }
  })

  it('con barra y sin dominadas completas, la palanca frontal está cerrada', () => {
    for (const id of ['remo-australiano-alto', 'dominada-negativa', 'dominada-asistida-leve']) {
      const cerrados = eslabonesCerrados(core, conTraccionEn(id), true)
      expect([...cerrados.keys()].sort(), id).toEqual([
        'palanca-frontal-agrupada',
        'palanca-frontal-negativa',
      ])
      for (const cierre of cerrados.values()) {
        expect(cierre).toEqual({ motivo: 'requisito', requisito: POR_ID.get('dominada-completa') })
      }
    }
  })

  it('llegar a las dominadas completas la abre', () => {
    for (const id of ['dominada-completa', 'dominada-arquera', 'dominada-un-brazo-asistida']) {
      expect(eslabonesCerrados(core, conTraccionEn(id), true).size, id).toBe(0)
    }
  })

  it('sin avance de tracción no se da nada por alcanzado', () => {
    expect(eslabonesCerrados(core, new Map(), true).has('palanca-frontal-agrupada')).toBe(true)
  })

  it('las cadenas sin colgados ni requisitos no cierran nada', () => {
    for (const patron of ['empuje', 'piernas', 'bisagra'] as Patron[]) {
      expect(eslabonesCerrados(cadenaDe(patron), new Map(), false).size, patron).toBe(0)
    }
  })
})

describe('el motor, con los eslabones cerrados que calcula la app', () => {
  /**
   * Corre sesiones contra el motor real, recalculando los cierres en cada una
   * con los avances del momento, igual que `cerrarSesion`. `cuanto` dice qué
   * fracción del objetivo se hizo en cada sesión.
   */
  function entrenar(
    avances: Map<Patron, Avance>,
    patron: Patron,
    sesiones: number,
    tieneBarra: boolean,
    cuanto: (i: number) => number = () => 1,
  ) {
    const cadena = cadenaDe(patron)
    const recorrido: string[] = []
    const explicaciones: string[] = []
    for (let i = 0; i < sesiones; i++) {
      const avance = avances.get(patron)!
      const { series: n, cantidad } = avance.objetivoActual
      const hechas: Serie[] = Array.from({ length: n }, () => ({
        logrado: Math.max(1, Math.round(cantidad * cuanto(i))),
      }))
      const d = siguienteAvance(
        avance,
        {
          rendimiento: rendimientoDeSesion(avance.objetivoActual, hechas),
          tipico: logradoTipico(hechas),
        },
        { cadena, ejercicios: POR_ID, cerrados: eslabonesCerrados(cadena, avances, tieneBarra) },
        i,
      )
      avances.set(patron, d.avance)
      recorrido.push(d.avance.ejercicioId)
      explicaciones.push(d.explicacion)
    }
    return { recorrido, explicaciones }
  }

  /**
   * Una semana tipo con días flojos, fija para que el test sea repetible. Pasa
   * por subidas, sesiones que se sostienen, bajadas y cambios de eslabón.
   */
  const irregular = (i: number) => [1, 1, 1, 0.85, 0.9, 0.85, 0.9, 1, 1, 0.5, 1, 1][i % 12]!

  it.each(['core', 'traccion'] as Patron[])(
    'sin barra, cumpliendo todo en %s, nunca cae en un ejercicio colgado',
    (patron) => {
      const cadena = cadenaDe(patron)
      const avances = new Map<Patron, Avance>([[patron, avanceInicial(cadena, POR_ID, 0)]])
      const { recorrido, explicaciones } = entrenar(avances, patron, 400, false)
      expect(recorrido.filter((id) => NECESITAN_BARRA.has(id))).toEqual([])
      // Y llega hasta donde se puede llegar: el último eslabón sin barra.
      expect(recorrido.at(-1)).toBe(ultimoSinBarra(cadena)!.id)
      expect(explicaciones.at(-1)).toContain('necesita una barra')
    },
  )

  it.each(['core', 'traccion'] as Patron[])(
    'sin barra y con sesiones irregulares en %s, tampoco',
    (patron) => {
      const cadena = cadenaDe(patron)
      const desdeCero = () => new Map<Patron, Avance>([[patron, avanceInicial(cadena, POR_ID, 0)]])

      // El control: con barra, las mismas sesiones sí llegan a lo colgado. Sin
      // esto, el test pasaría igual con un recorrido que nunca sube.
      const conBarra = entrenar(desdeCero(), patron, 600, true, irregular).recorrido
      expect(conBarra.some((id) => NECESITAN_BARRA.has(id))).toBe(true)

      const sinBarra = entrenar(desdeCero(), patron, 600, false, irregular).recorrido
      expect(sinBarra.filter((id) => NECESITAN_BARRA.has(id))).toEqual([])
    },
  )

  it('con barra y sin dominadas completas, la palanca frontal no se abre nunca', () => {
    const avances = new Map<Patron, Avance>([
      ['traccion', avanceEn('traccion', 'dominada-asistida-leve')],
      ['core', avanceEn('core', 'elevacion-piernas-colgado')],
    ])
    const { recorrido, explicaciones } = entrenar(avances, 'core', 300, true)
    expect(recorrido.filter((id) => id.startsWith('palanca-frontal'))).toEqual([])
    expect(recorrido.at(-1)).toBe('elevacion-piernas-colgado')
    expect(explicaciones.at(-1)).toContain('Palanca frontal agrupada')
    expect(explicaciones.at(-1)).toContain('Dominadas completas')
  })

  it('con las dominadas completas se abre, y por la agrupada', () => {
    const avances = new Map<Patron, Avance>([
      ['traccion', avanceEn('traccion', 'dominada-completa')],
      ['core', avanceEn('core', 'elevacion-piernas-colgado')],
    ])
    const { recorrido } = entrenar(avances, 'core', 300, true)
    const primeraPalanca = recorrido.find((id) => id.startsWith('palanca-frontal'))
    expect(primeraPalanca).toBe('palanca-frontal-agrupada')
    expect(recorrido.at(-1)).toBe('palanca-frontal-negativa')
  })

  it('sin barra, el motivo es la barra aunque tenga las dominadas completas', () => {
    const avances = new Map<Patron, Avance>([
      ['traccion', avanceEn('traccion', 'dominada-completa')],
      ['core', avanceEn('core', 'elevacion-piernas-suelo', POR_ID.get('elevacion-piernas-suelo')!.ventana.max)],
    ])
    const { recorrido, explicaciones } = entrenar(avances, 'core', 40, false)
    expect(recorrido.filter((id) => NECESITAN_BARRA.has(id))).toEqual([])
    expect(explicaciones.at(-1)).toContain('necesita una barra')
    expect(explicaciones.at(-1)).toContain('Ajustes')
  })
})
