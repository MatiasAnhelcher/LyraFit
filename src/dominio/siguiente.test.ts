import { describe, expect, it } from 'vitest'
import {
  dichoDeLoQueViene,
  loQueViene,
  rotuloDeLoQueViene,
  textoDeLoQueViene,
  type Paso,
} from './siguiente'

const PLAN: Paso[] = [
  { nombre: 'Dominadas con banda liviana', bajada: false },
  { nombre: 'Flexiones declinadas', bajada: false },
  { nombre: 'Plancha', bajada: false },
]

const base = { plan: PLAN, enCurso: 0, quedan: 1, hayFuelle: false, nombreDelCierre: 'Plancha' }

describe('qué viene después', () => {
  it('con dos series o más por delante no dice nada', () => {
    // Ahí lo que viene es otra serie del mismo ejercicio. Un dato que aparece
    // en los doce descansos de la sesión deja de ser un dato y pasa a ser
    // mobiliario.
    expect(loQueViene({ ...base, quedan: 2 })).toBeNull()
    expect(loQueViene({ ...base, quedan: 3 })).toBeNull()
  })

  it('con una serie por delante ya nombra lo que viene', () => {
    // Es el aviso previo: uno a tres minutos antes de que haga falta.
    expect(loQueViene({ ...base, quedan: 1 })).toEqual({
      clase: 'ejercicio',
      nombre: 'Flexiones declinadas',
    })
  })

  it('con el ejercicio completo dice lo mismo que dijo en el descanso', () => {
    // Si el aviso previo y la transición dijeran cosas distintas, la función
    // mentiría, que es peor que no tenerla.
    expect(loQueViene({ ...base, quedan: 0 })).toEqual(loQueViene({ ...base, quedan: 1 }))
  })

  it('la bajada se nombra como bajada y no como un ejercicio más', () => {
    const conBajada: Paso[] = [
      { nombre: 'Flexiones declinadas', bajada: false },
      { nombre: 'Flexiones inclinadas', bajada: true },
    ]
    expect(loQueViene({ ...base, plan: conBajada, quedan: 0 })).toEqual({
      clase: 'bajada',
      nombre: 'Flexiones inclinadas',
    })
  })

  it('al final del plan, con fuelle, anuncia el fuelle', () => {
    // Arregla una deshonestidad chica: hoy el botón dice "Terminar" y después
    // aparecen ocho a doce minutos de fuelle.
    expect(loQueViene({ ...base, enCurso: 2, quedan: 0, hayFuelle: true })).toEqual({
      clase: 'fuelle',
    })
  })

  it('al final del plan, sin fuelle, anuncia la serie de cierre', () => {
    expect(loQueViene({ ...base, enCurso: 2, quedan: 0 })).toEqual({
      clase: 'cierre',
      nombre: 'Plancha',
    })
  })

  it('sin fuelle y sin cierre, anuncia el final', () => {
    expect(
      loQueViene({ ...base, enCurso: 2, quedan: 0, nombreDelCierre: null }),
    ).toEqual({ clase: 'preguntas' })
  })

  it('el fuelle le gana al cierre, porque va antes', () => {
    expect(
      loQueViene({ ...base, enCurso: 2, quedan: 0, hayFuelle: true, nombreDelCierre: 'Plancha' }),
    ).toEqual({ clase: 'fuelle' })
  })

  it('un plan de un solo paso no se pasa de largo', () => {
    expect(loQueViene({ ...base, plan: [PLAN[0]!], enCurso: 0, quedan: 0 })).toEqual({
      clase: 'cierre',
      nombre: 'Plancha',
    })
  })

  it('en una sesión corta, cada transición avisa', () => {
    // La corta es una serie por ejercicio, así que `quedan` vale cero en cada
    // paso: el aviso aparece en todas las transiciones, que en siete minutos es
    // exactamente lo que corresponde.
    for (let i = 0; i < PLAN.length - 1; i++) {
      expect(loQueViene({ ...base, enCurso: i, quedan: 0 })).not.toBeNull()
    }
  })

  it('un índice fuera del plan no rompe: cae al final de la sesión', () => {
    expect(loQueViene({ ...base, enCurso: 99, quedan: 0, hayFuelle: true })).toEqual({
      clase: 'fuelle',
    })
  })
})

describe('cómo se escribe y cómo se dice', () => {
  const TODOS = [
    { clase: 'ejercicio', nombre: 'Flexiones declinadas' },
    { clase: 'bajada', nombre: 'Flexiones inclinadas' },
    { clase: 'fuelle' },
    { clase: 'cierre', nombre: 'Plancha' },
    { clase: 'preguntas' },
  ] as const

  it('ninguna variante se queda sin texto, sin rótulo ni sin dicho', () => {
    for (const viene of TODOS) {
      expect(textoDeLoQueViene(viene).length, viene.clase).toBeGreaterThan(0)
      expect(rotuloDeLoQueViene(viene).length, viene.clase).toBeGreaterThan(0)
      expect(dichoDeLoQueViene(viene).length, viene.clase).toBeGreaterThan(0)
    }
  })

  it('el rótulo avisa cuando es una bajada, así el nombre no se alarga', () => {
    expect(rotuloDeLoQueViene({ clase: 'bajada', nombre: 'x' })).toContain('BAJADA')
    expect(rotuloDeLoQueViene({ clase: 'ejercicio', nombre: 'x' })).toBe('DESPUÉS')
  })

  it('lo que se dice arranca con una palabra antes del nombre', () => {
    // Si la frase empieza con el nombre, la primera sílaba se pierde: llega
    // mientras la persona todavía está registrando que alguien habló.
    for (const viene of TODOS) {
      const dicho = dichoDeLoQueViene(viene)
      expect(dicho, viene.clase).toMatch(/^(Sigue|Bajada|Última|Terminaste)/)
    }
  })

  it('lo que se dice entra en lo que la voz dice de una', () => {
    // El tope de `voz.ts` es 80. Una frase más larga se corta a la mitad de una
    // palabra, que es peor que no decir nada.
    for (const viene of TODOS) {
      expect(dichoDeLoQueViene(viene).length, viene.clase).toBeLessThanOrEqual(80)
    }
  })

  it('el texto de pantalla no repite el rótulo', () => {
    // "DESPUÉS · BAJADA" arriba y "Bajada: flexiones inclinadas" abajo sería
    // decir lo mismo dos veces en dos renglones consecutivos.
    for (const viene of TODOS) {
      expect(textoDeLoQueViene(viene).toUpperCase(), viene.clase).not.toContain('DESPUÉS')
    }
  })
})
