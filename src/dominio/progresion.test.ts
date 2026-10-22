import { describe, expect, it } from 'vitest'
import { CADENAS, EJERCICIOS, POR_ID, cadenaDe } from './biblioteca'
import { RECORTE_DE_VUELTA } from './adherencia'
import { loProhibido } from './palabras'
import {
  BAJA,
  CONSOLIDACION,
  GRACIA,
  LLEGASTE_AL_TOTAL,
  MESETA,
  PREFATIGA,
  PROTEGIDA_EN_UN_DIA_FLOJO,
  PROTEGIDA_POR_PREFATIGA,
  avanceInicial,
  cantidadParaCarga,
  ccrEfectivo,
  conUnidad,
  cumpleCadaSerie,
  incremento,
  indiceDeCarga,
  leerLaSesion,
  logradoTipico,
  mueveElPlan,
  pasosQueSiguenTuNivel,
  porcentajeDeCadena,
  recalibrar,
  rellenoDeVentana,
  rendimientoDeSesion,
  proyectar,
  requisitoDicho,
  siguienteAvance,
  SUBE,
  ubicarEnCadena,
  unaPorPatron,
  yaLeidaHoy,
  type Cierre,
  type Lectura,
  type RegistroQueLee,
  type SesionALeer,
} from './progresion'
import type { Avance, Objetivo, Patron, Serie, Sesion, TipoSesion } from './tipos'

const empuje = cadenaDe('empuje')
const ctx = { cadena: empuje, ejercicios: POR_ID }

function ejercicio(id: string) {
  const e = POR_ID.get(id)
  if (!e) throw new Error(`falta ${id} en la biblioteca`)
  return e
}

function avanceEn(id: string, cantidad: number, extra: Partial<Avance> = {}): Avance {
  const e = ejercicio(id)
  return {
    patron: 'empuje',
    ejercicioId: id,
    objetivoActual: { series: e.series, cantidad },
    senal: 1,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
    actualizadoEn: 0,
    ...extra,
  }
}

function series(...logrados: number[]): Serie[] {
  return logrados.map((logrado) => ({ logrado }))
}

/** Corre una sesión en la que la persona hace exactamente lo que le piden. */
function cumpliendo(avance: Avance) {
  const objetivo = avance.objetivoActual
  const hechas = series(...Array(objetivo.series).fill(objetivo.cantidad))
  return siguienteAvance(
    avance,
    { rendimiento: rendimientoDeSesion(objetivo, hechas), tipico: logradoTipico(hechas) },
    ctx,
    0,
  )
}

describe('rendimientoDeSesion', () => {
  const objetivo: Objetivo = { series: 3, cantidad: 10 }

  it('cumplir exacto vale uno', () => {
    expect(rendimientoDeSesion(objetivo, series(10, 10, 10))).toBeCloseTo(1)
  })

  it('superarlo vale más de uno, pero con techo', () => {
    expect(rendimientoDeSesion(objetivo, series(12, 12, 12))).toBeGreaterThan(1)
    expect(rendimientoDeSesion(objetivo, series(50, 50, 50))).toBeCloseTo(1.25)
  })

  it('una serie floja pesa, pero no manda', () => {
    // El motor viejo juzgaba por la peor serie y esto contaba como fracaso.
    const casi = rendimientoDeSesion(objetivo, series(10, 10, 9))
    expect(casi).toBeGreaterThan(0.9)
    expect(casi).toBeLessThan(1)
  })

  it('abandonar a la mitad se penaliza fuerte, sin regla especial', () => {
    expect(rendimientoDeSesion(objetivo, series(10))).toBeLessThan(0.4)
  })

  it('no hacer nada vale cero', () => {
    expect(rendimientoDeSesion(objetivo, [])).toBe(0)
    expect(rendimientoDeSesion(objetivo, series(0, 0, 0))).toBe(0)
  })
})

describe('incremento proporcional', () => {
  it('mantiene el paso relativo a lo largo de la ventana', () => {
    expect(incremento('repeticiones', 5)).toBe(1)
    expect(incremento('repeticiones', 12)).toBe(1)
    expect(incremento('repeticiones', 20)).toBe(2)
    expect(incremento('segundos', 10)).toBe(3)
    expect(incremento('segundos', 30)).toBe(5)
  })

  it('nunca es cero', () => {
    expect(incremento('repeticiones', 1)).toBeGreaterThan(0)
    expect(incremento('segundos', 1)).toBeGreaterThan(0)
  })
})

describe('índice de carga', () => {
  it('hace comparables dos ejercicios distintos', () => {
    // Doce flexiones completas y ocho diamante son estados de fuerza parecidos.
    const completas = indiceDeCarga(ejercicio('flexion-completa'), 12)
    const diamante = indiceDeCarga(ejercicio('flexion-diamante'), 8)
    expect(Math.abs(completas - diamante) / completas).toBeLessThan(0.15)
  })

  it('sube al hacer más repeticiones del mismo ejercicio', () => {
    const e = ejercicio('flexion-completa')
    expect(indiceDeCarga(e, 10)).toBeGreaterThan(indiceDeCarga(e, 6))
  })

  it('cantidadParaCarga es la inversa de indiceDeCarga', () => {
    for (const id of ['flexion-completa', 'flexion-arquera']) {
      const e = ejercicio(id)
      for (const n of [3, 6, 9, 12]) {
        expect(cantidadParaCarga(e, indiceDeCarga(e, n))).toBeCloseTo(n, 0)
      }
    }
  })

  it('la curva de progreso NO se corta al cambiar de eslabón', () => {
    // Es la propiedad que justifica toda la aritmética de recalibración: el
    // registro crudo de repeticiones se desploma cada vez que se sube de nivel
    // (pasás de hacer 15 a hacer 6) y muestra un retroceso justo en el momento
    // de mayor logro. El índice de carga no.
    for (const cadena of [cadenaDe('empuje'), cadenaDe('piernas')]) {
      for (let i = 1; i < cadena.ejercicios.length; i++) {
        const desde = ejercicio(cadena.ejercicios[i - 1]!)
        const hacia = ejercicio(cadena.ejercicios[i]!)
        if (desde.medida !== hacia.medida) continue

        const cantidad = desde.ventana.max
        const nueva = recalibrar(desde, cantidad, hacia)
        const antes = indiceDeCarga(desde, cantidad)
        const despues = indiceDeCarga(hacia, nueva)

        // En los eslabones más livianos la fórmula se satura: quince
        // flexiones contra la pared están muy por encima del rango donde
        // Brzycki tiene algo que decir, así que el índice se queda corto y el
        // salto se nota. No es un problema real —los dos ejercicios son
        // fáciles y el motor corrige en dos sesiones— pero conviene que el
        // test lo diga en vez de taparlo con un umbral flojo para todos.
        const tolerancia = desde.ccr < 0.5 ? 0.35 : 0.2
        expect(
          Math.abs(despues - antes) / antes,
          `${desde.id} (${cantidad}) → ${hacia.id} (${nueva})`,
        ).toBeLessThan(tolerancia)
      }
    }
  })
})

describe('recalibrar', () => {
  it('entra al eslabón nuevo con una carga que se puede sostener', () => {
    const nueva = recalibrar(ejercicio('flexion-completa'), 12, ejercicio('flexion-diamante'))
    expect(nueva).toBeGreaterThanOrEqual(ejercicio('flexion-diamante').ventana.min)
    expect(nueva).toBeLessThan(12)
  })

  it('al bajar de eslabón propone más repeticiones', () => {
    const nueva = recalibrar(ejercicio('flexion-completa'), 5, ejercicio('flexion-rodillas'))
    expect(nueva).toBeGreaterThan(5)
  })

  it('sin traducción defendible entre unidades, entra por el piso', () => {
    const desde = ejercicio('remo-australiano-pies-elevados')
    const hacia = ejercicio('dominada-negativa')
    expect(recalibrar(desde, desde.ventana.max, hacia)).toBe(hacia.ventana.min)
  })

  it('nunca sale de la ventana del ejercicio de destino', () => {
    const hacia = ejercicio('flexion-completa')
    for (const n of [1, 5, 15, 40]) {
      const r = recalibrar(ejercicio('flexion-rodillas'), n, hacia)
      expect(r).toBeGreaterThanOrEqual(hacia.ventana.min)
      expect(r).toBeLessThanOrEqual(hacia.ventana.max)
    }
  })
})

describe('siguienteAvance', () => {
  it('cumplir sube el objetivo dentro de la ventana', () => {
    const avance = avanceEn('flexion-completa', 6)
    const d = cumpliendo(avance)
    expect(d.movimiento).toBe('subida')
    expect(d.avance.objetivoActual.cantidad).toBeGreaterThan(6)
    expect(d.cambioDeNivel).toBe(false)
  })

  it('cumplir en el techo de la ventana cambia de eslabón, después de consolidar', () => {
    const e = ejercicio('flexion-completa')
    let avance = avanceEn('flexion-completa', e.ventana.max)

    // Tocar el techo una vez no alcanza: un buen día no es dominar.
    for (let i = 0; i < CONSOLIDACION; i++) {
      const parcial = cumpliendo(avance)
      expect(parcial.cambioDeNivel, `sesión ${i + 1}`).toBe(false)
      avance = parcial.avance
    }

    const d = cumpliendo(avance)
    expect(d.cambioDeNivel).toBe(true)
    expect(d.movimiento).toBe('nivel-arriba')
    expect(d.avance.ejercicioId).toBe('flexion-diamante')
    expect(d.avance.graciaRestante).toBe(GRACIA)
  })

  it('en el techo, "un día de práctica más" es siempre la víspera del cambio, aunque quede gracia', () => {
    // Después de un retroceso se llega al techo con gracia, y el motor sostiene
    // mientras quede aunque ya lleves dos. Lo que dice tiene que coincidir con
    // lo que hace.
    const e = ejercicio('flexion-completa')
    let avance = avanceEn('flexion-completa', e.ventana.max, { graciaRestante: 3 })
    const dichos: string[] = []
    let d = cumpliendo(avance)
    while (!d.cambioDeNivel) {
      dichos.push(d.explicacion)
      avance = d.avance
      d = cumpliendo(avance)
    }
    expect(dichos).toHaveLength(3)
    expect(dichos[0]).toContain('Lo sostenemos 3 días de práctica')
    expect(dichos[1]).toContain('Lo sostenemos un par de días de práctica')
    expect(dichos[2]).toContain('Un día de práctica más así y cambiamos')
  })

  it('en el techo del último eslabón no promete cambiar de ejercicio', () => {
    const ultimo = empuje.ejercicios[empuje.ejercicios.length - 1]!
    const avance = avanceEn(ultimo, ejercicio(ultimo).ventana.max, {
      sesionesEnObjetivo: CONSOLIDACION - 1,
    })
    const d = cumpliendo(avance)
    expect(d.movimiento).toBe('sostiene')
    expect(d.explicacion).toContain('Un día de práctica más así y subimos.')
  })

  it('en la meseta del techo, lo que falta para cambiar sale de la gracia', () => {
    // Señal entre la mitad y la vara de subir: ni sube ni baja, y en la meseta
    // empuja hacia el siguiente cuando se termina la gracia.
    const e = ejercicio('flexion-completa')
    let avance = avanceEn('flexion-completa', e.ventana.max, {
      senal: 0.9,
      sesionesEnObjetivo: MESETA - 1,
      graciaRestante: 2,
    })
    const leer = (a: Avance) => siguienteAvance(a, { rendimiento: 0.9, tipico: 11 }, ctx, 0)
    const dichos: string[] = []
    let d = leer(avance)
    while (!d.cambioDeNivel && dichos.length < 5) {
      dichos.push(d.explicacion)
      avance = d.avance
      d = leer(avance)
    }
    expect(dichos).toEqual([
      'Seguimos en Flexiones completas. Faltan 2 días de práctica así para cambiar de ejercicio.',
      'Seguimos en Flexiones completas. Un día de práctica más así y cambiamos de ejercicio.',
    ])
    expect(d.movimiento).toBe('nivel-arriba')
  })

  it('en la meseta del último eslabón no hay a qué cambiar, pero se sube igual', () => {
    // Antes se sostenía, y con la señal entre las dos varas se sostenía para
    // siempre, con la misma frase.
    const ultimo = ejercicio(empuje.ejercicios[empuje.ejercicios.length - 1]!)
    const max = ultimo.ventana.max
    const avance = avanceEn(ultimo.id, max, { senal: 0.9, sesionesEnObjetivo: MESETA - 1 })
    const d = siguienteAvance(avance, { rendimiento: 0.9, tipico: max }, ctx, 0)
    const nueva = max + incremento(ultimo.medida, max)
    expect(d.movimiento).toBe('subida')
    expect(d.motivo).toBe('meseta')
    expect(d.cambioDeNivel).toBe(false)
    expect(d.avance.objetivoActual.cantidad).toBe(nueva)
    expect(d.explicacion).toBe(
      `Llevás varios días de práctica con este objetivo y estás listo: subimos a ${conUnidad(ultimo.medida, nueva)}.`,
    )
  })

  it('pasado el techo del último eslabón, ya no lo nombra como techo y lo que promete lo cumple', () => {
    const ultimo = ejercicio(empuje.ejercicios[empuje.ejercicios.length - 1]!)
    const encima = ultimo.ventana.max + 1
    let avance = avanceEn(ultimo.id, encima)
    const dichos: string[] = []
    let d = cumpliendo(avance)
    while (d.movimiento === 'sostiene' && dichos.length < 5) {
      dichos.push(d.explicacion)
      avance = d.avance
      d = cumpliendo(avance)
    }
    expect(dichos).toEqual([
      `Seguís sumando sobre ${ultimo.nombre}: lo sostenemos en ${conUnidad(ultimo.medida, encima)} por serie un par de días de práctica antes de subir.`,
      `Seguís sumando sobre ${ultimo.nombre}. Un día de práctica más así y subimos.`,
    ])
    expect(d.movimiento).toBe('subida')
    expect(d.avance.objetivoActual.cantidad).toBeGreaterThan(encima)
  })

  it('en el piso con gracia, lo que dice que sostiene es lo que sostiene', () => {
    const e = ejercicio('flexion-completa')
    let avance = avanceEn('flexion-completa', e.ventana.min, { senal: 0.5, graciaRestante: 3 })
    const leer = (a: Avance) => siguienteAvance(a, { rendimiento: 0.2, tipico: 2 }, ctx, 0)
    const dichos: string[] = []
    let d = leer(avance)
    while (d.movimiento === 'sostiene' && dichos.length < 5) {
      dichos.push(d.explicacion)
      avance = d.avance
      d = leer(avance)
    }
    expect(dichos).toEqual([
      'Flexiones completas todavía te está costando. Lo sostenemos tal cual, y seguimos en este ejercicio al menos 2 días de práctica más.',
      'Flexiones completas todavía te está costando. Lo sostenemos tal cual, y seguimos en este ejercicio al menos un día de práctica más.',
      'Flexiones completas todavía te está costando. Esta vez lo sostenemos tal cual.',
    ])
    expect(d.movimiento).toBe('nivel-abajo')
  })

  it('NO cambia de eslabón antes de dominar el actual', () => {
    // El defecto más caro del motor viejo: subía tras dos sesiones buenas sin
    // mirar nunca si se había llegado al objetivo declarado del ejercicio.
    let avance = avanceEn('flexion-pared', ejercicio('flexion-pared').ventana.min)
    for (let i = 0; i < 5; i++) {
      const d = cumpliendo(avance)
      expect(d.avance.ejercicioId, `sesión ${i + 1}`).toBe('flexion-pared')
      avance = d.avance
    }
  })

  it('el período de gracia evita el rebote entre dos eslabones', () => {
    const e = ejercicio('flexion-completa')
    let avance = avanceEn('flexion-completa', e.ventana.max, { graciaRestante: GRACIA })
    for (let i = 0; i < GRACIA; i++) {
      const d = cumpliendo(avance)
      expect(d.cambioDeNivel, `sesión ${i + 1}`).toBe(false)
      avance = d.avance
    }
    expect(cumpliendo(avance).cambioDeNivel).toBe(true)
  })

  it('venir flojo baja el objetivo', () => {
    const avance = avanceEn('flexion-completa', 10, { senal: BAJA })
    const hechas = series(4, 4, 3)
    const d = siguienteAvance(
      avance,
      { rendimiento: rendimientoDeSesion(avance.objetivoActual, hechas), tipico: 4 },
      ctx,
      0,
    )
    expect(d.movimiento).toBe('bajada')
    expect(d.avance.objetivoActual.cantidad).toBeLessThan(10)
  })

  it('desde el piso de la ventana, bajar significa volver un eslabón', () => {
    const e = ejercicio('flexion-completa')
    const avance = avanceEn('flexion-completa', e.ventana.min, { senal: 0.5 })
    const d = siguienteAvance(avance, { rendimiento: 0.2, tipico: 1 }, ctx, 0)
    expect(d.movimiento).toBe('nivel-abajo')
    expect(d.avance.ejercicioId).toBe('flexion-rodillas')
    // Y no entra en el techo del anterior: si no, dos buenas sesiones lo
    // devuelven al ejercicio que lo acaba de superar.
    expect(d.avance.objetivoActual.cantidad).toBeLessThan(
      ejercicio('flexion-rodillas').ventana.max,
    )
  })

  it('en el primer eslabón, el piso de la ventana deja de ser un piso', () => {
    // No hay ejercicio más fácil al que mandar a alguien, así que si el piso
    // de la ventana fuera intocable la app le pediría para siempre algo que no
    // le sale. Es el mismo agujero de antes, en el otro extremo de la cadena.
    const e = ejercicio('flexion-pared')
    const avance = avanceEn('flexion-pared', e.ventana.min, { senal: 0.4 })
    const d = siguienteAvance(avance, { rendimiento: 0.2, tipico: 2 }, ctx, 0)
    expect(d.cambioDeNivel).toBe(false)
    expect(d.avance.objetivoActual.cantidad).toBeLessThan(e.ventana.min)
  })

  it('pero no baja de una repetición', () => {
    const avance = avanceEn('flexion-pared', 1, { senal: 0.3 })
    const d = siguienteAvance(avance, { rendimiento: 0, tipico: 0 }, ctx, 0)
    expect(d.avance.objetivoActual.cantidad).toBe(1)
    expect(d.explicacion).toContain('primer nivel')
  })

  it('quedarse quieto tiene fecha de vencimiento', () => {
    // Éste es el agujero que dejaba a alguien meses con la misma frase: ni
    // éxito ni fallo, y las dos rachas en cero.
    let avance = avanceEn('flexion-completa', 10)
    const hechas = series(9, 9, 9)
    const evaluacion = {
      rendimiento: rendimientoDeSesion({ series: 3, cantidad: 10 }, hechas),
      tipico: 9,
    }

    const movimientos: string[] = []
    for (let i = 0; i < MESETA + 1; i++) {
      const d = siguienteAvance(avance, evaluacion, ctx, i)
      movimientos.push(d.movimiento)
      avance = d.avance
    }
    expect(movimientos.filter((m) => m === 'sostiene').length).toBeLessThanOrEqual(MESETA)
    expect(movimientos.some((m) => m !== 'sostiene')).toBe(true)
  })

  it('en meseta con la señal baja, el objetivo baja a lo que la persona hace', () => {
    let avance = avanceEn('flexion-completa', 11, { senal: 0.82, sesionesEnObjetivo: MESETA - 1 })
    const d = siguienteAvance(avance, { rendimiento: 0.8, tipico: 8 }, ctx, 0)
    expect(d.avance.objetivoActual.cantidad).toBeLessThanOrEqual(9)
    expect(d.explicacion).toBe(
      'El objetivo de 11 por serie no se termina de cerrar. Era optimista: lo llevamos a 8, que es lo que te salió esta vez.',
    )
    expect(d.motivo).toBe('meseta')
  })

  it('si lo típico es una traducción de otros kilos, no dice que es lo que te salió', () => {
    const avance = avanceEn('flexion-completa', 11, { senal: 0.82, sesionesEnObjetivo: MESETA - 1 })
    const d = siguienteAvance(avance, { rendimiento: 0.8, tipico: 8, tipicoEsCuenta: true }, ctx, 0)
    expect(d.avance.objetivoActual.cantidad).toBe(8)
    expect(d.explicacion).toBe('El objetivo de 11 por serie no se termina de cerrar. Era optimista: lo llevamos a 8.')
  })

  it('si lo de esta vez quedó más cerca, baja un paso y no dice que es lo que salió', () => {
    const avance = avanceEn('flexion-completa', 11, { senal: 0.82, sesionesEnObjetivo: MESETA - 1 })
    const d = siguienteAvance(avance, { rendimiento: 0.8, tipico: 11 }, ctx, 0)
    expect(d.avance.objetivoActual.cantidad).toBe(10)
    expect(d.explicacion).toBe(
      'El objetivo de 11 por serie no se termina de cerrar. Era optimista: lo llevamos a 10.',
    )
  })

  it('una sesión neutra no mueve absolutamente nada', () => {
    const avance = avanceEn('flexion-completa', 8, { senal: 0.9, sesionesEnObjetivo: 2 })
    const d = siguienteAvance(avance, { rendimiento: 0.1, tipico: 1, neutra: true }, ctx, 5)
    expect(d.movimiento).toBe('neutra')
    expect(d.avance.senal).toBe(avance.senal)
    expect(d.avance.objetivoActual).toEqual(avance.objetivoActual)
    expect(d.avance.sesionesEnObjetivo).toBe(avance.sesionesEnObjetivo)
  })

  it('una sesión protegida no arrastra la señal para abajo', () => {
    const avance = avanceEn('flexion-completa', 8, { senal: 1 })
    const d = siguienteAvance(avance, { rendimiento: 0.3, tipico: 3, protegida: true }, ctx, 0)
    expect(d.avance.senal).toBe(1)
  })

  it('pero una sesión protegida que sale bien sí cuenta', () => {
    const avance = avanceEn('flexion-completa', 8, { senal: 0.7 })
    const d = siguienteAvance(avance, { rendimiento: 1.2, tipico: 9, protegida: true }, ctx, 0)
    expect(d.avance.senal).toBeGreaterThan(0.7)
  })

  describe('una lectura floja protegida se sostiene tal cual', () => {
    // Tres series de 3 contra 3 × el objetivo: floja con cualquier señal.
    const floja = (avance: Avance) => {
      const hechas = series(3, 3, 3)
      return siguienteAvance(
        avance,
        {
          rendimiento: rendimientoDeSesion(avance.objetivoActual, hechas),
          tipico: logradoTipico(hechas),
          protegida: true,
        },
        ctx,
        5,
      )
    }
    const tal = (d: ReturnType<typeof floja>, avance: Avance) => {
      expect(d.movimiento).toBe('sostiene')
      expect(d.cambioDeNivel).toBe(false)
      expect(d.motivo).toBe('protegida')
      expect(d.explicacion).toBe(PROTEGIDA_EN_UN_DIA_FLOJO)
      // Tal cual, salvo la racha de protegidas, que suma una.
      expect(d.avance).toEqual({ ...avance, protegidasSeguidas: 1, actualizadoEn: 5 })
    }

    it('con la señal alta y techo por delante, no sube el objetivo', () => {
      const avance = avanceEn('flexion-completa', 10, { senal: 1 })
      tal(floja(avance), avance)
    })

    it('en el techo, ni consolida ni cambia de eslabón', () => {
      const techo = ejercicio('flexion-completa').ventana.max
      for (const sesionesEnObjetivo of [1, CONSOLIDACION]) {
        const avance = avanceEn('flexion-completa', techo, { senal: 1, sesionesEnObjetivo })
        tal(floja(avance), avance)
      }
    })

    it('en la meseta, ni baja ni retrocede de eslabón', () => {
      const avance = avanceEn('flexion-completa', 8, { senal: 0.8, sesionesEnObjetivo: MESETA - 1 })
      tal(floja(avance), avance)
    })

    it('con gracia por delante, no la gasta', () => {
      const avance = avanceEn('flexion-completa', 8, { senal: 0.9, graciaRestante: 2 })
      tal(floja(avance), avance)
    })

    it('una que igual cumple, aunque quede por debajo de la señal, cuenta', () => {
      const avance = avanceEn('flexion-completa', 8, { senal: 1.2 })
      const d = siguienteAvance(avance, { rendimiento: 1, tipico: 8, protegida: true }, ctx, 0)
      expect(d.movimiento).toBe('subida')
      expect(d.motivo).toBeUndefined()
    })

    it('una que sale mejor que lo que venía sube la señal, pero no baja nada', () => {
      const avance = avanceEn('flexion-completa', 8, { senal: 0.5 })
      // Sin protección, la señal sube y aun así queda por debajo de la vara de
      // bajar: baja el objetivo. Protegida, una peor se sostenía y esta, que
      // salió mejor, bajaba.
      expect(siguienteAvance(avance, { rendimiento: 0.7, tipico: 6 }, ctx, 0).movimiento).toBe('bajada')
      const d = siguienteAvance(avance, { rendimiento: 0.7, tipico: 6, protegida: true }, ctx, 0)
      expect(d.movimiento).toBe('sostiene')
      expect(d.motivo).toBe('protegida')
      expect(d.explicacion).toBe(PROTEGIDA_EN_UN_DIA_FLOJO)
      expect(d.avance.objetivoActual).toEqual(avance.objetivoActual)
      expect(d.avance.ejercicioId).toBe(avance.ejercicioId)
      expect(d.avance.senal).toBeGreaterThan(0.5)
    })

    it('ninguna protegida que no llegó baja el objetivo ni retrocede de eslabón', () => {
      for (const id of empuje.ejercicios) {
        const e = ejercicio(id)
        for (const cantidad of [e.ventana.min, Math.round((e.ventana.min + e.ventana.max) / 2), e.ventana.max]) {
          for (const senal of [0.2, 0.5, 0.76, 0.9, 1.1]) {
            for (const sesionesEnObjetivo of [0, MESETA - 1]) {
              for (const graciaRestante of [0, 2]) {
                const avance = avanceEn(id, cantidad, {
                  senal,
                  sesionesEnObjetivo,
                  graciaRestante,
                  protegidasSeguidas: MESETA - 2,
                })
                for (const rendimiento of [0, 0.3, 0.6, 0.8, 0.94, 0.99]) {
                  const d = siguienteAvance(avance, { rendimiento, tipico: 1, protegida: true }, ctx, 0)
                  const donde = `${id} ${cantidad} señal ${senal} r ${rendimiento}`
                  expect(['bajada', 'nivel-abajo'], donde).not.toContain(d.movimiento)
                }
              }
            }
          }
        }
      }
    })
  })

  describe('la protección vence', () => {
    // Si no venciera, alguien que siempre hace diamantes antes de las
    // completas quedaba con la misma frase para siempre.
    const avance = avanceEn('flexion-completa', 10, { senal: 0.9 })
    const floja = (seguidas: number) =>
      siguienteAvance(
        { ...avance, protegidasSeguidas: seguidas },
        { rendimiento: 0.6, tipico: 7, protegida: true },
        ctx,
        5,
      )

    it(`sostiene las primeras ${MESETA - 1} flojas protegidas seguidas`, () => {
      for (let seguidas = 0; seguidas < MESETA - 1; seguidas++) {
        const d = floja(seguidas)
        expect(d.motivo, `${seguidas} antes`).toBe('protegida')
        expect(d.avance.protegidasSeguidas, `${seguidas} antes`).toBe(seguidas + 1)
      }
    })

    it(`a la ${MESETA}ª, lleva el objetivo a lo que la persona hace, y lo dice como meseta`, () => {
      const d = floja(MESETA - 1)
      expect(d.movimiento).toBe('bajada')
      expect(d.motivo).toBe('meseta')
      expect(d.cambioDeNivel).toBe(false)
      expect(d.avance.ejercicioId).toBe('flexion-completa')
      expect(d.avance.objetivoActual.cantidad).toBe(7)
      expect(d.avance.sesionesEnObjetivo).toBe(0)
      expect(d.explicacion).toBe(
        'El objetivo de 10 por serie no se termina de cerrar. Era optimista: lo llevamos a 7, que es lo que te salió esta vez.',
      )
      // La lectura contó: la racha vuelve a cero, y la señal la arrastró
      // como a cualquier otra.
      expect(d.avance.protegidasSeguidas).toBeUndefined()
      expect(d.avance.senal).toBeCloseTo(0.5 * 0.6 + 0.5 * 0.9)
      expect(d.avance.graciaRestante).toBe(0)
    })

    it('vencida y sin adónde bajar el objetivo, cuenta como cualquier otra', () => {
      // En el piso de la ventana no hay objetivo más chico: lo que decide es
      // el resto del motor, exactamente como sin protección.
      const piso = avanceEn('flexion-completa', 5, { senal: 0.5 })
      const evaluacion = { rendimiento: 0.2, tipico: 1 }
      const sinProteger = siguienteAvance(piso, evaluacion, ctx, 0)
      const protegida = { ...evaluacion, protegida: true }
      expect(siguienteAvance(piso, protegida, ctx, 0).motivo).toBe('protegida')
      const d = siguienteAvance({ ...piso, protegidasSeguidas: MESETA - 1 }, protegida, ctx, 0)
      expect(d.movimiento).toBe(sinProteger.movimiento)
      expect(d.movimiento).toBe('nivel-abajo')
      expect(d.explicacion).toBe(sinProteger.explicacion)
      expect(d.avance).toEqual(sinProteger.avance)
      expect(d.avance.ejercicioId).not.toBe('flexion-completa')
    })

    it('vencida, lo que la movió es la racha: se firma como meseta en cualquier rama', () => {
      for (const id of empuje.ejercicios) {
        const e = ejercicio(id)
        for (const cantidad of [e.ventana.min, e.ventana.max]) {
          for (const senal of [0.5, 0.8, 1]) {
            const avance = avanceEn(id, cantidad, { senal, protegidasSeguidas: MESETA - 1 })
            const d = siguienteAvance(avance, { rendimiento: 0.3, tipico: 1, protegida: true }, ctx, 0)
            expect(d.motivo, `${id} ${cantidad} ${senal}`).not.toBe('protegida')
            if (d.movimiento !== 'sostiene') expect(d.motivo, `${id} ${cantidad} ${senal}`).toBe('meseta')
          }
        }
      }
    })

    it('cualquier lectura que cuenta corta la racha, y una neutra no', () => {
      const conRacha = avanceEn('flexion-completa', 10, { senal: 0.9, protegidasSeguidas: 2 })
      const neutra = siguienteAvance(conRacha, { rendimiento: 0.2, tipico: 2, neutra: true }, ctx, 0)
      expect(neutra.avance.protegidasSeguidas).toBe(2)
      for (const rendimiento of [0.3, 0.8, 1, 1.2]) {
        const d = siguienteAvance(conRacha, { rendimiento, tipico: 10 }, ctx, 0)
        expect(d.avance.protegidasSeguidas, `r ${rendimiento}`).toBeUndefined()
      }
      // Una protegida que igual cumple también cuenta, y la corta.
      const buena = siguienteAvance(conRacha, { rendimiento: 1.1, tipico: 11, protegida: true }, ctx, 0)
      expect(buena.motivo).toBeUndefined()
      expect(buena.avance.protegidasSeguidas).toBeUndefined()
    })
  })

  describe('el día que llega al total, no baja nada', () => {
    it('ni con la señal hundida por lo de antes', () => {
      const avance = avanceEn('flexion-completa', 8, { senal: 0.4 })
      const d = siguienteAvance(avance, { rendimiento: 1, tipico: 8 }, ctx, 0)
      expect(d.movimiento).toBe('sostiene')
      expect(d.explicacion).toBe(LLEGASTE_AL_TOTAL)
      expect(d.avance.objetivoActual).toEqual(avance.objetivoActual)
    })

    it('ni en la meseta de abajo', () => {
      const avance = avanceEn('flexion-completa', 11, { senal: 0.6, sesionesEnObjetivo: MESETA - 1 })
      const d = siguienteAvance(avance, { rendimiento: 1, tipico: 11 }, ctx, 0)
      expect(d.movimiento).toBe('sostiene')
      expect(d.explicacion).toBe(LLEGASTE_AL_TOTAL)
    })

    it('en ningún eslabón, con ninguna señal', () => {
      for (const id of empuje.ejercicios) {
        const e = ejercicio(id)
        for (const cantidad of [e.ventana.min, e.ventana.max]) {
          for (const senal of [0, 0.3, 0.6, 0.8]) {
            for (const sesionesEnObjetivo of [0, MESETA - 1]) {
              const avance = avanceEn(id, cantidad, { senal, sesionesEnObjetivo })
              for (const rendimiento of [1, 1.1, 1.25]) {
                const d = siguienteAvance(avance, { rendimiento, tipico: cantidad }, ctx, 0)
                expect(['bajada', 'nivel-abajo'], `${id} ${cantidad} ${senal}`).not.toContain(d.movimiento)
                expect(d.explicacion).not.toMatch(/cortas|costando|grande|no se termina de cerrar/)
              }
            }
          }
        }
      }
    })
  })

  describe('lo que dice al sostener, de cerca y de lejos', () => {
    it('"quedaste cerca" solo si quedó cerca', () => {
      const cerca = siguienteAvance(avanceEn('flexion-completa', 8, { senal: 0.8 }), { rendimiento: 0.9, tipico: 8 }, ctx, 0)
      expect(cerca.movimiento).toBe('sostiene')
      expect(cerca.explicacion).toBe('Quedaste cerca. Repetimos el mismo objetivo para consolidarlo.')

      const lejos = siguienteAvance(avanceEn('flexion-completa', 8, { senal: 0.95 }), { rendimiento: 0.7, tipico: 6 }, ctx, 0)
      expect(lejos.movimiento).toBe('sostiene')
      expect(lejos.explicacion).toBe('Repetimos el mismo objetivo para consolidarlo.')

      const llego = siguienteAvance(avanceEn('flexion-completa', 8, { senal: 0.6 }), { rendimiento: 1, tipico: 8 }, ctx, 0)
      expect(llego.movimiento).toBe('sostiene')
      expect(llego.explicacion).toBe('Repetimos el mismo objetivo para consolidarlo.')
    })

    it('"objetivo cumplido" solo si se cumplió', () => {
      // La señal pasa la vara de subir también con una sesión que no llegó,
      // por lo que venía de antes.
      const avance = avanceEn('flexion-completa', 8, { senal: 1.2 })
      const sinCumplir = siguienteAvance(avance, { rendimiento: 0.9, tipico: 8 }, ctx, 0)
      expect(sinCumplir.movimiento).toBe('subida')
      expect(sinCumplir.avance.senal).toBeGreaterThanOrEqual(SUBE)
      expect(sinCumplir.explicacion).toBe('Subimos a 9 por serie.')
      const cumplido = siguienteAvance(avance, { rendimiento: 1, tipico: 8, cumplido: true }, ctx, 0)
      expect(cumplido.explicacion).toBe('Objetivo cumplido. Subimos a 9 por serie.')
    })
  })

  it('no sube la exigencia si la persona la está pasando mal', () => {
    const avance = avanceEn('flexion-completa', 8, { senal: 1 })
    const d = siguienteAvance(avance, { rendimiento: 1, tipico: 8, animo: -1.5 }, ctx, 0)
    expect(d.movimiento).toBe('sostiene')
    expect(d.avance.objetivoActual.cantidad).toBe(8)
    expect(d.explicacion).toContain('consolidar')
  })

  it('la señal se mueve siempre que la sesión cuenta', () => {
    const avance = avanceEn('flexion-completa', 8, { senal: 1 })
    const d = siguienteAvance(avance, { rendimiento: 0.5, tipico: 4 }, ctx, 0)
    expect(d.avance.senal).toBeLessThan(1)
    expect(d.avance.senal).toBeGreaterThan(0.5)
  })
})

describe('ubicarEnCadena', () => {
  it('sin prueba, arranca desde el principio', () => {
    const a = ubicarEnCadena(empuje, POR_ID, 'flexion-completa', 0, 0)
    expect(a.ejercicioId).toBe(empuje.ejercicios[0])
  })

  it('quien ya hace flexiones completas no empieza contra la pared', () => {
    const a = ubicarEnCadena(empuje, POR_ID, 'flexion-completa', 12, 0)
    expect(empuje.ejercicios.indexOf(a.ejercicioId)).toBeGreaterThan(2)
  })

  it('ubica más arriba a quien hace más', () => {
    const pocas = ubicarEnCadena(empuje, POR_ID, 'flexion-completa', 3, 0)
    const muchas = ubicarEnCadena(empuje, POR_ID, 'flexion-completa', 14, 0)
    expect(empuje.ejercicios.indexOf(muchas.ejercicioId)).toBeGreaterThan(
      empuje.ejercicios.indexOf(pocas.ejercicioId),
    )
  })

  it('deja el objetivo dentro de la ventana del ejercicio elegido', () => {
    for (const n of [1, 4, 8, 15, 30]) {
      const a = ubicarEnCadena(empuje, POR_ID, 'flexion-completa', n, 0)
      const e = ejercicio(a.ejercicioId)
      expect(a.objetivoActual.cantidad).toBeGreaterThanOrEqual(e.ventana.min)
      expect(a.objetivoActual.cantidad).toBeLessThanOrEqual(e.ventana.max)
    }
  })

  it('baja un escalón a propósito, porque el autorreporte viene inflado', () => {
    // Con el mismo número declarado, la ubicación es un eslabón más abajo que
    // la que sale de la cuenta cruda.
    const cruda = ubicarEnCadena(empuje, POR_ID, 'flexion-completa', 12, 0)
    const conDescuento = empuje.ejercicios.indexOf(cruda.ejercicioId)

    // Y el descuento no puede ser tan grande como para mandar a alguien que
    // hace doce flexiones completas de vuelta a la pared.
    expect(conDescuento).toBeGreaterThanOrEqual(2)
  })

  it('quien llega al techo de un eslabón queda por encima de ese eslabón', () => {
    const a = ubicarEnCadena(empuje, POR_ID, 'flexion-diamante', 12, 0)
    const posicion = empuje.ejercicios.indexOf(a.ejercicioId)
    const diamante = empuje.ejercicios.indexOf('flexion-diamante')
    expect(posicion).toBeGreaterThanOrEqual(diamante)
    // Pero nunca más de dos eslabones por encima: el descuento de seguridad
    // existe justamente para que un número inflado no termine en una lesión.
    expect(posicion).toBeLessThanOrEqual(diamante + 2)
  })
})

describe('avanceInicial y porcentaje', () => {
  it('arranca en el primer eslabón con la señal neutra', () => {
    const a = avanceInicial(empuje, POR_ID, 7)
    expect(a.ejercicioId).toBe(empuje.ejercicios[0])
    expect(a.objetivoActual.cantidad).toBe(ejercicio(empuje.ejercicios[0]!).ventana.min)
    expect(a.senal).toBe(1)
    expect(a.actualizadoEn).toBe(7)
  })

  it('el porcentaje crece con la cadena y nunca se va de rango', () => {
    const primero = porcentajeDeCadena(avanceInicial(empuje, POR_ID, 0), empuje, POR_ID)
    const ultimo = porcentajeDeCadena(
      avanceEn('flexion-una-mano', ejercicio('flexion-una-mano').ventana.max),
      empuje,
      POR_ID,
    )
    expect(primero).toBeGreaterThanOrEqual(0)
    expect(ultimo).toBeLessThanOrEqual(100)
    expect(ultimo).toBeGreaterThan(primero)
  })
})

describe('rellenoDeVentana', () => {
  // El relleno del segmento actual en la barra de cada cadena.
  it('va de 0 en el piso a 1 en el techo, con repeticiones', () => {
    const diamante = ejercicio('flexion-diamante') // ventana de 5 a 12
    expect(rellenoDeVentana(diamante, 5)).toBe(0)
    expect(rellenoDeVentana(diamante, 12)).toBe(1)
    expect(rellenoDeVentana(diamante, 9)).toBeCloseTo(4 / 7)
  })

  it('y con segundos', () => {
    const plancha = ejercicio('plancha') // ventana de 15 a 30 segundos
    expect(rellenoDeVentana(plancha, 15)).toBe(0)
    expect(rellenoDeVentana(plancha, 22.5)).toBeCloseTo(0.5)
    expect(rellenoDeVentana(plancha, 30)).toBe(1)
  })

  it('acota lo que cae fuera de la ventana', () => {
    const diamante = ejercicio('flexion-diamante')
    expect(rellenoDeVentana(diamante, 2)).toBe(0)
    expect(rellenoDeVentana(diamante, 20)).toBe(1)
  })

  it('una ventana sin recorrido da 0 y no NaN', () => {
    const plana = { ...ejercicio('flexion-diamante'), ventana: { min: 8, max: 8 } }
    expect(rellenoDeVentana(plana, 8)).toBe(0)
  })

  it('es la misma cuenta que usa el porcentaje de la cadena', () => {
    const a = avanceEn('flexion-diamante', 9)
    const posicion = empuje.ejercicios.indexOf('flexion-diamante')
    expect(porcentajeDeCadena(a, empuje, POR_ID)).toBe(
      Math.round(((posicion + rellenoDeVentana(ejercicio('flexion-diamante'), 9)) / empuje.ejercicios.length) * 100),
    )
  })
})

describe('conUnidad', () => {
  it('dice segundos cuando son segundos', () => {
    expect(conUnidad('segundos', 30)).toBe('30 segundos')
    expect(conUnidad('repeticiones', 12)).toBe('12')
  })
})

describe('proyectar', () => {
  it('estima cuántas sesiones faltan para llegar a un ejercicio', () => {
    const inicial = avanceInicial(empuje, POR_ID, 0)
    const sesiones = proyectar(inicial, ctx, 'flexion-completa')
    expect(sesiones).toBeGreaterThan(20)
    expect(sesiones).toBeLessThan(200)
  })

  it('cuanto más lejos está el ejercicio, más sesiones faltan', () => {
    const inicial = avanceInicial(empuje, POR_ID, 0)
    expect(proyectar(inicial, ctx, 'flexion-arquera')!).toBeGreaterThan(
      proyectar(inicial, ctx, 'flexion-completa')!,
    )
  })

  it('no proyecta hacia atrás ni hacia donde ya estás', () => {
    const avance = avanceEn('flexion-diamante', 8)
    expect(proyectar(avance, ctx, 'flexion-completa')).toBeNull()
    expect(proyectar(avance, ctx, 'flexion-diamante')).toBeNull()
  })
})

describe('eslabones cerrados', () => {
  // El motor no sabe POR QUÉ un eslabón está cerrado —eso lo decide
  // `apertura.ts`, mirando el equipo y las otras cadenas—: solo recibe la
  // lista. Acá se prueba la mecánica sobre empuje con un cierre inventado, así
  // no depende de qué ejercicios cuelgan hoy.
  const diamante = ejercicio('flexion-diamante')
  const completa = ejercicio('flexion-completa')
  const cerrados = new Map<string, Cierre>([
    ['flexion-diamante', { motivo: 'requisito', requisito: ejercicio('dominada-completa') }],
  ])
  const ctxCerrado = { cadena: empuje, ejercicios: POR_ID, cerrados }
  const sinBarra = {
    ...ctxCerrado,
    cerrados: new Map<string, Cierre>([['flexion-diamante', { motivo: 'sin-barra' }]]),
  }

  function cumpliendoCon(avance: Avance, contexto: typeof ctxCerrado) {
    const objetivo = avance.objetivoActual
    const hechas = series(...Array(objetivo.series).fill(objetivo.cantidad))
    return siguienteAvance(
      avance,
      { rendimiento: rendimientoDeSesion(objetivo, hechas), tipico: logradoTipico(hechas) },
      contexto,
      0,
    )
  }

  it('dominar el eslabón no sube a uno cerrado: suma volumen y dice qué falta', () => {
    let avance = avanceEn('flexion-completa', completa.ventana.max, {
      sesionesEnObjetivo: CONSOLIDACION,
    })
    for (let i = 0; i < 30; i++) {
      const d = cumpliendoCon(avance, ctxCerrado)
      expect(d.cambioDeNivel, `sesión ${i + 1}`).toBe(false)
      expect(d.avance.ejercicioId).toBe('flexion-completa')
      expect(d.movimiento).toBe('subida')
      expect(d.explicacion).toContain(diamante.nombre)
      expect(d.explicacion).toContain('Dominadas completas')
      expect(d.avance.objetivoActual.cantidad).toBeGreaterThan(avance.objetivoActual.cantidad)
      avance = d.avance
    }
  })

  it('con un mínimo en el requisito, lo nombra: no alcanza con llegar', () => {
    const conMinimo = {
      ...ctxCerrado,
      cerrados: new Map<string, Cierre>([
        [
          'flexion-diamante',
          {
            motivo: 'requisito',
            requisito: ejercicio('dominada-completa'),
            minimo: { series: 3, cantidad: 8 },
          },
        ],
      ]),
    }
    const avance = avanceEn('flexion-completa', completa.ventana.max, {
      sesionesEnObjetivo: CONSOLIDACION,
    })
    const d = cumpliendoCon(avance, conMinimo)
    expect(d.cambioDeNivel).toBe(false)
    expect(d.explicacion).toContain(
      `Lo que sigue, ${diamante.nombre}, se abre cuando llegues a 3 series de 8 dominadas completas`,
    )
  })

  it('sin barra, dice que el siguiente necesita una y dónde avisar si la conseguís', () => {
    const avance = avanceEn('flexion-completa', completa.ventana.max, {
      sesionesEnObjetivo: CONSOLIDACION,
    })
    const d = cumpliendoCon(avance, sinBarra)
    expect(d.cambioDeNivel).toBe(false)
    expect(d.explicacion).toContain('necesita una barra')
    expect(d.explicacion).toContain('Ajustes')
  })

  it('llegar al techo no promete pasar de nivel si el siguiente está cerrado', () => {
    const casi = avanceEn('flexion-completa', completa.ventana.max - 1)
    expect(cumpliendo(casi).explicacion).toContain('pasás de nivel')
    expect(cumpliendoCon(casi, ctxCerrado).explicacion).not.toContain('pasás de nivel')
  })

  it('la meseta con el siguiente cerrado no promete cambiar: suma acá, y lo dice', () => {
    // Señal entre las dos varas, cuatro días en el techo: sin cierre, el
    // motor da el empujón y cambia de ejercicio.
    const avance = avanceEn('flexion-completa', completa.ventana.max, {
      senal: 0.9,
      sesionesEnObjetivo: MESETA - 1,
    })
    const evaluacion = { rendimiento: 0.9, tipico: completa.ventana.max }
    expect(siguienteAvance(avance, evaluacion, ctx, 0).cambioDeNivel).toBe(true)

    const d = siguienteAvance(avance, evaluacion, ctxCerrado, 0)
    const nueva = completa.ventana.max + incremento(completa.medida, completa.ventana.max)
    expect(d.cambioDeNivel).toBe(false)
    expect(d.movimiento).toBe('subida')
    expect(d.motivo).toBe('meseta')
    expect(d.avance.ejercicioId).toBe('flexion-completa')
    expect(d.avance.objetivoActual.cantidad).toBe(nueva)
    expect(d.explicacion).toBe(
      `Llevás varios días de práctica con este objetivo y estás listo: subimos a ${conUnidad(completa.medida, nueva)}. Lo que sigue, ${diamante.nombre}, se abre cuando llegues a Dominadas completas: mientras tanto seguís sumando acá.`,
    )
    expect(d.explicacion).not.toMatch(/cambiamos|cambiar de ejercicio/)
  })

  it('la meseta con el siguiente cerrado no se traba: con la misma lectura, sigue sumando', () => {
    // Antes se sostenía en esta franja de señal, y como la señal no se movía,
    // se sostenía para siempre con la misma frase.
    let avance = avanceEn('flexion-completa', completa.ventana.max, { senal: 0.9 })
    const frases = new Set<string>()
    for (let dia = 0; dia < 4 * MESETA; dia++) {
      const d = siguienteAvance(avance, { rendimiento: 0.9, tipico: completa.ventana.max }, ctxCerrado, 0)
      expect(d.cambioDeNivel, `día ${dia + 1}`).toBe(false)
      frases.add(d.explicacion)
      avance = d.avance
    }
    expect(avance.objetivoActual.cantidad).toBeGreaterThan(completa.ventana.max + 1)
    expect(frases.size).toBeGreaterThan(1)
  })

  it('la meseta con el siguiente cerrado y el ánimo bajo se queda, y dice por qué', () => {
    const avance = avanceEn('flexion-completa', completa.ventana.max, {
      senal: 0.9,
      sesionesEnObjetivo: MESETA - 1,
    })
    const d = siguienteAvance(avance, { rendimiento: 0.9, tipico: completa.ventana.max, animo: -1 }, ctxCerrado, 0)
    expect(d.movimiento).toBe('sostiene')
    expect(d.avance.objetivoActual).toEqual(avance.objetivoActual)
    expect(d.explicacion).toBe(
      'Llevás varios días con este objetivo, pero las últimas sesiones se te hicieron cuesta arriba. Nos quedamos acá para consolidar.',
    )
  })

  it('bajar a un eslabón cerrado sí puede: bajar nunca es el riesgo', () => {
    const declinada = ejercicio('flexion-declinada')
    const avance = avanceEn('flexion-declinada', declinada.ventana.min, { senal: 0.5 })
    const d = siguienteAvance(avance, { rendimiento: 0.2, tipico: 1 }, ctxCerrado, 0)
    expect(d.movimiento).toBe('nivel-abajo')
    expect(d.avance.ejercicioId).toBe('flexion-diamante')
  })

  it('sin cierres, el motor hace exactamente lo de siempre', () => {
    const avance = avanceEn('flexion-completa', completa.ventana.max, {
      sesionesEnObjetivo: CONSOLIDACION,
    })
    const vacio = { cadena: empuje, ejercicios: POR_ID, cerrados: new Map<string, Cierre>() }
    expect(cumpliendoCon(avance, vacio)).toEqual(cumpliendo(avance))
  })

  it('no proyecta sesiones hasta un eslabón cerrado, ni más allá de uno', () => {
    const avance = avanceEn('flexion-rodillas', 8)
    expect(proyectar(avance, ctx, 'flexion-completa')).not.toBeNull()
    expect(proyectar(avance, ctxCerrado, 'flexion-completa')).not.toBeNull()
    expect(proyectar(avance, ctxCerrado, 'flexion-diamante')).toBeNull()
    expect(proyectar(avance, ctxCerrado, 'flexion-una-mano')).toBeNull()
  })
})

describe('requisitoDicho', () => {
  it('sin mínimo, el nombre del eslabón: alcanza con llegar', () => {
    expect(requisitoDicho(ejercicio('dominada-completa'))).toBe('Dominadas completas')
  })

  it('con mínimo, series y cantidad del eslabón, en minúscula', () => {
    expect(requisitoDicho(ejercicio('dominada-completa'), { series: 3, cantidad: 8 })).toBe(
      '3 series de 8 dominadas completas',
    )
  })

  it('en segundos, con la unidad', () => {
    expect(requisitoDicho(ejercicio('plancha'), { series: 3, cantidad: 30 })).toBe(
      '3 series de 30 segundos de plancha',
    )
  })
})

describe('ubicarEnCadena con techo', () => {
  it('no ubica por encima del techo, aunque la cuenta dé más', () => {
    for (const n of [12, 20, 30]) {
      const libre = ubicarEnCadena(empuje, POR_ID, 'flexion-completa', n, 0)
      const conTecho = ubicarEnCadena(empuje, POR_ID, 'flexion-completa', n, 0, 'flexion-rodillas')
      expect(empuje.ejercicios.indexOf(libre.ejercicioId)).toBeGreaterThan(
        empuje.ejercicios.indexOf('flexion-rodillas'),
      )
      expect(conTecho.ejercicioId).toBe('flexion-rodillas')
      const e = ejercicio('flexion-rodillas')
      expect(conTecho.objetivoActual.cantidad).toBeGreaterThanOrEqual(e.ventana.min)
      expect(conTecho.objetivoActual.cantidad).toBeLessThanOrEqual(e.ventana.max)
    }
  })

  it('por debajo del techo no cambia nada', () => {
    for (const n of [0, 1, 3, 5]) {
      expect(ubicarEnCadena(empuje, POR_ID, 'flexion-completa', n, 0, 'flexion-una-mano')).toEqual(
        ubicarEnCadena(empuje, POR_ID, 'flexion-completa', n, 0),
      )
    }
  })
})

describe('la serie de cierre no opina', () => {
  const objetivo: Objetivo = { series: 3, cantidad: 12 }

  // La serie de cierre es trabajo real y se guarda, pero se hace hasta donde
  // dé después de haber cumplido: si entrara al promedio, cumplir el objetivo
  // y encima dejar algo más en el tanque daría MÁS de 1,00 y podría disparar
  // un salto de eslabón que no se ganó.
  it('cumplir exacto sigue valiendo exactamente uno, con cierre o sin él', () => {
    const conCierre: Serie[] = [...series(12, 12, 12), { logrado: 7, cierre: true }]
    expect(rendimientoDeSesion(objetivo, conCierre)).toBeCloseTo(1, 10)
  })

  it('y si contara, no valdría uno —que es de dónde vino el defecto', () => {
    const comoSiContara = series(12, 12, 12, 7)
    expect(rendimientoDeSesion(objetivo, comoSiContara)).toBeGreaterThan(1)
  })

  it('tampoco arrastra la mediana para abajo', () => {
    const conCierre: Serie[] = [...series(12, 12, 12), { logrado: 4, cierre: true }]
    expect(logradoTipico(conCierre)).toBe(12)
  })

  it('así que una sesión cumplida con cierre no cambia de eslabón sola', () => {
    // Mismo caso, ahora contra el motor entero: en el techo y recién llegado,
    // el cierre no puede ser lo que empuje el salto.
    const e = ejercicio('flexion-completa')
    const avance = avanceEn('flexion-completa', e.ventana.max)
    const conCierre: Serie[] = [
      ...series(...Array(e.series).fill(e.ventana.max)),
      { logrado: Math.round(e.ventana.max / 2), cierre: true },
    ]
    const d = siguienteAvance(
      avance,
      {
        rendimiento: rendimientoDeSesion(avance.objetivoActual, conCierre),
        tipico: logradoTipico(conCierre),
      },
      ctx,
      0,
    )
    expect(d.cambioDeNivel).toBe(false)
  })
})

describe('el freno por ánimo, y hasta dónde llega', () => {
  // El freno existe para no apretar el acelerador cuando alguien viene
  // cumpliendo pero pasándola mal. Lo que NO puede hacer es frenar el cambio
  // de eslabón: cambiar de eslabón es neutro en carga por construcción
  // —`recalibrar` conserva el índice a los dos lados del salto—, así que
  // frenarlo no le baja la exigencia a nadie: solo le posterga lo único que la
  // app le prometió, y justo el día en que se lo ganó.
  const mal = { animo: -1.5 }

  it('por debajo del techo, sostiene', () => {
    const avance = avanceEn('flexion-completa', 8, { senal: 1 })
    const d = siguienteAvance(avance, { rendimiento: 1, tipico: 8, ...mal }, ctx, 0)
    expect(d.movimiento).toBe('sostiene')
  })

  it('pero sí frena el salto que pide más carga, que en la base de las cadenas existe', () => {
    // El argumento de "el salto es neutro en carga" es falso en los bordes:
    // `recalibrar` acota contra la ventana del destino y en los primeros
    // eslabones el resultado cae por debajo del piso, así que el salto termina
    // pidiendo más. Justo a un principiante que la está pasando mal.
    const e = ejercicio('flexion-pared')
    const avance: Avance = {
      patron: 'empuje',
      ejercicioId: 'flexion-pared',
      objetivoActual: { series: e.series, cantidad: e.ventana.max },
      senal: 1,
      sesionesEnObjetivo: CONSOLIDACION,
      graciaRestante: 0,
      actualizadoEn: 0,
    }
    const siguiente = ejercicio('flexion-inclinada-alta')
    const nueva = recalibrar(e, e.ventana.max, siguiente)
    // Primero se comprueba la premisa: este salto SUBE la carga.
    expect(indiceDeCarga(siguiente, nueva)).toBeGreaterThan(indiceDeCarga(e, e.ventana.max))

    const d = siguienteAvance(avance, { rendimiento: 1, tipico: e.ventana.max, ...mal }, ctx, 0)
    expect(d.cambioDeNivel).toBe(false)
    expect(d.explicacion).toContain('cuesta arriba')
  })

  it('consolidando en el techo, no promete un cambio que el freno va a parar', () => {
    const e = ejercicio('flexion-pared')
    const avance = avanceEn('flexion-pared', e.ventana.max, { sesionesEnObjetivo: CONSOLIDACION - 1 })
    const evaluacion = { rendimiento: 1, tipico: e.ventana.max, cumplido: true }
    expect(siguienteAvance(avance, evaluacion, ctx, 0).explicacion).toContain(
      'Un día de práctica más así y cambiamos de ejercicio.',
    )
    const d = siguienteAvance(avance, { ...evaluacion, ...mal }, ctx, 0)
    expect(d.movimiento).toBe('sostiene')
    expect(d.explicacion).toBe(
      `Llegaste al techo de ${e.nombre}. Lo sostenemos acá: las últimas sesiones se te hicieron cuesta arriba y el paso a ${ejercicio('flexion-inclinada-alta').nombre} pide más.`,
    )
    // Y lo que dice se cumple: al día siguiente, igual de mal, tampoco cambia.
    expect(siguienteAvance(d.avance, { ...evaluacion, ...mal }, ctx, 0).cambioDeNivel).toBe(false)
  })

  it('en el techo y con el eslabón dominado, cambia de nivel igual', () => {
    const e = ejercicio('flexion-completa')
    const avance = avanceEn('flexion-completa', e.ventana.max, {
      senal: 1,
      sesionesEnObjetivo: CONSOLIDACION,
    })
    const d = siguienteAvance(
      avance,
      { rendimiento: 1, tipico: e.ventana.max, ...mal },
      ctx,
      0,
    )
    expect(d.movimiento).toBe('nivel-arriba')
    expect(d.cambioDeNivel).toBe(true)
    expect(d.avance.ejercicioId).toBe('flexion-diamante')
  })
})

describe('qué sesiones mueven el plan', () => {
  it('solo las del plan', () => {
    expect(mueveElPlan('plan')).toBe(true)
    expect(mueveElPlan('corta')).toBe(false)
    // La de vuelta trae el objetivo recortado al 70%: cumplirlo es cumplir una
    // vara más baja, no ganarse un eslabón.
    expect(mueveElPlan('vuelta')).toBe(false)
  })

  it('un tipo nuevo tiene que decidirse acá, no heredar el permiso', () => {
    const TIPOS: TipoSesion[] = ['plan', 'corta', 'vuelta']
    expect(TIPOS.filter(mueveElPlan)).toEqual(['plan'])
  })

  it('y por eso una vuelta cumplida no empuja el eslabón', () => {
    // El objetivo real de la sesión ya viene recortado; contra esa vara la
    // persona da 1,00 y la señal se iría para arriba si la sesión contara.
    const e = ejercicio('flexion-completa')
    const avance = avanceEn('flexion-completa', e.ventana.max, {
      senal: 1,
      sesionesEnObjetivo: CONSOLIDACION,
    })
    const recortado = Math.round(e.ventana.max * RECORTE_DE_VUELTA)
    const hechas = series(...Array(e.series).fill(recortado))
    const evaluacion = {
      rendimiento: rendimientoDeSesion({ series: e.series, cantidad: recortado }, hechas),
      tipico: recortado,
    }

    // Sin la marca, cumplir la vara recortada alcanza para saltar.
    expect(siguienteAvance(avance, evaluacion, ctx, 0).cambioDeNivel).toBe(true)

    // Con ella —que es lo que pone `cerrarSesion` vía `mueveElPlan`—, no.
    const d = siguienteAvance(avance, { ...evaluacion, neutra: true }, ctx, 0)
    expect(d.cambioDeNivel).toBe(false)
    expect(d.avance.senal).toBe(avance.senal)
  })
})

describe('los kilos, que entran sin mover nada de lo que ya estaba', () => {
  const PESO = 75

  it('sin carga, el índice y su inversa dan EXACTAMENTE lo de siempre', () => {
    // Es el candado de toda la entrega: 47 ejercicios × varias cantidades, y
    // el resultado tiene que ser idéntico bit a bit, no parecido. Por eso
    // `ccrEfectivo` devuelve `ejercicio.ccr` tal cual en vez de `ccr + 0/peso`:
    // en el papel son el mismo número y en punto flotante pueden no serlo.
    for (const ejercicio of EJERCICIOS) {
      for (const cantidad of [1, 3, 5, 8, 12, 15, 30]) {
        expect(indiceDeCarga(ejercicio, cantidad, undefined), ejercicio.id).toBe(
          indiceDeCarga(ejercicio, cantidad),
        )
        expect(ccrEfectivo(ejercicio), ejercicio.id).toBe(ejercicio.ccr)
        expect(ccrEfectivo(ejercicio, { kg: 0, pesoCorporalKg: PESO }), ejercicio.id).toBe(
          ejercicio.ccr,
        )
        // Y sin peso corporal cargado, los kilos no pueden hacer nada: no hay
        // forma de pasarlos a la escala del motor.
        expect(ccrEfectivo(ejercicio, { kg: 20 }), ejercicio.id).toBe(ejercicio.ccr)
      }
    }
  })

  it('veinte kilos sobre una dominada suben la carga, no la bajan', () => {
    // El modo de falla que esto evita, medido antes de arreglarlo: diez
    // dominadas sin lastre daban índice 1,267 y seis con veinte kilos daban
    // 1,103 — el motor leía una CAÍDA del 13% el día que la carga real subió.
    // Con el signo del gradiente invertido, un estimador de capacidad no
    // estima nada.
    const dominada = POR_ID.get('dominada-completa')!
    const sinLastre = indiceDeCarga(dominada, 10)
    const conLastre = indiceDeCarga(dominada, 6, { kg: 20, pesoCorporalKg: PESO })
    expect(conLastre).toBeGreaterThan(sinLastre)
  })

  it('la inversa sigue siendo la inversa con los discos puestos', () => {
    // `recalibrar` se apoya en esta igualdad para traducir entre eslabones. Un
    // término de carga que entre en una función y no en la otra la rompe en
    // silencio.
    const carga = { kg: 15, pesoCorporalKg: PESO }
    for (const id of ['flexion-completa', 'dominada-completa', 'sentadilla-completa']) {
      const ejercicio = POR_ID.get(id)!
      for (const cantidad of [4, 6, 9]) {
        const indice = indiceDeCarga(ejercicio, cantidad, carga)
        expect(cantidadParaCarga(ejercicio, indice, carga), `${id} × ${cantidad}`).toBeCloseTo(
          cantidad,
          0,
        )
      }
    }
  })

  it('un objetivo sin discos hecho CON discos no se lee como un fracaso', () => {
    // El caso que motivó todo. Objetivo 3×10 a peso corporal, hecho 6-6-5 con
    // veinte kilos. En repeticiones peladas da 0,550 y el motor baja el
    // objetivo al día siguiente; la carga real había subido un 28%.
    const ejercicio = POR_ID.get('dominada-completa')!
    const objetivo = { series: 3, cantidad: 10 }
    const series = [{ logrado: 6, kg: 20 }, { logrado: 6, kg: 20 }, { logrado: 5, kg: 20 }]

    const aCiegas = rendimientoDeSesion(objetivo, series)
    const traducido = rendimientoDeSesion(objetivo, series, { ejercicio, pesoCorporalKg: PESO })

    expect(aCiegas).toBeLessThan(0.7)
    expect(traducido).toBeGreaterThan(aCiegas)
    expect(traducido).toBeGreaterThan(0.9)
  })

  it('una serie vacía sigue valiendo cero aunque haya discos declarados', () => {
    // La inversa, aplicada a cero repeticiones, devuelve un número positivo.
    // Sin el corte explícito, una serie que no se hizo se traduciría a una
    // serie que sí.
    const ejercicio = POR_ID.get('dominada-completa')!
    const objetivo = { series: 3, cantidad: 10 }
    const series = [{ logrado: 0, kg: 20 }, { logrado: 0, kg: 20 }, { logrado: 0, kg: 20 }]
    expect(rendimientoDeSesion(objetivo, series, { ejercicio, pesoCorporalKg: PESO })).toBe(0)
  })

  it('el típico también se traduce, o la meseta bajaría el objetivo de más', () => {
    const ejercicio = POR_ID.get('flexion-completa')!
    const objetivo = { series: 3, cantidad: 12 }
    const series = [{ logrado: 8, kg: 10 }, { logrado: 8, kg: 10 }, { logrado: 7, kg: 10 }]
    const pelado = logradoTipico(series)
    const traducido = logradoTipico(series, { ejercicio, objetivo, pesoCorporalKg: PESO })
    expect(pelado).toBe(8)
    expect(traducido).toBeGreaterThan(pelado)
  })
})

/**
 * Varias sesiones por día.
 *
 * Una lectura por cadena y por día: la primera sesión que la sigue la lee, y
 * las demás suman volumen. Todo pasa por `leerLaSesion`, que es exactamente lo
 * que corre `cerrarSesion`.
 */
describe('varias sesiones por día', () => {
  const DIA = '2026-10-21'
  /** Un instante de ese día, en la hora local de quien corre el test. */
  const a = (h: number, m: number) => new Date(2026, 9, 21, h, m).getTime()

  const avances = new Map<Patron, Avance>([
    ['empuje', avanceEn('flexion-completa', 8, { senal: 0.9, actualizadoEn: 7 })],
    [
      'traccion',
      {
        ...avanceEn('remo-australiano-alto', 10, { actualizadoEn: 7 }),
        patron: 'traccion',
      },
    ],
  ])

  function registro(
    ejercicioId: string,
    logrados: number[],
    extra: Partial<RegistroQueLee> = {},
  ): RegistroQueLee {
    return {
      ejercicioId,
      objetivo: { series: logrados.length, cantidad: 8 },
      series: series(...logrados),
      ...extra,
    }
  }

  function leer(
    registros: RegistroQueLee[],
    historial: Sesion[] = [],
    extra: Partial<SesionALeer> = {},
  ): Lectura[] {
    return leerLaSesion({
      registros,
      avances,
      dia: DIA,
      historial,
      neutra: false,
      congeladas: new Set(),
      protegida: false,
      contextoDe: (patron) => ({ cadena: cadenaDe(patron), ejercicios: POR_ID }),
      ahora: a(9, 10),
      ...extra,
    })
  }

  /** La sesión como la guarda `cerrarSesion`, con sus decisiones copiadas. */
  function guardada(
    lecturas: Lectura[],
    finalizadaEn: number,
    registros: RegistroQueLee[] = [],
  ): Sesion {
    return {
      id: `s-${finalizadaEn}`,
      fecha: DIA,
      finalizadaEn,
      duracionSegundos: 1800,
      tipo: 'plan',
      registros: registros.map(({ ejercicioId, objetivo, series: hechas }) => ({
        ejercicioId,
        objetivo,
        series: hechas,
      })),
      decisiones: lecturas.map(({ patron, decision }) => ({
        patron,
        movimiento: decision.movimiento,
        explicacion: decision.explicacion,
        cambioDeNivel: decision.cambioDeNivel,
        ...(decision.motivo ? { motivo: decision.motivo } : {}),
        ...(decision.leidaA !== undefined ? { leidaA: decision.leidaA } : {}),
      })),
    }
  }

  describe('yaLeidaHoy', () => {
    const sesionCon = (
      finalizadaEn: number,
      movimiento: string,
      patron: Patron = 'empuje',
      fecha = DIA,
    ): Sesion => ({
      id: `s-${finalizadaEn}`,
      fecha,
      finalizadaEn,
      duracionSegundos: 1800,
      tipo: 'plan',
      registros: [],
      decisiones: [{ patron, movimiento, explicacion: '', cambioDeNivel: false }],
    })

    it('sin una lectura ese día, no', () => {
      expect(yaLeidaHoy('empuje', DIA, [])).toBeNull()
      const ayer = sesionCon(1, 'subida', 'empuje', '2026-10-20')
      expect(yaLeidaHoy('empuje', DIA, [ayer])).toBeNull()
      expect(yaLeidaHoy('empuje', DIA, [sesionCon(1, 'subida', 'traccion')])).toBeNull()
    })

    it('una decisión neutra no es una lectura', () => {
      expect(yaLeidaHoy('empuje', DIA, [sesionCon(a(9, 10), 'neutra')])).toBeNull()
    })

    it('da la hora de la primera lectura del día', () => {
      const historial = [sesionCon(a(13, 30), 'sostiene'), sesionCon(a(9, 10), 'subida')]
      expect(yaLeidaHoy('empuje', DIA, historial)).toBe(a(9, 10))
    })
  })

  describe('unaPorPatron', () => {
    it('decide el primer paso de la cadena, en el orden de la sesión', () => {
      const pasos = unaPorPatron(
        [
          registro('remo-australiano-alto', [10, 10, 10]),
          registro('flexion-completa', [8, 8, 8]),
          registro('flexion-completa', [3, 3, 3]),
        ],
        avances,
      )
      expect(pasos).toEqual([
        { patron: 'traccion', indice: 0 },
        { patron: 'empuje', indice: 1 },
      ])
    })

    it('un registro fijo, de bajada, de calentamiento o del Reloj no decide', () => {
      for (const marca of [
        { fijo: true },
        { bajada: true },
        { calentamiento: true },
        { reloj: true },
      ] as const) {
        const solo = unaPorPatron([registro('flexion-completa', [8, 8, 8], marca)], avances)
        expect(solo, JSON.stringify(marca)).toEqual([])
        // Y no le quita el lugar al paso que sí sigue tu nivel.
        expect(
          unaPorPatron(
            [registro('flexion-completa', [8, 8, 8], marca), registro('flexion-completa', [8, 8, 8])],
            avances,
          ),
        ).toEqual([{ patron: 'empuje', indice: 1 }])
      }
    })

    it('ni otro eslabón, ni un paso salteado, ni la serie de cierre sola', () => {
      expect(unaPorPatron([registro('flexion-diamante', [8, 8, 8])], avances)).toEqual([])
      expect(unaPorPatron([registro('flexion-completa', [])], avances)).toEqual([])
      const soloCierre: RegistroQueLee = {
        ...registro('flexion-completa', []),
        series: [{ logrado: 5, cierre: true }],
      }
      expect(unaPorPatron([soloCierre], avances)).toEqual([])
    })
  })

  it('los pasos que siguen tu nivel se cuentan hechos o no', () => {
    expect(
      pasosQueSiguenTuNivel(
        [
          registro('flexion-completa', []),
          registro('remo-australiano-alto', [10]),
          registro('flexion-completa', [8], { fijo: true }),
          registro('flexion-inclinada-baja', [8], { bajada: true }),
          registro('flexion-diamante', [8]),
        ],
        avances,
      ),
    ).toBe(2)
    expect(pasosQueSiguenTuNivel([registro('flexion-diamante', [8])], avances)).toBe(0)
  })

  it('una cadena ya leída hoy queda neutra, con la hora, y no devuelve avance para guardar', () => {
    const manana = [registro('flexion-completa', [8, 8, 8])]
    const primera = leer(manana)
    expect(primera).toHaveLength(1)
    expect(primera[0]!.guardar).toBe(true)
    expect(primera[0]!.decision.movimiento).not.toBe('neutra')

    const historial = [guardada(primera, a(9, 10), manana)]
    const tarde = leer([registro('flexion-completa', [3, 3, 3])], historial, { ahora: a(19, 5) })
    expect(tarde).toHaveLength(1)
    const { decision, guardar } = tarde[0]!
    expect(guardar).toBe(false)
    expect(decision.movimiento).toBe('neutra')
    expect(decision.motivo).toBe('ya-leida-hoy')
    expect(decision.leidaA).toBe(a(9, 10))
    expect(decision.cambioDeNivel).toBe(false)
    expect(decision.explicacion).toBe('Empuje ya se leyó hoy a las 9:10: esta sesión sumó volumen.')
    // El mismo avance, sin pasar por la rama neutra: `actualizadoEn` incluido.
    expect(decision.avance).toBe(avances.get('empuje'))
  })

  it('al día siguiente se vuelve a leer', () => {
    const manana = [registro('flexion-completa', [8, 8, 8])]
    const historial = [guardada(leer(manana), a(9, 10), manana)]
    const otroDia = leer(manana, historial, { dia: '2026-10-22' })
    expect(otroDia[0]!.guardar).toBe(true)
    expect(otroDia[0]!.decision.motivo).toBeUndefined()
  })

  it('una sesión neutra no gasta la lectura del día', () => {
    // Una sesión corta o un día rojo no leyeron nada: la de la tarde lee.
    const manana = [registro('flexion-completa', [8, 8, 8])]
    const neutra = leer(manana, [], { neutra: true })
    expect(neutra[0]!.decision.movimiento).toBe('neutra')
    expect(neutra[0]!.decision.motivo).toBeUndefined()
    const tarde = leer(manana, [guardada(neutra, a(9, 10), manana)], { ahora: a(19, 5) })
    expect(tarde[0]!.decision.movimiento).not.toBe('neutra')
    expect(tarde[0]!.guardar).toBe(true)
  })

  describe('la prefatiga', () => {
    // Una lectura floja: tres series de 3 contra un objetivo de 3 × 8.
    const floja = registro('flexion-completa', [3, 3, 3])
    // Siete series de pectoral antes del paso de empuje.
    const diamante = registro('flexion-diamante', [6, 6, 6, 6, 6, 6, 6])

    it('después de muchas series de sus principales, la lectura va protegida', () => {
      const sola = leer([floja])[0]!.decision
      const despues = leer([diamante, floja])[0]!.decision
      // Sin prefatiga, la floja arrastra la señal y baja el objetivo; con ella,
      // esta vez no bajó.
      expect(sola.movimiento).toBe('bajada')
      expect(despues.avance.senal).toBe(avances.get('empuje')!.senal)
      expect(despues.movimiento).toBe('sostiene')
      expect(despues.motivo).toBe('protegida')
      expect(despues.explicacion).toBe(PROTEGIDA_POR_PREFATIGA)
    })

    it('la que sale bien con prefatiga cuenta, y guarda el motivo', () => {
      const buena = registro('flexion-completa', [9, 9, 9])
      const decision = leer([diamante, buena])[0]!.decision
      expect(decision.movimiento).toBe('subida')
      expect(decision.motivo).toBe('prefatiga')
    })

    it('protegida por el chequeo y sin prefatiga, dice lo del día flojo', () => {
      const decision = leer([floja], [], { protegida: true })[0]!.decision
      expect(decision.motivo).toBe('protegida')
      expect(decision.explicacion).toBe(PROTEGIDA_EN_UN_DIA_FLOJO)
    })

    it('con chequeo y prefatiga juntos, dice lo de la prefatiga', () => {
      // La prefatiga es la razón que mira este paso, y no el día entero.
      const decision = leer([diamante, floja], [], { protegida: true })[0]!.decision
      expect(decision.motivo).toBe('protegida')
      expect(decision.movimiento).toBe('sostiene')
      expect(decision.explicacion).toBe(PROTEGIDA_POR_PREFATIGA)
    })

    /**
     * Varios días seguidos de la misma sesión, uno por día, con el avance que
     * guardó cada lectura como el de la siguiente: lo que hace la app.
     */
    function diaTrasDia(registros: RegistroQueLee[], cuantos: number, extra: Partial<SesionALeer> = {}) {
      let avance = avances.get('empuje')!
      const decisiones: ReturnType<typeof siguienteAvance>[] = []
      for (let i = 0; i < cuantos; i++) {
        const dia = `2026-10-${String(10 + i).padStart(2, '0')}`
        const ahora = new Date(2026, 9, 10 + i, 9, 10).getTime()
        const lectura = leer(registros, [], {
          dia,
          ahora,
          avances: new Map<Patron, Avance>([...avances, ['empuje', avance]]),
          ...extra,
        })[0]!
        decisiones.push(lectura.decision)
        avance = lectura.decision.avance
      }
      return decisiones
    }

    it(`a la ${MESETA}ª protegida seguida sobre el mismo objetivo, vence, y la meseta gana sobre la prefatiga`, () => {
      // Seis por serie contra ocho: floja contra la señal, pero lo bastante
      // cerca como para que el objetivo pueda ir a lo que hace.
      const corta = registro('flexion-completa', [6, 6, 6])
      const decisiones = diaTrasDia([diamante, corta], MESETA)
      for (let i = 0; i < MESETA - 1; i++) {
        expect(decisiones[i]!.motivo, `día ${i + 1}`).toBe('protegida')
        expect(decisiones[i]!.avance.protegidasSeguidas, `día ${i + 1}`).toBe(i + 1)
      }
      const vencida = decisiones[MESETA - 1]!
      expect(vencida.movimiento).toBe('bajada')
      expect(vencida.motivo).toBe('meseta')
      expect(vencida.avance.objetivoActual.cantidad).toBe(6)
      expect(vencida.avance.protegidasSeguidas).toBeUndefined()
      expect(vencida.explicacion).toBe(
        'El objetivo de 8 por serie no se termina de cerrar. Era optimista: lo llevamos a 6, que es lo que te salió esta vez.',
      )
    })

    it('vence también los días ámbar, con el objetivo de la sesión recortado', () => {
      // Un día ámbar Entrenar pide el 90% (7 en vez de 8), y la sesión guarda
      // ese 7. La racha contada en el historial comparaba ese 7 con el 8 del
      // avance y se cortaba todos los días: la protección no vencía nunca.
      const recortada = registro('flexion-completa', [5, 5, 5], {
        objetivo: { series: 3, cantidad: 7 },
      })
      const decisiones = diaTrasDia([recortada], MESETA, { protegida: true })
      for (let i = 0; i < MESETA - 1; i++) expect(decisiones[i]!.motivo, `día ${i + 1}`).toBe('protegida')
      const vencida = decisiones[MESETA - 1]!
      expect(vencida.motivo).toBe('meseta')
      expect(vencida.movimiento).toBe('bajada')
      // Lo que hace es 5, y el objetivo del avance (8) va ahí.
      expect(vencida.avance.objetivoActual.cantidad).toBe(5)
    })

    it('la racha es de cada cadena', () => {
      // Empuje a una de vencer no hace vencer a tracción en su primera.
      const floja = registro('remo-australiano-alto', [4, 4, 4], { objetivo: { series: 3, cantidad: 10 } })
      const conRacha = new Map<Patron, Avance>([
        ...avances,
        ['empuje', { ...avances.get('empuje')!, protegidasSeguidas: MESETA - 1 }],
      ])
      const [lectura] = leer([floja], [], { protegida: true, avances: conRacha })
      expect(lectura!.patron).toBe('traccion')
      expect(lectura!.decision.motivo).toBe('protegida')
      expect(lectura!.decision.avance.protegidasSeguidas).toBe(1)
    })

    it('lo típico de dos series distintas es una cuenta, y no se dice que salió', () => {
      // La mediana de 7 y 9 es 8, y ninguna serie dio 8.
      const enMeseta = new Map<Patron, Avance>([
        ...avances,
        ['empuje', avanceEn('flexion-completa', 11, { senal: 0.82, sesionesEnObjetivo: MESETA - 1 })],
      ])
      const objetivo = { series: 2, cantidad: 11 }
      const dos = leer([registro('flexion-completa', [7, 9], { objetivo })], [], { avances: enMeseta })
      expect(dos[0]!.decision.explicacion).toBe(
        'El objetivo de 11 por serie no se termina de cerrar. Era optimista: lo llevamos a 8.',
      )
      // Con un 8 de verdad en una serie, sí salió.
      const tres = leer([registro('flexion-completa', [7, 8, 9], { objetivo: { series: 3, cantidad: 11 } })], [], {
        avances: enMeseta,
      })
      expect(tres[0]!.decision.explicacion).toBe(
        'El objetivo de 11 por serie no se termina de cerrar. Era optimista: lo llevamos a 8, que es lo que te salió esta vez.',
      )
    })

    it('"Objetivo cumplido" sale de que cada serie llegó, no de la señal', () => {
      const cada = leer([registro('flexion-completa', [8, 8, 8])])[0]!.decision
      expect(cada.explicacion).toMatch(/^Objetivo cumplido\. /)
      // Doce, ocho y siete suman lo mismo que tres de nueve, pero una quedó corta.
      const una = leer([registro('flexion-completa', [12, 8, 7])])[0]!.decision
      expect(una.movimiento).toBe('subida')
      expect(una.explicacion).not.toMatch(/Objetivo cumplido/)
    })

    it('cuenta lo de las sesiones anteriores del día', () => {
      const manana = [diamante, registro('remo-australiano-alto', [10, 10, 10])]
      const historial = [guardada(leer(manana), a(9, 10), manana)]
      // La de la mañana leyó tracción y no empuje: empuje se lee a la tarde,
      // con las siete de pectoral de la mañana encima.
      const tarde = leer([floja], historial, { ahora: a(19, 5) })[0]!.decision
      expect(tarde.motivo).toBe('protegida')
      expect(tarde.explicacion).toBe(PROTEGIDA_POR_PREFATIGA)
      expect(tarde.movimiento).toBe('sostiene')
    })

    it(`por debajo de ${PREFATIGA} series no protege`, () => {
      const pocas = registro('flexion-diamante', [6, 6, 6, 6, 6])
      const decision = leer([pocas, floja])[0]!.decision
      expect(decision.motivo).toBeUndefined()
      expect(decision.movimiento).toBe('bajada')
    })

    it('una lectura protegida gasta la lectura del día', () => {
      const manana = [diamante, floja]
      const primera = leer(manana)
      expect(primera[0]!.decision.motivo).toBe('protegida')
      const historial = [guardada(primera, a(9, 10), manana)]
      // La de la tarde no puede volver a leer empuje para buscar otro resultado.
      const tarde = leer([registro('flexion-completa', [8, 8, 8])], historial, { ahora: a(19, 5) })
      expect(tarde[0]!.decision.motivo).toBe('ya-leida-hoy')
      expect(tarde[0]!.guardar).toBe(false)
    })

    it('una sesión que cruzó la medianoche no dice "hoy"', () => {
      const manana = [registro('flexion-completa', [8, 8, 8])]
      const historial = [guardada(leer(manana), a(9, 10), manana)]
      // Del 21, arrancada a las 23:40 y cerrada el 22 a las 00:15.
      const pasada = new Date(2026, 9, 22, 0, 15).getTime()
      const decision = leer(manana, historial, { ahora: pasada })[0]!.decision
      expect(decision.motivo).toBe('ya-leida-hoy')
      expect(decision.explicacion).toBe(
        'Empuje ya se había leído ese día a las 9:10: esta sesión sumó volumen.',
      )
    })

    it('en una sesión neutra no hay nada que proteger, y no se dice', () => {
      const decision = leer([diamante, floja], [], { neutra: true })[0]!.decision
      expect(decision.movimiento).toBe('neutra')
      expect(decision.motivo).toBeUndefined()
    })
  })
})

describe('cumpleCadaSerie', () => {
  const objetivo: Objetivo = { series: 3, cantidad: 8 }

  it('cada serie llegó', () => {
    expect(cumpleCadaSerie(objetivo, series(8, 8, 8))).toBe(true)
    expect(cumpleCadaSerie(objetivo, series(10, 9, 8))).toBe(true)
  })

  it('una corta no, aunque el total alcance', () => {
    expect(cumpleCadaSerie(objetivo, series(12, 8, 7))).toBe(false)
  })

  it('una que falta tampoco', () => {
    expect(cumpleCadaSerie(objetivo, series(8, 8))).toBe(false)
  })

  it('la de cierre no cuenta, ni a favor ni en contra', () => {
    expect(cumpleCadaSerie(objetivo, [...series(8, 8, 8), { logrado: 2, cierre: true }])).toBe(true)
    expect(cumpleCadaSerie(objetivo, [...series(8, 8), { logrado: 9, cierre: true }])).toBe(false)
  })
})

describe('lo que dice el motor no usa palabras prohibidas', () => {
  // Lo ve la persona tal cual en el Cierre. Las líneas, las frases, las
  // rutinas y la biblioteca ya pasan por `loProhibido`; esto cubre las
  // explicaciones, recorriendo una grilla que pasa por todas las ramas.
  it('ni las fijas', () => {
    for (const texto of [PROTEGIDA_EN_UN_DIA_FLOJO, PROTEGIDA_POR_PREFATIGA, LLEGASTE_AL_TOTAL]) {
      expect(loProhibido(texto), texto).toBeNull()
    }
  })

  it('ni las que arma cada rama', () => {
    const barra = { pesoCorporalKg: 75, cargaMaximaKg: 45, pasoDeDiscoKg: 2.5 }
    const vistas = new Set<string>()
    for (const cadena of CADENAS) {
      for (let i = 0; i < cadena.ejercicios.length; i++) {
        const e = ejercicio(cadena.ejercicios[i]!)
        const siguiente = cadena.ejercicios[i + 1]
        const contextos = [
          { cadena, ejercicios: POR_ID },
          { cadena, ejercicios: POR_ID, barra },
          ...(siguiente
            ? [
                { cadena, ejercicios: POR_ID, cerrados: new Map<string, Cierre>([[siguiente, { motivo: 'sin-barra' }]]) },
                {
                  cadena,
                  ejercicios: POR_ID,
                  cerrados: new Map<string, Cierre>([[siguiente, { motivo: 'requisito', requisito: e }]]),
                },
              ]
            : []),
        ]
        const medio = Math.round((e.ventana.min + e.ventana.max) / 2)
        for (const cantidad of [e.ventana.min, medio, e.ventana.max, e.ventana.max + 6]) {
          for (const kg of [undefined, 10]) {
            for (const senal of [0.5, 0.8, 0.9, 1]) {
              for (const sesionesEnObjetivo of [0, CONSOLIDACION, MESETA - 1]) {
                for (const graciaRestante of [0, 1, 3]) {
                  const avance: Avance = {
                    patron: cadena.patron,
                    ejercicioId: e.id,
                    objetivoActual: { series: e.series, cantidad, ...(kg ? { kg } : {}) },
                    senal,
                    sesionesEnObjetivo,
                    graciaRestante,
                    actualizadoEn: 0,
                  }
                  for (const contexto of contextos) {
                    for (const rendimiento of [0.3, 0.8, 0.9, 1.1]) {
                      for (const tipico of [Math.max(1, cantidad - 3), cantidad]) {
                        for (const extra of [{}, { protegida: true }, { animo: -1 }, { cumplido: true }]) {
                          const d = siguienteAvance(avance, { rendimiento, tipico, ...extra }, contexto, 0)
                          vistas.add(d.explicacion)
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    // Que la grilla de verdad haya recorrido: si no, esto no probaría nada.
    expect(vistas.size).toBeGreaterThan(200)
    for (const texto of vistas) expect(loProhibido(texto), texto).toBeNull()
  })
})

describe('lo que dice el motor es cierto', () => {
  const barra = { pesoCorporalKg: 75, cargaMaximaKg: 45, pasoDeDiscoKg: 2.5 }

  /** Cada caso de la grilla: un avance, una lectura y un contexto. */
  function* grilla() {
    for (const cadena of CADENAS) {
      for (let i = 0; i < cadena.ejercicios.length; i++) {
        const e = ejercicio(cadena.ejercicios[i]!)
        const siguiente = cadena.ejercicios[i + 1]
        const contextos = [
          { cadena, ejercicios: POR_ID },
          { cadena, ejercicios: POR_ID, barra },
          ...(siguiente
            ? [{ cadena, ejercicios: POR_ID, cerrados: new Map<string, Cierre>([[siguiente, { motivo: 'sin-barra' }]]) }]
            : []),
        ]
        for (const cantidad of [e.ventana.max - 1, e.ventana.max, e.ventana.max + 2]) {
          for (const senal of [0.85, 0.95, 1.1]) {
            for (const sesionesEnObjetivo of [0, 1, MESETA - 1]) {
              for (const graciaRestante of [0, 1, 3]) {
                const avance: Avance = {
                  patron: cadena.patron,
                  ejercicioId: e.id,
                  objetivoActual: { series: e.series, cantidad },
                  senal,
                  sesionesEnObjetivo,
                  graciaRestante,
                  actualizadoEn: 0,
                }
                for (const ctxDe of contextos) {
                  for (const rendimiento of [0.85, 0.95, 1, 1.15]) {
                    for (const animo of [undefined, -1]) {
                      const evaluacion = {
                        rendimiento,
                        tipico: cantidad,
                        ...(rendimiento >= 1 ? { cumplido: true } : {}),
                        ...(animo !== undefined ? { animo } : {}),
                      }
                      yield { avance, evaluacion, ctx: ctxDe }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const PROMESAS: [RegExp, (m: RegExpMatchArray) => number][] = [
    [/Un día de práctica más así y (?:cambiamos de ejercicio|subimos)\./, () => 1],
    [/(un par de|\d+) días de práctica antes de subir/, (m) => (m[1] === 'un par de' ? 2 : Number(m[1]))],
    [/Faltan (\d+) días de práctica así para cambiar de ejercicio/, (m) => Number(m[1])],
  ]

  it('cada plazo prometido se cumple repitiendo la misma lectura', () => {
    // Con la misma lectura la señal se sigue moviendo, y "un día más así y
    // cambiamos" salía con una señal que, al día siguiente, quedaba abajo.
    let promesas = 0
    for (const { avance, evaluacion, ctx: contexto } of grilla()) {
      const d = siguienteAvance(avance, evaluacion, contexto, 0)
      for (const [patron, plazo] of PROMESAS) {
        const m = d.explicacion.match(patron)
        if (!m) continue
        promesas++
        const dias = plazo(m)
        const donde = `${avance.ejercicioId} ${avance.objetivoActual.cantidad} señal ${avance.senal} r ${evaluacion.rendimiento}: "${d.explicacion}"`
        let siguiente = d.avance
        for (let dia = 1; dia <= dias; dia++) {
          const despues = siguienteAvance(siguiente, evaluacion, contexto, 0)
          if (dia < dias) {
            expect(despues.movimiento, `día ${dia} de ${dias}, ${donde}`).toBe('sostiene')
          } else {
            expect(['subida', 'nivel-arriba'], `día ${dia} de ${dias}, ${donde}`).toContain(despues.movimiento)
            if (/cambia(mos|r) de ejercicio/.test(d.explicacion)) {
              expect(despues.cambioDeNivel, donde).toBe(true)
            }
          }
          siguiente = despues.avance
        }
      }
    }
    // Que la grilla de verdad haya pasado por las promesas.
    expect(promesas).toBeGreaterThan(100)
  })

  it('"Llegaste al techo" y "Dominaste" solo si cada serie llegó', () => {
    let vistas = 0
    for (const { avance, evaluacion, ctx: contexto } of grilla()) {
      const sinCumplir = { ...evaluacion, cumplido: false }
      const d = siguienteAvance(avance, sinCumplir, contexto, 0)
      expect(d.explicacion, d.explicacion).not.toMatch(/Llegaste al techo|Dominaste|Objetivo cumplido/)
      if (/Estás en el techo|Sostuviste/.test(d.explicacion)) vistas++
    }
    expect(vistas).toBeGreaterThan(0)
  })

  it('"Quedaste cerca" desde la mitad entre las dos varas y sin llegar', () => {
    const avance = avanceEn('flexion-completa', 10, { senal: 0.9 })
    const dice = (rendimiento: number) => siguienteAvance(avance, { rendimiento, tipico: 9 }, ctx, 0).explicacion
    const mitad = (SUBE + BAJA) / 2
    expect(dice(mitad)).toBe('Quedaste cerca. Repetimos el mismo objetivo para consolidarlo.')
    expect(dice(mitad - 0.001)).toBe('Repetimos el mismo objetivo para consolidarlo.')
  })
})
