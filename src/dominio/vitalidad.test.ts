import { describe, expect, it } from 'vitest'
import {
  SERIES_MINIMAS,
  DIAS_MINIMOS,
  animoDentroDe,
  animoPorDia,
  animoReciente,
  calibracion,
  cargaInterna,
  frasePorCalibracion,
  vitalidad,
  vitalidadDeAntes,
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
  it('solo mide las predicciones en repeticiones', () => {
    // Treinta series de flexiones con un error de 1, y planchas con un error
    // de 6 segundos que no tienen que entrar al promedio de repeticiones.
    const planchas = Array.from({ length: 8 }, (_, i) =>
      sesion(100 + i, [{ predicho: 30, logrado: 24 }], {
        registros: [
          {
            ejercicioId: 'plancha',
            objetivo: { series: 1, cantidad: 30 },
            series: [{ predicho: 30, logrado: 24 }],
          },
        ],
      }),
    )
    const c = calibracion([...conPrediccion(10, 10, 1), ...planchas])!
    expect(c.series).toBe(30)
    expect(c.error).toBe(1)
  })

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
    const pocas = Array.from({ length: DIAS_MINIMOS - 1 }, (_, i) =>
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

  it('da el cambio de cada sesión, de la más vieja a la más nueva', () => {
    // Son los diez puntos de la baldosa de Energía en Progreso.
    const sesiones = Array.from({ length: 10 }, (_, i) =>
      sesion(i, [{ logrado: 10 }], { vitalidadPre: 5, vitalidadPost: i < 3 ? 6 : 3 }),
    )
    const v = vitalidad(sesiones)!
    expect(v.serie).toEqual([1, 1, 1, -2, -2, -2, -2, -2, -2, -2])
    expect(v.serie.filter((d) => d > 0)).toHaveLength(v.subieron)
  })
})

describe('delta de vitalidad, un día a la vez', () => {
  // Diez días, cada uno con una sesión a las 9 que sube de 3 a 4.
  const mananas = Array.from({ length: 10 }, (_, i) =>
    sesion(i, [{ logrado: 10 }], { vitalidadPre: 3, vitalidadPost: 4 }),
  )
  /** Otra sesión el mismo día que `n`, unas horas más tarde. */
  const tarde = (n: number, extra: Partial<Sesion>) =>
    sesion(n, [{ logrado: 10 }], { id: `t${n}`, finalizadaEn: n * 86_400_000 + 36_000_000, ...extra })

  it('las de más tarde con la energía de la mañana, guardadas antes de la regla, no cuentan', () => {
    // Sin la regla al leer, las cinco de la noche (3 → 1) entrarían a las
    // diez más nuevas y el delta compararía la mañana con la noche.
    const noches = [5, 6, 7, 8, 9].map((n) => tarde(n, { vitalidadPre: 3, vitalidadPost: 1 }))
    const v = vitalidad([...mananas, ...noches])!
    expect(v.dias).toBe(10)
    expect(v.delta).toBeCloseTo(1)
    expect(v.subieron).toBe(10)
  })

  it('un día cuya primera sesión no se midió no se mide con otra de más tarde', () => {
    // El día 9 arrancó con un Reloj sin energía; la de la tarde, medida,
    // no ocupa su lugar.
    const conReloj = mananas.map((s, i) => {
      if (i !== 9) return s
      const { vitalidadPre, vitalidadPost, ...reloj } = s
      void vitalidadPre
      void vitalidadPost
      return { ...reloj, tipo: 'reloj' as const }
    })
    const v = vitalidad([...conReloj, tarde(9, { vitalidadPre: 3, vitalidadPost: 5 })])!
    expect(v.dias).toBe(9)
    expect(v.serie).toEqual(Array(9).fill(1))
  })

  it('pide días medidos, no sesiones', () => {
    // Siete días con dos sesiones medidas cada uno son siete días, no catorce.
    const siete = mananas.slice(0, DIAS_MINIMOS - 1)
    const dobles = siete.map((_, n) => tarde(n, { vitalidadPre: 3, vitalidadPost: 4 }))
    expect(vitalidad([...siete, ...dobles])).toBeNull()
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

  it('cuenta los tres últimos días distintos, no las tres últimas sesiones', () => {
    // Una tarde con tres sesiones malas vale un día: no tapa los dos de antes.
    const dia = (n: number, animo: number, extra: Partial<Sesion> = {}) =>
      sesion(n, [{ logrado: 10 }], { animo, ...extra })
    const sesiones = [
      dia(1, 0),
      dia(2, 2),
      dia(3, 2),
      dia(4, -2, { id: 'a', finalizadaEn: 4 * 86_400_000 + 1 }),
      dia(4, -2, { id: 'b', finalizadaEn: 4 * 86_400_000 + 2 }),
      dia(4, -2, { id: 'c', finalizadaEn: 4 * 86_400_000 + 3 }),
    ]
    // Días 2, 3 y 4: (2 + 2 - 2) / 3. Por sesiones habría dado -2.
    expect(animoReciente(sesiones)).toBeCloseTo(2 / 3)
  })

  it('dentro de un día, promedia lo que se contestó ese día', () => {
    const sesiones = [
      sesion(1, [{ logrado: 10 }], { animo: 0 }),
      sesion(2, [{ logrado: 10 }], { id: 'a', animo: 2, finalizadaEn: 2 * 86_400_000 + 1 }),
      sesion(2, [{ logrado: 10 }], { id: 'b', animo: -2, finalizadaEn: 2 * 86_400_000 + 2 }),
      sesion(2, [{ logrado: 10 }], { id: 'c', finalizadaEn: 2 * 86_400_000 + 3 }),
    ]
    expect(animoReciente(sesiones)).toBeCloseTo(0)
    // Tres sesiones contestadas en un solo día son un dato, no tres.
    expect(animoReciente(sesiones.slice(1))).toBeUndefined()
  })
})

describe('el ánimo día por día, y el de los días que vienen', () => {
  const dia = (n: number, animo?: number) =>
    sesion(n, [{ logrado: 10 }], animo !== undefined ? { animo } : {})

  it('de hoy para atrás, con su lugar el día que no se contestó', () => {
    expect(animoPorDia([dia(1, 2), dia(2), dia(3, -1)])).toEqual([-1, undefined, 2])
    // Solo los tres últimos días con sesión.
    expect(animoPorDia([dia(1, 2), dia(2, 1), dia(3, 0), dia(4, -1)])).toEqual([-1, 0, 1])
  })

  it('contestando como hoy, el promedio se corre hacia la respuesta de hoy', () => {
    // Dos días de +1 y hoy -1: hoy da 1/3; mañana, con otro -1, da -1/3.
    const dias = animoPorDia([dia(1, 1), dia(2, 1), dia(3, -1)])
    expect(animoDentroDe(dias, 0)).toBeCloseTo(1 / 3)
    expect(animoDentroDe(dias, 1)).toBeCloseTo(-1 / 3)
    expect(animoDentroDe(dias, 2)).toBeCloseTo(-1)
  })

  it('con la primera respuesta, mañana ya dice algo', () => {
    const dias = animoPorDia([dia(1, -1)])
    expect(animoDentroDe(dias, 0)).toBeUndefined()
    expect(animoDentroDe(dias, 1)).toBeCloseTo(-1)
  })

  it('sin contestar hoy, los días nuevos no suman respuestas y empujan afuera a las viejas', () => {
    const dias = animoPorDia([dia(1, -2), dia(2, -2), dia(3)])
    expect(animoDentroDe(dias, 0)).toBeCloseTo(-2)
    expect(animoDentroDe(dias, 1)).toBeUndefined()
  })

  it('animoReciente es el de hoy', () => {
    const sesiones = [dia(1, 2), dia(2, -1), dia(3, 0)]
    expect(animoReciente(sesiones)).toBeCloseTo(animoDentroDe(animoPorDia(sesiones), 0)!)
  })
})

describe('la energía de antes', () => {
  it('es la del chequeo solo en la primera sesión del día', () => {
    const deAyer = sesion(1, [{ logrado: 10 }])
    const deHoy = sesion(2, [{ logrado: 10 }])
    expect(vitalidadDeAntes(4, deHoy.fecha, [])).toBe(4)
    // Una sesión de ayer no cambia nada: hoy esta es la primera.
    expect(vitalidadDeAntes(4, deHoy.fecha, [deAyer])).toBe(4)
    // Con una sesión hoy, el chequeo de la mañana ya no es el de antes.
    expect(vitalidadDeAntes(4, deHoy.fecha, [deAyer, deHoy])).toBeUndefined()
  })

  it('sin chequeo no hay energía de antes', () => {
    expect(vitalidadDeAntes(undefined, '2026-01-03', [])).toBeUndefined()
  })

  it('una movilidad a la mañana no es la primera sesión: la de fuerza de la tarde lleva la energía', () => {
    const movilidad = movilidadDelDia(2, 8)
    expect(vitalidadDeAntes(4, movilidad.fecha, [movilidad])).toBe(4)
    // Una de fuerza ese día sí ocupa el lugar, con o sin movilidad antes.
    const fuerza = sesion(2, [{ logrado: 10 }], { id: 'f2', finalizadaEn: movilidad.finalizadaEn + 3_600_000 })
    expect(vitalidadDeAntes(4, movilidad.fecha, [movilidad, fuerza])).toBeUndefined()
  })
})

/**
 * Una movilidad de cinco minutos el día de la sesión `n`, a la hora `h`: como
 * la guarda el arranque (`fuelle`, `origen: movilidad`, sin registros) y sin
 * las preguntas del final, que no hace.
 */
function movilidadDelDia(n: number, h: number): Sesion {
  return {
    id: `m${n}-${h}`,
    fecha: sesion(n, []).fecha,
    finalizadaEn: n * 86_400_000 + h * 3_600_000,
    duracionSegundos: 300,
    tipo: 'fuelle',
    origen: { clase: 'movilidad', sector: 'pecho', nombre: 'Movilidad de pecho' },
    registros: [],
  }
}

describe('la movilidad no es una sesión para la vitalidad ni para el ánimo', () => {
  it('el día que arrancó con una movilidad se mide con la primera sesión que cuenta', () => {
    // Diez días medidos con la sesión a las 19; el último arrancó con una
    // movilidad a las 8, sin energía. Tomarla como la primera dejaba ese día
    // afuera.
    const dias = Array.from({ length: 10 }, (_, i) =>
      sesion(i, [{ logrado: 10 }], {
        finalizadaEn: i * 86_400_000 + 19 * 3_600_000,
        vitalidadPre: 3,
        vitalidadPost: 4,
      }),
    )
    const v = vitalidad([...dias, movilidadDelDia(9, 8)])!
    expect(v.dias).toBe(10)
    expect(v.serie).toEqual(Array(10).fill(1))
  })

  it('un día de pura movilidad no ocupa un lugar en la ventana del ánimo', () => {
    // Dos días malos contestados y después dos días con solo una movilidad:
    // el freno del ánimo sigue viendo los dos días malos.
    const sesiones = [
      sesion(1, [{ logrado: 10 }], { animo: -2 }),
      sesion(2, [{ logrado: 10 }], { animo: -2 }),
      movilidadDelDia(3, 9),
      movilidadDelDia(4, 9),
    ]
    expect(animoPorDia(sesiones)).toEqual([-2, -2])
    expect(animoReciente(sesiones)).toBeCloseTo(-2)
  })

  it('una movilidad el mismo día que una sesión no le cambia el ánimo a ese día', () => {
    const sesiones = [
      sesion(1, [{ logrado: 10 }], { animo: 1 }),
      sesion(2, [{ logrado: 10 }], { animo: 2 }),
      movilidadDelDia(2, 23),
    ]
    expect(animoPorDia(sesiones)).toEqual([2, 1])
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
