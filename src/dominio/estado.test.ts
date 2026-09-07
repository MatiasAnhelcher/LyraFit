import { describe, expect, it } from 'vitest'
import {
  ENTRADAS_MINIMAS,
  ajusteDelDia,
  bandaSostenida,
  cadenasCongeladas,
  compuesto,
  leerEstado,
} from './estado'
import type { Estado } from './tipos'

function dia(n: number, sueno: number, energia: number, musculos: number, extra: Partial<Estado> = {}): Estado {
  const fecha = new Date('2026-01-01T00:00:00')
  fecha.setDate(fecha.getDate() + n)
  const dd = (x: number) => String(x).padStart(2, '0')
  return {
    fecha: `${fecha.getFullYear()}-${dd(fecha.getMonth() + 1)}-${dd(fecha.getDate())}`,
    sueno,
    energia,
    musculos,
    actualizadoEn: n,
    ...extra,
  }
}

function fechaDe(n: number): string {
  return dia(n, 3, 3, 3).fecha
}

/** Una racha de días iguales, para armar una línea de base estable. */
function base(dias: number, valor = 4): Estado[] {
  return Array.from({ length: dias }, (_, i) => dia(i, valor, valor, valor))
}

describe('el compuesto', () => {
  it('va de 0 a 1 y trata los tres ítems igual', () => {
    expect(compuesto(dia(0, 1, 1, 1))).toBe(0)
    expect(compuesto(dia(0, 5, 5, 5))).toBe(1)
    expect(compuesto(dia(0, 3, 3, 3))).toBeCloseTo(0.5)
    expect(compuesto(dia(0, 5, 1, 3))).toBeCloseTo(compuesto(dia(0, 1, 5, 3)))
  })
})

describe('la compuerta de arranque', () => {
  it('no dice nada hasta tener línea de base', () => {
    const lectura = leerEstado(base(ENTRADAS_MINIMAS - 1), fechaDe(13))
    expect(lectura.confiable).toBe(false)
    expect(lectura.faltan).toBe(1)
    expect(lectura.banda).toBe('normal')
  })

  it('con datos suficientes ya lee', () => {
    const lectura = leerEstado(base(20), fechaDe(19))
    expect(lectura.confiable).toBe(true)
    expect(lectura.faltan).toBe(0)
  })

  it('una línea de base vieja no describe a nadie', () => {
    // Veinte entradas, pero la última es de hace un mes.
    const lectura = leerEstado(base(20), fechaDe(60))
    expect(lectura.confiable).toBe(false)
  })

  it('sin historial no explota', () => {
    const lectura = leerEstado([], '2026-01-01')
    expect(lectura.confiable).toBe(false)
    expect(lectura.entradas).toBe(0)
  })
})

describe('la banda', () => {
  it('un día normal no dispara nada', () => {
    const historial = [...base(20), dia(20, 4, 4, 4)]
    expect(leerEstado(historial, fechaDe(20)).banda).toBe('normal')
  })

  it('un derrumbe contra la propia línea de base se nota', () => {
    const historial = [...base(20, 4), dia(20, 1, 1, 1)]
    const lectura = leerEstado(historial, fechaDe(20))
    expect(lectura.z).toBeLessThan(-1)
    expect(['ambar', 'rojo']).toContain(lectura.banda)
  })

  it('un día excelente contra la propia línea también', () => {
    const historial = [...base(20, 2), dia(20, 5, 5, 5)]
    expect(leerEstado(historial, fechaDe(20)).z).toBeGreaterThan(1)
  })

  it('la escala es propia: el mismo 3 puede ser bueno o malo', () => {
    const bajo = leerEstado([...base(20, 2), dia(20, 3, 3, 3)], fechaDe(20))
    const alto = leerEstado([...base(20, 5), dia(20, 3, 3, 3)], fechaDe(20))
    expect(bajo.z).toBeGreaterThan(alto.z)
  })

  it('un solo día malo no cambia el entrenamiento', () => {
    // Hace falta que se sostenga: si no, la app estaría reaccionando a ruido.
    const historial = [...base(20, 4), dia(20, 1, 1, 1)]
    expect(bandaSostenida(historial, fechaDe(20))).toBe('normal')
  })

  it('varios días malos seguidos sí', () => {
    const historial = [...base(20, 4), dia(20, 1, 1, 1), dia(21, 1, 1, 1), dia(22, 1, 1, 2)]
    expect(bandaSostenida(historial, fechaDe(22))).not.toBe('normal')
  })
})

describe('qué hace con el entrenamiento', () => {
  it('en un día normal no pasa nada, y no se dice nada', () => {
    const ajuste = ajusteDelDia('normal')
    expect(ajuste.factor).toBe(1)
    expect(ajuste.neutra).toBe(false)
    expect(ajuste.protegida).toBe(false)
    expect(ajuste.mensaje).toBeNull()
  })

  it('un día verde no sube nada solo', () => {
    expect(ajusteDelDia('verde').factor).toBe(1)
    expect(ajusteDelDia('verde').mensaje).toBeNull()
  })

  it('en ámbar baja el objetivo y protege el contador', () => {
    const ajuste = ajusteDelDia('ambar')
    expect(ajuste.factor).toBeLessThan(1)
    expect(ajuste.protegida).toBe(true)
    // Pero la sesión igual puede contar a favor si se cumple.
    expect(ajuste.neutra).toBe(false)
  })

  it('en rojo la sesión no cuenta ni a favor ni en contra', () => {
    const ajuste = ajusteDelDia('rojo')
    expect(ajuste.neutra).toBe(true)
    expect(ajuste.mensaje).toContain('ni a favor ni en contra')
  })
})

describe('molestia puntual', () => {
  it('congela la cadena mientras la molestia siga apareciendo', () => {
    const historial = [
      dia(0, 4, 4, 2, { molestia: 'traccion' }),
      dia(1, 4, 4, 2, { molestia: 'traccion' }),
      dia(2, 4, 4, 3),
    ]
    expect(cadenasCongeladas(historial, fechaDe(2)).has('traccion')).toBe(true)
  })

  it('la suelta cuando deja de aparecer', () => {
    const historial = [
      dia(0, 4, 4, 2, { molestia: 'traccion' }),
      dia(1, 4, 4, 4),
      dia(2, 4, 4, 4),
      dia(3, 4, 4, 4),
    ]
    expect(cadenasCongeladas(historial, fechaDe(3)).size).toBe(0)
  })

  it('el dolor muscular parejo no congela nada: es parte de entrenar', () => {
    const historial = [dia(0, 4, 4, 1), dia(1, 4, 4, 1), dia(2, 4, 4, 1)]
    expect(cadenasCongeladas(historial, fechaDe(2)).size).toBe(0)
  })
})
