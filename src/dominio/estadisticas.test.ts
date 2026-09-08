import { describe, expect, it } from 'vitest'
import {
  curvaDeFuerza,
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
} from './estadisticas'
import type { Sesion } from './tipos'

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
    expect(seriesPorPatron(s)).toEqual({ empuje: 3, traccion: 0, piernas: 0, core: 0 })
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
