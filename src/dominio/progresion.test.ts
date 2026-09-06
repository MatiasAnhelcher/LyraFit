import { describe, expect, it } from 'vitest'
import {
  avanceInicial,
  evaluarSesion,
  porcentajeDeCadena,
  siguienteAvance,
} from './progresion'
import { CADENAS, POR_ID, buscarEjercicio, cadenaDe } from './biblioteca'
import type { Avance, Objetivo, Serie } from './tipos'

const ctxEmpuje = { cadena: cadenaDe('empuje'), ejercicios: POR_ID }
const AHORA = 1_700_000_000_000

function series(...valores: number[]): Serie[] {
  return valores.map((logrado) => ({ logrado }))
}

function avanceEn(ejercicioId: string, objetivo: Objetivo, extra: Partial<Avance> = {}): Avance {
  return {
    patron: 'empuje',
    ejercicioId,
    objetivoActual: objetivo,
    rachaExitos: 0,
    rachaFallos: 0,
    actualizadoEn: AHORA,
    ...extra,
  }
}

describe('evaluarSesion', () => {
  const objetivo: Objetivo = { series: 3, cantidad: 10 }

  it('es éxito cuando todas las series llegan al objetivo', () => {
    expect(evaluarSesion(objetivo, series(10, 10, 10))).toBe('exito')
    expect(evaluarSesion(objetivo, series(12, 11, 10))).toBe('exito')
  })

  it('mira la serie más floja y no el promedio', () => {
    // Promedio 10, pero la última se fue de rango: no es objetivo cumplido.
    expect(evaluarSesion(objetivo, series(14, 14, 2))).toBe('fallo')
  })

  it('es parcial cuando queda cerca', () => {
    expect(evaluarSesion(objetivo, series(9, 8, 8))).toBe('parcial')
  })

  it('es fallo por debajo del sesenta por ciento del objetivo', () => {
    expect(evaluarSesion(objetivo, series(5, 5, 5))).toBe('fallo')
  })

  it('es fallo si faltó más de la mitad de las series', () => {
    expect(evaluarSesion(objetivo, series(12))).toBe('fallo')
  })

  it('no cuenta como éxito si sobra cantidad pero faltan series', () => {
    expect(evaluarSesion(objetivo, series(20, 20))).toBe('parcial')
  })

  it('es fallo cuando no se registró nada', () => {
    expect(evaluarSesion(objetivo, [])).toBe('fallo')
    expect(evaluarSesion(objetivo, series(0, 0, 0))).toBe('fallo')
  })
})

describe('siguienteAvance', () => {
  it('sube la exigencia con un solo éxito, sin cambiar de ejercicio', () => {
    const avance = avanceEn('flexion-completa', { series: 3, cantidad: 5 })
    const { avance: nuevo, cambioDeNivel } = siguienteAvance(avance, 'exito', ctxEmpuje, AHORA)

    expect(cambioDeNivel).toBe(false)
    expect(nuevo.ejercicioId).toBe('flexion-completa')
    expect(nuevo.objetivoActual.cantidad).toBe(6)
    expect(nuevo.rachaExitos).toBe(1)
  })

  it('cambia de ejercicio recién con dos éxitos seguidos', () => {
    const avance = avanceEn('flexion-completa', { series: 3, cantidad: 15 }, { rachaExitos: 1 })
    const { avance: nuevo, cambioDeNivel } = siguienteAvance(avance, 'exito', ctxEmpuje, AHORA)

    expect(cambioDeNivel).toBe(true)
    expect(nuevo.ejercicioId).toBe('flexion-diamante')
    expect(nuevo.objetivoActual).toEqual(buscarEjercicio('flexion-diamante')!.entrada)
    expect(nuevo.rachaExitos).toBe(0)
  })

  it('no supera el objetivo declarado del ejercicio', () => {
    const avance = avanceEn('flexion-completa', { series: 3, cantidad: 15 })
    const { avance: nuevo } = siguienteAvance(avance, 'exito', ctxEmpuje, AHORA)

    expect(nuevo.objetivoActual.cantidad).toBe(15)
  })

  it('en el último eslabón suma volumen en vez de romperse', () => {
    const avance = avanceEn('flexion-una-mano', { series: 3, cantidad: 8 }, { rachaExitos: 1 })
    const { avance: nuevo, cambioDeNivel } = siguienteAvance(avance, 'exito', ctxEmpuje, AHORA)

    expect(cambioDeNivel).toBe(false)
    expect(nuevo.ejercicioId).toBe('flexion-una-mano')
    expect(nuevo.objetivoActual.cantidad).toBe(9)
  })

  it('sostiene el objetivo cuando la sesión sale parcial', () => {
    const avance = avanceEn('flexion-completa', { series: 3, cantidad: 10 }, { rachaExitos: 1 })
    const { avance: nuevo } = siguienteAvance(avance, 'parcial', ctxEmpuje, AHORA)

    expect(nuevo.objetivoActual.cantidad).toBe(10)
    expect(nuevo.rachaExitos).toBe(0)
  })

  it('perdona el primer fallo', () => {
    const avance = avanceEn('flexion-completa', { series: 3, cantidad: 10 })
    const { avance: nuevo } = siguienteAvance(avance, 'fallo', ctxEmpuje, AHORA)

    expect(nuevo.objetivoActual.cantidad).toBe(10)
    expect(nuevo.rachaFallos).toBe(1)
  })

  it('descarga dentro del mismo ejercicio al segundo fallo', () => {
    const avance = avanceEn('flexion-completa', { series: 3, cantidad: 10 }, { rachaFallos: 1 })
    const { avance: nuevo, cambioDeNivel } = siguienteAvance(avance, 'fallo', ctxEmpuje, AHORA)

    expect(cambioDeNivel).toBe(false)
    expect(nuevo.objetivoActual.cantidad).toBe(8)
    expect(nuevo.rachaFallos).toBe(0)
  })

  it('vuelve al ejercicio anterior si ya estaba en la carga mínima', () => {
    const entrada = buscarEjercicio('flexion-diamante')!.entrada
    const avance = avanceEn('flexion-diamante', { ...entrada }, { rachaFallos: 1 })
    const { avance: nuevo, cambioDeNivel } = siguienteAvance(avance, 'fallo', ctxEmpuje, AHORA)

    expect(cambioDeNivel).toBe(true)
    expect(nuevo.ejercicioId).toBe('flexion-completa')
    expect(nuevo.objetivoActual).toEqual(buscarEjercicio('flexion-completa')!.objetivo)
  })

  it('no baja del primer nivel: no hay adónde retroceder', () => {
    const primero = buscarEjercicio('flexion-pared')!
    const avance = avanceEn('flexion-pared', { ...primero.entrada }, { rachaFallos: 1 })
    const { avance: nuevo, cambioDeNivel } = siguienteAvance(avance, 'fallo', ctxEmpuje, AHORA)

    expect(cambioDeNivel).toBe(false)
    expect(nuevo.ejercicioId).toBe('flexion-pared')
    expect(nuevo.objetivoActual).toEqual(primero.entrada)
  })

  it('un éxito corta la racha de fallos', () => {
    const avance = avanceEn('flexion-completa', { series: 3, cantidad: 10 }, { rachaFallos: 1 })
    const { avance: nuevo } = siguienteAvance(avance, 'exito', ctxEmpuje, AHORA)

    expect(nuevo.rachaFallos).toBe(0)
  })

  it('usa incrementos de cinco segundos en los ejercicios de tiempo', () => {
    const ctxCore = { cadena: cadenaDe('core'), ejercicios: POR_ID }
    const avance: Avance = {
      patron: 'core',
      ejercicioId: 'plancha',
      objetivoActual: { series: 3, cantidad: 30 },
      rachaExitos: 0,
      rachaFallos: 0,
      actualizadoEn: AHORA,
    }
    const { avance: nuevo } = siguienteAvance(avance, 'exito', ctxCore, AHORA)

    expect(nuevo.objetivoActual.cantidad).toBe(35)
  })
})

describe('recorrido completo de una cadena', () => {
  it('llega del primer al último ejercicio entrenando siempre bien', () => {
    const cadena = cadenaDe('piernas')
    const ctx = { cadena, ejercicios: POR_ID }
    let avance = avanceInicial(cadena, POR_ID, AHORA)
    const visitados = new Set<string>([avance.ejercicioId])

    // Se simula entrenar cumpliendo siempre el objetivo. El tope evita que un
    // error de lógica convierta el test en un bucle infinito.
    for (let sesion = 0; sesion < 500; sesion++) {
      const ejercicio = buscarEjercicio(avance.ejercicioId)!
      const logrado = Math.max(avance.objetivoActual.cantidad, ejercicio.entrada.cantidad)
      const resultado = evaluarSesion(
        avance.objetivoActual,
        series(logrado, logrado, logrado),
      )
      avance = siguienteAvance(avance, resultado, ctx, AHORA).avance
      visitados.add(avance.ejercicioId)

      if (avance.ejercicioId === cadena.ejercicios.at(-1)) break
    }

    expect(avance.ejercicioId).toBe('pistol-squat')
    expect(visitados.size).toBe(cadena.ejercicios.length)
  })
})

describe('porcentajeDeCadena', () => {
  it('arranca en cero en el primer ejercicio con la carga de entrada', () => {
    const cadena = cadenaDe('empuje')
    const avance = avanceInicial(cadena, POR_ID, AHORA)

    expect(porcentajeDeCadena(avance, cadena, POR_ID)).toBe(0)
  })

  it('crece a medida que se avanza en la cadena', () => {
    const cadena = cadenaDe('empuje')
    const temprano = avanceEn('flexion-inclinada', { series: 3, cantidad: 8 })
    const tarde = avanceEn('flexion-arquera', { series: 3, cantidad: 4 })

    expect(porcentajeDeCadena(tarde, cadena, POR_ID)).toBeGreaterThan(
      porcentajeDeCadena(temprano, cadena, POR_ID),
    )
  })

  it('nunca se pasa de cien', () => {
    const cadena = cadenaDe('empuje')
    const ultimo = buscarEjercicio('flexion-una-mano')!
    const avance = avanceEn('flexion-una-mano', { ...ultimo.objetivo })

    expect(porcentajeDeCadena(avance, cadena, POR_ID)).toBeLessThanOrEqual(100)
  })
})

describe('integridad de la biblioteca', () => {
  it('cada ejercicio de cada cadena existe', () => {
    for (const cadena of CADENAS) {
      for (const id of cadena.ejercicios) {
        expect(buscarEjercicio(id), `falta el ejercicio "${id}"`).toBeDefined()
      }
    }
  })

  it('los niveles están ordenados y sin saltos dentro de cada cadena', () => {
    for (const cadena of CADENAS) {
      const niveles = cadena.ejercicios.map((id) => buscarEjercicio(id)!.nivel)
      expect(niveles).toEqual(niveles.map((_, i) => i + 1))
    }
  })

  it('cada ejercicio pertenece al patrón de su cadena', () => {
    for (const cadena of CADENAS) {
      for (const id of cadena.ejercicios) {
        expect(buscarEjercicio(id)!.patron).toBe(cadena.patron)
      }
    }
  })

  it('la carga de entrada nunca supera al objetivo', () => {
    for (const ejercicio of POR_ID.values()) {
      expect(
        ejercicio.entrada.cantidad,
        `${ejercicio.nombre} arranca por encima de su objetivo`,
      ).toBeLessThanOrEqual(ejercicio.objetivo.cantidad)
    }
  })

  it('no hay ejercicios sueltos fuera de las cadenas', () => {
    const enCadenas = new Set(CADENAS.flatMap((c) => c.ejercicios))
    for (const id of POR_ID.keys()) {
      expect(enCadenas.has(id), `"${id}" no está en ninguna cadena`).toBe(true)
    }
  })

  it('todos tienen técnica y errores comunes cargados', () => {
    for (const ejercicio of POR_ID.values()) {
      expect(ejercicio.tecnica.length, ejercicio.nombre).toBeGreaterThan(0)
      expect(ejercicio.erroresComunes.length, ejercicio.nombre).toBeGreaterThan(0)
    }
  })
})

describe('los textos nombran la unidad correcta', () => {
  it('dice "segundos" en los ejercicios de tiempo', () => {
    const ctxCore = { cadena: cadenaDe('core'), ejercicios: POR_ID }
    const avance: Avance = {
      patron: 'core',
      ejercicioId: 'plancha',
      objetivoActual: { series: 3, cantidad: 30 },
      rachaExitos: 0,
      rachaFallos: 0,
      actualizadoEn: AHORA,
    }
    const { explicacion } = siguienteAvance(avance, 'exito', ctxCore, AHORA)

    expect(explicacion).toContain('35 segundos')
  })

  it('no dice "segundos" en los ejercicios de repeticiones', () => {
    const avance = avanceEn('flexion-completa', { series: 3, cantidad: 8 })
    const { explicacion } = siguienteAvance(avance, 'exito', ctxEmpuje, AHORA)

    expect(explicacion).toContain('9 por serie')
    expect(explicacion).not.toContain('segundos')
  })
})
