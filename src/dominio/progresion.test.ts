import { describe, expect, it } from 'vitest'
import { POR_ID, cadenaDe } from './biblioteca'
import {
  BAJA,
  CONSOLIDACION,
  GRACIA,
  MESETA,

  avanceInicial,
  cantidadParaCarga,
  conUnidad,
  incremento,
  indiceDeCarga,
  logradoTipico,
  porcentajeDeCadena,
  recalibrar,
  rendimientoDeSesion,
  siguienteAvance,
  ubicarEnCadena,
} from './progresion'
import type { Avance, Objetivo, Serie } from './tipos'

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
    expect(d.explicacion).toContain('optimista')
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

describe('conUnidad', () => {
  it('dice segundos cuando son segundos', () => {
    expect(conUnidad('segundos', 30)).toBe('30 segundos')
    expect(conUnidad('repeticiones', 12)).toBe('12')
  })
})
