import { describe, expect, it } from 'vitest'
import { POR_ID } from '@/dominio/biblioteca'
import { planDelPrimerCuadro } from './primerCuadro'

const paso = (extra: Record<string, unknown> = {}) => ({
  ejercicio: { id: 'flexion-inclinada' },
  objetivo: { series: 3, cantidad: 8 },
  ...extra,
})

describe('planDelPrimerCuadro', () => {
  it('sin estado, o con un estado que no es un plan, no hay primer cuadro', () => {
    expect(planDelPrimerCuadro(undefined)).toBeNull()
    expect(planDelPrimerCuadro(null)).toBeNull()
    expect(planDelPrimerCuadro('plan')).toBeNull()
    expect(planDelPrimerCuadro({})).toBeNull()
    expect(planDelPrimerCuadro({ plan: [] })).toBeNull()
    expect(planDelPrimerCuadro({ plan: 'flexiones' })).toBeNull()
  })

  it('el ejercicio sale de la biblioteca de esta versión, no del estado guardado', () => {
    const plan = planDelPrimerCuadro({
      plan: [paso({ ejercicio: { id: 'flexion-inclinada', nombre: 'Un nombre viejo', tecnica: [] } })],
    })
    expect(plan).not.toBeNull()
    expect(plan![0]!.ejercicio).toBe(POR_ID.get('flexion-inclinada'))
    expect(plan![0]!.ejercicio.nombre).not.toBe('Un nombre viejo')
  })

  it('lo que falta toma el valor de una sesión sin historia', () => {
    const [primero] = planDelPrimerCuadro({ plan: [paso()] })!
    expect(primero).toMatchObject({
      objetivo: { series: 3, cantidad: 8 },
      antes: null,
      abre: null,
      bajada: false,
      porMolestia: false,
      descansoSegundos: POR_ID.get('flexion-inclinada')!.descansoSegundos,
    })
  })

  it('un ejercicio que no se reconoce, o un objetivo roto, descartan el plan entero', () => {
    expect(planDelPrimerCuadro({ plan: [paso(), paso({ ejercicio: { id: 'no-existe' } })] })).toBeNull()
    expect(planDelPrimerCuadro({ plan: [paso({ objetivo: { series: 0, cantidad: 8 } })] })).toBeNull()
    expect(planDelPrimerCuadro({ plan: [paso({ objetivo: { series: 3, cantidad: -1 } })] })).toBeNull()
    expect(planDelPrimerCuadro({ plan: [paso({ objetivo: { series: 3 } })] })).toBeNull()
    expect(planDelPrimerCuadro({ plan: [null] })).toBeNull()
  })

  it('los kilos del objetivo pasan solo si son un número', () => {
    const [conKilos] = planDelPrimerCuadro({ plan: [paso({ objetivo: { series: 3, cantidad: 8, kg: 20 } })] })!
    expect(conKilos!.objetivo.kg).toBe(20)
    const [sinKilos] = planDelPrimerCuadro({ plan: [paso({ objetivo: { series: 3, cantidad: 8, kg: '20' } })] })!
    expect(sinKilos!.objetivo).not.toHaveProperty('kg')
  })

  it('la vara pasa si está entera, y si no se dibuja sin ella', () => {
    const antes = { fecha: '2026-10-17', hace: 2, logros: [8, 7, 7], objetivo: { series: 3, cantidad: 8 }, mejor: 8 }
    const [conVara] = planDelPrimerCuadro({ plan: [paso({ antes })] })!
    expect(conVara!.antes).toMatchObject({ hace: 2, logros: [8, 7, 7] })
    const [sinVara] = planDelPrimerCuadro({ plan: [paso({ antes: { hace: 2, logros: ['8'] } })] })!
    expect(sinVara!.antes).toBeNull()
  })

  it('el eslabón que abre también sale de la biblioteca', () => {
    const [primero] = planDelPrimerCuadro({ plan: [paso({ abre: { id: 'flexion-inclinada-baja' } })] })!
    expect(primero!.abre).toBe(POR_ID.get('flexion-inclinada-baja'))
    const [desconocido] = planDelPrimerCuadro({ plan: [paso({ abre: { id: 'no-existe' } })] })!
    expect(desconocido!.abre).toBeNull()
  })

  it('la bajada y la molestia pasan como vienen', () => {
    const [primero] = planDelPrimerCuadro({
      plan: [paso({ bajada: true, porMolestia: true, descansoSegundos: 45 })],
    })!
    expect(primero).toMatchObject({ bajada: true, porMolestia: true, descansoSegundos: 45 })
  })
})
