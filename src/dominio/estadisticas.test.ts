import { describe, expect, it } from 'vitest'
import {
  curvaDeFuerza,
  fuerzaPorSemana,
  haceCuanto,
  historicoDeEjercicio,
  laVezPasada,
  lunesDe,
  porSemana,
  recordDe,
  repeticionesDeSesion,
  segundosDeSesion,
  seriesDeSesion,
  seriesPorPatron,
  totales,
  ultimasSemanas,
} from './estadisticas'
import { POR_ID } from './biblioteca'
import type { Ejercicio, RegistroEjercicio, Sesion } from './tipos'

function sesion(fecha: string, ejercicioId: string, logros: number[]): Sesion {
  return {
    id: `${fecha}-${ejercicioId}`,
    fecha,
    finalizadaEn: new Date(`${fecha}T18:00:00`).getTime(),
    duracionSegundos: 1800,
    tipo: 'plan',
    registros: [
      {
        ejercicioId,
        objetivo: { series: logros.length, cantidad: logros[0] ?? 0 },
        series: logros.map((logrado) => ({ logrado })),
      },
    ],
  }
}

describe('conteos por sesión', () => {
  it('cuenta series, que es la unidad comparable', () => {
    expect(seriesDeSesion(sesion('2026-09-02', 'flexion-completa', [10, 9, 8]))).toBe(3)
  })

  it('no mezcla repeticiones con segundos', () => {
    // Antes las sumaba juntas y el resultado no significaba nada.
    const flexiones = sesion('2026-09-02', 'flexion-completa', [10, 10])
    const plancha = sesion('2026-09-02', 'plancha', [30, 30])

    expect(repeticionesDeSesion(flexiones)).toBe(20)
    expect(segundosDeSesion(flexiones)).toBe(0)
    expect(repeticionesDeSesion(plancha)).toBe(0)
    expect(segundosDeSesion(plancha)).toBe(60)
  })

  it('reparte las series según el patrón de cada ejercicio', () => {
    const s = sesion('2026-09-02', 'flexion-completa', [10, 10, 10])
    expect(seriesPorPatron(s)).toEqual({ empuje: 3, traccion: 0, piernas: 0, core: 0, bisagra: 0 })
  })

  it('ignora ejercicios que no están en la biblioteca', () => {
    const s = sesion('2026-09-02', 'inventado', [10])
    expect(seriesPorPatron(s).empuje).toBe(0)
    expect(repeticionesDeSesion(s)).toBe(0)
  })
})

describe('agrupación semanal', () => {
  it('encuentra el lunes de cualquier día', () => {
    expect(lunesDe('2026-09-06')).toBe('2026-08-31') // domingo
    expect(lunesDe('2026-08-31')).toBe('2026-08-31') // lunes
    expect(lunesDe('2026-09-02')).toBe('2026-08-31') // miércoles
  })

  it('siempre devuelve un lunes, en cualquier huso horario', () => {
    // La versión anterior formateaba con toISOString(), que convierte a UTC:
    // al este de Greenwich la medianoche local cae el día anterior y el lunes
    // salía domingo. Se recorre un año entero para que ninguna combinación de
    // huso y horario de verano se escape.
    const dia = new Date('2026-01-01T00:00:00')
    for (let i = 0; i < 365; i++) {
      const fecha = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
      const lunes = lunesDe(fecha)
      expect(new Date(`${lunes}T00:00:00`).getDay(), `${fecha} → ${lunes}`).toBe(1)
      dia.setDate(dia.getDate() + 1)
    }
  })

  it('agrupa las sesiones por semana y las ordena', () => {
    const semanas = porSemana([
      sesion('2026-09-02', 'flexion-completa', [10, 10]),
      sesion('2026-08-26', 'flexion-completa', [8]),
      sesion('2026-09-04', 'flexion-completa', [10]),
    ])

    expect(semanas.map((s) => s.semana)).toEqual(['2026-08-24', '2026-08-31'])
    expect(semanas[1]!.sesiones).toBe(2)
    expect(semanas[1]!.series).toBe(3)
  })
})

describe('histórico y récords', () => {
  const historial = [
    sesion('2026-09-01', 'flexion-completa', [8, 7]),
    sesion('2026-09-03', 'flexion-completa', [10, 9]),
    sesion('2026-09-05', 'dominada-completa', [4]),
  ]

  it('devuelve los puntos ordenados por fecha', () => {
    const puntos = historicoDeEjercicio(historial, 'flexion-completa')
    expect(puntos.map((p) => p.fecha)).toEqual(['2026-09-01', '2026-09-03'])
    expect(puntos[1]!.mejor).toBe(10)
    expect(puntos[1]!.series).toBe(2)
  })

  it('el récord es la mejor serie de todo el historial', () => {
    expect(recordDe(historial, 'flexion-completa')).toBe(10)
    expect(recordDe(historial, 'plancha')).toBe(0)
  })
})

describe('curva de fuerza', () => {
  it('sube al cambiar a un ejercicio más difícil, en vez de desplomarse', () => {
    // Es la propiedad que justifica el índice de carga: quince flexiones de
    // rodillas y seis completas son estados de fuerza parecidos, pero el
    // registro crudo de repeticiones muestra una caída del sesenta por ciento.
    const curva = curvaDeFuerza(
      [
        sesion('2026-09-01', 'flexion-rodillas', [15, 15, 15]),
        sesion('2026-09-03', 'flexion-completa', [6, 6, 6]),
        sesion('2026-09-05', 'flexion-completa', [9, 9, 8]),
      ],
      'empuje',
    )

    expect(curva).toHaveLength(3)
    expect(curva[1]!.carga).toBeGreaterThanOrEqual(curva[0]!.carga * 0.9)
    expect(curva[2]!.carga).toBeGreaterThan(curva[1]!.carga)
  })

  it('se queda con la mejor carga del día y solo mira su patrón', () => {
    const curva = curvaDeFuerza(
      [
        {
          ...sesion('2026-09-01', 'flexion-completa', [6]),
          registros: [
            ...sesion('2026-09-01', 'flexion-completa', [6]).registros,
            ...sesion('2026-09-01', 'flexion-diamante', [8]).registros,
            ...sesion('2026-09-01', 'dominada-completa', [5]).registros,
          ],
        },
      ],
      'empuje',
    )

    expect(curva).toHaveLength(1)
    expect(curva[0]!.ejercicioId).toBe('flexion-diamante')
  })
})

describe('las semanas de Progreso', () => {
  it('son los lunes de las últimas doce, de la más vieja a la de hoy', () => {
    const semanas = ultimasSemanas('2026-10-21', 12)
    expect(semanas).toHaveLength(12)
    expect(semanas[0]).toBe('2026-08-03')
    expect(semanas[11]).toBe('2026-10-19')
  })

  it('arrancan en la semana de la primera sesión si es más nueva', () => {
    expect(ultimasSemanas('2026-10-21', 12, '2026-10-08')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
    expect(ultimasSemanas('2026-10-21', 12, '2026-10-20')).toEqual(['2026-10-19'])
  })

  it('traen la semana de hoy aunque la primera sesión tenga una fecha más nueva', () => {
    // El reloj adelantado, o la primera sesión el lunes en Sídney y Progreso
    // abierto el domingo en Buenos Aires: sin esta semana no habría eje.
    expect(ultimasSemanas('2026-10-18', 12, '2026-10-19')).toEqual(['2026-10-12'])
  })

  it('no se corren con el cambio de hora', () => {
    // En Sídney la hora cambia el domingo 4 de octubre de 2026; el CI corre
    // también con TZ=Australia/Sydney.
    expect(ultimasSemanas('2026-10-07', 3)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05'])
  })
})

describe('fuerza por semana', () => {
  const semanas = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']

  it('se queda con la mejor marca de cada semana y deja vacías las que no entrenaste', () => {
    const fuerza = fuerzaPorSemana(
      [
        sesion('2026-09-08', 'flexion-completa', [6, 6, 6]),
        sesion('2026-09-10', 'flexion-completa', [9, 8, 8]),
        // Después de la mejor y más baja: si ganara la última, la semana
        // daría 5 y no 9.
        sesion('2026-09-11', 'flexion-completa', [5, 5, 5]),
        sesion('2026-09-29', 'flexion-completa', [10, 9, 9]),
      ],
      'empuje',
      semanas,
    )
    const curva = curvaDeFuerza([sesion('2026-09-10', 'flexion-completa', [9, 8, 8])], 'empuje')
    expect(fuerza).toHaveLength(4)
    expect(fuerza[0]!.carga).toBe(curva[0]!.carga)
    expect(fuerza[1]).toBeNull()
    expect(fuerza[2]).toBeNull()
    expect(fuerza[3]!.carga).toBeGreaterThan(fuerza[0]!.carga)
  })

  it('el domingo es de la semana del lunes anterior', () => {
    const fuerza = fuerzaPorSemana([sesion('2026-09-20', 'flexion-completa', [8])], 'empuje', semanas)
    expect(fuerza.map((f) => f?.semana ?? null)).toEqual([null, '2026-09-14', null, null])
  })

  it('dice el ejercicio de cada semana, que es de donde sale la marca del eslabón nuevo', () => {
    const fuerza = fuerzaPorSemana(
      [
        sesion('2026-09-08', 'flexion-rodillas', [15, 15, 15]),
        sesion('2026-09-15', 'flexion-completa', [6, 6, 6]),
      ],
      'empuje',
      semanas,
    )
    expect(fuerza[0]!.ejercicioId).toBe('flexion-rodillas')
    expect(fuerza[1]!.ejercicioId).toBe('flexion-completa')
  })

  it('y si el eslabón nuevo se mide distinto, también se ve', () => {
    const fuerza = fuerzaPorSemana(
      [
        sesion('2026-09-08', 'remo-australiano-pies-elevados', [12, 12, 12]),
        sesion('2026-09-15', 'dominada-negativa', [8, 8, 8]),
      ],
      'traccion',
      semanas,
    )
    const [antes, despues] = [fuerza[0]!, fuerza[1]!]
    expect(POR_ID.get(antes.ejercicioId)!.medida).toBe('repeticiones')
    expect(POR_ID.get(despues.ejercicioId)!.medida).toBe('segundos')
  })

  it('el cambio de eslabón cae en la semana en que pasó, aunque el viejo tenga la mejor marca', () => {
    // El lunes, remo con pies elevados en su techo; el jueves, el primer día
    // de dominadas negativas, que en esta escala arrancan más abajo.
    const fuerza = fuerzaPorSemana(
      [
        sesion('2026-09-07', 'remo-australiano-pies-elevados', [12, 12, 12]),
        sesion('2026-09-10', 'dominada-negativa', [8, 8, 8]),
        sesion('2026-09-14', 'dominada-negativa', [9, 9, 9]),
      ],
      'traccion',
      semanas,
    )
    const remo = curvaDeFuerza([sesion('2026-09-07', 'remo-australiano-pies-elevados', [12])], 'traccion')[0]!
    expect(fuerza[0]!.ejercicioId).toBe('remo-australiano-pies-elevados')
    expect(fuerza[0]!.cambio).toEqual({
      de: 'remo-australiano-pies-elevados',
      cargaAntes: remo.carga,
      a: 'dominada-negativa',
    })
    expect(fuerza[1]!.cambio).toBeUndefined()
  })

  it('mira el día anterior aunque caiga antes de las semanas del eje', () => {
    const fuerza = fuerzaPorSemana(
      [sesion('2026-09-01', 'flexion-rodillas', [15, 15, 15]), sesion('2026-09-08', 'flexion-completa', [6, 6, 6])],
      'empuje',
      semanas,
    )
    expect(fuerza[0]!.cambio?.de).toBe('flexion-rodillas')
  })

  it('ir y volver en la misma semana no es un cambio', () => {
    const fuerza = fuerzaPorSemana(
      [
        sesion('2026-09-08', 'flexion-completa', [12, 12, 12]),
        sesion('2026-09-09', 'flexion-diamante', [5, 5, 5]),
        sesion('2026-09-11', 'flexion-completa', [10, 10, 10]),
      ],
      'empuje',
      semanas,
    )
    expect(fuerza[0]!.cambio).toBeUndefined()
  })

  it('con el peso corporal, los discos cuentan y gana la mejor serie, no la de más repeticiones', () => {
    const conDiscos: Sesion = {
      ...sesion('2026-09-08', 'flexion-completa', [12]),
      registros: [
        {
          ejercicioId: 'flexion-completa',
          objetivo: { series: 2, cantidad: 8, kg: 10 },
          series: [{ logrado: 9 }, { logrado: 8, kg: 10 }],
        },
      ],
    }
    const sinPeso = fuerzaPorSemana([conDiscos], 'empuje', semanas)[0]!
    const conPeso = fuerzaPorSemana([conDiscos], 'empuje', semanas, 75)[0]!
    // Sin peso corporal no hay cómo pasar kilos a la escala: gana la de 9.
    expect(sinPeso.conDiscos).toBe(false)
    // Con 75 kg, 8 con 10 kg le gana a 9 sin peso.
    expect(conPeso.conDiscos).toBe(true)
    expect(conPeso.carga).toBeGreaterThan(sinPeso.carga)
  })

  it('los discos caen en la semana en que entraron, aunque la mejor marca sea la de sin peso', () => {
    // El lunes, flexiones a una mano en su techo sin peso; el miércoles y el
    // viernes, los primeros días con discos.
    const conDiscos = (fecha: string, logros: number[]): Sesion => ({
      ...sesion(fecha, 'flexion-una-mano', logros),
      registros: [
        {
          ejercicioId: 'flexion-una-mano',
          objetivo: { series: logros.length, cantidad: logros[0] ?? 0, kg: 2.5 },
          series: logros.map((logrado) => ({ logrado, kg: 2.5 })),
        },
      ],
    })
    const lunes = sesion('2026-09-14', 'flexion-una-mano', [12, 12, 12])
    const fuerza = fuerzaPorSemana(
      [lunes, conDiscos('2026-09-16', [3, 3, 2]), conDiscos('2026-09-18', [3, 3, 3]), conDiscos('2026-09-21', [4, 3, 3])],
      'empuje',
      semanas,
      75,
    )
    const sinPeso = curvaDeFuerza([lunes], 'empuje', 75)[0]!
    const primerDia = curvaDeFuerza([conDiscos('2026-09-16', [3, 3, 2])], 'empuje', 75)[0]!
    expect(fuerza[1]!.conDiscos).toBe(false)
    expect(fuerza[1]!.discos).toEqual({
      desde: '2026-09-16',
      ejercicioId: 'flexion-una-mano',
      cargaAntes: sinPeso.carga,
      carga: primerDia.carga,
    })
    expect(primerDia.carga).toBeLessThan(sinPeso.carga)
    // La semana siguiente ya es toda con discos: no hay nada que entre.
    expect(fuerza[2]!.conDiscos).toBe(true)
    expect(fuerza[2]!.discos).toBeUndefined()
  })

  it('y entran el primer día con alguna serie con discos, aunque la mejor de ese día sea sin peso', () => {
    // Entrenar deja sumar peso en medio de la sesión: el miércoles, la
    // primera serie sin peso y las otras dos con discos.
    const mixto: Sesion = {
      ...sesion('2026-09-16', 'flexion-una-mano', [6]),
      registros: [
        {
          ejercicioId: 'flexion-una-mano',
          objetivo: { series: 3, cantidad: 6 },
          series: [{ logrado: 6 }, { logrado: 3, kg: 2.5 }, { logrado: 3, kg: 2.5 }],
        },
      ],
    }
    const fuerza = fuerzaPorSemana([sesion('2026-09-14', 'flexion-una-mano', [6, 6, 6]), mixto], 'empuje', semanas, 75)
    expect(fuerza[1]!.conDiscos).toBe(false)
    expect(fuerza[1]!.discos?.desde).toBe('2026-09-16')
    expect(fuerza[1]!.discos!.carga).toBeLessThan(fuerza[1]!.discos!.cargaAntes)
  })

  it('una cadena que no se entrenó da todas vacías', () => {
    expect(fuerzaPorSemana([sesion('2026-09-08', 'plancha', [30])], 'empuje', semanas)).toEqual([
      null,
      null,
      null,
      null,
    ])
  })
})

describe('totales', () => {
  it('resume el historial completo sin mezclar unidades', () => {
    const t = totales([
      sesion('2026-09-01', 'flexion-completa', [10, 10]),
      sesion('2026-09-03', 'plancha', [30]),
    ])

    expect(t.sesiones).toBe(2)
    expect(t.series).toBe(3)
    expect(t.repeticiones).toBe(20)
    expect(t.segundos).toBe(30)
    expect(t.minutos).toBe(60)
  })
})

describe('la vez pasada', () => {
  const conEjercicio = (fecha: string, id: string, logros: number[], cantidad = 10): Sesion => ({
    id: fecha + id,
    fecha,
    finalizadaEn: 0,
    duracionSegundos: 600,
    tipo: 'plan',
    registros: [
      {
        ejercicioId: id,
        objetivo: { series: logros.length, cantidad },
        series: logros.map((logrado) => ({ logrado })),
      },
    ],
  })

  it('encuentra la última vez, no la primera', () => {
    const historial = [
      conEjercicio('2026-01-05', 'flexion-completa', [5, 5, 4]),
      conEjercicio('2026-01-12', 'flexion-completa', [8, 8, 7]),
      conEjercicio('2026-01-09', 'flexion-completa', [6, 6, 6]),
    ]
    const vez = laVezPasada(historial, 'flexion-completa', '2026-01-15')
    expect(vez?.fecha).toBe('2026-01-12')
    expect(vez?.logros).toEqual([8, 8, 7])
    expect(vez?.mejor).toBe(8)
    expect(vez?.hace).toBe(3)
  })

  it('la primera vez no inventa una vara', () => {
    expect(laVezPasada([], 'flexion-completa', '2026-01-15')).toBeNull()
    expect(
      laVezPasada(
        [conEjercicio('2026-01-05', 'dominada-australiana', [5, 5])],
        'flexion-completa',
        '2026-01-15',
      ),
    ).toBeNull()
  })

  it('ignora las series en cero: no son una vara, son una sesión abandonada', () => {
    const historial = [
      conEjercicio('2026-01-05', 'flexion-completa', [7, 7, 7]),
      conEjercicio('2026-01-12', 'flexion-completa', [0, 0, 0]),
    ]
    const vez = laVezPasada(historial, 'flexion-completa', '2026-01-15')
    expect(vez?.fecha).toBe('2026-01-05')
  })

  it('conserva el objetivo de ese día, para saber si lo cumplió', () => {
    const vez = laVezPasada(
      [conEjercicio('2026-01-12', 'flexion-completa', [8, 8, 7], 8)],
      'flexion-completa',
      '2026-01-15',
    )
    expect(vez?.objetivo).toEqual({ series: 3, cantidad: 8 })
  })
})

describe('haceCuanto', () => {
  it('habla como habla alguien, no como un reloj', () => {
    expect(haceCuanto(0)).toBe('hoy')
    expect(haceCuanto(1)).toBe('ayer')
    expect(haceCuanto(3)).toBe('hace 3 días')
    expect(haceCuanto(8)).toBe('hace una semana')
    expect(haceCuanto(21)).toBe('hace 3 semanas')
    expect(haceCuanto(45)).toBe('hace un mes')
    expect(haceCuanto(90)).toBe('hace 3 meses')
  })
})

/**
 * La serie de cierre y las estadísticas.
 *
 * Se hace al final, al sesenta por ciento del ejercicio más fácil, y la app la
 * anota con el número propuesto sin preguntar: nunca se midió. El motor ya la
 * ignoraba para decidir; faltaba que la ignoraran las estadísticas que dicen
 * cuánto podés hacer.
 *
 * El caso de abajo es el peor y no es raro: alguien pidió quince y logró
 * 4-3-3. La serie de cierre le pide 9. Sin filtrar, esa persona ve "tu mejor
 * serie: 9" y a la sesión siguiente un "antes 9" en Hoy — una vara que nunca
 * hizo, puesta justo el día que la está pasando mal.
 */
describe('la serie de cierre no cuenta como capacidad, pero sí como trabajo', () => {
  const malDia: Sesion = {
    id: 'mal',
    fecha: '2026-09-01',
    finalizadaEn: 1,
    duracionSegundos: 600,
    tipo: 'plan',
    registros: [
      {
        ejercicioId: 'flexion-inclinada-alta',
        objetivo: { series: 3, cantidad: 15 },
        series: [{ logrado: 4 }, { logrado: 3 }, { logrado: 3 }, { logrado: 9, cierre: true }],
      },
    ],
  }

  it('no inventa un récord', () => {
    expect(recordDe([malDia], 'flexion-inclinada-alta')).toBe(4)
  })

  it('no se convierte en la vara de la vez pasada', () => {
    const vez = laVezPasada([malDia], 'flexion-inclinada-alta', '2026-09-03')
    expect(vez?.mejor).toBe(4)
    expect(vez?.logros).toEqual([4, 3, 3])
  })

  it('no infla el histórico del ejercicio', () => {
    const [punto] = historicoDeEjercicio([malDia], 'flexion-inclinada-alta')
    expect(punto?.mejor).toBe(4)
    expect(punto?.series).toBe(3)
  })

  it('no infla la curva de fuerza', () => {
    const conCierre = curvaDeFuerza([malDia], 'empuje')[0]
    const sinCierre = curvaDeFuerza(
      [
        {
          ...malDia,
          registros: [{ ...malDia.registros[0]!, series: [{ logrado: 4 }, { logrado: 3 }, { logrado: 3 }] }],
        },
      ],
      'empuje',
    )[0]
    expect(conCierre?.carga).toBeCloseTo(sinCierre!.carga, 10)
  })

  it('pero sigue contando como trabajo hecho: cuatro series son cuatro series', () => {
    // Es la otra mitad de la regla, y es la que evita pasarse de largo: la
    // serie de cierre se guarda justamente porque es trabajo real.
    expect(seriesDeSesion(malDia)).toBe(4)
    expect(repeticionesDeSesion(malDia)).toBe(19)
  })
})

describe('el reloj es trabajo, no una medida de capacidad', () => {
  /** Una sesión de reloj: cuatro vueltas de veinte segundos del mismo ejercicio. */
  function tabata(fecha: string, ejercicioId: string, logros: number[]): Sesion {
    const base = sesion(fecha, ejercicioId, logros)
    return {
      ...base,
      tipo: 'reloj',
      registros: base.registros.map((r) => ({ ...r, reloj: true as const })),
    }
  }

  it('no es "la vez pasada": la vara la pone la última sesión de verdad', () => {
    // Es el dato más usado de la app —el número que aparece al lado de cada
    // casillero— y si lo pusiera un tabata, la próxima sesión compararía tres
    // series completas contra vueltas de veinte segundos.
    const historial = [
      sesion('2026-09-01', 'flexion-completa', [12, 11, 10]),
      tabata('2026-09-03', 'flexion-completa', [9, 8, 7, 7]),
    ]
    const vara = laVezPasada(historial, 'flexion-completa', '2026-09-04')
    expect(vara?.fecha).toBe('2026-09-01')
    expect(vara?.logros).toEqual([12, 11, 10])
  })

  it('no entra en el histórico ni en el récord', () => {
    const historial = [
      sesion('2026-09-01', 'flexion-completa', [12, 11, 10]),
      tabata('2026-09-03', 'flexion-completa', [9, 8, 7, 7]),
    ]
    expect(historicoDeEjercicio(historial, 'flexion-completa')).toHaveLength(1)
    expect(recordDe(historial, 'flexion-completa')).toBe(12)
  })

  it('no entra en la curva de fuerza', () => {
    const historial = [tabata('2026-09-03', 'flexion-completa', [9, 8, 7, 7])]
    expect(curvaDeFuerza(historial, 'empuje')).toEqual([])
  })

  it('pero sí cuenta como volumen: cuatro vueltas son cuatro series', () => {
    // Acá no se saltea nada, y es deliberado: el mapa muscular cuenta series, y
    // veinte segundos de flexiones con el pulso a ciento ochenta son trabajo.
    const t = tabata('2026-09-03', 'flexion-completa', [9, 8, 7, 7])
    expect(seriesDeSesion(t)).toBe(4)
    expect(seriesPorPatron(t).empuje).toBe(4)
  })
})

/**
 * Qué entra en la curva de fuerza desde que se puede entrenar cualquier cosa.
 *
 * La curva dice cuánto podés mover en una cadena, así que entra lo que se
 * puede comparar con esa cadena: sus eslabones, vengan del plan, de una rutina
 * o de un mix, y las variantes que declaran a qué eslabón equivalen. Lo demás
 * es trabajo real que suma volumen, pero no es una marca de esa cadena.
 *
 * El catálogo de hoy todavía no tiene variantes ni accesorios marcados: llegan
 * con la ola 1. Por eso acá se arman a mano, sobre fichas reales, y se le
 * pasan a la curva como catálogo.
 */
describe('la curva de fuerza con rutinas, mixes y variantes', () => {
  const completa = POR_ID.get('flexion-completa')!
  /** Una variante que equivale a la flexión completa, con su `ccr`, como pide §5.2. */
  const variante: Ejercicio = {
    ...POR_ID.get('flexion-rodillas')!,
    id: 'variante-de-prueba',
    nombre: 'Variante de prueba',
    nivel: completa.nivel,
    ccr: completa.ccr,
    equivale: { patron: 'empuje', nivel: completa.nivel },
  }
  /** Un accesorio de empuje con un `ccr` que le ganaría a cualquier flexión. */
  const accesorio: Ejercicio = {
    ...POR_ID.get('flexion-diamante')!,
    id: 'accesorio-de-prueba',
    nombre: 'Accesorio de prueba',
    nivel: 1,
    ccr: 2,
    accesorio: true,
  }
  const catalogo = new Map(POR_ID)
  catalogo.set(variante.id, variante)
  catalogo.set(accesorio.id, accesorio)

  function registro(
    ejercicioId: string,
    logros: number[],
    extra: Partial<RegistroEjercicio> = {},
  ): RegistroEjercicio {
    return {
      ejercicioId,
      objetivo: { series: logros.length, cantidad: logros[0] ?? 0 },
      series: logros.map((logrado) => ({ logrado })),
      ...extra,
    }
  }

  function conRegistros(fecha: string, registros: RegistroEjercicio[]): Sesion {
    return { ...sesion(fecha, 'flexion-completa', [1]), id: `${fecha}-${registros.length}`, registros }
  }

  it('un paso fijo con tu eslabón entra, como el del plan', () => {
    // Una rutina tuya con flexión completa fija es fuerza en flexión completa:
    // no lee la cadena, pero la marca es tuya igual.
    const fijo = conRegistros('2026-09-08', [registro('flexion-completa', [8, 8, 7], { fijo: true })])
    const delPlan = conRegistros('2026-09-08', [registro('flexion-completa', [8, 8, 7])])
    expect(curvaDeFuerza([fijo], 'empuje')).toEqual(curvaDeFuerza([delPlan], 'empuje'))
    expect(curvaDeFuerza([fijo], 'empuje')).toHaveLength(1)
  })

  it('una variante con `equivale` entra y se compara por su ccr', () => {
    // Su `ccr` es el del eslabón al que equivale, así que ocho de la variante
    // pesan en la curva lo mismo que ocho de la flexión completa.
    const conVariante = conRegistros('2026-09-08', [registro(variante.id, [8])])
    const conEslabon = conRegistros('2026-09-08', [registro('flexion-completa', [8])])
    const [punto] = curvaDeFuerza([conVariante], 'empuje', undefined, catalogo)
    expect(punto?.ejercicioId).toBe(variante.id)
    expect(punto?.carga).toBeCloseTo(curvaDeFuerza([conEslabon], 'empuje')[0]!.carga, 10)
  })

  it('una variante de otra cadena no entra en esta', () => {
    const otra: Ejercicio = { ...variante, id: 'variante-de-traccion', equivale: { patron: 'traccion', nivel: 3 } }
    const conOtra = new Map(catalogo)
    conOtra.set(otra.id, otra)
    const s = conRegistros('2026-09-08', [registro(otra.id, [10, 10])])
    expect(curvaDeFuerza([s], 'empuje', undefined, conOtra)).toEqual([])
  })

  it('un accesorio no entra, aunque sea del mismo patrón y su índice le gane al eslabón', () => {
    const s = conRegistros('2026-09-08', [
      registro('flexion-completa', [6, 6]),
      registro(accesorio.id, [12, 12], { fijo: true }),
    ])
    const [punto] = curvaDeFuerza([s], 'empuje', undefined, catalogo)
    expect(punto?.ejercicioId).toBe('flexion-completa')
    const soloAccesorio = conRegistros('2026-09-08', [registro(accesorio.id, [12, 12], { fijo: true })])
    expect(curvaDeFuerza([soloAccesorio], 'empuje', undefined, catalogo)).toEqual([])
  })

  it('la barra con discos no entra: progresa por peso, no por palanca', () => {
    // Cuarenta kilos de press militar con setenta y cinco de peso corporal le
    // ganan en esta escala a cualquier flexión, y sin el filtro se quedarían
    // con el punto de la cadena de empuje. Como paso fijo de una rutina no
    // lleva la marca `bajada` que hasta ahora lo dejaba afuera.
    const s = conRegistros('2026-09-08', [
      registro('flexion-completa', [8, 8]),
      {
        ejercicioId: 'press-militar-barra',
        objetivo: { series: 2, cantidad: 6, kg: 40 },
        series: [
          { logrado: 6, kg: 40 },
          { logrado: 6, kg: 40 },
        ],
        fijo: true,
      },
    ])
    const curva = curvaDeFuerza([s], 'empuje', 75)
    expect(curva).toHaveLength(1)
    expect(curva[0]!.ejercicioId).toBe('flexion-completa')
    expect(curva[0]!.conDiscos).toBe(false)
  })

  it('la entrada en calor no entra, aunque su índice le gane al trabajo del día', () => {
    // La serie fácil es del eslabón anterior y se pide lejos del fallo: hecha
    // larga puede dar un índice más alto que el eslabón al piso de su ventana.
    const calentamiento = registro('flexion-rodillas', [15], { calentamiento: true })
    const duro = registro('flexion-completa', [5, 5, 5])
    expect(
      curvaDeFuerza([conRegistros('2026-09-08', [registro('flexion-rodillas', [15])])], 'empuje')[0]!.carga,
    ).toBeGreaterThan(curvaDeFuerza([conRegistros('2026-09-08', [duro])], 'empuje')[0]!.carga)
    const [punto] = curvaDeFuerza([conRegistros('2026-09-08', [calentamiento, duro])], 'empuje')
    expect(punto?.ejercicioId).toBe('flexion-completa')
    expect(curvaDeFuerza([conRegistros('2026-09-08', [calentamiento])], 'empuje')).toEqual([])
  })

  it('la movilidad no entra: no es un eslabón ni equivale a ninguno', () => {
    // Va en `Sesion.movilidad` y no en los registros; y aunque un id de
    // movilidad apareciera en un registro, no está en el catálogo de fuerza.
    const s: Sesion = {
      ...conRegistros('2026-09-08', [registro('gato-vaca', [10, 10])]),
      tipo: 'fuelle',
      movilidad: [{ ejercicioId: 'gato-vaca', logrado: [10, 10] }],
    }
    for (const patron of ['empuje', 'traccion', 'piernas', 'core', 'bisagra'] as const) {
      expect(curvaDeFuerza([s], patron), patron).toEqual([])
    }
  })

  it('sigue quedándose con la mejor serie del día, venga de la sesión que venga', () => {
    // Tres sesiones el mismo día —el plan, una rutina y un mix—: un solo punto,
    // el de la mejor serie, y no el de la última sesión.
    const curva = curvaDeFuerza(
      [
        conRegistros('2026-09-08', [registro('flexion-completa', [6, 6, 6])]),
        { ...conRegistros('2026-09-08', [registro('flexion-diamante', [7], { fijo: true })]), id: 'b' },
        { ...conRegistros('2026-09-08', [registro(variante.id, [5])]), id: 'c' },
      ],
      'empuje',
      undefined,
      catalogo,
    )
    expect(curva).toHaveLength(1)
    expect(curva[0]!.ejercicioId).toBe('flexion-diamante')
  })

  it('el día que la variante le gana al eslabón, el punto dice también la marca del eslabón', () => {
    const s = conRegistros('2026-09-08', [registro('flexion-rodillas', [10]), registro(variante.id, [9])])
    const [punto] = curvaDeFuerza([s], 'empuje', undefined, catalogo)
    expect(punto?.ejercicioId).toBe(variante.id)
    expect(punto?.eslabon?.ejercicioId).toBe('flexion-rodillas')
    expect(punto!.eslabon!.carga).toBeLessThan(punto!.carga)
    // Si el que gana es un eslabón, no hace falta repetirlo.
    const soloEslabon = curvaDeFuerza([conRegistros('2026-09-08', [registro('flexion-completa', [8])])], 'empuje')
    expect(soloEslabon[0]!.eslabon).toBeUndefined()
  })
})

describe('fuerza por semana con variantes', () => {
  const semanas = ['2026-09-07', '2026-09-14', '2026-09-21']
  const completa = POR_ID.get('flexion-completa')!
  const variante: Ejercicio = {
    ...POR_ID.get('flexion-rodillas')!,
    id: 'variante-de-prueba',
    nombre: 'Variante de prueba',
    nivel: completa.nivel,
    ccr: completa.ccr,
    equivale: { patron: 'empuje', nivel: completa.nivel },
  }
  const catalogo = new Map(POR_ID)
  catalogo.set(variante.id, variante)

  it('alternar el eslabón con una variante no es un cambio de eslabón', () => {
    // El plan los lunes y una rutina con la variante fija los jueves: la cadena
    // no se movió, y "pasaste de una a otra" cada semana sería falso.
    const fuerza = fuerzaPorSemana(
      [
        sesion('2026-09-07', 'flexion-completa', [8, 8, 8]),
        sesion('2026-09-10', variante.id, [10, 10, 10]),
        sesion('2026-09-14', 'flexion-completa', [9, 8, 8]),
        sesion('2026-09-17', variante.id, [11, 10, 10]),
      ],
      'empuje',
      semanas,
      undefined,
      catalogo,
    )
    expect(fuerza[0]!.ejercicioId).toBe(variante.id)
    expect(fuerza[0]!.cambio).toBeUndefined()
    expect(fuerza[1]!.cambio).toBeUndefined()
  })

  it('el cambio de eslabón se sigue viendo con variantes en el medio', () => {
    const fuerza = fuerzaPorSemana(
      [
        sesion('2026-09-07', 'flexion-rodillas', [15, 15, 15]),
        sesion('2026-09-09', variante.id, [12, 12, 12]),
        sesion('2026-09-15', 'flexion-completa', [6, 6, 6]),
      ],
      'empuje',
      semanas,
      undefined,
      catalogo,
    )
    const rodillas = curvaDeFuerza([sesion('2026-09-07', 'flexion-rodillas', [15])], 'empuje')[0]!
    expect(fuerza[0]!.cambio).toBeUndefined()
    expect(fuerza[1]!.cambio).toEqual({
      de: 'flexion-rodillas',
      cargaAntes: rodillas.carga,
      a: 'flexion-completa',
    })
  })
})

describe('la entrada en calor no es una marca', () => {
  /** Una sesión con la serie fácil del eslabón anterior antes del trabajo. */
  const conEntrada = (fecha: string, logros: number[]): Sesion => ({
    ...sesion(fecha, 'flexion-rodillas', logros),
    registros: [
      {
        ejercicioId: 'flexion-rodillas',
        objetivo: { series: 1, cantidad: logros[0] ?? 0 },
        series: logros.map((logrado) => ({ logrado })),
        calentamiento: true,
      },
      {
        ejercicioId: 'flexion-completa',
        objetivo: { series: 3, cantidad: 8 },
        series: [{ logrado: 8 }, { logrado: 8 }, { logrado: 7 }],
      },
    ],
  })

  it('no es "la vez pasada": la vara la pone la última vez que fue trabajo', () => {
    const historial = [
      sesion('2026-09-01', 'flexion-rodillas', [12, 12, 11]),
      conEntrada('2026-09-08', [15]),
    ]
    const vara = laVezPasada(historial, 'flexion-rodillas', '2026-09-10')
    expect(vara?.fecha).toBe('2026-09-01')
    expect(vara?.logros).toEqual([12, 12, 11])
    // Sin otra vez que la de la entrada en calor, no hay vara.
    expect(laVezPasada([conEntrada('2026-09-08', [15])], 'flexion-rodillas', '2026-09-10')).toBeNull()
    // Y el trabajo de esa misma sesión sigue siendo la vara de su ejercicio.
    expect(laVezPasada(historial, 'flexion-completa', '2026-09-10')?.logros).toEqual([8, 8, 7])
  })

  it('no entra en el histórico ni en el récord', () => {
    const historial = [
      sesion('2026-09-01', 'flexion-rodillas', [12, 12, 11]),
      conEntrada('2026-09-08', [15]),
    ]
    expect(historicoDeEjercicio(historial, 'flexion-rodillas').map((p) => p.fecha)).toEqual(['2026-09-01'])
    expect(recordDe(historial, 'flexion-rodillas')).toBe(12)
  })

  it('pero sí cuenta como series hechas en la sesión', () => {
    // Las series por semana suman todo lo que se hizo, que es trabajo real.
    expect(seriesDeSesion(conEntrada('2026-09-08', [15]))).toBe(4)
  })
})
