import { describe, expect, it } from 'vitest'
import {
  SERIES_MINIMAS,
  SESIONES_MINIMAS,
  animoReciente,
  calibracion,
  cargaInterna,
  frasePorCalibracion,
  vitalidad,
} from './vitalidad'
import type { Serie, Sesion } from './tipos'

function sesion(n: number, series: Serie[], extra: Partial<Sesion> = {}): Sesion {
  return {
    id: `s${n}`,
    fecha: `2026-01-${String((n % 28) + 1).padStart(2, '0')}`,
    finalizadaEn: n * 86_400_000,
    duracionSegundos: 1800,
    tipo: 'plan',
    registros: [{ ejercicioId: 'flexion-completa', objetivo: { series: series.length, cantidad: 10 }, series }],
    ...extra,
  }
}

/** N sesiones donde la persona predice `predicho` y logra `predicho + error`. */
function conPrediccion(cantidad: number, predicho: number, error: number, desde = 0): Sesion[] {
  return Array.from({ length: cantidad }, (_, i) =>
    sesion(desde + i, [
      { predicho, logrado: predicho + error },
      { predicho, logrado: predicho + error },
      { predicho, logrado: predicho + error },
    ]),
  )
}

describe('calibración', () => {
  it('no dice nada hasta tener suficientes series', () => {
    expect(calibracion(conPrediccion(3, 10, 0))).toBeNull()
  })

  it('detecta a quien se subestima', () => {
    const c = calibracion(conPrediccion(15, 10, 2))!
    expect(c.series).toBe(SERIES_MINIMAS)
    expect(c.sesgo).toBeCloseTo(2)
    expect(c.error).toBeCloseTo(2)
    expect(frasePorCalibracion(c)).toContain('subestimarte')
  })

  it('y a quien se sobrestima', () => {
    const c = calibracion(conPrediccion(15, 10, -3))!
    expect(c.sesgo).toBeCloseTo(-3)
    expect(frasePorCalibracion(c)).toContain('sobrestimarte')
  })

  it('a quien predice bien no le inventa una tendencia', () => {
    const c = calibracion(conPrediccion(15, 10, 0))!
    expect(c.error).toBe(0)
    expect(frasePorCalibracion(c)).toContain('ni para arriba ni para abajo')
  })

  it('solo reporta una mejora si es más grande que el ruido', () => {
    // Treinta series con error 3 y antes treinta con error 3: sin cambio.
    const iguales = calibracion([
      ...conPrediccion(10, 10, 3),
      ...conPrediccion(10, 10, 3, 10),
    ])!
    expect(iguales.tendencia).toBeNull()

    // Ahora sí hay una mejora clara: las treinta series más nuevas erran
    // mucho menos que las treinta anteriores.
    const mejoro = calibracion([
      ...conPrediccion(10, 10, 4),
      ...conPrediccion(10, 10, 1, 10),
    ])!
    expect(mejoro.tendencia).toBeLessThan(0)
  })

  it('ignora las series sin predicción', () => {
    const sinPrediccion = Array.from({ length: 20 }, (_, i) =>
      sesion(i, [{ logrado: 10 }, { logrado: 10 }]),
    )
    expect(calibracion(sinPrediccion)).toBeNull()
  })
})

describe('delta de vitalidad', () => {
  it('mide cuánta energía deja la sesión, no cuánta promete la app', () => {
    const sesiones = Array.from({ length: 10 }, (_, i) =>
      sesion(i, [{ logrado: 10 }], { vitalidadPre: 3, vitalidadPost: 5 }),
    )
    const v = vitalidad(sesiones)!
    expect(v.delta).toBeCloseTo(2)
    expect(v.subieron).toBe(10)
  })

  it('no promedia lo que no se midió', () => {
    const sesiones = Array.from({ length: 10 }, (_, i) => sesion(i, [{ logrado: 10 }]))
    expect(vitalidad(sesiones)).toBeNull()
  })

  it('espera a tener sesiones suficientes', () => {
    const pocas = Array.from({ length: SESIONES_MINIMAS - 1 }, (_, i) =>
      sesion(i, [{ logrado: 10 }], { vitalidadPre: 3, vitalidadPost: 5 }),
    )
    expect(vitalidad(pocas)).toBeNull()
  })

  it('también registra cuando la sesión deja peor', () => {
    const sesiones = Array.from({ length: 10 }, (_, i) =>
      sesion(i, [{ logrado: 10 }], { vitalidadPre: 5, vitalidadPost: i < 3 ? 6 : 3 }),
    )
    const v = vitalidad(sesiones)!
    expect(v.delta).toBeLessThan(0)
    expect(v.subieron).toBeLessThan(10)
  })
})

describe('ánimo reciente', () => {
  it('promedia las últimas', () => {
    const sesiones = [
      sesion(1, [{ logrado: 10 }], { animo: -2 }),
      sesion(2, [{ logrado: 10 }], { animo: -1 }),
      sesion(3, [{ logrado: 10 }], { animo: 0 }),
    ]
    expect(animoReciente(sesiones)).toBeCloseTo(-1)
  })

  it('con un solo dato no dice nada', () => {
    expect(animoReciente([sesion(1, [{ logrado: 10 }], { animo: -2 })])).toBeUndefined()
  })
})

describe('carga interna', () => {
  it('es esfuerzo por tiempo de trabajo, no por reloj', () => {
    // Descansar más no puede subir la carga de la sesión, que es lo que pasa
    // si se multiplica por la duración total.
    const corta = cargaInterna(
      sesion(1, [{ logrado: 10 }, { logrado: 10 }], { esfuerzo: 8, duracionSegundos: 600 }),
    )
    const larga = cargaInterna(
      sesion(2, [{ logrado: 10 }, { logrado: 10 }], { esfuerzo: 8, duracionSegundos: 3600 }),
    )
    expect(corta).toBe(larga)
  })

  it('sin esfuerzo declarado no inventa un número', () => {
    expect(cargaInterna(sesion(1, [{ logrado: 10 }]))).toBeNull()
  })
})
