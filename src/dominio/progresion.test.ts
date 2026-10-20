import { describe, expect, it } from 'vitest'
import { EJERCICIOS, POR_ID, cadenaDe } from './biblioteca'
import { RECORTE_DE_VUELTA } from './adherencia'
import {
  BAJA,
  CONSOLIDACION,
  GRACIA,
  MESETA,

  avanceInicial,
  cantidadParaCarga,
  ccrEfectivo,
  conUnidad,
  incremento,
  indiceDeCarga,
  logradoTipico,
  mueveElPlan,
  porcentajeDeCadena,
  recalibrar,
  rendimientoDeSesion,
  proyectar,
  siguienteAvance,
  ubicarEnCadena,
  type Cierre,
} from './progresion'
import type { Avance, Objetivo, Serie, TipoSesion } from './tipos'

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

  it('la meseta tampoco promete cambiar con el siguiente cerrado', () => {
    // Señal entre las dos varas, cuatro sesiones en el techo: sin cierre, el
    // motor da el empujón y cambia de ejercicio.
    const avance = avanceEn('flexion-completa', completa.ventana.max, {
      senal: 0.9,
      sesionesEnObjetivo: MESETA - 1,
    })
    const evaluacion = { rendimiento: 0.9, tipico: completa.ventana.max }
    expect(siguienteAvance(avance, evaluacion, ctx, 0).cambioDeNivel).toBe(true)

    const d = siguienteAvance(avance, evaluacion, ctxCerrado, 0)
    expect(d.cambioDeNivel).toBe(false)
    expect(d.explicacion).not.toContain('La próxima cambiamos')
    expect(d.explicacion).toContain(diamante.nombre)
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
