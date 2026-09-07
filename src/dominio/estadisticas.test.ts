import { describe, expect, it } from 'vitest'
import {
  curvaDeFuerza,
  historicoDeEjercicio,
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
