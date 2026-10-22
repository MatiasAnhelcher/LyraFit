import { describe, expect, it } from 'vitest'
import {
  ENTRADAS_MINIMAS,
  RECORTE_AMBAR,
  ajusteDelDia,
  ajusteParaFijos,
  bandaSostenida,
  cadenasCongeladas,
  compuesto,
  contestoElChequeo,
  hayFijosParaBajar,
  leerEstado,
  type Chequeo,
} from './estado'
import type { Estado, PasoDelBorrador } from './tipos'

function dia(
  n: number,
  sueno: number,
  energia: number,
  musculos: number,
  extra: Partial<Pick<Estado, 'molestia' | 'posterior'>> = {},
): Chequeo {
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

/**
 * La molestia avisada sola, con el chequeo apagado.
 *
 * Es como viene la app de fábrica: el chequeo diario está apagado, así que la
 * fila del día trae la molestia y nada más. Tiene que proteger la cadena igual
 * y, al mismo tiempo, no puede entrar al índice: no hay nada que promediar, y
 * rellenarla sería inventar un día normal que nadie contó.
 */
describe('molestia sin chequeo', () => {
  /** La fila que deja avisar una molestia con el chequeo apagado. */
  function soloMolestia(n: number, molestia: Estado['molestia']): Estado {
    return { fecha: fechaDe(n), molestia, actualizadoEn: n }
  }

  it('la fila con la molestia sola no pasa por el chequeo', () => {
    expect(contestoElChequeo(soloMolestia(0, 'bisagra'))).toBe(false)
    expect(contestoElChequeo(dia(0, 4, 4, 4))).toBe(true)
  })

  it('congela la cadena igual, la bisagra incluida', () => {
    for (const patron of ['empuje', 'traccion', 'piernas', 'core', 'bisagra'] as const) {
      expect(cadenasCongeladas([soloMolestia(5, patron)], fechaDe(5)).has(patron), patron).toBe(
        true,
      )
    }
  })

  it('la lectura de hoy la trae aunque no haya ni una fila de chequeo', () => {
    const lectura = leerEstado([soloMolestia(3, 'traccion')], fechaDe(3))
    expect(lectura.molestia).toBe('traccion')
    expect(lectura.entradas).toBe(0)
    expect(lectura.confiable).toBe(false)
  })

  it('no cuenta como entrada ni mueve el índice', () => {
    const historial = base(20)
    const conMolestia = [...historial, soloMolestia(20, 'empuje')]
    const sin = leerEstado(historial, fechaDe(20))
    const con = leerEstado(conMolestia, fechaDe(20))
    expect(con.entradas).toBe(sin.entradas)
    expect(con.z).toBe(sin.z)
    expect(con.banda).toBe(sin.banda)
    expect(con.molestia).toBe('empuje')
    expect(Number.isNaN(con.z)).toBe(false)
  })

  it('tampoco cuenta para la banda sostenida', () => {
    // Dos días malos y una molestia sola en el medio: la molestia no puede
    // hacer de tercer día ni romper la cuenta de dos de tres.
    const historial = [...base(20, 4), dia(20, 1, 1, 1), soloMolestia(21, 'core'), dia(22, 1, 1, 1)]
    const sinLaMolestia = historial.filter((e) => e.molestia === undefined)
    expect(bandaSostenida(historial, fechaDe(22))).toBe(bandaSostenida(sinLaMolestia, fechaDe(22)))
  })

  it('una molestia sola no hace de segundo día malo', () => {
    // Un solo día malo, y al otro una molestia avisada sin chequeo. Si la fila
    // de la molestia entrara a la cuenta de dos de tres, se leería con el
    // índice del día anterior —el malo— y lo contaría dos veces: el objetivo
    // bajaría por un día flojo suelto, que es justo lo que esta regla evita.
    const historial = [...base(20, 4), dia(20, 1, 1, 1), soloMolestia(21, 'core')]
    expect(leerEstado(historial, fechaDe(21)).banda).not.toBe('normal')
    expect(bandaSostenida(historial, fechaDe(21))).toBe('normal')
  })
})

/**
 * "Bajar también los tuyos".
 *
 * El chequeo ámbar o rojo baja los pasos de cadena, como siempre. Los fijos
 * llevan números que escribió la persona, y esos no cambian en silencio: solo
 * con el botón, y solo para esa sesión. Lo que se prueba es que el botón baje
 * exactamente lo mismo que baja el plan, y nada más que los fijos.
 */
describe('el chequeo en los pasos fijos', () => {
  const fijo = (id: string, cantidad: number, extra: Partial<PasoDelBorrador> = {}): PasoDelBorrador => ({
    id,
    ejercicioId: 'flexion-diamante',
    objetivo: { series: 3, cantidad },
    clase: 'fijo',
    fijo: true,
    seccion: 'principal',
    ...extra,
  })
  const cadena: PasoDelBorrador = {
    id: 'c',
    ejercicioId: 'flexion-completa',
    objetivo: { series: 3, cantidad: 10 },
    clase: 'cadena',
    seccion: 'principal',
  }
  const volumen: PasoDelBorrador = {
    id: 'v',
    ejercicioId: 'flexion-rodillas',
    objetivo: { series: 2, cantidad: 15 },
    clase: 'volumen',
    bajada: true,
  }
  const movilidad: PasoDelBorrador = {
    id: 'm',
    ejercicioId: 'gato-vaca',
    objetivo: { series: 1, cantidad: 10 },
    clase: 'movilidad',
    seccion: 'entrada',
  }
  const entrada = fijo('e', 10, { calentamiento: true, seccion: 'entrada' })

  it('en ámbar y en rojo baja los fijos con la misma cuenta que el plan', () => {
    // La del plan: la cantidad por el factor, redondeada, nunca menos de 1.
    for (const banda of ['ambar', 'rojo'] as const) {
      const ajuste = ajusteDelDia(banda)
      const [doce, veinte, treinta] = ajusteParaFijos(
        [fijo('a', 12), fijo('b', 20), fijo('c', 30, { ejercicioId: 'plancha' })],
        ajuste,
      )
      expect(doce!.objetivo.cantidad).toBe(Math.max(1, Math.round(12 * RECORTE_AMBAR)))
      expect(doce!.objetivo.cantidad).toBe(11)
      expect(veinte!.objetivo.cantidad).toBe(18)
      expect(treinta!.objetivo.cantidad).toBe(27)
      expect(doce!.objetivo.series).toBe(3)
    }
  })

  it('no toca la cadena, el volumen, la movilidad ni la entrada en calor', () => {
    // La cadena ya bajó por su lado; el volumen lo pone el motor; la movilidad
    // y la entrada en calor son preparación, no trabajo.
    const pasos = [cadena, volumen, movilidad, entrada]
    const bajados = ajusteParaFijos(pasos, ajusteDelDia('ambar'))
    bajados.forEach((paso, i) => expect(paso).toBe(pasos[i]))
    expect(hayFijosParaBajar(pasos, ajusteDelDia('ambar'))).toBe(false)
  })

  it('un día normal o verde no cambia nada', () => {
    const pasos = [fijo('a', 12), cadena]
    for (const banda of ['normal', 'verde'] as const) {
      expect(ajusteParaFijos(pasos, ajusteDelDia(banda))).toEqual(pasos)
      expect(hayFijosParaBajar(pasos, ajusteDelDia(banda))).toBe(false)
    }
  })

  it('nunca sube un número, aunque le llegue un factor mayor que 1', () => {
    expect(ajusteParaFijos([fijo('a', 10)], { factor: 1.2 })[0]!.objetivo.cantidad).toBe(10)
  })

  it('no baja de una repetición ni toca los kilos', () => {
    const [uno, conKilos] = ajusteParaFijos(
      [fijo('a', 1), fijo('b', 10, { objetivo: { series: 3, cantidad: 10, kg: 20 } })],
      ajusteDelDia('ambar'),
    )
    expect(uno!.objetivo.cantidad).toBe(1)
    expect(conKilos!.objetivo).toEqual({ series: 3, cantidad: 9, kg: 20 })
  })

  it('el botón aparece solo si cambia algún número', () => {
    // Con fijos que el redondeo deja igual (1, 4), tocarlo no haría nada.
    expect(hayFijosParaBajar([fijo('a', 1), fijo('b', 4)], ajusteDelDia('ambar'))).toBe(false)
    expect(hayFijosParaBajar([fijo('a', 1), fijo('b', 12)], ajusteDelDia('ambar'))).toBe(true)
    expect(hayFijosParaBajar([], ajusteDelDia('rojo'))).toBe(false)
  })

  it('lee un paso viejo sin clase como lo lee normalizarBorrador', () => {
    const viejoFijo: PasoDelBorrador = {
      ejercicioId: 'flexion-diamante',
      objetivo: { series: 3, cantidad: 10 },
      fijo: true,
    }
    const viejoDeCadena: PasoDelBorrador = {
      ejercicioId: 'flexion-completa',
      objetivo: { series: 3, cantidad: 10 },
    }
    const [fijoBajado, deCadena] = ajusteParaFijos([viejoFijo, viejoDeCadena], ajusteDelDia('ambar'))
    expect(fijoBajado!.objetivo.cantidad).toBe(9)
    expect(deCadena).toBe(viejoDeCadena)
  })

  it('es pura: no toca los pasos que recibe', () => {
    const pasos = [fijo('a', 12), cadena]
    const copia = structuredClone(pasos)
    ajusteParaFijos(pasos, ajusteDelDia('rojo'))
    expect(pasos).toEqual(copia)
  })
})
