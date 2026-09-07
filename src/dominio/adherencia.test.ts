import { describe, expect, it } from 'vitest'
import {
  CREDITOS_MAXIMOS,
  adherencia,
  consistenciaHoraria,
  esHito,
  esVuelta,
  horaHabitual,
  intervaloHabitual,
  proximoHito,
  sesionesDeVida,
} from './adherencia'
import type { Sesion } from './tipos'

function sesion(fecha: string, hora = 18): Sesion {
  return {
    id: `s-${fecha}-${hora}`,
    fecha,
    finalizadaEn: new Date(`${fecha}T${String(hora).padStart(2, '0')}:00:00`).getTime(),
    duracionSegundos: 1800,
    tipo: 'plan',
    registros: [],
  }
}

/** Genera sesiones perfectas para una rutina de N días por semana. */
function rutina(desde: string, dias: number[], semanas: number): Sesion[] {
  const base = new Date(`${desde}T00:00:00`)
  const out: Sesion[] = []
  for (let s = 0; s < semanas; s++) {
    for (const d of dias) {
      const f = new Date(base)
      f.setDate(f.getDate() + s * 7 + d)
      const dd = (n: number) => String(n).padStart(2, '0')
      out.push(sesion(`${f.getFullYear()}-${dd(f.getMonth() + 1)}-${dd(f.getDate())}`))
    }
  }
  return out
}

describe('adherencia rodante', () => {
  // 2026-01-05 es lunes.
  it('alguien impecable ve el máximo, con la rutina de la propia app', () => {
    // Esto es exactamente lo que la racha de días hacía mal: con lunes,
    // miércoles y viernes, ocho semanas perfectas mostraban un tres.
    const sesiones = rutina('2026-01-05', [0, 2, 4], 8)
    const a = adherencia(sesiones, '2026-02-27', 3)
    expect(a.porcentaje).toBe(100)
    expect(a.hechas).toBe(12)
  })

  it('la rutina mínima de dos días también llega al máximo', () => {
    const sesiones = rutina('2026-01-06', [0, 3], 8)
    const a = adherencia(sesiones, '2026-02-27', 2)
    expect(a.porcentaje).toBe(100)
  })

  it('faltar una vez no derrumba nada, porque hay crédito', () => {
    const sesiones = rutina('2026-01-05', [0, 2, 4], 8).slice(0, -1)
    const a = adherencia(sesiones, '2026-02-27', 3)
    expect(a.cubiertos).toBeGreaterThan(0)
    expect(a.porcentaje).toBe(100)
  })

  it('pero los créditos tienen tope: faltar mucho sí se nota', () => {
    const sesiones = rutina('2026-01-05', [0, 2, 4], 8).slice(0, -6)
    const a = adherencia(sesiones, '2026-02-27', 3)
    expect(a.creditos).toBeLessThanOrEqual(CREDITOS_MAXIMOS)
    expect(a.porcentaje).toBeLessThan(100)
  })

  it('nunca vuelve a cero de golpe: siempre se puede recuperar en días', () => {
    const sesiones = rutina('2026-01-05', [0, 2, 4], 8)
    // Dos semanas sin entrenar: la barra baja, pero no desaparece.
    const a = adherencia(sesiones, '2026-03-13', 3)
    expect(a.porcentaje).toBeGreaterThan(0)
    expect(a.porcentaje).toBeLessThan(100)
  })

  it('sin historial no explota', () => {
    const a = adherencia([], '2026-02-27', 3)
    expect(a.porcentaje).toBe(0)
    expect(a.creditos).toBe(0)
  })

  it('dos sesiones el mismo día cuentan como un día', () => {
    const a = adherencia([sesion('2026-02-26'), sesion('2026-02-26', 20)], '2026-02-27', 3)
    expect(a.hechas).toBe(1)
  })
})

describe('el contador que solo sube', () => {
  it('cuenta todo lo que hiciste en tu vida', () => {
    expect(sesionesDeVida(rutina('2026-01-05', [0, 2, 4], 10))).toBe(30)
  })

  it('los hitos van marcando el camino', () => {
    expect(proximoHito(0)).toEqual({ hito: 10, faltan: 10 })
    expect(proximoHito(47)).toEqual({ hito: 50, faltan: 3 })
    expect(esHito(50)).toBe(true)
    expect(esHito(51)).toBe(false)
  })

  it('después del último hito ya no hay nada que perseguir', () => {
    expect(proximoHito(5000)).toBeNull()
  })
})

describe('el ritmo de cada uno', () => {
  it('mide el intervalo real, no el declarado', () => {
    expect(intervaloHabitual(rutina('2026-01-05', [0, 2, 4], 4))).toBe(2)
  })

  it('sin suficiente historial no inventa un ritmo', () => {
    expect(intervaloHabitual([sesion('2026-02-01')])).toBeNull()
  })

  it('la vuelta se juzga contra el hábito propio, no contra un número fijo', () => {
    const tresPorSemana = rutina('2026-01-05', [0, 2, 4], 4)
    // Cuatro días sin entrenar es mucho para quien entrena día por medio.
    expect(esVuelta(tresPorSemana, '2026-02-05')).toBe(true)
    // Pero un día de descanso normal no es una vuelta.
    expect(esVuelta(tresPorSemana, '2026-01-31')).toBe(false)
  })
})

describe('consistencia horaria', () => {
  it('quien entrena siempre a la misma hora tiene consistencia alta', () => {
    const sesiones = rutina('2026-01-05', [0, 2, 4], 3).map((s) => ({ ...s }))
    expect(consistenciaHoraria(sesiones)!).toBeGreaterThan(0.9)
  })

  it('quien entrena a cualquier hora tiene consistencia baja', () => {
    const horas = [6, 13, 21, 8, 23, 15, 11, 19, 7, 22]
    const sesiones = horas.map((h, i) => sesion(`2026-01-${String(i + 5).padStart(2, '0')}`, h))
    expect(consistenciaHoraria(sesiones)!).toBeLessThan(0.6)
  })

  it('no dice nada con pocos datos', () => {
    expect(consistenciaHoraria([sesion('2026-01-05')])).toBeNull()
    expect(horaHabitual([sesion('2026-01-05')])).toBeNull()
  })

  it('la hora típica cruza la medianoche sin volverse loca', () => {
    // Las 23 y la 1 están a dos horas, no a veintidós: por eso la cuenta es
    // circular. El promedio ingenuo daría el mediodía.
    const sesiones = [23, 0, 1, 23.5, 0.5, 23, 1].map((h, i) =>
      sesion(`2026-01-${String(i + 5).padStart(2, '0')}`, Math.floor(h)),
    )
    const hora = horaHabitual(sesiones)!
    expect(hora > 22 || hora < 2).toBe(true)
  })
})
