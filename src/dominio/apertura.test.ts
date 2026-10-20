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
  avisoDeBajada,
  avisosDeLaRevision,
  bajarDeLoColgado,
  bajarPorRequisito,
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
import type { Avance, Patron, RevisionDeRequisitos, Serie } from './tipos'

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

describe('bajarDeLoColgado', () => {
  // Lo que pasa al apagar "Tengo dónde colgarme": cerrar lo colgado frena las
  // subidas, pero alguien que ya estaba en las dominadas seguía en ellas.
  it.each([core, traccion].flatMap((c) => c.ejercicios.filter((id) => NECESITAN_BARRA.has(id))))(
    'desde %s baja al último eslabón que no cuelga',
    (id) => {
      const e = POR_ID.get(id)!
      const avance = { ...avanceEn(e.patron, id, e.ventana.max), senal: 0.9 }
      const abajo = bajarDeLoColgado(avance, 7)!
      const destino = ultimoSinBarra(cadenaDe(e.patron))!
      expect(abajo.ejercicioId).toBe(destino.id)
      expect(NECESITAN_BARRA.has(abajo.ejercicioId)).toBe(false)
      expect(abajo.objetivoActual.series).toBe(destino.series)
      expect(abajo.objetivoActual.cantidad).toBeGreaterThanOrEqual(destino.ventana.min)
      expect(abajo.objetivoActual.cantidad).toBeLessThanOrEqual(destino.ventana.max)
      expect(abajo.objetivoActual.kg).toBeUndefined()
      expect(abajo.senal).toBe(0.9)
      expect(abajo.actualizadoEn).toBe(7)
    },
  )

  it('lo que no cuelga se queda donde está', () => {
    for (const cadena of [core, traccion, cadenaDe('empuje')]) {
      for (const id of cadena.ejercicios.filter((x) => !NECESITAN_BARRA.has(x))) {
        expect(bajarDeLoColgado(avanceEn(cadena.patron, id), 0), id).toBeNull()
      }
    }
  })

  it('y desde ahí, sin barra, el motor no vuelve a subir a lo colgado', () => {
    const e = POR_ID.get('elevacion-rodillas-colgado')!
    const abajo = bajarDeLoColgado(avanceEn('core', e.id, e.ventana.max), 0)!
    let avance = abajo
    const avances = new Map<Patron, Avance>([['core', avance]])
    for (let i = 0; i < 60; i++) {
      const { series: n, cantidad } = avance.objetivoActual
      const hechas: Serie[] = Array.from({ length: n }, () => ({ logrado: cantidad }))
      avance = siguienteAvance(
        avance,
        { rendimiento: rendimientoDeSesion(avance.objetivoActual, hechas), tipico: cantidad },
        { cadena: core, ejercicios: POR_ID, cerrados: eslabonesCerrados(core, avances, false) },
        i,
      ).avance
      avances.set('core', avance)
      expect(NECESITAN_BARRA.has(avance.ejercicioId), `sesión ${i + 1}`).toBe(false)
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
        expect(cierre).toEqual({
          motivo: 'requisito',
          requisito: POR_ID.get('dominada-completa'),
          minimo: { series: 3, cantidad: 8 },
        })
      }
    }
  })

  /** Tracción en las dominadas completas, con este objetivo. */
  const enDominadas = (series: number, cantidad: number) =>
    new Map<Patron, Avance>([
      ['traccion', { ...avanceEn('traccion', 'dominada-completa'), objetivoActual: { series, cantidad } }],
    ])

  it('llegar a las dominadas completas no alcanza: se entra con 3 por serie', () => {
    // Era la regla vieja: llegar abría la palanca, con 3×3.
    const dominada = POR_ID.get('dominada-completa')!
    for (let cantidad = dominada.ventana.min; cantidad < 8; cantidad++) {
      const cerrados = eslabonesCerrados(core, enDominadas(3, cantidad), true)
      expect([...cerrados.keys()].sort(), `3×${cantidad}`).toEqual([
        'palanca-frontal-agrupada',
        'palanca-frontal-negativa',
      ])
    }
  })

  it('la abre un objetivo de 3 series de 8 dominadas completas, o más', () => {
    const dominada = POR_ID.get('dominada-completa')!
    for (let cantidad = 8; cantidad <= dominada.ventana.max; cantidad++) {
      expect(eslabonesCerrados(core, enDominadas(3, cantidad), true).size, `3×${cantidad}`).toBe(0)
    }
  })

  it('son 3 series: dos de diez no alcanzan', () => {
    expect(eslabonesCerrados(core, enDominadas(2, 10), true).has('palanca-frontal-agrupada')).toBe(
      true,
    )
  })

  it('pasadas las dominadas completas, abierta sin mirar el objetivo', () => {
    for (const id of ['dominada-arquera', 'dominada-un-brazo-asistida']) {
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
    expect(explicaciones.at(-1)).toContain('se abre cuando llegues a 3 series de 8 dominadas completas')
  })

  it('en las dominadas completas con 3 por serie, tampoco: es donde la regla vieja la abría', () => {
    const avances = new Map<Patron, Avance>([
      ['traccion', avanceEn('traccion', 'dominada-completa', 3)],
      ['core', avanceEn('core', 'elevacion-piernas-colgado')],
    ])
    const { recorrido, explicaciones } = entrenar(avances, 'core', 300, true)
    expect(recorrido.filter((id) => id.startsWith('palanca-frontal'))).toEqual([])
    expect(explicaciones.at(-1)).toContain('3 series de 8 dominadas completas')
  })

  it('con 3 series de 8 dominadas completas se abre, y por la agrupada', () => {
    const avances = new Map<Patron, Avance>([
      ['traccion', avanceEn('traccion', 'dominada-completa', 8)],
      ['core', avanceEn('core', 'elevacion-piernas-colgado')],
    ])
    const { recorrido } = entrenar(avances, 'core', 300, true)
    const primeraPalanca = recorrido.find((id) => id.startsWith('palanca-frontal'))
    expect(primeraPalanca).toBe('palanca-frontal-agrupada')
    expect(recorrido.at(-1)).toBe('palanca-frontal-negativa')
  })

  it('entrenando las dos cadenas, el core espera a que las dominadas lleguen a 3×8', () => {
    // Las dos a la vez, como en una sesión de verdad: los cierres de cada
    // sesión salen de los avances de ANTES de esa sesión, igual que en
    // `cerrarSesion`. El core llega primero al techo y se queda sumando; la
    // palanca se abre recién en la sesión siguiente a que el objetivo de
    // dominadas pida 3 series de 8.
    const avances = new Map<Patron, Avance>([
      ['traccion', avanceEn('traccion', 'dominada-completa', 3)],
      [
        'core',
        avanceEn('core', 'elevacion-piernas-colgado', POR_ID.get('elevacion-piernas-colgado')!.ventana.max),
      ],
    ])
    let abrio: { sesion: number; traccion: Avance } | null = null
    for (let i = 0; i < 200 && !abrio; i++) {
      const antes = new Map(avances)
      for (const patron of ['traccion', 'core'] as Patron[]) {
        const cadena = cadenaDe(patron)
        const avance = antes.get(patron)!
        const { series: n, cantidad } = avance.objetivoActual
        const hechas: Serie[] = Array.from({ length: n }, () => ({ logrado: cantidad }))
        const d = siguienteAvance(
          avance,
          { rendimiento: rendimientoDeSesion(avance.objetivoActual, hechas), tipico: logradoTipico(hechas) },
          { cadena, ejercicios: POR_ID, cerrados: eslabonesCerrados(cadena, antes, true) },
          i,
        )
        avances.set(patron, d.avance)
      }
      if (avances.get('core')!.ejercicioId.startsWith('palanca-frontal')) {
        abrio = { sesion: i, traccion: antes.get('traccion')! }
      }
    }
    expect(abrio, 'la palanca no se abrió nunca').not.toBeNull()
    expect(abrio!.sesion).toBeGreaterThan(0)
    expect(avances.get('core')!.ejercicioId).toBe('palanca-frontal-agrupada')
    // Lo que tenía tracción en la sesión en que se abrió: 3×8, o más arriba.
    const { traccion } = abrio!
    const enCompleta = traccion.ejercicioId === 'dominada-completa'
    expect(traccion.ejercicioId === 'dominada-arquera' || enCompleta).toBe(true)
    if (enCompleta) {
      expect(traccion.objetivoActual.series).toBeGreaterThanOrEqual(3)
      expect(traccion.objetivoActual.cantidad).toBeGreaterThanOrEqual(8)
    }
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

describe('bajarPorRequisito', () => {
  // La revisión única: quien quedó en la palanca frontal con la regla vieja
  // —el alta lo ponía ahí con 120 s de plancha y cero dominadas, o el motor
  // al llegar a las dominadas completas con 3 por serie— baja una vez.
  const conTraccion = (traccion: Avance, coreEn: string, cantidad?: number) =>
    new Map<Patron, Avance>([
      ['traccion', traccion],
      ['core', { ...avanceEn('core', coreEn, cantidad), senal: 0.93 }],
    ])
  const enCompleta = (cantidad: number) => avanceEn('traccion', 'dominada-completa', cantidad)

  it.each(['palanca-frontal-agrupada', 'palanca-frontal-negativa'])(
    'con barra y sin las 3×8, desde %s baja a la elevación de piernas colgado',
    (id) => {
      const avances = conTraccion(enCompleta(5), id, 13)
      const { avances: abajo, bajadas } = bajarPorRequisito(avances, true, 42)
      expect(bajadas).toEqual([{ patron: 'core', desde: id, hasta: 'elevacion-piernas-colgado' }])
      expect(abajo).toHaveLength(1)
      const [nuevo] = abajo
      const destino = POR_ID.get('elevacion-piernas-colgado')!
      // La carga, recalculada como en cualquier cambio de eslabón: de segundos
      // a repeticiones no hay cuenta posible, así que entra por el piso.
      expect(nuevo).toEqual({
        patron: 'core',
        ejercicioId: destino.id,
        objetivoActual: { series: destino.series, cantidad: destino.ventana.min },
        senal: 0.93,
        sesionesEnObjetivo: 0,
        graciaRestante: 0,
        actualizadoEn: 42,
      })
      // Y queda en un eslabón abierto: el motor puede seguir desde ahí.
      expect(eslabonesCerrados(core, avances, true).has(nuevo!.ejercicioId)).toBe(false)
    },
  )

  it.each(['palanca-frontal-agrupada', 'palanca-frontal-negativa'])(
    'sin barra y sin las 3×8, desde %s baja a lo último que no cuelga',
    (id) => {
      const { avances: abajo, bajadas } = bajarPorRequisito(
        conTraccion(avanceEn('traccion', 'remo-australiano-pies-elevados'), id),
        false,
        0,
      )
      expect(bajadas).toEqual([{ patron: 'core', desde: id, hasta: 'elevacion-piernas-suelo' }])
      expect(NECESITAN_BARRA.has(abajo[0]!.ejercicioId)).toBe(false)
    },
  )

  it('el caso de la revisión: alta con 120 s de plancha y cero dominadas', () => {
    // Lo que la app real guardaba: tracción en el primer eslabón y core en la
    // palanca frontal negativa, 3×13 s.
    const avances = new Map<Patron, Avance>([
      ['traccion', avanceInicial(traccion, POR_ID, 0)],
      ['core', avanceEn('core', 'palanca-frontal-negativa', 13)],
    ])
    expect(bajarPorRequisito(avances, true, 0).bajadas[0]?.hasta).toBe('elevacion-piernas-colgado')
    expect(bajarPorRequisito(avances, false, 0).bajadas[0]?.hasta).toBe('elevacion-piernas-suelo')
  })

  it('sin avance de tracción no se da nada por cumplido', () => {
    const avances = new Map<Patron, Avance>([['core', avanceEn('core', 'palanca-frontal-agrupada')]])
    expect(bajarPorRequisito(avances, true, 0).bajadas).toHaveLength(1)
  })

  it('con la palanca abierta no toca a nadie', () => {
    for (const traccion of [
      enCompleta(8),
      enCompleta(10),
      avanceEn('traccion', 'dominada-arquera'),
      avanceEn('traccion', 'dominada-un-brazo-asistida'),
    ]) {
      for (const id of ['palanca-frontal-agrupada', 'palanca-frontal-negativa']) {
        const resultado = bajarPorRequisito(conTraccion(traccion, id), true, 0)
        expect(resultado, `${traccion.ejercicioId} ${traccion.objetivoActual.cantidad}, ${id}`).toEqual({
          avances: [],
          bajadas: [],
        })
      }
    }
  })

  it('quien cumple las dominadas no baja aunque no tenga barra: eso es cosa del interruptor', () => {
    const avances = conTraccion(avanceEn('traccion', 'dominada-arquera'), 'palanca-frontal-agrupada')
    expect(bajarPorRequisito(avances, false, 0).avances).toEqual([])
  })

  it('solo mira los eslabones con requisito', () => {
    for (const id of core.ejercicios.filter((x) => !REQUISITOS.has(x))) {
      for (const barra of [true, false]) {
        expect(bajarPorRequisito(conTraccion(enCompleta(3), id), barra, 0).avances, id).toEqual([])
      }
    }
  })

  it('es idempotente: lo que baja ya no está en un eslabón cerrado', () => {
    for (const barra of [true, false]) {
      const avances = conTraccion(enCompleta(3), 'palanca-frontal-negativa')
      const primera = bajarPorRequisito(avances, barra, 0)
      for (const avance of primera.avances) avances.set(avance.patron, avance)
      expect(bajarPorRequisito(avances, barra, 0)).toEqual({ avances: [], bajadas: [] })
    }
  })

  it('y no toca la tracción: el requisito se mira, no se mueve', () => {
    const traccionAntes = enCompleta(4)
    const { avances } = bajarPorRequisito(conTraccion(traccionAntes, 'palanca-frontal-agrupada'), true, 0)
    expect(avances.map((a) => a.patron)).toEqual(['core'])
  })
})

describe('el aviso de la bajada', () => {
  const bajada = (hasta: string) => ({
    patron: 'core' as const,
    desde: 'palanca-frontal-agrupada',
    hasta,
  })

  it('dice adónde bajó, qué lo vuelve a abrir y por qué, en una línea', () => {
    expect(avisoDeBajada(bajada('elevacion-piernas-colgado'), true)).toBe(
      'Bajamos core a elevación de piernas colgado hasta que llegues a 3 series de 8 dominadas completas: así se cuida el codo.',
    )
  })

  it('sin barra, suma la barra a lo que falta', () => {
    expect(avisoDeBajada(bajada('elevacion-piernas-suelo'), false)).toBe(
      'Bajamos core a elevación de piernas en el suelo hasta que tengas una barra y llegues a 3 series de 8 dominadas completas: así se cuida el codo.',
    )
  })

  it('es una sola frase, corta, y no le reprocha nada a nadie', () => {
    for (const [hasta, barra] of [
      ['elevacion-piernas-colgado', true],
      ['elevacion-piernas-suelo', false],
    ] as const) {
      const aviso = avisoDeBajada(bajada(hasta), barra)!
      expect(aviso.endsWith('.')).toBe(true)
      expect(aviso.slice(0, -1)).not.toContain('.')
      expect(aviso.length).toBeLessThanOrEqual(150)
      expect(aviso).not.toMatch(/deber[ií]as|tendr[ií]as|error|culpa|mal|no pod[eé]s/i)
    }
  })

  it('con eslabones que ya no existen no inventa nada', () => {
    expect(avisoDeBajada({ patron: 'core', desde: 'no-existe', hasta: 'plancha' }, true)).toBeNull()
    expect(
      avisoDeBajada({ patron: 'core', desde: 'palanca-frontal-agrupada', hasta: 'no-existe' }, true),
    ).toBeNull()
  })
})

describe('avisosDeLaRevision', () => {
  const revision: RevisionDeRequisitos = {
    en: 1000,
    bajadas: [{ patron: 'core', desde: 'palanca-frontal-negativa', hasta: 'elevacion-piernas-colgado' }],
  }

  it('sin revisión, o sin nada bajado, no hay nada que decir', () => {
    expect(avisosDeLaRevision(undefined, [], true)).toEqual([])
    expect(avisosDeLaRevision({ en: 1000, bajadas: [] }, [], true)).toEqual([])
  })

  it('se dice hasta la próxima sesión cerrada', () => {
    const aviso = avisoDeBajada(revision.bajadas[0]!, true)
    expect(avisosDeLaRevision(revision, [], true)).toEqual([aviso])
    // Las sesiones de antes de la revisión no cuentan.
    expect(avisosDeLaRevision(revision, [{ finalizadaEn: 999 }], true)).toEqual([aviso])
    expect(avisosDeLaRevision(revision, [{ finalizadaEn: 999 }, { finalizadaEn: 1001 }], true)).toEqual(
      [],
    )
  })

  it('el texto sigue a la barra de ahora, no a la del día de la revisión', () => {
    expect(avisosDeLaRevision(revision, [], false)[0]).toContain('hasta que tengas una barra')
  })
})
