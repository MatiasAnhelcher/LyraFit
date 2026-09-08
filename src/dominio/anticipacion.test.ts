import { describe, expect, it } from 'vitest'
import { POR_ID, cadenaDe } from './biblioteca'
import { CERCA, anticipacion, esRecord, seAbreHoy } from './anticipacion'
import { CONSOLIDACION, avanceInicial } from './progresion'
import type { Avance, Sesion } from './tipos'

const empuje = cadenaDe('empuje')

function ejercicio(id: string) {
  const e = POR_ID.get(id)
  if (!e) throw new Error(`falta ${id}`)
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

const anticipar = (a: Avance) => anticipacion(a, empuje, POR_ID)

describe('anticipación', () => {
  it('en el piso de la ventana falta mucho, y no está cerca', () => {
    const a = anticipar(avanceInicial(empuje, POR_ID, 0))
    expect(a.siguiente?.id).toBe(empuje.ejercicios[1])
    expect(a.sesiones).toBeGreaterThan(CERCA)
    expect(a.cerca).toBe(false)
    expect(a.aUnaSesion).toBe(false)
    expect(a.enLaVentana).toBe(0)
  })

  it('la ventana se llena a medida que sube el objetivo', () => {
    const e = ejercicio('flexion-completa')
    const lleno = (n: number) => anticipar(avanceEn('flexion-completa', n)).enLaVentana

    expect(lleno(e.ventana.min)).toBe(0)
    expect(lleno(e.ventana.max)).toBe(1)

    // Y crece sin saltos ni retrocesos a lo largo de toda la ventana.
    for (let n = e.ventana.min; n < e.ventana.max; n++) {
      expect(lleno(n + 1), `${n} → ${n + 1}`).toBeGreaterThan(lleno(n))
    }
  })

  it('reconoce el techo de la ventana', () => {
    const e = ejercicio('flexion-completa')
    expect(anticipar(avanceEn('flexion-completa', e.ventana.max)).enElTecho).toBe(true)
    expect(anticipar(avanceEn('flexion-completa', e.ventana.min)).enElTecho).toBe(false)
  })

  it('detecta el estado de máxima anticipación: la próxima sesión salta', () => {
    // En el techo y con la consolidación ya cumplida, la que viene cambia de
    // ejercicio. Es el único momento del producto que merece gritarse.
    const e = ejercicio('flexion-completa')
    const a = anticipar(
      avanceEn('flexion-completa', e.ventana.max, { sesionesEnObjetivo: CONSOLIDACION }),
    )
    expect(a.sesiones).toBe(1)
    expect(a.aUnaSesion).toBe(true)
    expect(a.cerca).toBe(true)
  })

  it('la gracia después de un cambio de nivel aleja el salto siguiente', () => {
    const e = ejercicio('flexion-completa')
    const conGracia = anticipar(
      avanceEn('flexion-completa', e.ventana.max, {
        sesionesEnObjetivo: CONSOLIDACION,
        graciaRestante: 3,
      }),
    )
    expect(conGracia.sesiones).toBeGreaterThan(1)
    expect(conGracia.aUnaSesion).toBe(false)
  })

  it('en el último eslabón no hay nada que anticipar, y no lo inventa', () => {
    const a = anticipar(avanceEn('flexion-una-mano', 4))
    expect(a.siguiente).toBeNull()
    expect(a.sesiones).toBeNull()
    expect(a.cerca).toBe(false)
    expect(a.aUnaSesion).toBe(false)
  })

  it('cuanto más cerca del techo, menos sesiones faltan', () => {
    const e = ejercicio('flexion-completa')
    const lejos = anticipar(avanceEn('flexion-completa', e.ventana.min)).sesiones!
    const cerca = anticipar(avanceEn('flexion-completa', e.ventana.max - 1)).sesiones!
    expect(cerca).toBeLessThan(lejos)
  })
})

describe('récord personal', () => {
  function sesion(ejercicioId: string, logros: number[]): Sesion {
    return {
      id: `s-${ejercicioId}-${logros.join('-')}`,
      fecha: '2026-01-01',
      finalizadaEn: 1,
      duracionSegundos: 600,
      tipo: 'plan',
      registros: [
        {
          ejercicioId,
          objetivo: { series: logros.length, cantidad: logros[0] ?? 0 },
          series: logros.map((logrado) => ({ logrado })),
        },
      ],
    }
  }

  const historial = [sesion('flexion-completa', [8, 7, 7]), sesion('flexion-completa', [9, 8, 8])]

  it('superar la mejor serie es un récord', () => {
    expect(esRecord(historial, 'flexion-completa', 10)).toBe(true)
  })

  it('igualarla no lo es', () => {
    expect(esRecord(historial, 'flexion-completa', 9)).toBe(false)
  })

  it('la primera vez que hacés un ejercicio no es un récord, es una línea de base', () => {
    // Si lo fuera, cada cambio de eslabón vendría con una celebración vacía.
    expect(esRecord(historial, 'flexion-diamante', 6)).toBe(false)
  })

  it('cero nunca es récord', () => {
    expect(esRecord(historial, 'flexion-completa', 0)).toBe(false)
    expect(esRecord([], 'flexion-completa', 0)).toBe(false)
  })
})

describe('seAbreHoy', () => {
  /** Alguien parado en el techo del eslabón, con la consolidación ya hecha. */
  function aPuntoDeSaltar(): Avance {
    const e = POR_ID.get('flexion-completa')!
    return {
      patron: 'empuje',
      ejercicioId: 'flexion-completa',
      objetivoActual: { series: e.series, cantidad: e.ventana.max },
      senal: 1,
      sesionesEnObjetivo: CONSOLIDACION,
      graciaRestante: 0,
      actualizadoEn: 0,
    }
  }

  it('nombra el eslabón que se abre si la sesión se cumple', () => {
    const abre = seAbreHoy(aPuntoDeSaltar(), empuje, POR_ID, true)
    expect(abre?.id).toBe('flexion-diamante')
  })

  it('se calla cuando faltan más sesiones', () => {
    const e = POR_ID.get('flexion-completa')!
    const lejos: Avance = { ...aPuntoDeSaltar(), objetivoActual: { series: e.series, cantidad: e.ventana.min } }
    expect(seAbreHoy(lejos, empuje, POR_ID, true)).toBeNull()
  })

  it('y se calla en un día que no mueve la progresión, aunque el dato sea correcto', () => {
    // Una sesión de vuelta, una cadena congelada o un estado rojo sostenido.
    // Prometer un cambio de eslabón esos días es mentir con un dato cierto.
    expect(seAbreHoy(aPuntoDeSaltar(), empuje, POR_ID, false)).toBeNull()
  })
})
