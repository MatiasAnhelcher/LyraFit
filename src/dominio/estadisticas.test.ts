import { describe, expect, it } from 'vitest'
import {
  historicoDeEjercicio,
  lunesDe,
  porSemana,
  rachaActual,
  recordDe,
  totales,
  volumenDeSesion,
  volumenPorPatron,
} from './estadisticas'
import type { Sesion } from './tipos'

function sesion(fecha: string, ejercicioId: string, logros: number[]): Sesion {
  return {
    id: `${fecha}-${ejercicioId}`,
    fecha,
    finalizadaEn: new Date(`${fecha}T18:00:00`).getTime(),
    duracionSegundos: 1800,
    registros: [
      {
        ejercicioId,
        objetivo: { series: 3, cantidad: 10 },
        series: logros.map((logrado) => ({ logrado })),
      },
    ],
  }
}

describe('volumen', () => {
  it('suma todas las repeticiones de la sesión', () => {
    expect(volumenDeSesion(sesion('2026-09-01', 'flexion-completa', [10, 9, 8]))).toBe(27)
  })

  it('reparte el volumen según el patrón de cada ejercicio', () => {
    const resultado = volumenPorPatron(sesion('2026-09-01', 'dominada-completa', [5, 4]))
    expect(resultado.traccion).toBe(9)
    expect(resultado.empuje).toBe(0)
  })

  it('ignora ejercicios que no están en la biblioteca', () => {
    const resultado = volumenPorPatron(sesion('2026-09-01', 'inventado', [10]))
    expect(Object.values(resultado).every((v) => v === 0)).toBe(true)
  })
})

describe('rachaActual', () => {
  it('es cero sin historial', () => {
    expect(rachaActual([], '2026-09-06')).toBe(0)
  })

  it('cuenta días consecutivos', () => {
    const sesiones = [
      sesion('2026-09-06', 'flexion-completa', [10]),
      sesion('2026-09-05', 'flexion-completa', [10]),
      sesion('2026-09-04', 'flexion-completa', [10]),
    ]
    expect(rachaActual(sesiones, '2026-09-06')).toBe(3)
  })

  it('tolera un día de descanso entre sesiones', () => {
    const sesiones = [
      sesion('2026-09-06', 'flexion-completa', [10]),
      sesion('2026-09-04', 'flexion-completa', [10]),
      sesion('2026-09-02', 'flexion-completa', [10]),
    ]
    expect(rachaActual(sesiones, '2026-09-06')).toBe(3)
  })

  it('se corta con más de un día de hueco', () => {
    const sesiones = [
      sesion('2026-09-06', 'flexion-completa', [10]),
      sesion('2026-09-01', 'flexion-completa', [10]),
    ]
    expect(rachaActual(sesiones, '2026-09-06')).toBe(1)
  })

  it('se corta si hace varios días que no entrenás', () => {
    const sesiones = [sesion('2026-08-20', 'flexion-completa', [10])]
    expect(rachaActual(sesiones, '2026-09-06')).toBe(0)
  })

  it('no cuenta dos veces el mismo día', () => {
    const sesiones = [
      sesion('2026-09-06', 'flexion-completa', [10]),
      { ...sesion('2026-09-06', 'dominada-completa', [5]), id: 'otra' },
    ]
    expect(rachaActual(sesiones, '2026-09-06')).toBe(1)
  })
})

describe('agrupación semanal', () => {
  it('encuentra el lunes de cualquier día', () => {
    expect(lunesDe('2026-09-06')).toBe('2026-08-31') // domingo
    expect(lunesDe('2026-08-31')).toBe('2026-08-31') // lunes
    expect(lunesDe('2026-09-02')).toBe('2026-08-31') // miércoles
  })

  it('agrupa las sesiones por semana y las ordena', () => {
    const semanas = porSemana([
      sesion('2026-09-02', 'flexion-completa', [10, 10]),
      sesion('2026-08-26', 'flexion-completa', [8]),
      sesion('2026-09-04', 'flexion-completa', [10]),
    ])

    expect(semanas).toHaveLength(2)
    expect(semanas[0]!.semana).toBe('2026-08-24')
    expect(semanas[1]!.sesiones).toBe(2)
    expect(semanas[1]!.volumen).toBe(30)
  })
})

describe('histórico y récords', () => {
  const sesiones = [
    sesion('2026-09-04', 'flexion-completa', [12, 11, 10]),
    sesion('2026-09-01', 'flexion-completa', [8, 8, 7]),
    sesion('2026-09-02', 'dominada-completa', [4, 3]),
  ]

  it('devuelve los puntos ordenados por fecha', () => {
    const puntos = historicoDeEjercicio(sesiones, 'flexion-completa')
    expect(puntos.map((p) => p.fecha)).toEqual(['2026-09-01', '2026-09-04'])
    expect(puntos[1]!.mejor).toBe(12)
    expect(puntos[1]!.volumen).toBe(33)
  })

  it('el récord es la mejor serie de todo el historial', () => {
    expect(recordDe(sesiones, 'flexion-completa')).toBe(12)
    expect(recordDe(sesiones, 'pistol-squat')).toBe(0)
  })
})

describe('totales', () => {
  it('resume el historial completo', () => {
    const resumen = totales(
      [
        sesion('2026-09-06', 'flexion-completa', [10, 10]),
        sesion('2026-09-05', 'flexion-completa', [9]),
      ],
      '2026-09-06',
    )

    expect(resumen.sesiones).toBe(2)
    expect(resumen.volumen).toBe(29)
    expect(resumen.minutos).toBe(60)
    expect(resumen.racha).toBe(2)
  })
})
